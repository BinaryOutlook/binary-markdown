'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { verifyRun, renderReleaseNotes, verifyValidationJobs } = require('./release-candidate');
const { command, api, optionalApi, pages, git, currentMain, assertMain, assertRepository, REPOSITORY } = require('./release-github.cjs');

async function promote({ runId, publish = false, beforePublish = async () => {} }) {
    assertRepository();
    assert.match(String(runId), /^[1-9][0-9]*$/);
    const source = currentMain();
    const run = api(`actions/runs/${runId}`);
    const candidate = verifyRun(run, REPOSITORY, source);
    verifyValidationJobs(pages(`actions/runs/${runId}/attempts/${candidate.attempt}/jobs?per_page=100`, 'jobs'));
    git('fetch', 'origin', 'main', '--tags');
    assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'Release checkout must be clean');
    git('checkout', '--detach', source);
    const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
    const tag = 'v' + version;
    const notes = fs.readFileSync(`release-notes/${version}.md`, 'utf8');
    assert.equal(optionalApi(`releases/tags/${tag}`), null, 'A release or draft already exists; do not replace it');
    assert.equal(optionalApi(`git/ref/tags/${tag}`), null, 'A tag already exists; do not move it');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vsix-release-'));
    try {
        const dist = path.join(directory, 'dist');
        const evidence = path.join(directory, 'validation');
        fs.mkdirSync(dist);
        fs.mkdirSync(evidence);
        command('gh', ['run', 'download', String(runId), '--repo', REPOSITORY,
            '--name', candidate.artifact, '--dir', dist]);
        command(process.execPath, ['scripts/release-candidate.js', 'verify', dist, source]);
        for (const lane of ['ubuntu', 'macos', 'windows', 'vscode-minimum']) {
            const name = `validation-${lane}-${source}-${candidate.attempt}`;
            const target = path.join(evidence, name);
            command('gh', ['run', 'download', String(runId), '--repo', REPOSITORY, '--name', name, '--dir', target]);
            assert.ok(fs.statSync(path.join(target, 'artifact-audit.json')).isFile());
        }
        fs.writeFileSync(path.join(evidence, 'validation-run.json'), JSON.stringify(run, null, 2) + '\n');
        command('git', ['archive', '--format=tar.gz', `--prefix=binary-markdown-${version}/`,
            '-o', path.join(dist, `binary-markdown-${version}-source.tar.gz`), source]);
        command('tar', ['-czf', path.join(dist, `binary-markdown-${version}-validation.tar.gz`), '-C', evidence, '.']);
        const hashes = fs.readdirSync(dist).sort().filter(file => /\.(vsix|json|tar\.gz)$/.test(file)).map(file =>
            createHash('sha256').update(fs.readFileSync(path.join(dist, file))).digest('hex') + '  ' + file);
        fs.writeFileSync(path.join(dist, 'SHA256SUMS'), hashes.join('\n') + '\n');
        const notesFile = path.join(directory, 'release-notes.md');
        fs.writeFileSync(notesFile, renderReleaseNotes(notes, source) +
            `\nSource commit: \`${source}\`\n\nValidation: https://github.com/${REPOSITORY}/actions/runs/${runId} (attempt ${candidate.attempt}).\n\nThe attached VSIX is the exact artifact validated by that run. Check \`SHA256SUMS\` before installation.\n`);
        assertMain(source);
        if (publish) await beforePublish();
        // Upload privately first. A failed upload leaves a draft for inspection,
        // never a public release with a partially uploaded asset set.
        command('gh', ['release', 'create', tag, ...fs.readdirSync(dist).sort().map(file => path.join(dist, file)),
            '--repo', REPOSITORY, '--draft', '--target', source,
            '--title', `Binary Markdown ${version}`, '--notes-file', notesFile]);
        if (publish) {
            assertMain(source);
            await beforePublish();
            command('gh', ['release', 'edit', tag, '--repo', REPOSITORY, '--draft=false', '--latest']);
        }
        const released = api(`releases/tags/${tag}`);
        assert.equal(released.draft, !publish);
        assert.equal(released.prerelease, false);
        console.log(`${publish ? 'Published' : 'Prepared draft'} ${released.html_url} from ${source}`);
        if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
            `\n${publish ? 'Published' : 'Prepared draft'} [${tag}](${released.html_url}) from \`${source}\`.\n`);
        return released;
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
}
if (require.main === module) promote({ runId: process.env.VALIDATION_RUN }).catch(error => {
    console.error(error.message);
    if (error.stderr) console.error(String(error.stderr));
    process.exitCode = 1;
});
module.exports = { promote };
