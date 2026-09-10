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
