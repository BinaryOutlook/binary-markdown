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
