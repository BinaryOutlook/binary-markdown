const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

// Execute the compiled provider's event wiring with a controlled VS Code model.
// The controller is a boundary stub here; export-controller.test.js exercises its
// real implementation. These tests do not replace installed/native validation.
const providerPath = path.resolve(__dirname, '../../out/editorProvider.js');
const providerSource = fs.readFileSync(providerPath, 'utf8');
const scopedRequire = createRequire(providerPath);

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
}
function event() {
    const listeners = new Set();
    return {
        listen: listener => { listeners.add(listener); return { dispose: () => listeners.delete(listener) }; },
        fire: value => [...listeners].map(listener => listener(value)),
        listeners
    };
}
async function setup(t) {
    const changes = event();
    const configChanges = event();
    const willSave = event();
    const didSave = event();
    const watcher = event();
    const disposed = event();
    const viewState = event();
    const incoming = event();
    const posts = [];
    const notices = [];
    const renderConfigs = [];
    const locales = [];
    let cachedLocale = 'ja'; // A locale cached before the current configuration.
    const timers = [];
    const config = { theme: 'github', language: 'en' };
    const state = {
        text: '# OLD-EDITOR\n', disk: '# OLD-EDITOR\n', captureCalls: 0, saveCalls: 0,
        captures: async () => '# OLD-EDITOR\n', beforeWrite: async () => {}, failedWrite: false,
        controller: undefined, exports: []
    };
    const file = value => ({ scheme: 'file', fsPath: value, toString: () => 'file://' + value });
    const document = {
        uri: file('/provider-fixture/report.md'), version: 1, eol: 1, isDirty: false, isClosed: false,
        get lineCount() { return state.text.split('\n').length; },
        getText: () => state.text, positionAt: offset => ({ line: 0, character: offset }),
        save: async () => {
            state.saveCalls++;
            const promises = [];
            willSave.fire({ document, waitUntil: promise => promises.push(promise) });
            for (const promise of promises) {
                const edits = await promise;
                for (const edit of edits) { state.text = edit.newText; document.version++; document.isDirty = true; }
            }
            await state.beforeWrite();
            if (state.failedWrite) throw new Error('Native disk write failed');
            state.disk = state.text;
            document.isDirty = false;
            didSave.fire(document);
            return true;
        }
    };
    const vscode = {
        EndOfLine: { LF: 1, CRLF: 2 }, env: { language: 'en' },
        Uri: { file, joinPath: (base, ...parts) => file(path.join(base.fsPath, ...parts)) },
        Range: class { constructor(...values) { this.values = values; } },
        RelativePattern: class {},
        WorkspaceEdit: class { constructor() { this.edits = []; } replace(_uri, _range, text) { this.edits.push(text); } },
        TextEdit: { replace: (range, newText) => ({ range, newText }) },
        workspace: {
            getConfiguration: () => ({ get: (key, fallback) => key in config ? config[key] : fallback }),
            getWorkspaceFolder: () => undefined,
            onDidChangeTextDocument: changes.listen,
            onDidChangeConfiguration: configChanges.listen,
            onWillSaveTextDocument: willSave.listen,
            onDidSaveTextDocument: didSave.listen,
            createFileSystemWatcher: () => ({ onDidChange: watcher.listen, dispose: () => {} }),
            fs: { readFile: async () => Buffer.from(state.disk) },
            applyEdit: async edit => {
                for (const text of edit.edits) { state.text = text; document.version++; document.isDirty = true; }
                changes.fire({ document, contentChanges: [{ text: state.text }] });
                return true;
            }
        },
        window: { showInformationMessage: async message => { notices.push(message); }, showErrorMessage: async () => undefined }
    };
    const panel = {
        active: true,
        onDidDispose: disposed.listen, onDidChangeViewState: viewState.listen,
        webview: {
            html: '', options: {}, asWebviewUri: uri => ({ toString: () => 'webview:' + uri.fsPath }),
            postMessage: message => { posts.push(message); return Promise.resolve(true); },
            onDidReceiveMessage: incoming.listen
        }
    };
    class Controller {
        constructor(_context, _document, _panel, waitForSave) { this.waitForSave = waitForSave; this.refreshes = 0; state.controller = this; }
        captureForSave() { state.captureCalls++; return state.captures(); }
        export(format) { state.exports.push(format); return Promise.resolve(); }
        refreshCapabilities() { this.refreshes++; }
        handleMessage() { return false; }
        dispose() { this.disposed = true; }
    }
    const mocks = {
        vscode,
        './webviewContent': { getWebviewContent: (_webview, _uri, _content, options) => { renderConfigs.push(options); return '<p>Fixture editor</p>'; } },
        './export/controller': { ExportController: Controller },
        './i18n/messages': {
            t: key => key, getWebviewMessages: () => ({ locale: cachedLocale }),
            initLocale: locale => { locales.push(locale); cachedLocale = locale; }
        },
        './shared/outline-state-store': { OutlineStateStore: class { getOpen(_scope, _uri, defaultOpen) { return defaultOpen; } } }
    };
    const compiled = { exports: {} };
    new Function('require', 'module', 'exports', '__dirname', '__filename', 'setTimeout', providerSource)(
        name => name in mocks ? mocks[name] : scopedRequire(name), compiled, compiled.exports,
        path.dirname(providerPath), providerPath, callback => { timers.push(callback); return timers.length; }
    );
    const provider = new compiled.exports.BinaryMarkdownEditorProvider({ extensionUri: file('/extension-fixture'), workspaceState: {}, globalState: {} });
    await provider.resolveCustomTextEditor(document, panel, {});
    t.after(() => disposed.fire());
    return {
        state, document, panel, provider, config, posts, notices, renderConfigs, locales, disposed,
        configChanged: keys => configChanges.fire({ affectsConfiguration: query => keys.some(key => key === query || key.startsWith(query + '.')) }),
        externalChange: async content => { state.disk = content; watcher.fire(document.uri); await timers.shift()(); },
        send: message => Promise.all(incoming.fire(message))
    };
}

test('export commands target the active custom editor for each format', async t => {
    const h = await setup(t);
    for (const format of ['html', 'pdf', 'docx', 'epub']) { h.provider.requestExport(format); }
    assert.deepEqual(h.state.exports, ['html', 'pdf', 'docx', 'epub']);
    assert.deepEqual(h.notices, []);
});

test('export command refuses a cached panel that is no longer active', async t => {
    const h = await setup(t);
    // Native focus can change before the queued view-state callback clears the
    // provider's cached panel. A command must not export that previous document.
    h.panel.active = false;
    h.provider.requestExport('html');
    assert.deepEqual(h.state.exports, []);
    assert.deepEqual(h.notices, ['openMarkdownFirst']);
    assert.equal(h.state.captureCalls, 0);
    assert.equal(h.state.saveCalls, 0);
    assert.equal(h.document.getText(), '# OLD-EDITOR\n');
});

test('provider native-save barrier waits through disk completion and didSave', async t => {
    const h = await setup(t);
    const write = deferred();
    const entered = deferred();
    h.state.captures = async () => '# NATIVE-SAVED\n';
    h.state.beforeWrite = () => { entered.resolve(); return write.promise; };
    const save = h.document.save();
    await entered.promise;
    let finished = false;
    const waiting = h.state.controller.waitForSave().then(() => { finished = true; });
    await Promise.resolve();
    assert.equal(finished, false);
    assert.equal(h.document.isDirty, true);
    assert.equal(h.state.disk, '# OLD-EDITOR\n');
    write.resolve();
    await Promise.all([save, waiting]);
    assert.equal(h.state.disk, '# NATIVE-SAVED\n');
    assert.equal(h.posts.find(message => message.type === 'documentSaved').content, '# NATIVE-SAVED\n');
});

test('failed native capture rejects its barrier and a fresh save can recover', async t => {
    const h = await setup(t);
    h.state.captures = async () => { throw new Error('Capture unavailable'); };
    const save = h.document.save();
    const waiting = h.state.controller.waitForSave();
    await assert.rejects(save, /Capture unavailable/);
    await assert.rejects(waiting, /Capture unavailable/);
    h.state.captures = async () => '# RECOVERED\n';
    await h.document.save();
    await h.state.controller.waitForSave();
    assert.equal(h.state.disk, '# RECOVERED\n');
});

test('cancelling a wait after failed native disk write does not trap future exports', async t => {
    const h = await setup(t);
    h.state.captures = async () => '# UNSAVED-AFTER-DISK-FAILURE\n';
    h.state.failedWrite = true;
    await assert.rejects(h.document.save(), /Native disk write failed/);
    const abort = new AbortController();
    const waiting = h.state.controller.waitForSave(abort.signal);
    abort.abort();
    await assert.rejects(waiting, { name: 'AbortError' });
    await h.state.controller.waitForSave();
    assert.equal(h.document.isDirty, true); // The controller's strict gate rejects it.
    assert.equal(h.state.disk, '# OLD-EDITOR\n');
    assert.equal(h.state.saveCalls, 1);
});

test('a new native save supersedes a failed write while existing export waiters follow the retry', async t => {
    const h = await setup(t);
    h.state.captures = async () => '# FIRST-ATTEMPT\n';
    h.state.failedWrite = true;
    await assert.rejects(h.document.save(), /Native disk write failed/);
    const waiting = h.state.controller.waitForSave();
    h.state.failedWrite = false;
    h.state.captures = async () => '# RETRY-SAVED\n';
    await h.document.save();
    await waiting;
    assert.equal(h.state.disk, '# RETRY-SAVED\n');
});

test('external file synchronization bypasses stale webview capture before saving', async t => {
    const h = await setup(t);
    h.state.captures = async () => '# STALE-WEBVIEW-WOULD-OVERWRITE\n';
    await h.externalChange('# EXTERNAL-EDITOR-REVISION\n');
    assert.equal(h.state.captureCalls, 0);
    assert.equal(h.state.disk, '# EXTERNAL-EDITOR-REVISION\n');
    assert.equal(h.document.getText(), '# EXTERNAL-EDITOR-REVISION\n');
    assert.equal(h.posts.find(message => message.type === 'update').content, '# EXTERNAL-EDITOR-REVISION\n');
});

test('keyboard save carries explicit content without recapturing the webview', async t => {
    const h = await setup(t);
    await h.send({ type: 'save', content: '# KEYBOARD-SAVED\n', revision: 7 });
    assert.equal(h.state.captureCalls, 0);
    assert.equal(h.state.disk, '# KEYBOARD-SAVED\n');
    assert.deepEqual(h.posts.find(message => message.type === 'saveResult'), { type: 'saveResult', revision: 7, success: true });
});

test('export-only settings refresh capabilities without recreating editor HTML', async t => {
    const h = await setup(t);
    h.configChanged(['binary-markdown.export.pandocPath']);
    assert.equal(h.state.controller.refreshes, 1);
    assert.equal(h.renderConfigs.length, 1);
});

test('new editors and appearance rebuilds use the current configured language', async t => {
    const h = await setup(t);
    assert.equal(h.renderConfigs[0].webviewMessages.locale, 'en');
    // A later settings value can be visible while handling an earlier event.
    // Rendering must use that snapshot, not depend on a language-event side effect.
    h.config.language = 'zh-CN';
    h.config.theme = 'night';
    h.configChanged(['binary-markdown.theme']);
    assert.equal(h.renderConfigs.at(-1).webviewMessages.locale, 'zh-CN');
    h.config.language = 'en';
    h.config.toolbarMode = 'simple';
    h.configChanged(['binary-markdown.toolbarMode']);
    assert.equal(h.renderConfigs.at(-1).webviewMessages.locale, 'en');
    assert.equal(h.renderConfigs.at(-1).toolbarMode, 'simple');
});

test('combined export and appearance/language changes update both integrations', async t => {
    const h = await setup(t);
    h.config.theme = 'night';
    h.config.language = 'zh-cn';
    h.configChanged(['binary-markdown.export.browserPath', 'binary-markdown.theme', 'binary-markdown.language']);
    assert.equal(h.state.controller.refreshes, 1);
    assert.equal(h.renderConfigs.length, 2);
    assert.equal(h.renderConfigs[1].theme, 'night');
    assert.deepEqual(h.locales, ['en', 'zh-cn']);
});

test('disposing a panel releases an outstanding native-save wait', async t => {
    const h = await setup(t);
    h.state.failedWrite = true;
    await assert.rejects(h.document.save(), /Native disk write failed/);
    const waiting = h.state.controller.waitForSave();
    h.disposed.fire();
    await assert.rejects(waiting, /document editor was closed/);
    await assert.rejects(h.state.controller.waitForSave(), /document editor was closed/);
});
