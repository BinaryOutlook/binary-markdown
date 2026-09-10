'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

function verifyRun(run, repository, mainCommit) {
    assert.match(mainCommit, /^[0-9a-f]{40}$/);
    assert.equal(run.path, '.github/workflows/ci-vsix.yml');
    assert.equal(run.repository.full_name, repository);
    assert.equal(run.head_repository.full_name, repository);
    assert.equal(run.head_branch, 'main');
    assert.equal(run.head_sha, mainCommit, 'Select a successful build of the current main revision');
    assert.equal(run.event, 'push', 'PR and manually supplied artifacts cannot become official releases');
    assert.equal(run.status, 'completed');
    assert.equal(run.conclusion, 'success');
    assert.ok(Number.isSafeInteger(run.id) && run.id > 0);
    assert.ok(Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0);
    return { source: run.head_sha, artifact: `vsix-candidate-${run.head_sha}-${run.run_attempt}`, attempt: run.run_attempt };
}

function verifyCandidate(directory, manifest, sourceCommit) {
    assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
    assert.equal(manifest.name, 'binary-markdown');
    assert.equal(manifest.publisher, 'BinaryOutlook');
    assert.equal(manifest.license, 'AGPL-3.0-or-later');
    const name = manifest.name + '-' + manifest.version + '.vsix';
    assert.deepEqual(fs.readdirSync(directory).sort(), [name, name + '.build-info.json', name + '.sha256'].sort(), 'A candidate contains only its VSIX, checksum and identity');
    const bytes = fs.readFileSync(path.join(directory, name));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const info = JSON.parse(fs.readFileSync(path.join(directory, name + '.build-info.json'), 'utf8'));
    assert.equal(fs.readFileSync(path.join(directory, name + '.sha256'), 'utf8'), sha256 + '  ' + name + '\n');
    for (const key of ['version', 'name', 'license']) assert.equal(info[key], manifest[key]);
    assert.equal(info.sourceCommit, sourceCommit);
    assert.equal(info.sourceKind, 'git');
    assert.equal(info.dirty, false);
    assert.equal(info.repository, 'https://github.com/BinaryOutlook/binary-markdown');
    assert.equal(info.artifact, name);
    assert.equal(info.sha256, sha256);
    return { name, sha256, info };
}

if (require.main === module) {
    const [mode, first, second] = process.argv.slice(2);
    if (mode === 'inspect') {
        const result = verifyRun(JSON.parse(fs.readFileSync(first, 'utf8')), process.env.GITHUB_REPOSITORY, second);
        for (const [key, value] of Object.entries(result)) console.log(key + '=' + value);
    } else if (mode === 'verify') {
        const result = verifyCandidate(first, require('../package.json'), second);
        const packaged = JSON.parse(execFileSync('unzip', ['-p', path.join(first, result.name), 'extension/build-info.json'], { encoding: 'utf8' }));
        for (const [key, value] of Object.entries(packaged)) assert.deepEqual(result.info[key], value, key);
        assert.equal(packaged.sourceTree, execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim());
        console.log('Verified candidate ' + result.name + ': ' + result.sha256);
    } else throw new Error('Use inspect <run.json> <main-sha> or verify <candidate-directory> <source-sha>.');
}

module.exports = { verifyRun, verifyCandidate };
