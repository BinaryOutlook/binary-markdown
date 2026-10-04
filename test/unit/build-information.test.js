'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function copy(stored) {
    let clipboard;
    const exports = {};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../out/build-info.js'), 'utf8'), {
        exports,
        require(id) {
            if (id === 'vscode') return {
                version: '1.85.0', env: { remoteName: undefined, clipboard: { writeText: async text => { clipboard = text; } } },
                l10n: { t: text => text }, window: { showInformationMessage() {} },
            };
            if (id === 'os') return { platform: () => 'linux', arch: () => 'x64' };
            if (id === 'fs/promises') return { readFile: async () => {
                if (stored === null) throw new Error('No stamp');
                return stored;
            } };
            throw new Error(id);
        },
    });
    await exports.copyBuildInformation({
        extension: { packageJSON: { version: '0.2.0' } }, asAbsolutePath: () => '/private/path/build-info.json',
    });
    return clipboard;
}
test('copied build report identifies the packaged source and local modifications without document paths', async () => {
    const report = await copy(JSON.stringify({ sourceCommit: 'a'.repeat(40), sourceTree: 'b'.repeat(40), sourceKind: 'git', dirty: true }));
    assert.match(report, /Binary Markdown 0\.2\.0/);
    assert.ok(report.includes('Source commit: ' + 'a'.repeat(40)));
    assert.match(report, /Local source changes: yes/);
    assert.match(report, /Host: linux x64/);
    assert.doesNotMatch(report, /\/private\/path/);
});
test('missing or damaged build stamps remain explicitly unknown', async () => {
    for (const stamp of [null, '{broken', 'null', '[]']) {
        const report = await copy(stamp);
        assert.match(report, /Source commit: unknown/);
        assert.match(report, /Local source changes: unknown/);
    }
});

test('copied CI report distinguishes same-version builds and rerun attempts', async () => {
    for (const attempt of [1, 2]) {
        const report = await copy(JSON.stringify({version: '0.4.1', ci: {
            runId: 123456, runNumber: 42, runAttempt: attempt,
            runUrl: 'https://github.com/BinaryOutlook/binary-markdown/actions/runs/123456',
            ref: 'refs/heads/feature',
        }}));
        assert.match(report, /Binary Markdown 0\.4\.1/);
        assert.match(report, /CI build number: 42/);
        assert.match(report, /CI run ID: 123456/);
        assert.ok(report.includes('CI run attempt: ' + attempt));
        assert.ok(report.includes('CI run URL: https://github.com/BinaryOutlook/binary-markdown/actions/runs/123456'));
        assert.match(report, /CI ref: refs\/heads\/feature/);
    }
});
test('local and older packages report absent CI metadata honestly', async () => {
    for (const info of [{}, {ci: null}]) {
        const report = await copy(JSON.stringify(info));
        assert.match(report, /CI build number: not recorded/);
        assert.match(report, /CI run ID: not recorded/);
        assert.match(report, /CI run attempt: not recorded/);
        assert.match(report, /CI run URL: not recorded/);
    }
});
