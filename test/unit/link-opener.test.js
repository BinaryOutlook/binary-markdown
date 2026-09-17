const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Model the VS Code boundary; installed-editor tests exercise real URI and filesystem APIs.
function fixture() {
    const uri = (scheme, resourcePath, authority = '') => ({
        scheme, path: resourcePath, authority,
        with(values) { return uri(values.scheme || this.scheme, values.path || this.path, values.authority ?? this.authority); }
    });
    const calls = { stats: [], opens: [], copies: [], notices: [], errors: [] };
    const state = { workspace: uri('file', '/project'), statError: null, openError: null, copyError: null, choice: undefined };
    const vscode = {
        Uri: {
            file: value => uri('file', value),
            parse: value => { const u = new URL(value); return uri(u.protocol.slice(0, -1), decodeURIComponent(u.pathname), u.hostname); },
            joinPath: (base, value) => uri(base.scheme, path.posix.join(base.path, value), base.authority)
        },
        workspace: {
            getWorkspaceFolder: () => state.workspace && ({ uri: state.workspace }),
            fs: { stat: async value => { calls.stats.push(value); if (state.statError) throw state.statError; return { type: 2 }; } }
        },
        commands: { executeCommand: async (...args) => { calls.opens.push(args); if (state.openError) throw state.openError; } },
        env: { clipboard: { writeText: async value => { if (state.copyError) throw state.copyError; calls.copies.push(value); } } },
        window: {
            showWarningMessage: async (...args) => { calls.notices.push(args); return state.choice; },
            showErrorMessage: async value => { calls.errors.push(value); }
        }
    };
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname, '../../out/link-opener.js'), 'utf8');
    new Function('require', 'module', 'exports', source)(name => {
        if (name === 'vscode') return vscode;
        if (name === './i18n/messages') return { t: key => key };
        throw Error('Unexpected dependency: ' + name);
    }, module, module.exports);
    return { ...module.exports, calls, state, uri, document: uri('file', '/project/nested/report.md') };
}

test('absolute directories retain their path instead of duplicating the workspace', async () => {
    const h = fixture();
    const target = process.platform === 'win32' ? 'C:\\project\\03 Labs\\Lab2' : '/project/03 Labs/Lab2';
    await h.openLocalLink(target, h.document);
    assert.equal(h.calls.stats[0].path, target);
    assert.deepEqual(h.calls.opens, [['vscode.open', h.calls.stats[0]]]);
    assert.deepEqual(h.calls.notices, []);
});

test('absolute paths and file URIs open without a workspace', async () => {
    const h = fixture(); h.state.workspace = undefined;
    const target = process.platform === 'win32' ? 'C:/fixtures/A B#100%.txt' : '/fixtures/A B#100%.txt';
    const fileUri = process.platform === 'win32' ? 'file:///C:/fixtures/A%20B%23100%25.txt' : 'file:///fixtures/A%20B%23100%25.txt';
    await h.openLocalLink(target, h.document);
    await h.openLocalLink(fileUri, h.document);
    assert.equal(h.calls.stats[0].path, target, 'raw filesystem characters stay literal');
    assert.equal(h.calls.stats[1].path, (process.platform === 'win32' ? '/' : '') + target, 'URI escapes are decoded by the URI API');
    assert.equal(h.calls.opens.length, 2);
});

test('relative links retain the selected workspace base and raw percent characters', async () => {
    const h = fixture(); h.state.workspace = h.uri('file', '/second-project');
    await h.openLocalLink('03 Labs/100%20notes.md', h.document);
    assert.equal(h.calls.opens[0][1].path, '/second-project/03 Labs/100%20notes.md');
});

test('Windows drive and UNC paths are recognized only on the appropriate host', () => {
    const h = fixture();
    for (const value of ['C:\\fixtures\\Folder With Spaces', '\\\\server\\share\\folder', '//server/share/folder']) {
        assert.equal(h.resolveLocalLink(value, h.document, h.state.workspace, 'win32').path, value);
    }
    for (const value of ['C:\\fixtures\\folder', '\\\\server\\share\\folder', 'file:///C:/fixtures/folder']) {
        assert.equal(h.resolveLocalLink(value, h.document, h.state.workspace, 'darwin'), undefined);
    }
    assert.equal(h.resolveLocalLink('/fixtures/folder', h.document, h.state.workspace, 'win32'), undefined);
});

test('remote relative links retain their scheme and authority; explicit local paths do not cross hosts', () => {
    const h = fixture(); const remote = h.uri('vscode-remote', '/project', 'remote-fixture');
    const target = h.resolveLocalLink('notes.md', remote, remote, 'linux');
    assert.deepEqual([target.scheme, target.authority, target.path], ['vscode-remote', 'remote-fixture', '/project/notes.md']);
    for (const value of ['/fixtures/folder', 'file:///fixtures/folder']) assert.equal(h.resolveLocalLink(value, remote, remote, 'linux'), undefined);
});

for (const [code, message] of [['FileNotFound', 'linkNotFound'], ['NoPermissions', 'linkNoPermissions'], ['Unavailable', 'linkOpenFailed']]) {
    test(code + ' offers copying without opening or exposing raw error details', async () => {
        const h = fixture(); h.state.statError = Object.assign(Error('private-error-detail'), { code });
        h.state.choice = 'copyLinkAddress';
        await h.openLocalLink('03 Labs/Missing folder', h.document);
        assert.deepEqual(h.calls.opens, []);
        assert.deepEqual(h.calls.notices, [[message, 'copyLinkAddress']]);
        assert.deepEqual(h.calls.copies, ['03 Labs/Missing folder']);
    });
}

test('dismissing the unavailable-target action leaves the clipboard alone', async () => {
    const h = fixture(); h.state.statError = { code: 'FileNotFound' };
    await h.openLocalLink('missing', h.document);
    assert.deepEqual(h.calls.copies, []);
});

test('opening rejection is awaited and offers the same copy action', async () => {
    const h = fixture(); h.state.openError = Error('private-error-detail'); h.state.choice = 'copyLinkAddress';
    await h.openLocalLink('notes.txt', h.document);
    assert.deepEqual(h.calls.notices, [['linkOpenFailed', 'copyLinkAddress']]);
    assert.deepEqual(h.calls.copies, ['notes.txt']);
});

test('unsupported schemes and links without a workspace offer copying without commands', async () => {
    const h = fixture(); h.state.workspace = undefined;
    for (const value of ['command:unsafe', 'custom:target', 'notes.md', 'file:relative']) await h.openLocalLink(value, h.document);
    assert.equal(h.calls.notices.length, 4);
    assert.deepEqual(h.calls.stats, []);
    assert.deepEqual(h.calls.opens, []);
});

test('clipboard failures are contained and show no private exception details', async () => {
    const h = fixture(); h.state.copyError = Error('private-error-detail');
    await h.copyLinkAddress('original destination');
    assert.deepEqual(h.calls.errors, ['linkCopyFailed']);
});
