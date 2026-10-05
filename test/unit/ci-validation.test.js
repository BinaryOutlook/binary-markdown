'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const { validationMode, verifyGate, evidenceNames } = require('../../scripts/ci-validation.cjs');
const { changedPullFiles } = require('../../.github/scripts/ci-scope.cjs');

test('only allowlisted prose changes take the PR fast path', () => {
    const docs = ['README.md', 'docs/testing/README.md', 'reports/validation/result.md', 'release-notes/0.4.1.md'];
    assert.equal(validationMode('pull_request', 'refs/pull/1/merge', docs), 'docs');
    for (const file of ['src/editor.js', 'test/specs/editor.spec.ts', 'package-lock.json', '.github/workflows/ci-vsix.yml',
        'scripts/ci-validation.cjs', '.gitignore', 'docs/../src/editor.md', 'docs/example.js', 'docs/data.json',
        'media/export-help.md', 'README.md\nsrc/editor.js']) {
        assert.equal(validationMode('pull_request', 'refs/pull/1/merge', [...docs, file]), 'full', file);
    }
    for (const files of [[], undefined]) assert.equal(validationMode('pull_request', 'refs/pull/1/merge', files), 'full');
});

test('main, explicit dispatch and unknown events always validate fully; branch pushes only build', () => {
    for (const event of ['push', 'workflow_dispatch', 'merge_group', 'unknown']) {
        assert.equal(validationMode(event, 'refs/heads/main', ['README.md']), 'full');
    }
    assert.equal(validationMode('workflow_dispatch', 'refs/heads/topic', ['README.md']), 'full');
    assert.equal(validationMode('push', 'refs/heads/topic', ['src/editor.js']), 'build');
    assert.equal(validationMode('push', 'refs/tags/v0.4.1', ['README.md']), 'full');
});

test('the merge gate fails closed for failed, cancelled, missing and unexpectedly skipped jobs', () => {
    for (const mode of ['full', 'docs']) {
        const good = { mode, scope: 'success', package: 'success', native: mode === 'full' ? 'success' : 'skipped',
            browser: mode === 'full' ? 'success' : 'skipped' };
        verifyGate(good);
        for (const key of ['scope', 'package', 'native', 'browser']) {
            for (const result of ['failure', 'cancelled', '', undefined, key === 'scope' || key === 'package' || mode === 'full' ? 'skipped' : 'success']) {
                assert.throws(() => verifyGate({ ...good, [key]: result }), `${mode} ${key} ${result}`);
            }
        }
        for (const other of ['build', '', undefined]) assert.throws(() => verifyGate({ ...good, mode: other }));
    }
});

test('full evidence includes all four native lanes and all nine browser shards for one attempt', () => {
    const names = evidenceNames('a'.repeat(40), 2);
    assert.equal(new Set(names).size, 13);
    for (const platform of ['ubuntu', 'macos', 'windows']) for (const shard of [1, 2, 3]) {
        assert.ok(names.includes(`browser-${platform}-${shard}-${'a'.repeat(40)}-2`));
    }
    assert.ok(names.includes(`validation-vscode-minimum-${'a'.repeat(40)}-2`));
});

test('the executed gate retains package identity and reports failures without claiming validation', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-gate-test-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    for (const [mode, native, browser, passed] of [
        ['full', 'success', 'success', true], ['docs', 'skipped', 'skipped', true],
        ['full', 'success', 'failure', false], ['build', 'skipped', 'skipped', false],
    ]) {
        const summary = path.join(directory, `${mode}-${browser}.md`);
        const run = spawnSync(process.execPath, [path.resolve(__dirname, '../../.github/scripts/ci-gate.cjs')], {
            encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: summary, VALIDATION_MODE: mode,
                SCOPE_RESULT: 'success', PACKAGE_RESULT: 'success', NATIVE_RESULT: native, BROWSER_RESULT: browser,
                PACKAGE_FILE: 'candidate.vsix', SOURCE: 'a'.repeat(40), CANDIDATE: 'candidate-1', SHA256: 'b'.repeat(64),
                ARTIFACT_URL: 'https://github.com/example/project/actions/runs/123/artifacts/456' },
        });
        assert.equal(run.status === 0, passed, run.stderr);
        const output = fs.readFileSync(summary, 'utf8');
        assert.match(output, passed ? /VSIX validation passed/ : /VSIX validation did not pass/);
        assert.ok(output.includes('a'.repeat(40)) && output.includes('candidate.vsix'));
        assert.match(output, /Download the development package/);
        if (mode === 'docs') assert.match(output, /not full release validation/);
    }
});

test('workflow matrices cover every required platform and shard with independent browser jobs', () => {
    const workflow = require('js-yaml').load(fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/ci-vsix.yml'), 'utf8'));
    const { scope, package: packaged, validate, browser, ready } = workflow.jobs;
    assert.deepEqual(validate.strategy.matrix.include.map(item => item.label).sort(), ['macos', 'ubuntu', 'vscode-minimum', 'windows']);
    assert.deepEqual(browser.strategy.matrix.platform.map(item => item.label).sort(), ['macos', 'ubuntu', 'windows']);
    assert.deepEqual(browser.strategy.matrix.shard, [1, 2, 3]);
    assert.deepEqual(browser.needs, ['scope', 'package']);
    assert.deepEqual(validate.needs, ['scope', 'package']);
    assert.deepEqual(ready.needs, ['scope', 'package', 'validate', 'browser']);
    assert.equal(packaged.needs, 'scope');
    assert.match(ready.if, /always\(\)/);
    assert.match(ready.if, /github\.ref == 'refs\/heads\/main'/);
    assert.equal(ready.name, "${{ github.event_name == 'push' && github.ref != 'refs/heads/main' && 'Branch build only' || 'VSIX validation' }}");
    assert.equal(browser.if, "needs.scope.outputs.mode == 'full'");
    assert.equal(validate.if, browser.if);
    assert.equal(scope.steps[0].with['fetch-depth'], 2);
    for (const step of browser.steps.filter(item => item.name?.startsWith('Browser regressions'))) {
        assert.match(step.run, /--retries=0/);
        assert.match(step.run, /--shard=\$\{\{ matrix\.shard \}\}\/3/);
    }
    assert.ok(browser.steps.some(step => step.name === 'Retain browser evidence' && step.if === 'always()'));
    assert.ok(!validate.steps.some(step => /playwright test/.test(step.run || '')));
});

test('browser discovery never repeats generated JavaScript beside TypeScript sources', () => {
    const directory = path.resolve(__dirname, '../specs');
    const files = fs.readdirSync(directory);
    const duplicates = files.filter(file => file.endsWith('.spec.js') && files.includes(file.replace(/\.js$/, '.ts')));
    assert.deepEqual(duplicates, []);
    assert.ok(files.includes('backspace-nested-list.spec.js'), 'Keep the independent JavaScript suite');
});

test('PR classification considers earlier code edits even when the tip commit changes only documentation', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-scope-test-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    git(['init', '-b', 'main']);
    git(['config', 'user.name', 'CI Fixture']); git(['config', 'user.email', 'ci@example.invalid']);
    const commit = (file, content) => { fs.writeFileSync(path.join(directory, file), content); git(['add', file]); git(['commit', '-m', 'fixture']); };
    commit('README.md', 'baseline'); const base = git(['rev-parse', 'HEAD']).trim();
    git(['checkout', '-b', 'topic']); commit('runtime.js', 'changed'); commit('README.md', 'docs tip');
    git(['checkout', 'main']); git(['merge', '--no-ff', 'topic', '-m', 'PR merge']);
    const source = git(['rev-parse', 'HEAD']).trim();
    const files = changedPullFiles({ pull_request: { base: { sha: base } } }, source, git);
    assert.deepEqual(files.sort(), ['README.md', 'runtime.js']);
    assert.equal(validationMode('pull_request', 'refs/pull/1/merge', files), 'full');
    assert.throws(() => changedPullFiles({ pull_request: { base: { sha: base } } }, base, git));
    assert.throws(() => changedPullFiles({ pull_request: { base: { sha: 'b'.repeat(40) } } }, source, git));
    git(['checkout', '-b', 'documentation', base]); commit('README.md', 'documentation only');
    git(['checkout', '-b', 'clean-base', base]); git(['merge', '--no-ff', 'documentation', '-m', 'Docs PR merge']);
    const docs = changedPullFiles({ pull_request: { base: { sha: base } } }, git(['rev-parse', 'HEAD']).trim(), git);
    assert.equal(validationMode('pull_request', 'refs/pull/2/merge', docs), 'docs');
});
