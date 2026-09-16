'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const toolsPath = path.resolve(__dirname, '../../out/export/tools.js');
const localRequire = createRequire(toolsPath);

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function windowsTools({ available = false, launch } = {}) {
    const checked = [];
    const module = { exports: {} };
    const mocks = {
        path: path.win32,
        os: { homedir: () => String.raw`C:\Users\runner` },
        'fs/promises': {
            access: async file => { checked.push(file); if (!available) throw new Error('Not installed'); },
            stat: async () => ({ isFile: () => true })
        }
    };
    new Function('require', 'module', 'exports', 'process', '__dirname', fs.readFileSync(toolsPath, 'utf8'))(
        name => name.endsWith('vendor\\playwright-core') ? { chromium: { launch } } : mocks[name] || localRequire(name),
        module, module.exports, { platform: 'win32', env: {
            PATH: String.raw`C:\custom tools;D:\other tools`,
            LOCALAPPDATA: String.raw`C:\Users\runner\AppData\Local`,
            ProgramFiles: String.raw`C:\Program Files`,
            'ProgramFiles(x86)': String.raw`C:\Program Files (x86)`
        } }, path.dirname(toolsPath));
    return { ...module.exports, checked };
}

test('Windows discovery searches executable names and per-user/system installation paths', async () => {
    const tools = windowsTools();
    await tools.discoverTool('pandoc', '');
    assert.ok(tools.checked.includes(String.raw`C:\custom tools\pandoc.exe`));
    assert.ok(tools.checked.includes(String.raw`C:\Users\runner\AppData\Local\Pandoc\pandoc.exe`));
    assert.ok(tools.checked.includes(String.raw`C:\Program Files\Pandoc\pandoc.exe`));
    tools.checked.length = 0;
    await tools.discoverTool('browser', '');
    assert.ok(tools.checked.includes(String.raw`C:\custom tools\msedge.exe`));
    assert.ok(tools.checked.includes(String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`));
    assert.ok(tools.checked.includes(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`));
    assert.ok(tools.checked.every(file => file.endsWith('.exe')));
});

test('Windows browser discovery uses its sandboxed browser protocol and closes the probe', async () => {
    let closed = 0;
    const executable = String.raw`C:\Browser files\chrome.exe`;
    const tools = windowsTools({ available: true, launch: async options => {
        assert.equal(options.executablePath, executable);
        assert.equal(options.chromiumSandbox, true);
        assert.equal(options.headless, true);
        assert.equal(options.timeout, 10000);
        return { version: () => '145.0.0.0', close: async () => { closed++; } };
    } });
    const status = await tools.discoverTool('browser', executable);
    assert.equal(status.available, true);
    assert.equal(status.version, 'Chromium 145.0.0.0');
    assert.equal(closed, 1);
});

test('cancelling Windows browser discovery during launch closes its eventual worker', async () => {
    const controller = new AbortController();
    let closed = 0;
    const tools = windowsTools({ available: true, launch: async () => {
        controller.abort();
        return { version: () => '145.0.0.0', close: async () => { closed++; } };
    } });
    await assert.rejects(tools.discoverTool('browser', String.raw`C:\chrome.exe`, controller.signal), { name: 'AbortError' });
    assert.equal(closed, 1);
});

test('overlapping Windows capability checks share one browser launch until it is closed', async () => {
    const started = deferred(), finishLaunch = deferred(), finishClose = deferred();
    let launches = 0, closed = 0;
    const tools = windowsTools({ available: true, launch: async () => {
        launches++;
        started.resolve();
        if (launches > 1) throw new Error('Concurrent browser startup exhausted the probe deadline');
        await finishLaunch.promise;
        return { version: () => '145.0.0.0', close: async () => { closed++; await finishClose.promise; } };
    } });
    const executable = String.raw`C:\Browser files\chrome.exe`;
    const pending = Array.from({ length: 12 }, () => tools.discoverTool('browser', executable));
    await started.promise;
    finishLaunch.resolve();
    await new Promise(resolve => setImmediate(resolve));
    pending.push(tools.discoverTool('browser', executable.toUpperCase()));
    await new Promise(resolve => setImmediate(resolve));
    finishClose.resolve();
    const statuses = await Promise.all(pending);
    assert.ok(statuses.every(status => status.available), 'Every editor and export receives the shared probe result');
    assert.equal(launches, 1);
    assert.equal(closed, 1);
});

test('cancelling one Windows capability waiter leaves the other editor probe running', async () => {
    const started = deferred(), finish = deferred();
    const abort = new AbortController();
    let launches = 0, closed = 0;
    const tools = windowsTools({ available: true, launch: async () => {
        launches++;
        started.resolve();
        await finish.promise;
        return { version: () => '145.0.0.0', close: async () => { closed++; } };
    } });
    const executable = String.raw`C:\Browser files\chrome.exe`;
    const cancelled = tools.discoverTool('browser', executable, abort.signal);
    const surviving = tools.discoverTool('browser', executable);
    await started.promise;
    abort.abort();
    // Cancellation must resolve without waiting for the browser startup.
    const rejection = assert.rejects(cancelled, { name: 'AbortError' });
    try {
        await Promise.race([rejection, new Promise((_, reject) => setTimeout(() => reject(new Error('Cancellation waited for launch')), 500))]);
    } finally { finish.resolve(); }
    assert.equal((await surviving).available, true);
    assert.equal(launches, 1);
    assert.equal(closed, 1);
});

test('completed Windows probes are not cached and a failed probe can recover', async () => {
    let launches = 0, closed = 0;
    const tools = windowsTools({ available: true, launch: async () => {
        if (++launches === 1) throw new Error('Browser startup failed');
        return { version: () => '145.0.0.0', close: async () => { closed++; } };
    } });
    const executable = String.raw`C:\Browser files\chrome.exe`;
    const failed = await tools.discoverTool('browser', executable);
    assert.equal(failed.available, false);
    assert.match(failed.error, /Browser startup failed/);
    assert.equal((await tools.discoverTool('browser', executable)).available, true);
    assert.equal((await tools.discoverTool('browser', executable)).available, true);
    assert.equal(launches, 3, 'A later menu opening or export rechecks the actual executable');
    assert.equal(closed, 2);
});

test('different Windows browser paths are probed independently', async () => {
    const launches = [];
    const tools = windowsTools({ available: true, launch: async options => {
        launches.push(options.executablePath);
        return { version: () => '145.0.0.0', close: async () => {} };
    } });
    const paths = [String.raw`C:\Chrome\chrome.exe`, String.raw`C:\Edge\msedge.exe`];
    const statuses = await Promise.all(paths.map(executable => tools.discoverTool('browser', executable)));
    assert.deepEqual(launches, paths);
    assert.deepEqual(statuses.map(status => status.path), paths);
});
