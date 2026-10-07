'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { readEditorRuntime, markers } = require('../../scripts/bundle-editor.cjs');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

test('compiled editor retains every host substitution and includes its browser helper APIs', () => {
    const runtime = readEditorRuntime(path.resolve(__dirname, '../..'));
    for (const marker of markers) assert.equal(runtime.split(marker).length - 1, 1, marker);
    for (const api of ['BinaryMath', 'BinaryTablePlacement', 'BinaryWorkspaceUi', 'BinaryTableToolbar']) assert.ok(runtime.includes(api), api);
});

test('browser fixture loading rejects stale source and overwritten runtime bytes', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-bundle-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, 'out/webview'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    const source = 'original source', runtime = 'original runtime';
    fs.writeFileSync(path.join(root, 'src/editor.js'), source);
    fs.writeFileSync(path.join(root, 'out/webview/editor.js'), runtime);
    fs.writeFileSync(path.join(root, 'out/webview/editor.bundle.json'), JSON.stringify({
        runtimeSha256: digest(runtime), inputs: [{ file: 'src/editor.js', sha256: digest(source) }]
    }));
    assert.equal(readEditorRuntime(root), runtime);
    fs.writeFileSync(path.join(root, 'src/editor.js'), 'changed source');
    assert.throws(() => readEditorRuntime(root), /stale.*npm run compile/);
    fs.writeFileSync(path.join(root, 'src/editor.js'), source);
    fs.writeFileSync(path.join(root, 'out/webview/editor.js'), 'overwritten entry');
    assert.throws(() => readEditorRuntime(root), /bundle changed.*npm run compile/);
});
