const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');

// These tests execute the compiled controller, actual webview RPC, artifact
// validation and exclusive output writer. VS Code, renderer/tool discovery and
// native converter boundaries are mocked; this is not native/installed evidence.
const controllerPath = path.resolve(__dirname, '../../out/export/controller.js');
const scopedRequire = createRequire(controllerPath);
const controllerSource = require('node:fs').readFileSync(controllerPath, 'utf8');
const validHtml = '<!doctype html><html><head><title>Controller fixture</title></head><body><p>COMPLETE-EXPORT-MARKER</p></body></html>';

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

async function harness(t, options = {}) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'binary-export-controller-'));
    const sourcePath = path.join(directory, options.filename || 'report.md');
    const original = options.source || '# SAVED-SOURCE\n';
    await fs.writeFile(sourcePath, original);
    const posts = [];
    const notifications = [];
    const progressEvents = [];
    const commands = [];
    const subscriptions = new Set();
    const observers = [];
    const notification = options.notification || deferred();
    const calls = { save: 0, applyEdit: 0, render: 0, converter: 0, discover: 0, wait: 0 };
    let currentContent = original;
    let controller;
    let unavailable = false;
    const uri = { scheme: 'file', fsPath: sourcePath, toString: () => 'file://' + sourcePath };
    const document = {
        uri, version: 1, isDirty: false, isClosed: false, isUntitled: false,
        getText: () => currentContent,
        save: async () => { calls.save++; throw new Error('Export must never save the source.'); }
    };
    Object.assign(document, options.document || {});
    const display = options.display || (content => content);
    const config = options.config || {};
    const configApi = { get: (key, fallback) => key in config ? config[key] : fallback };
    const vscode = {
        UIKind: { Desktop: 1, Web: 2 }, ProgressLocation: { Notification: 15 },
        env: { uiKind: 1, remoteName: undefined, openExternal: async target => { commands.push(['openExternal', target.fsPath]); return true; } },
        workspace: { isTrusted: true, getConfiguration: () => configApi, applyEdit: async () => { calls.applyEdit++; throw new Error('Export must never edit the source.'); } },
        Uri: { file: value => ({ scheme: 'file', fsPath: value }), joinPath: (base, ...parts) => ({ scheme: 'file', fsPath: path.join(base.fsPath, ...parts) }) },
        commands: { executeCommand: async (...args) => { commands.push(args); } },
        window: {
            withProgress: async (_options, task) => task({ report: event => progressEvents.push(event) }, {
                onCancellationRequested: listener => {
                    subscriptions.add(listener);
                    return { dispose: () => subscriptions.delete(listener) };
                }
            }),
            showInformationMessage: (...args) => { notifications.push({ kind: 'information', args }); return notification.promise; },
            showWarningMessage: (...args) => { notifications.push({ kind: 'warning', args }); return notification.promise; },
            showErrorMessage: (...args) => { notifications.push({ kind: 'error', args }); return notification.promise; }
        }
    };
    if (options.trusted === false) vscode.workspace.isTrusted = false;
    if (options.remote) vscode.env.remoteName = options.remote;
    if (options.web) vscode.env.uiKind = vscode.UIKind.Web;
    const reply = message => controller.handleMessage(message);
    const panel = { webview: { postMessage: message => {
        if (unavailable && options.closedPost === 'throw') throw new Error('Panel is disposed');
        if (unavailable && options.closedPost === 'reject') return Promise.reject(new Error('Panel is disposed'));
        posts.push(message);
        for (const observer of [...observers]) {
            if (observer.type === message.type) { observers.splice(observers.indexOf(observer), 1); observer.resolve(message); }
        }
        if (unavailable) return Promise.resolve(false);
        if (message.type === 'captureExportSnapshot' && !options.holdSnapshot) {
            queueMicrotask(() => reply({ type: 'exportSnapshot', requestId: message.requestId,
                content: options.snapshot === undefined ? display(currentContent) : options.snapshot, pending: false }));
        } else if (message.type === 'prepareExport' && !options.holdPreparation) {
            options.onPrepare?.(message, document, content => { currentContent = content; });
            queueMicrotask(() => reply({ type: 'exportPrepared', requestId: message.requestId,
                html: '<article><p>Rendered source</p></article>', warnings: options.warnings || [], diagrams: [], theme: 'github', fontSize: 16 }));
        } else if (message.type === 'validateExportImage') {
            queueMicrotask(() => reply({ type: 'exportImageValidated', requestId: message.requestId, valid: options.validImage !== false }));
        }
        return Promise.resolve(true);
    } } };
    const mocks = {
        vscode,
        './tools': { discoverTool: async (kind, override, signal) => {
            calls.discover++;
            return options.discover ? options.discover({ kind, override, signal }) :
                { kind, available: true, path: '/mock/' + kind, version: 'mock-only' };
        } },
        './html': { prepareStandaloneHtml: async (source, prepared, _extensionPath, operations) => {
            calls.render++;
            if (options.render) return options.render({ source, prepared, operations, document });
            return validHtml;
        } },
        './pandoc': { convertPandoc: async () => { calls.converter++; throw new Error('Unexpected native Pandoc call in controller fixture.'); } },
        './pdf': { convertPdf: async (_html, executable, operations) => {
            calls.converter++;
            if (options.pdf) return options.pdf({ executable, operations });
            throw new Error('Unexpected native browser call in controller fixture.');
        } },
        './resources': {
            createResourceLoader: () => async () => ({ bytes: Buffer.from('image-fixture'), mime: 'image/png' }),
            dataUri: () => 'data:image/png;base64,aW1hZ2UtZml4dHVyZQ=='
        }
    };
    const compiled = { exports: {} };
    // A module-local platform shim makes host eligibility cases deterministic
    // on CI without changing the process or any other test's environment.
    new Function('require', 'module', 'exports', 'process', '__dirname', '__filename', controllerSource)(
        name => name in mocks ? mocks[name] : scopedRequire(name), compiled, compiled.exports,
        { platform: options.platform || 'darwin' }, path.dirname(controllerPath), controllerPath
    );
    controller = new compiled.exports.ExportController(
        { extensionPath: directory, extensionUri: { fsPath: directory } }, document, panel,
        async () => { calls.wait++; await options.waitForSave?.(); }, display
    );
    t.after(async () => { controller.dispose(); await fs.rm(directory, { recursive: true, force: true }); });
    return {
        controller, directory, sourcePath, original, document, vscode, posts, calls, notifications, notification, progressEvents, subscriptions, commands,
        setText: content => { currentContent = content; },
        waitForPost: type => {
            const existing = posts.find(message => message.type === type);
            if (existing) return Promise.resolve(existing);
            return new Promise(resolve => observers.push({ type, resolve }));
        },
        dispose: () => { unavailable = true; document.isClosed = true; controller.dispose(); },
        reply,
        terminal: () => posts.filter(message => message.type === 'exportStatus' && message.state !== 'running')
    };
}

async function assertSourceIntact(h) {
    assert.equal(h.calls.save, 0);
    assert.equal(h.calls.applyEdit, 0);
    assert.equal(await fs.readFile(h.sourcePath, 'utf8'), h.original);
}

for (const platform of ['darwin', 'linux']) for (const [name, options] of [
    ['dirty document', { document: { isDirty: true } }],
    ['untitled document', { document: { isUntitled: true } }],
    ['non-file document', { document: { uri: { scheme: 'untitled', fsPath: 'untitled:Untitled-1' } } }],
    ['divergent unsynchronized editor', { snapshot: '# UNSAVED-VISUAL-EDIT\n' }]
]) {
    test(platform + ' controller rejects ' + name + ' without saving or changing the source', async t => {
        const h = await harness(t, { ...options, platform });
        await h.controller.export('html');
        assert.deepEqual(h.terminal().map(result => result.state), ['failed']);
        assert.match(h.terminal()[0].message, /Save this Markdown file/);
        assert.equal(h.calls.render, 0);
        assert.equal(h.calls.discover, 0);
        assert.equal(h.posts.some(message => message.type === 'prepareExport'), false);
        assert.deepEqual(await fs.readdir(h.directory), ['report.md']);
        await assertSourceIntact(h);
    });
}

test('controller awaits an existing save before checking eligibility and capturing', async t => {
    const save = deferred();
    const h = await harness(t, { document: { isDirty: true }, waitForSave: () => save.promise });
    const job = h.controller.export('html');
    await h.waitForPost('exportStatus');
    assert.equal(h.calls.wait, 1);
    assert.equal(h.posts.some(message => message.type === 'captureExportSnapshot'), false);
    h.document.isDirty = false;
    save.resolve();
    await job;
    assert.equal(h.posts.some(message => message.type === 'captureExportSnapshot'), true);
    assert.equal(h.terminal()[0].state, 'complete');
    await assertSourceIntact(h);
});

test('controller compares normalized display content but exports the untouched host source', async t => {
    const source = '\uFEFF# Exact source\r\n\r\n![image](/original.png)\r\n';
    let captured;
    const h = await harness(t, {
        source, display: text => text.replace('/original.png', 'https://file+.vscode-resource.vscode-cdn.net/original.png'),
        snapshot: '# Exact source\n\n![image](https://file+.vscode-resource.vscode-cdn.net/original.png)\n',
        render: ({ source: saved }) => { captured = saved; return validHtml; }
    });
    await h.controller.export('html');
    assert.equal(h.terminal()[0].state, 'complete');
    assert.equal(captured.markdown, source);
    assert.equal(Object.isFrozen(captured), true);
    await assertSourceIntact(h);
});

test('a revision change while the webview snapshot is pending rejects stale capture', async t => {
    const h = await harness(t, { holdSnapshot: true });
    const job = h.controller.export('html');
    const request = await h.waitForPost('captureExportSnapshot');
    h.document.version++;
    h.reply({ type: 'exportSnapshot', requestId: request.requestId, content: h.original, pending: false });
    await job;
    assert.equal(h.terminal()[0].state, 'failed');
    assert.equal(h.calls.render, 0);
    await assertSourceIntact(h);
});

test('editing after capture does not replace the source passed to rendering or naming', async t => {
    let saved;
    const h = await harness(t, {
        onPrepare: (_message, document, setText) => { setText('# NEWER-UNSAVED\n'); document.version++; document.isDirty = true; },
        render: ({ source }) => { saved = source; return validHtml; }
    });
    await h.controller.export('html');
    assert.equal(saved.markdown, h.original);
    assert.equal(saved.version, 1);
    assert.equal(h.document.getText(), '# NEWER-UNSAVED\n');
    assert.equal(h.document.isDirty, true);
    assert.equal(h.terminal()[0].state, 'complete');
    assert.equal(h.terminal()[0].outputPath, path.join(h.directory, 'report.html'));
    await assertSourceIntact(h);
});

test('completion settles without waiting for a notification choice and allows another export', async t => {
    const notification = deferred();
    const h = await harness(t, { notification });
    await h.controller.export('html');
    assert.equal(h.terminal()[0].state, 'complete');
    assert.equal(h.subscriptions.size, 0);
    assert.equal(h.controller.running, undefined);
    await h.controller.export('html');
    assert.equal(h.terminal().filter(result => result.state === 'complete').length, 2);
    notification.resolve('Open exported file');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.commands.filter(command => command[0] === 'openExternal').length, 2);
    await assertSourceIntact(h);
});

test('controller reports the real collision-safe sibling filename and finalized bytes', async t => {
    const h = await harness(t, { filename: 'report 文档.md' });
    const base = path.join(h.directory, 'report 文档.html');
    await fs.writeFile(base, 'PRESERVE-EXISTING-EXPORT');
    await h.controller.export('html');
    const hash = createHash('sha256').update(validHtml).digest('hex').slice(-8);
    const expected = path.join(h.directory, 'report 文档_' + hash + '.html');
    assert.equal(h.terminal()[0].outputPath, expected);
    assert.equal(await fs.readFile(expected, 'utf8'), validHtml);
    assert.equal(await fs.readFile(base, 'utf8'), 'PRESERVE-EXISTING-EXPORT');
    assert.equal((await fs.readdir(h.directory)).some(name => name.startsWith('.binary-markdown-export-')), false);
    await assertSourceIntact(h);
});

test('cancellation during rendering reports cancelled, releases RPC work and never creates output', async t => {
    const h = await harness(t, { holdPreparation: true });
    const job = h.controller.export('html');
    const request = await h.waitForPost('prepareExport');
    h.controller.handleMessage({ type: 'cancelExport' });
    await job;
    assert.deepEqual(h.terminal().map(result => result.state), ['cancelled']);
    assert.equal(h.posts.some(message => message.type === 'cancelExportPreparation' && message.requestId === request.requestId), true);
    assert.equal(h.controller.channel.pending.size, 0);
    assert.equal(h.subscriptions.size, 0);
    assert.equal(h.notifications.some(notification => notification.kind === 'error'), false);
    assert.deepEqual(await fs.readdir(h.directory), ['report.md']);
    await assertSourceIntact(h);
});

test('cancellation reaches the mocked native conversion signal and prevents output', async t => {
    const entered = deferred();
    const h = await harness(t, { pdf: ({ executable, operations }) => {
        assert.equal(executable, '/mock/browser');
        entered.resolve();
        return new Promise((_resolve, reject) => operations.signal.addEventListener('abort', () => {
            const error = new Error('Mock converter cancelled'); error.name = 'AbortError'; reject(error);
        }, { once: true }));
    } });
    const job = h.controller.export('pdf');
    await entered.promise;
    for (const cancel of h.subscriptions) cancel();
    await job;
    assert.equal(h.terminal()[0].state, 'cancelled');
    assert.equal(h.calls.converter, 1);
    assert.equal(h.controller.running, undefined);
    assert.deepEqual(await fs.readdir(h.directory), ['report.md']);
    await assertSourceIntact(h);
});

test('disposing a panel cancels pending work, cleans up subscriptions and ignores late replies', async t => {
    const h = await harness(t, { holdPreparation: true });
    const job = h.controller.export('html');
    const request = await h.waitForPost('prepareExport');
    h.dispose();
    await job;
    assert.equal(h.controller.running, undefined);
    assert.equal(h.controller.channel.pending.size, 0);
    assert.equal(h.subscriptions.size, 0);
    h.reply({ type: 'exportPrepared', requestId: request.requestId, html: '<article>Late</article>', warnings: [] });
    assert.equal(h.calls.render, 0);
    assert.deepEqual(await fs.readdir(h.directory), ['report.md']);
    await assertSourceIntact(h);
});

for (const closedPost of ['throw', 'reject']) {
    test('a disposed panel with ' + closedPost + ' status delivery does not reject the export task', async t => {
        const h = await harness(t, { holdPreparation: true, closedPost });
        const job = h.controller.export('html');
        await h.waitForPost('prepareExport');
        h.dispose();
        await assert.doesNotReject(job);
        assert.equal(h.controller.running, undefined);
        assert.equal(h.controller.channel.pending.size, 0);
        assert.equal(h.subscriptions.size, 0);
    });
}

test('invalid converted HTML is a failure and cannot produce a success file', async t => {
    const h = await harness(t, { render: () => '<p>Incomplete HTML fragment</p>' });
    await h.controller.export('html');
    assert.equal(h.terminal()[0].state, 'failed');
    assert.match(h.terminal()[0].message, /incomplete or invalid/);
    assert.deepEqual(await fs.readdir(h.directory), ['report.md']);
    assert.equal(h.notifications.some(notification => notification.kind === 'information'), false);
    await assertSourceIntact(h);
});

for (const platform of ['darwin', 'linux']) {
    test(platform + ' local desktop capabilities agree with successful saved HTML export', async t => {
        const h = await harness(t, { platform });
        const capabilities = await h.controller.getCapabilities();
        assert.equal(capabilities.host.available, true);
        assert.equal(capabilities.pandoc.available, true);
        assert.equal(capabilities.browser.available, true);
        assert.equal(h.calls.discover, 2);
        await h.controller.getCapabilities();
        assert.equal(h.calls.discover, 2, 'Repeated labels reuse tool probes');
        await h.controller.export('html');
        assert.equal(h.terminal()[0].state, 'complete');
        assert.equal(h.calls.wait, 1);
        assert.equal(h.calls.render, 1);
        assert.equal(await fs.readFile(h.terminal()[0].outputPath, 'utf8'), validHtml);
        await assertSourceIntact(h);
    });
}

test('cached available tools do not bypass changed workspace trust in capability labels', async t => {
    const h = await harness(t, { platform: 'linux' });
    await h.controller.getCapabilities();
    h.vscode.workspace.isTrusted = false;
    const capabilities = await h.controller.getCapabilities();
    for (const status of Object.values(capabilities)) {
        assert.equal(status.available, false);
        assert.match(status.error, /Trust this workspace/);
    }
    assert.equal(h.calls.discover, 2, 'Untrusted capability requests do not launch new probes');
    await h.controller.export('html');
    assert.equal(h.terminal()[0].state, 'failed');
    assert.equal(h.calls.wait, 0);
    await assertSourceIntact(h);
});

test('only the latest overlapping capability refresh publishes its configured tool result', async t => {
    const earlier = deferred();
    const config = { 'export.pandocPath': '/old/pandoc', 'export.browserPath': '/old/browser' };
    const h = await harness(t, {
        config, platform: 'linux',
        discover: ({ kind, override }) => override.startsWith('/old/')
            ? earlier.promise.then(() => ({ kind, available: true, path: override }))
            : { kind, available: false, path: override, error: 'Configured path is unusable' }
    });
    h.controller.refreshCapabilities();
    config['export.pandocPath'] = '/new/invalid-pandoc';
    config['export.browserPath'] = '/new/invalid-browser';
    h.controller.refreshCapabilities();
    await h.waitForPost('exportCapabilities');
    earlier.resolve();
    await new Promise(resolve => setImmediate(resolve));
    const updates = h.posts.filter(message => message.type === 'exportCapabilities');
    assert.equal(updates.length, 1, 'An older completed probe cannot replace the latest labels');
    assert.equal(updates[0].pandoc.path, '/new/invalid-pandoc');
    assert.equal(updates[0].browser.path, '/new/invalid-browser');
    assert.equal(updates[0].pandoc.available, false);
    assert.equal(updates[0].browser.available, false);
    assert.equal(h.calls.discover, 4);
    await assertSourceIntact(h);
});

test('disposing the controller discards pending capability results and ignores later refreshes', async t => {
    const pending = deferred();
    const h = await harness(t, {
        discover: ({ kind }) => pending.promise.then(() => ({ kind, available: true, path: '/mock/' + kind }))
    });
    h.controller.refreshCapabilities();
    assert.equal(h.calls.discover, 2);
    h.dispose();
    pending.resolve();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.posts.some(message => message.type === 'exportCapabilities'), false);
    h.controller.refreshCapabilities();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.calls.discover, 2, 'Closed editors do not start additional capability probes');
    await assertSourceIntact(h);
});

for (const [name, options] of [
    ['untrusted workspace', { trusted: false }],
    ['remote extension host', { remote: 'ssh-remote' }],
    ['web VS Code', { web: true }],
    ['unsupported local platform', { platform: 'win32' }],
    ['Linux untrusted workspace', { platform: 'linux', trusted: false }],
    ['Linux Remote-SSH window', { platform: 'linux', remote: 'ssh-remote' }],
    ['Linux web VS Code', { platform: 'linux', web: true }]
]) {
    test('controller rejects ' + name + ' before tool discovery or source capture', async t => {
        const h = await harness(t, options);
        const capabilities = await h.controller.getCapabilities();
        const reason = options.trusted === false ? /Trust this workspace/ : options.remote ? /not yet supported in remote windows, including Remote-SSH/ : /local desktop VS Code on macOS or Linux/;
        for (const status of Object.values(capabilities)) {
            assert.equal(status.available, false);
            assert.match(status.error, reason);
        }
        await h.controller.export('html');
        assert.equal(h.terminal()[0].state, 'failed');
        assert.match(h.terminal()[0].message, reason);
        assert.equal(h.calls.wait, 0);
        assert.equal(h.calls.discover, 0);
        assert.equal(h.posts.some(message => message.type === 'captureExportSnapshot'), false);
        await assertSourceIntact(h);
    });
}
