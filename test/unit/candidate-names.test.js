'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { canonicalVSIXName, candidateVSIXName } = require('../../scripts/candidate-names.cjs');
const manifest = {name: 'binary-markdown', version: '0.4.1'};
const ci = {ref: 'refs/heads/main', runNumber: 125, runAttempt: 1};

test('local and official filenames retain the numeric product version', () => {
    assert.equal(canonicalVSIXName(manifest), 'binary-markdown-0.4.1.vsix');
    assert.equal(candidateVSIXName(manifest, null), 'binary-markdown-0.4.1.vsix');
    assert.equal(manifest.version, '0.4.1');
});
test('development filenames distinguish main, PRs, branches and rerun attempts', () => {
    assert.equal(candidateVSIXName(manifest, ci), 'binary-markdown-0.4.1-dev-main-build125-attempt1.vsix');
    assert.equal(candidateVSIXName(manifest, {...ci, ref: 'refs/pull/98/merge'}),
        'binary-markdown-0.4.1-dev-pr98-build125-attempt1.vsix');
    assert.equal(candidateVSIXName(manifest, {...ci, ref: 'refs/heads/feat/Spellcheck'}),
        'binary-markdown-0.4.1-dev-feat-spellcheck-build125-attempt1.vsix');
    assert.equal(candidateVSIXName(manifest, {...ci, ref: 'refs/tags/v0.4.1'}),
        'binary-markdown-0.4.1-dev-tag-v0.4.1-build125-attempt1.vsix');
    assert.notEqual(candidateVSIXName(manifest, ci), candidateVSIXName(manifest, {...ci, runAttempt: 2}));
    assert.notEqual(candidateVSIXName(manifest, ci), candidateVSIXName(manifest, {...ci, runNumber: 126}));
});
test('branch names produce bounded portable filenames without losing full metadata', () => {
    for (const ref of ['refs/heads/文件|[x](evil)', 'refs/heads/' + 'long/'.repeat(100), 'refs/heads/..']) {
        const input = {...ci, ref};
        const name = candidateVSIXName(manifest, input);
        assert.match(name, /^binary-markdown-0\.4\.1-dev-[a-z0-9._-]+-build125-attempt1\.vsix$/);
        assert.ok(name.length < 120);
        assert.equal(input.ref, ref);
    }
});
test('malformed versions, paths and counters cannot become filenames', () => {
    assert.throws(() => candidateVSIXName({...manifest, name: '../escape'}, ci));
    assert.throws(() => candidateVSIXName({...manifest, version: '0.4.1-dev'}, ci));
    for (const overrides of [{runNumber: 0}, {runNumber: '125'}, {runAttempt: -1},
        {runAttempt: Number.MAX_SAFE_INTEGER + 1}, {ref: 'main'}, {ref: 'refs/pull/0/merge'}]) {
        assert.throws(() => candidateVSIXName(manifest, {...ci, ...overrides}));
    }
});
