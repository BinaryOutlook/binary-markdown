'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const toolsPath = path.resolve(__dirname, '../../out/export/tools.js');
const localRequire = createRequire(toolsPath);

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
