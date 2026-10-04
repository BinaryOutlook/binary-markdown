'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildIdentity, assertReleaseIdentity, sourceRepository } = require('../../scripts/build-identity');

function directory(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'binary-build-id-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
        name: 'binary-markdown', version: '0.2.0', license: 'AGPL-3.0-or-later',
        repository: { url: 'https://github.com/BinaryOutlook/binary-markdown' },
    }));
    return root;
}
function git(root, ...args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function checkout(t) {
    const root = directory(t);
    git(root, 'init', '-q');
    git(root, 'add', 'package.json');
    git(root, '-c', 'user.name=Build test', '-c', 'user.email=build@example.invalid', 'commit', '-qm', 'fixture');
    return root;
}
test('build identity identifies the exact clean checkout and its modifications', t => {
    const root = checkout(t);
    const info = buildIdentity(root, {});
    assert.equal(info.sourceCommit, git(root, 'rev-parse', 'HEAD'));
    assert.equal(info.sourceTree, git(root, 'rev-parse', 'HEAD^{tree}'));
    assert.equal(info.dirty, false);
    assert.doesNotThrow(() => assertReleaseIdentity(info));
    fs.writeFileSync(path.join(root, 'local-change.md'), 'local');
    const changed = buildIdentity(root, {});
    assert.equal(changed.dirty, true);
    assert.throws(() => assertReleaseIdentity(changed), /clean Git checkout/);
});
test('source archives remain explicitly unidentified unless a revision is supplied', t => {
    const root = directory(t);
    const info = buildIdentity(root, {});
    assert.equal(info.sourceKind, 'unknown');
    assert.equal(info.sourceCommit, null);
    assert.equal(info.dirty, null);
    const provided = buildIdentity(root, { BINARY_MARKDOWN_SOURCE_COMMIT: 'a'.repeat(40) });
    assert.equal(provided.sourceKind, 'provided');
    assert.throws(() => assertReleaseIdentity(provided), /clean Git checkout/);
    assert.throws(() => buildIdentity(root, { BINARY_MARKDOWN_SOURCE_COMMIT: 'main' }), /full lowercase Git SHA/);
});
test('an archive inside an unrelated checkout cannot inherit its parent revision', t => {
    const parent = checkout(t);
    const root = path.join(parent, 'archive');
    fs.mkdirSync(root);
    fs.copyFileSync(path.join(parent, 'package.json'), path.join(root, 'package.json'));
    assert.equal(buildIdentity(root, {}).sourceKind, 'unknown');
});
test('source repository identity strips credentials and supports ordinary SSH origins', () => {
    assert.equal(sourceRepository('https://secret:credential@github.com/owner/repo.git'), 'https://github.com/owner/repo');
    assert.equal(sourceRepository('git@github.com:owner/repo.git'), 'https://github.com/owner/repo');
    assert.equal(sourceRepository('file:///private/source'), null);
    assert.equal(sourceRepository('not a URL'), null);
});

const ciEnvironment = (overrides = {}) => ({
    GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'BinaryOutlook/binary-markdown',
    GITHUB_RUN_ID: '123456', GITHUB_RUN_NUMBER: '42', GITHUB_RUN_ATTEMPT: '2',
    GITHUB_SERVER_URL: 'https://github.com', GITHUB_REF: 'refs/pull/12/merge',
    GITHUB_EVENT_NAME: 'pull_request', ...overrides,
});
test('CI identity records rerun identity without replacing the checked-out source or version', t => {
    const root = checkout(t);
    const info = buildIdentity(root, ciEnvironment({ GITHUB_SHA: 'f'.repeat(40) }));
    assert.equal(info.sourceCommit, git(root, 'rev-parse', 'HEAD'));
    assert.equal(info.version, '0.2.0');
    assert.deepEqual(info.ci, {
        provider: 'github-actions', repository: 'BinaryOutlook/binary-markdown',
        runId: 123456, runNumber: 42, runAttempt: 2,
        runUrl: 'https://github.com/BinaryOutlook/binary-markdown/actions/runs/123456',
        event: 'pull_request', ref: 'refs/pull/12/merge',
    });
    assert.equal(buildIdentity(root, ciEnvironment({GITHUB_ACTIONS: 'false'})).ci, null);
    assert.equal(buildIdentity(root, {}).ci, null);
});
test('partial or malformed CI identity fails instead of inventing an attributable build', t => {
    const root = checkout(t);
    for (const overrides of [
        {GITHUB_RUN_ID: undefined}, {GITHUB_RUN_ID: '../123'}, {GITHUB_RUN_NUMBER: '0'},
        {GITHUB_RUN_ATTEMPT: '-2'}, {GITHUB_RUN_ID: '9007199254740992'},
        {GITHUB_REPOSITORY: '../repo'}, {GITHUB_REPOSITORY: 'owner/..'},
        {GITHUB_SERVER_URL: 'http://github.com'}, {GITHUB_SERVER_URL: 'https://token@github.com'},
        {GITHUB_SERVER_URL: 'https://github.com/path'}, {GITHUB_REF: 'main'},
        {GITHUB_REF: 'refs/heads/branch\nInjected: value'},
    ]) assert.throws(() => buildIdentity(root, ciEnvironment(overrides)), undefined, Object.keys(overrides).join(','));
});
