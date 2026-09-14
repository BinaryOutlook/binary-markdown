'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { latestOfficialRelease, isReleaseRelevant, patchEligible, planRelease, patchFiles, nextPatch } = require('../../scripts/release-policy.cjs');

const published = '2026-09-11T14:51:40Z';
const threshold = Date.parse(published) + 3 * 86400000;
const release = (overrides = {}) => ({ id: 1, tag_name: 'v0.2.1', draft: false, prerelease: false,
    published_at: published, assets: [{ name: 'binary-markdown-0.2.1.vsix', state: 'uploaded', size: 100 }], ...overrides });
const change = (message = 'fix: preserve document edits', files = ['src/editor.ts']) => ({ sha: 'a'.repeat(40), message, files });
const input = (overrides = {}) => ({ config: { enabled: true, minimumDays: 3, branch: 'main' },
    releases: [release()], version: '0.2.1', hasNotes: true, changes: [change()], now: threshold, ...overrides });

test('three-day minimum is inclusive and uses complete 24-hour days', () => {
    assert.equal(planRelease(input({ now: threshold - 1 })).eligible, false);
    assert.equal(planRelease(input()).eligible, true);
    assert.equal(planRelease(input()).eligibleAt, '2026-09-14T14:51:40.000Z');
    assert.equal(planRelease(input()).version, '0.2.2');
});
test('successful manual publication resets the interval; drafts and other channels do not', () => {
    const manual = release({ id: 2, published_at: '2026-09-13T00:00:00Z', created_at: '2020-01-01T00:00:00Z' });
    const ignored = [release({ id: 3, draft: true }), release({ id: 4, prerelease: true }),
        release({ id: 5, tag_name: 'electron-v0.2.1' }), release({ id: 6, assets: [] }),
        release({ id: 7, assets: [{ name: 'binary-markdown-0.2.1.vsix', state: 'new', size: 0 }] })];
    assert.equal(latestOfficialRelease([...ignored, release(), manual]).id, 2);
    const plan = planRelease(input({ releases: [release(), manual, ...ignored] }));
    assert.equal(plan.eligible, false);
    assert.equal(plan.eligibleAt, '2026-09-16T00:00:00.000Z');
});
test('disabled policy, missing baseline, unchanged source and non-runtime changes cannot release', () => {
    for (const overrides of [{ config: { enabled: false, minimumDays: 3, branch: 'main' } },
        { releases: [] }, { changes: [] }, { changes: [change('docs: explain exports', ['docs/export.md'])] },
        { changes: [change('fix: desktop window', ['electron/main.js'])] }]) {
        assert.equal(planRelease(input(overrides)).eligible, false);
    }
    assert.equal(isReleaseRelevant('package.nls.zh-cn.json'), true);
    assert.equal(isReleaseRelevant('.github/workflows/ci-vsix.yml'), false);
});
test('features, breaking changes and unknown runtime titles require a version decision', () => {
    for (const message of ['feat: add new export', 'fix!: replace format', 'fix: repair\n\nBREAKING CHANGE: new API',
        'Improve exports', 'Merge pull request #12 from fork/topic\n\nfeat: add format']) {
        assert.equal(planRelease(input({ changes: [change(message)] })).eligible, false, message);
    }
    for (const message of ['fix(export): repair paths', 'perf: render faster', 'chore(deps): update dependency',
        'Merge pull request #12 from fork/topic\n\nfix: preserve edits']) assert.equal(patchEligible(change(message)), true);
});
test('a maintainer-selected unreleased version uses its notes and never gets bumped again', () => {
    const plan = planRelease(input({ version: '0.3.0', changes: [change('feat: add format')] }));
    assert.equal(plan.action, 'publish');
    assert.equal(plan.version, '0.3.0');
    assert.equal(planRelease(input({ version: '0.3.0', hasNotes: false })).eligible, false);
    assert.equal(planRelease(input({ version: '0.1.9' })).eligible, false);
    assert.equal(planRelease(input({ releases: [release(), release({ tag_name: 'v0.2.2', draft: true })] })).eligible, false);
});
test('patch increments do not roll over and version metadata stays aligned', () => {
    assert.equal(nextPatch('0.2.9'), '0.2.10');
    assert.throws(() => nextPatch('0.2.01'));
    const files = { 'CHANGELOG.md': '# Changelog\n\n## 0.2.9\n', 'release-notes/README.md': '# Notes\n' };
    for (const name of ['package.json', 'electron/package.json']) files[name] = JSON.stringify({ name: 'app', version: '0.2.9' }, null, 4) + '\n';
    for (const name of ['package-lock.json', 'electron/package-lock.json']) files[name] = JSON.stringify({ version: '0.2.9', packages: { '': { version: '0.2.9' }, dep: { version: '1.0.0' } } }, null, 2) + '\n';
    const updated = patchFiles(files, '0.2.9', '0.2.10', [change()]);
    assert.equal(Object.keys(updated).length, 7);
    for (const name of ['package.json', 'package-lock.json', 'electron/package.json', 'electron/package-lock.json']) assert.equal(JSON.parse(updated[name]).version, '0.2.10');
    assert.equal(JSON.parse(updated['package-lock.json']).packages[''].version, '0.2.10');
    assert.equal(JSON.parse(updated['package-lock.json']).packages.dep.version, '1.0.0');
    assert.match(updated['package.json'], /\n    "name"/);
    assert.match(updated['CHANGELOG.md'], /## 0.2.10/);
    assert.match(updated['release-notes/0.2.10.md'], /commit\/a{40}/);
    assert.throws(() => patchFiles(files, '0.2.9', '0.3.0', [change()]));
    assert.throws(() => patchFiles({ ...files, 'package.json': '{"version":"0.2.8"}' }, '0.2.9', '0.2.10', [change()]));
});
