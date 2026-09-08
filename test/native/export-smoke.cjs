'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const net = require('node:net');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const sentinelName = '.binary-markdown-native-export.json';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const inside = (base, target) => {
    const relative = path.relative(base, target);
    return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
};
const harnessIdentity = () => ({ platform: process.platform, arch: process.arch, nodeVersion: process.version });
const saveShortcut = () => process.platform === 'darwin' ? { label: 'Meta+S', modifiers: 4 } : { label: 'Ctrl+S', modifiers: 2 };
const assertSupportedHost = () => {
    assert.ok(['darwin', 'linux'].includes(process.platform), 'Use local desktop VS Code on macOS or Linux for this harness');
    assert.notEqual(process.getuid?.(), 0, 'Run as the ordinary desktop user: root bypasses the unwritable-output test and browser sandbox');
};
const temporaryRoot = () => fs.realpathSync(os.tmpdir());

function options() {
    const result = {
        command: process.argv[2], workdir: path.join(root, '.vscode-test/export-native-repro'), port: 9327,
        package: path.join(root, 'dist', require('../../package.json').name + '-' + require('../../package.json').version + '.vsix'),
        code: 'code', timeout: 120000, suite: 'all', pandoc: '', browser: ''
    };
    for (let index = 3; index < process.argv.length; index += 2) {
        const key = process.argv[index].replace(/^--/, '');
        if (!['workdir', 'port', 'package', 'code', 'timeout', 'suite', 'pandoc', 'browser'].includes(key) || !process.argv[index + 1]) {
            throw new Error('Expected --workdir, --port, --package, --code, --timeout, --suite, --pandoc or --browser with a value.');
        }
        result[key] = process.argv[index + 1];
    }
    result.workdir = path.resolve(result.workdir);
    result.package = path.resolve(result.package);
    result.port = Number(result.port);
    result.timeout = Number(result.timeout);
    if (!Number.isInteger(result.port) || result.port < 1024 || result.port > 65535 || !(result.timeout > 0)) throw new Error('Invalid test port or watchdog.');
    const allowed = path.join(root, '.vscode-test');
    if (result.workdir === allowed || !inside(allowed, result.workdir)) throw new Error('Use a dedicated directory beneath this checkout’s .vscode-test directory.');
    return result;
}

function verifyInputs(workspace) {
    const frozenManifest = fs.readFileSync(path.join(root, 'test/fixtures/exports/manifest.json'));
    assert.ok(fs.readFileSync(path.join(workspace, 'manifest.json')).equals(frozenManifest), 'The copied manifest must match the frozen checkout manifest');
    const manifest = JSON.parse(frozenManifest);
    for (const file of manifest.files) {
        const input = path.resolve(workspace, file.path);
        assert.ok(inside(workspace, input), 'Fixture path remains inside owned workspace');
        assert.equal(hash(fs.readFileSync(input)), file.sha256, 'Frozen fixture changed: ' + file.path);
    }
    return manifest.files.length;
}

function initialize(settings) {
    assertSupportedHost();
    if (fs.existsSync(settings.workdir)) throw new Error('Initialization requires a new directory; existing evidence is never erased. Choose another --workdir.');
    fs.mkdirSync(path.dirname(settings.workdir), { recursive: true });
    assert.ok(inside(fs.realpathSync(root), fs.realpathSync(path.dirname(settings.workdir))), 'Test directory must not escape through a symlink');
    assert.ok(fs.existsSync(settings.package), 'Build the VSIX before initializing the native harness.');
    // Stay below the smaller macOS Unix-domain socket limit, including a conservative versioned socket name.
    assert.ok(Buffer.byteLength(path.join(temporaryRoot(), 'bm-native-XXXXXX', '1.9999-main.sock')) <= 103,
        'The temporary directory is too long for the VS Code IPC socket. Set TMPDIR to a shorter temporary directory for every harness command.');
    const token = crypto.randomUUID();
    const owner = {
        kind: 'binary-markdown-native-export-v1', token, base: settings.workdir,
        workspace: path.join(settings.workdir, 'workspace-' + token.slice(0, 8)),
        // Use the host temporary directory rather than the possibly deeply nested checkout.
        profile: fs.mkdtempSync(path.join(temporaryRoot(), 'bm-native-')), extensions: path.join(settings.workdir, 'extensions'),
        driver: path.join(settings.workdir, 'driver'), port: settings.port
    };
    for (const directory of [owner.base, owner.profile, owner.extensions, owner.driver, path.join(owner.base, 'evidence')]) fs.mkdirSync(directory, { recursive: true });
    fs.cpSync(path.join(root, 'test/fixtures/exports'), owner.workspace, { recursive: true });
    verifyInputs(owner.workspace);
    for (const directory of [owner.base, owner.workspace, owner.profile]) fs.writeFileSync(path.join(directory, sentinelName), JSON.stringify(owner, null, 2));
    fs.copyFileSync(path.join(__dirname, 'export-driver.cjs'), path.join(owner.driver, 'main.cjs'));
    fs.writeFileSync(path.join(owner.driver, 'package.json'), JSON.stringify({
        name: 'binary-export-test-driver', publisher: 'local', version: '0.0.1', engines: { vscode: '^1.85.0' },
        activationEvents: ['workspaceContains:' + sentinelName], main: 'main.cjs'
    }, null, 2));
    fs.mkdirSync(path.join(owner.profile, 'User'), { recursive: true });
    fs.writeFileSync(path.join(owner.profile, 'User/settings.json'), JSON.stringify({
        'window.title': 'Binary Markdown Export Test ' + token, 'window.restoreWindows': 'none',
        'workbench.startupEditor': 'none', 'binary-markdown.language': 'en', 'binary-markdown.theme': 'github',
        'extensions.autoUpdate': false, 'extensions.autoCheckUpdates': false, 'update.mode': 'none'
    }, null, 2));
    console.log('Created owned test workspace:', owner.workspace);
    console.log('Created owned temporary profile:', owner.profile);
}

function owned(settings) {
    const owner = JSON.parse(fs.readFileSync(path.join(settings.workdir, sentinelName), 'utf8'));
    assert.equal(owner.kind, 'binary-markdown-native-export-v1', 'Explicit native test sentinel is required');
    assert.match(owner.token, /^[0-9a-f-]{36}$/, 'Generated workspace ownership token is required');
    assert.equal(owner.base, settings.workdir);
    assert.equal(owner.port, settings.port, 'Use the port recorded at initialization');
    assert.equal(fs.realpathSync(owner.base), owner.base, 'Owned base must not be a symlink');
    for (const name of ['workspace', 'extensions', 'driver']) {
        assert.ok(inside(owner.base, owner[name]) && fs.realpathSync(owner[name]) === owner[name], 'Owned ' + name + ' is required');
    }
    assert.equal(path.dirname(owner.profile), temporaryRoot(), 'The test profile must be a generated temporary directory; keep TMPDIR consistent across commands');
    assert.match(path.basename(owner.profile), /^bm-native-[A-Za-z0-9]+$/);
    assert.equal(fs.realpathSync(owner.profile), owner.profile);
    const profileOwner = JSON.parse(fs.readFileSync(path.join(owner.profile, sentinelName), 'utf8'));
    assert.equal(profileOwner.token, owner.token); assert.equal(profileOwner.base, owner.base);
    assert.equal(JSON.parse(fs.readFileSync(path.join(owner.workspace, sentinelName), 'utf8')).token, owner.token);
    return owner;
}

function receipt(owner) {
    const response = JSON.parse(fs.readFileSync(path.join(owner.workspace, 'response.json'), 'utf8'));
    assert.equal(response.token, owner.token, 'The installed test driver must confirm the ownership sentinel');
    assert.equal(response.workspace, owner.workspace);
    assert.equal(response.profile, owner.profile);
    assert.equal(response.platform, process.platform, 'The driver must run on the same local operating system as the harness');
    assert.equal(response.uiKind, 1, 'The driver must run in desktop VS Code');
    assert.equal(response.remoteName, null, 'This harness validates a local extension host, not a remote VS Code extension host');
    assert.ok(response.extensionPath && inside(owner.extensions, response.extensionPath), 'The subject must be the isolated installed VSIX');
    assert.equal(response.trusted, true, 'Trust only the generated test workspace before running');
    return response;
}

function harness(settings, owner) {
    const until = async callback => {
        const end = Date.now() + settings.timeout;
        while (Date.now() < end) { const result = await callback(); if (result) return result; await sleep(100); }
        throw new Error('Native test watchdog expired. Inspect the isolated window and evidence; this is not a performance target.');
    };
    const driver = async action => {
        receipt(owner);
        const id = crypto.randomUUID();
        const temporary = path.join(owner.workspace, 'request.json.tmp');
        fs.writeFileSync(temporary, JSON.stringify({ id, token: owner.token, ...action }));
        fs.renameSync(temporary, path.join(owner.workspace, 'request.json'));
        return until(() => {
            let response;
            try { response = receipt(owner); } catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return; throw error; }
            if (response.id === id) { assert.equal(response.ok, true, response.error); return response; }
        });
    };
    const workbench = async callback => {
        receipt(owner);
        const browser = await require('playwright-core').chromium.connectOverCDP('http://127.0.0.1:' + owner.port);
        try {
            const pages = browser.contexts().flatMap(context => context.pages());
            const matches = [];
            for (const page of pages) if ((await page.title()).includes(owner.token)) matches.push(page);
            assert.equal(matches.length, 1, 'Exactly one window must match the owned profile token');
            return await callback(matches[0]);
        } finally { await browser.close(); }
    };
    const connect = async () => {
        const visibleUrl = await workbench(async page => {
            const visible = await page.locator('iframe.webview').evaluateAll(frames => frames.filter(frame => {
                const rectangle = frame.getBoundingClientRect();
                return getComputedStyle(frame).visibility === 'visible' && rectangle.width > 0 && rectangle.height > 0;
            }).map(frame => frame.src));
            assert.equal(visible.length, 1, 'Select one visible Markdown editor, never the first background iframe');
            return visible[0];
        });
        const targets = await (await fetch('http://127.0.0.1:' + owner.port + '/json/list')).json();
        const target = targets.find(candidate => candidate.type === 'iframe' && candidate.url === visibleUrl);
        assert.ok(target, 'The active visible editor CDP target must exist');
        const WebSocket = require('ws');
        const socket = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
        let sequence = 0;
        const pending = new Map();
        const contexts = [];
        socket.on('message', raw => {
            const message = JSON.parse(raw);
            if (message.id) {
                const request = pending.get(message.id);
                if (!request) return;
                clearTimeout(request.timer); pending.delete(message.id);
                if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.resolve(message.result);
            } else if (message.method === 'Runtime.executionContextCreated') contexts.push(message.params.context);
        });
        socket.on('close', () => {
            for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Editor CDP connection closed')); }
            pending.clear();
        });
        const send = (method, params = {}) => new Promise((resolve, reject) => {
            const id = ++sequence;
            const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP watchdog expired: ' + method)); }, settings.timeout);
            pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
        });
        try {
            await send('Runtime.enable');
            let contextId;
            for (const context of contexts.filter(value => value.auxData?.isDefault)) {
                const found = await send('Runtime.evaluate', { expression: '!!document.querySelector("#editor")', contextId: context.id, returnByValue: true });
                if (found.result.value) contextId = context.id;
            }
            assert.ok(contextId, 'The active editor context must be ready');
            return {
                send, close: () => socket.close(),
                evaluate: async expression => {
                    const result = await send('Runtime.evaluate', { expression, contextId, returnByValue: true, awaitPromise: true });
                    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
                    return result.result.value;
                }
            };
        } catch (error) { socket.close(); throw error; }
    };
    const open = async file => {
        await driver({ action: 'open', file });
        return until(async () => { try { return await connect(); } catch { return null; } });
    };
    const reset = connection => connection.evaluate(`window.__nativeExportEvents=[];if(!window.__nativeExportListener){window.__nativeExportListener=e=>{if(e.data.type==='exportStatus')window.__nativeExportEvents.push(e.data)};window.addEventListener('message',window.__nativeExportListener)}`);
    const terminal = connection => until(async () => (await connection.evaluate('window.__nativeExportEvents')).findLast(event => ['complete', 'failed', 'cancelled'].includes(event.state)));
    const output = (result, file, format) => {
        assert.equal(result.state, 'complete', result.message);
        assert.equal(path.dirname(result.outputPath), path.dirname(path.join(owner.workspace, file)), 'Output belongs beside the selected source');
        const stem = path.basename(file, '.md');
        const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(path.basename(result.outputPath), new RegExp('^' + escaped + '(?:_[0-9a-f]{8}(?:_(?:[2-9]|[1-9][0-9]+))?)?\\.' + format + '$'), 'Output must belong to the selected document, not a stale iframe');
        assert.ok(fs.statSync(result.outputPath).size > 0);
    };
    const exportFile = async (connection, file, format, viaCommand = false, expectSuccess = true) => {
        if (!viaCommand) {
            await connection.evaluate('document.getElementById("exportButton").click()');
            await until(() => connection.evaluate(`document.querySelector('[data-export-format="${format}"] [data-export-tool-status]').textContent === 'Available'`));
        }
        await reset(connection);
        if (viaCommand) await driver({ action: 'export', format });
        else await connection.evaluate(`document.querySelector('[data-export-format="${format}"]').click()`);
        const result = await terminal(connection);
        if (expectSuccess) output(result, file, format);
        return { ...result, stages: (await connection.evaluate('window.__nativeExportEvents')).filter(event => event.stage).map(event => event.stage) };
    };
    const sourceMode = connection => connection.evaluate(`if(getComputedStyle(document.getElementById('sourceEditor')).display==='none')document.querySelector('[data-action="source"]').click();const e=document.getElementById('sourceEditor');e.focus();e.setSelectionRange(e.value.length,e.value.length)`);
    return { until, driver, connect, open, reset, terminal, output, exportFile, workbench, sourceMode };
}

async function run(settings, owner) {
    receipt(owner); // All mutation is after workspace/profile/installed-extension verification.
    assertSupportedHost();
    verifyInputs(owner.workspace);
    const installed = JSON.parse(fs.readFileSync(path.join(owner.base, 'installed.json'), 'utf8'));
    assert.equal(installed.token, owner.token);
    assert.equal(installed.packageSha256, hash(fs.readFileSync(settings.package)), 'Install the requested package into this profile before testing it');
    const h = harness(settings, owner);
    const receipts = [];
    const report = path.join(owner.base, 'evidence', 'native-' + Date.now() + '.json');
    const record = (name, details = {}) => {
        receipts.push({ name, ...details });
        fs.writeFileSync(report, JSON.stringify({ harness: harnessIdentity(), host: receipt(owner), packageSha256: hash(fs.readFileSync(settings.package)), receipts }, null, 2));
        console.log(name, JSON.stringify(details));
    };
    const available = ['formats', 'saves', 'edges', 'ui', 'selection', 'immutable', 'offline'];
    const groups = settings.suite === 'all' ? available : [settings.suite];
    assert.ok(groups.every(value => available.includes(value)), 'Suite must be all, ' + available.join(', '));
    const htmlExports = [];
    const write = (file, content) => fs.writeFileSync(path.join(owner.workspace, file), content);
    const read = file => fs.readFileSync(path.join(owner.workspace, file));
    try {
        await h.driver({ action: 'config', key: 'export.pandocPath', value: settings.pandoc });
        await h.driver({ action: 'config', key: 'export.browserPath', value: settings.browser });
        if (groups.includes('formats')) for (const file of ['basic.md', 'fallbacks.md', 'pagination.md', 'w30-report.md']) {
            const connection = await h.open(file);
            const original = read(file);
            try {
                await h.until(() => connection.evaluate('document.getElementById("editor").innerText.length > 50'));
                for (const format of ['html', 'pdf', 'docx', 'epub']) {
                    const result = await h.exportFile(connection, file, format);
                    assert.ok(read(file).equals(original));
                    record('format', { file, format, ...result });
                    if (format === 'html') htmlExports.push({ file, outputPath: result.outputPath });
                }
            } finally { connection.close(); }
        }
        if (groups.includes('saves')) for (const mode of ['visual', 'source']) for (const save of ['native', 'keyboard']) {
            const file = `save-${mode}-${save}.md`;
            write(file, '# Saved original\n\nInitial paragraph.\n');
            const connection = await h.open(file);
            try {
                await h.until(() => connection.evaluate('document.getElementById("editor").innerText.includes("Initial paragraph")'));
                if (mode === 'source') await h.sourceMode(connection);
                else await connection.evaluate(`const e=document.getElementById('editor');e.focus();const r=document.createRange();r.selectNodeContents(e);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r)`);
                const marker = `IMMEDIATE-${mode}-${save}-MARKER`;
                await connection.send('Input.insertText', { text: ' ' + marker });
                if (save === 'native') await h.driver({ action: 'save' });
                else for (const type of ['keyDown', 'keyUp']) await connection.send('Input.dispatchKeyEvent', { type, key: 's', code: 'KeyS', modifiers: saveShortcut().modifiers });
                await h.until(() => read(file).toString().includes(marker));
                const original = read(file);
                const state = `JSON.stringify({text:document.getElementById('sourceEditor').value,selection:getSelection().toString(),mode:document.getElementById('sourceEditor').style.display})`;
                const before = await connection.evaluate(state);
                const result = await h.exportFile(connection, file, 'html');
                assert.ok(fs.readFileSync(result.outputPath, 'utf8').includes(marker));
                assert.ok(read(file).equals(original));
                assert.equal(await connection.evaluate(state), before);
                record('immediate-save', { mode, save, shortcut: save === 'keyboard' ? saveShortcut().label : undefined, sourceUnchanged: true, editorStateUnchanged: true, output: path.basename(result.outputPath) });
            } finally { connection.close(); }
        }
        if (groups.includes('edges')) {
            write('edges.md', '# Edge fixture\n\nSAVED-EDGE-MARKER\n');
            let connection = await h.open('edges.md');
            try {
                await connection.evaluate('window.__preservedIdentity="settings-no-reload"');
                for (const key of ['export.pandocPath', 'export.browserPath']) await h.driver({ action: 'config', key, value: path.join(owner.workspace, 'missing-' + key) });
                assert.equal(await connection.evaluate('window.__preservedIdentity'), 'settings-no-reload');
                await h.exportFile(connection, 'edges.md', 'html');
                for (const format of ['docx', 'pdf']) {
                    const result = await h.exportFile(connection, 'edges.md', format, true, false);
                    assert.equal(result.state, 'failed'); assert.match(result.message, /Configured .* path is unusable/);
                    record('missing-' + format, { htmlIndependent: true, settingsPreservedEditor: true });
                }
                for (const [key, value] of [['export.pandocPath', settings.pandoc], ['export.browserPath', settings.browser]]) await h.driver({ action: 'config', key, value });
                const first = await h.exportFile(connection, 'edges.md', 'html');
                const second = await h.exportFile(connection, 'edges.md', 'html');
                assert.equal(first.outputPath, second.outputPath); assert.match(second.message, /reused/i);
                assert.ok(first.outputPath.endsWith('_' + hash(fs.readFileSync(first.outputPath)).slice(-8) + '.html'));
                record('hash-reuse', { output: path.basename(first.outputPath), reused: true });
                const original = read('edges.md'); await h.sourceMode(connection);
                await connection.send('Input.insertText', { text: 'UNSAVED-EDGE-MARKER' });
                const dirty = await h.exportFile(connection, 'edges.md', 'html', true, false);
                assert.equal(dirty.state, 'failed'); assert.match(dirty.message, /Save/); assert.ok(read('edges.md').equals(original));
                record('dirty-rejected', { noAutomaticSave: true });
            } finally { connection.close(); }
            await h.driver({ action: 'untitled' });
            connection = await h.until(async () => { try { return await h.connect(); } catch { return null; } });
            try {
                await h.until(() => connection.evaluate('document.getElementById("editor").innerText.includes("Untitled test")'));
                const result = await h.exportFile(connection, '', 'html', true, false);
                assert.equal(result.state, 'failed'); assert.match(result.message, /Save/); record('untitled-rejected');
            } finally { connection.close(); }
            const directory = path.join(owner.workspace, 'readonly'); fs.mkdirSync(directory, { recursive: true });
            write('readonly/report.md', '# READONLY-SOURCE-MARKER\n'); connection = await h.open('readonly/report.md');
            try {
                fs.chmodSync(directory, 0o555);
                const result = await h.exportFile(connection, 'readonly/report.md', 'html', false, false);
                assert.equal(result.state, 'failed'); assert.match(result.message, /EACCES|EPERM/);
                assert.deepEqual(fs.readdirSync(directory), ['report.md']); record('unwritable-destination', { noPartialOutput: true });
            } finally { fs.chmodSync(directory, 0o755); connection.close(); }
            await cancellationCases(h, owner, record);
        }
        // Restore real discovery before the remaining scenarios after the controlled worker.
        await h.driver({ action: 'config', key: 'export.pandocPath', value: settings.pandoc });
        if (groups.includes('ui')) await appearanceCases(h, owner, record);
        if (groups.includes('selection')) await selectionCase(h, owner, record);
        if (groups.includes('immutable')) await immutableCase(h, owner, record);
        if (groups.includes('offline')) await offlineCases(h, owner, settings, htmlExports, record);
        verifyInputs(owner.workspace);
        record('complete', { frozenInputsUnchanged: true });
    } finally {
        await h.driver({ action: 'config', key: 'export.pandocPath', value: settings.pandoc });
        await h.driver({ action: 'config', key: 'export.browserPath', value: settings.browser });
        for (const [key, value] of [['theme', 'github'], ['language', 'en'], ['toolbarMode', 'full']]) await h.driver({ action: 'config', key, value });
    }
    console.log('Evidence:', report);
}

async function cancellationCases(h, owner, record) {
    let hold = false, closed = false;
    const requests = [], sockets = new Set();
    const image = fs.readFileSync(path.join(owner.workspace, 'assets/Field sample 图像.png'));
    const server = http.createServer((request, response) => {
        requests.push({ url: request.url, method: request.method });
        if (hold) { request.on('close', () => { closed = true; }); return; }
        response.writeHead(200, { 'Content-Type': 'image/png' }); response.end(image);
    });
    server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let connection;
    try {
        const file = 'resource-cancel.md';
        const address = 'http://127.0.0.1:' + server.address().port;
        const source = '# Resource wait\n\n![REQUIRED-IMAGE](' + address + '/required.png)\n\n[Ordinary link](' + address + '/never-fetch)\n';
        fs.writeFileSync(path.join(owner.workspace, file), source); connection = await h.open(file);
        await h.until(() => connection.evaluate('Array.from(document.images).some(image=>image.naturalWidth>0)'));
        hold = true; requests.length = 0; await h.reset(connection); await h.driver({ action: 'export', format: 'html' });
        await h.until(() => requests.length > 0);
        await h.sourceMode(connection);
        await connection.send('Input.insertText', { text: 'EDIT-WHILE-EXPORT-WAITS' });
        assert.ok(await connection.evaluate('document.getElementById("sourceEditor").value.includes("EDIT-WHILE-EXPORT-WAITS")'));
        await connection.evaluate('document.getElementById("exportCancel").click()');
        assert.equal((await h.terminal(connection)).state, 'cancelled'); await h.until(() => closed);
        assert.equal(fs.readFileSync(path.join(owner.workspace, file), 'utf8'), source);
        assert.ok(!fs.existsSync(path.join(owner.workspace, 'resource-cancel.html')));
        assert.deepEqual(requests, [{ url: '/required.png', method: 'GET' }]);
        record('resource-cancel', { editorUsable: true, sourceUnchanged: true, noOutput: true, requests });
    } finally { connection?.close(); for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); }

    const pidFile = path.join(owner.workspace, 'worker.pid');
    const script = path.join(owner.workspace, 'controlled-pandoc.cjs');
    const executable = path.join(owner.workspace, 'controlled pandoc 工具.sh');
    const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
    const prefix = `const fs=require('node:fs');const argument=process.argv[2];if(argument==='--version')console.log('pandoc 3.8.3');else if(argument==='--list-input-formats')console.log('commonmark_x\\njson');else if(argument==='--list-output-formats')console.log('json\\ndocx\\nepub');else if(argument==='--list-extensions=commonmark_x')console.log('+tex_math_gfm');else{fs.writeFileSync(${JSON.stringify(pidFile)},String(process.pid));`;
    fs.writeFileSync(script, prefix + 'process.stdin.resume();setInterval(()=>{},1000)}');
    fs.writeFileSync(executable, '#!/bin/sh\nexec ' + quote(process.execPath) + ' ' + quote(script) + ' "$@"\n', { mode: 0o700 });
    fs.rmSync(pidFile, { force: true });
    fs.writeFileSync(path.join(owner.workspace, 'worker-cancel.md'), '# WORKER-CANCEL-SOURCE\n');
    connection = await h.open('worker-cancel.md');
    try {
        await h.driver({ action: 'config', key: 'export.pandocPath', value: executable });
        await h.reset(connection); await h.driver({ action: 'export', format: 'docx' }); await h.until(() => fs.existsSync(pidFile));
        const pid = Number(fs.readFileSync(pidFile, 'utf8'));
        assert.equal(await connection.evaluate('document.getElementById("exportStatus").dataset.state'), 'running');
        await connection.evaluate('document.getElementById("exportCancel").click()'); assert.equal((await h.terminal(connection)).state, 'cancelled');
        await h.until(() => { try { process.kill(pid, 0); return false; } catch { return true; } });
        assert.ok(!fs.existsSync(path.join(owner.workspace, 'worker-cancel.docx'))); record('worker-cancel', { processEnded: true, noOutput: true });
        fs.writeFileSync(script, prefix + "console.error('CONTROLLED-WRITER-FAILURE');process.exit(2)}");
        const failure = await h.exportFile(connection, 'worker-cancel.md', 'docx', true, false);
        assert.equal(failure.state, 'failed'); assert.match(failure.message, /CONTROLLED-WRITER-FAILURE/);
        assert.ok(!fs.existsSync(path.join(owner.workspace, 'worker-cancel.docx'))); record('worker-failure', { noOutput: true });
    } finally { connection.close(); }
}

async function appearanceCases(h, owner, record) {
    const file = 'appearance.md';
    fs.writeFileSync(path.join(owner.workspace, file), '# Appearance fixture\n\n> A readable quotation.\n\n```math\nE = mc^2\n```\n');
    (await h.open(file)).close();
    const matchingEditor = expression => h.until(async () => {
        let connection;
        try { connection = await h.connect(); if (await connection.evaluate(expression)) return connection; }
        catch { /* Appearance changes may briefly replace the webview. */ }
        connection?.close();
    });
    for (const [mode, language, label] of [['full', 'zh-CN', '导出'], ['simple', 'en', 'Export']]) {
        await h.driver({ action: 'config', key: 'toolbarMode', value: mode });
        await h.driver({ action: 'config', key: 'language', value: language });
        const connection = await matchingEditor(`document.getElementById('exportButton').getAttribute('aria-label')===${JSON.stringify(label)}`);
        try {
            assert.equal(receipt(owner).nativeLanguage, 'en', 'Native VS Code language remains independent of the runtime language');
            assert.equal(await connection.evaluate(`document.getElementById('exportButton').previousElementSibling.dataset.action`), 'openInTextEditor');
            await connection.evaluate(`document.getElementById('exportButton').focus()`);
            for (const format of ['html', 'pdf']) {
                await connection.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown' });
                assert.equal(await connection.evaluate('document.activeElement.dataset.exportFormat'), format);
            }
            await connection.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
            assert.equal(await connection.evaluate('document.getElementById("exportMenu").hidden'), true);
            assert.equal(await connection.evaluate('document.activeElement.id'), 'exportButton');
            record('toolbar', { mode, language, label, nativeLanguage: 'en', keyboardNavigation: true, nextToVsCode: true });
        } finally { connection.close(); }
    }
    for (const theme of ['github', 'night']) {
        await h.driver({ action: 'config', key: 'theme', value: theme });
        const connection = await matchingEditor(`document.documentElement.dataset.theme===${JSON.stringify(theme)}`);
        try {
            const result = await h.exportFile(connection, file, 'html');
            record('theme', { theme, outputPath: result.outputPath });
        } finally { connection.close(); }
    }
    await h.driver({ action: 'config', key: 'theme', value: 'github' });
}

async function selectionCase(h, owner, record) {
    fs.writeFileSync(path.join(owner.workspace, 'command-owner.md'), '# COMMAND-OWNER\n');
    fs.writeFileSync(path.join(owner.workspace, 'normal.txt'), 'NORMAL-TEXT-TAB\n');
    const connection = await h.open('command-owner.md');
    try {
        await h.reset(connection);
        await h.driver({ action: 'text', file: 'normal.txt' });
        await h.driver({ action: 'export', format: 'html' });
        await h.workbench(page => h.until(async () => /Please open a Markdown|Open a Markdown|Markdown file first/i.test(await page.locator('body').innerText())));
        assert.deepEqual(await connection.evaluate('window.__nativeExportEvents'), []);
        assert.ok(!fs.existsSync(path.join(owner.workspace, 'command-owner.html')));
        record('wrong-active-tab', { noCaptureOrOutput: true });
    } finally { connection.close(); }
}

async function immutableCase(h, owner, record) {
    let hold = false, waiting;
    const sockets = new Set();
    const image = fs.readFileSync(path.join(owner.workspace, 'assets/Field sample 图像.png'));
    const server = http.createServer((_request, response) => {
        if (hold) { waiting = response; return; }
        response.writeHead(200, { 'Content-Type': 'image/png' }); response.end(image);
    });
    server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let connection;
    try {
        const file = 'immutable.md';
        const source = '# IMMUTABLE-SAVED-MARKER\n\n![Image](http://127.0.0.1:' + server.address().port + '/image.png)\n';
        fs.writeFileSync(path.join(owner.workspace, file), source); connection = await h.open(file);
        await h.until(() => connection.evaluate('Array.from(document.images).some(image=>image.naturalWidth>0)'));
        hold = true; await h.reset(connection); await h.driver({ action: 'export', format: 'html' });
        await h.until(() => waiting); await h.sourceMode(connection);
        await connection.send('Input.insertText', { text: 'NEW-UNSAVED-AFTER-CAPTURE' });
        waiting.writeHead(200, { 'Content-Type': 'image/png' }); waiting.end(image);
        const result = await h.terminal(connection); h.output(result, file, 'html');
        const output = fs.readFileSync(result.outputPath, 'utf8');
        assert.ok(output.includes('IMMUTABLE-SAVED-MARKER'));
        assert.ok(!output.includes('NEW-UNSAVED-AFTER-CAPTURE'));
        assert.ok(await connection.evaluate('document.getElementById("sourceEditor").value.includes("NEW-UNSAVED-AFTER-CAPTURE")'));
        assert.equal(fs.readFileSync(path.join(owner.workspace, file), 'utf8'), source);
        record('immutable-capture', { capturedSourcePreserved: true, laterUnsavedEditPreserved: true, sourceDiskUnchanged: true });
    } finally { connection?.close(); for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); }
}

async function offlineCases(h, owner, settings, outputs, record) {
    // A focused offline run first creates its own installed-VSIX HTML outputs.
    if (!outputs.length) for (const file of ['basic.md', 'fallbacks.md', 'pagination.md', 'w30-report.md']) {
        const connection = await h.open(file);
        try { outputs.push({ file, outputPath: (await h.exportFile(connection, file, 'html')).outputPath }); }
        finally { connection.close(); }
    }
    const { discoverTool } = require(path.join(receipt(owner).extensionPath, 'out/export/tools.js'));
    const tool = await discoverTool('browser', settings.browser);
    assert.equal(tool.available, true, tool.error);
    const browser = await require('playwright-core').chromium.launch({ executablePath: tool.path, headless: true, chromiumSandbox: true });
    const folder = fs.mkdtempSync(path.join(owner.base, 'evidence/relocated-'));
    try {
        const context = await browser.newContext({ offline: true });
        for (const result of outputs) {
            const file = path.join(folder, path.basename(result.outputPath));
            fs.copyFileSync(result.outputPath, file);
            const page = await context.newPage(), external = [], errors = [];
            page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(pathToFileURL(file).href);
            await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(image => image.decode())); });
            const data = await page.evaluate(() => ({
                text: document.body.innerText,
                images: Array.from(document.images).map(image => ({ width: image.naturalWidth, height: image.naturalHeight, complete: image.complete })),
                controls: document.querySelectorAll('#exportButton,#toolbar,#sourceEditor,[contenteditable=true],script').length,
                background: getComputedStyle(document.body).backgroundColor,
                quote: document.querySelector('blockquote') ? getComputedStyle(document.querySelector('blockquote')).color : null
            }));
            const marker = { 'basic.md': 'BASIC-LAST-MARKER', 'fallbacks.md': 'FALLBACK-LAST-MARKER', 'pagination.md': 'PAGINATION-LAST-MARKER', 'w30-report.md': 'W30-LAST-MARKER' }[result.file];
            assert.ok(data.text.includes(marker)); assert.equal(data.controls, 0);
            assert.deepEqual(external, []); assert.deepEqual(errors, []);
            assert.ok(data.images.every(image => image.complete && image.width > 0));
            let originalImagePreserved;
            if (result.file === 'basic.md') {
                const original = fs.readFileSync(path.join(owner.workspace, 'assets/Field sample 图像.png'));
                originalImagePreserved = fs.readFileSync(file, 'utf8').includes('data:image/png;base64,' + original.toString('base64'));
                assert.equal(originalImagePreserved, true);
                await page.screenshot({ path: path.join(folder, 'basic-html.png'), fullPage: true });
            }
            record('offline-html', { file: result.file, browser: tool.version, relocatedPath: file, externalRequests: 0, scriptErrors: 0, images: data.images, quoteColor: data.quote, bodyBackground: data.background, editorControls: 0, originalImagePreserved });
            await page.close();
        }
        await context.close();
    } finally { await browser.close(); }
}

async function main() {
    const settings = options();
    if (settings.command === 'init') return initialize(settings);
    const owner = owned(settings);
    if (settings.command === 'install' || settings.command === 'launch') {
        assertSupportedHost();
        const args = ['--user-data-dir', owner.profile, '--extensions-dir', owner.extensions];
        if (settings.command === 'install') {
            assert.ok(fs.existsSync(settings.package), 'Build the requested VSIX first');
            args.push('--install-extension', settings.package, '--force');
        } else {
            if (process.platform === 'linux') assert.ok(process.env.DISPLAY || process.env.WAYLAND_DISPLAY,
                'Launch under the local Linux desktop session, or an explicitly provisioned Xvfb display.');
            // Refuse to connect accidentally to another running debugging session.
            const probe = net.createServer();
            await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(owner.port, '127.0.0.1', resolve); });
            await new Promise(resolve => probe.close(resolve));
            args.push('--new-window', '--locale', 'en', '--skip-welcome', '--skip-release-notes',
                '--extensionDevelopmentPath=' + owner.driver, '--remote-debugging-port=' + owner.port,
                '--remote-debugging-address=127.0.0.1', owner.workspace);
        }
        const environment = { ...process.env };
        // An inherited integrated-terminal IPC hook must not redirect the CLI into another VS Code profile.
        delete environment.VSCODE_IPC_HOOK_CLI;
        // The CLI must not consume the remaining commands of a piped SSH script.
        const child = spawnSync(settings.code, args, { stdio: ['ignore', 'inherit', 'inherit'], env: environment });
        if (child.error) throw child.error;
        assert.equal(child.status, 0, 'Isolated VS Code command failed');
        if (settings.command === 'install') fs.writeFileSync(path.join(owner.base, 'installed.json'), JSON.stringify({ token: owner.token, packagePath: settings.package, packageSha256: hash(fs.readFileSync(settings.package)), installedAt: new Date().toISOString() }, null, 2));
        return;
    }
    if (settings.command === 'check') {
        const response = await harness(settings, owner).driver({ action: 'inspect' });
        console.log(JSON.stringify({ ready: true, frozenInputs: verifyInputs(owner.workspace), harness: harnessIdentity(), ...response }, null, 2));
        return;
    }
    if (settings.command === 'run') return run(settings, owner);
    throw new Error('Use init, install, launch, check or run. See test/native/export-smoke.md.');
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
