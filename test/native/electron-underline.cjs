'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('native-playwright');
const { source, underlineChecks } = require('./underline.cjs');

async function main() {
    const root = path.resolve(__dirname, '../..'), desktop = path.join(root, 'electron');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-electron-underline-'));
    const profile = path.join(directory, 'profile'); fs.mkdirSync(profile);
    const fixture = path.join(directory, 'underline.md'); fs.writeFileSync(fixture, source);
    const bootstrap = path.join(directory, 'bootstrap.cjs');
    fs.writeFileSync(bootstrap, `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(profile)}); app.setAppPath(${JSON.stringify(desktop)}); process.argv = [process.argv[0], ${JSON.stringify(desktop)}, ${JSON.stringify(fixture)}]; require(${JSON.stringify(path.join(desktop, 'out/main.js'))});`);
    const application = await _electron.launch({ executablePath: require('../../electron/node_modules/electron'), args: [bootstrap], env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } });
    const evidence = path.join(root, '.vscode-test', 'electron-underline-' + Date.now()); fs.mkdirSync(evidence, { recursive: true });
    const receipts = [];
    try {
        assert.equal(await application.evaluate(({ app }) => app.getPath('userData')), profile);
        const page = await application.firstWindow(); await page.waitForSelector('#editor td');
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).webContents.closeDevTools());
        const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
        const before = await underlineChecks({ editor: page, keyboard: page.keyboard, modifier,
            save: async expected => {
                await page.keyboard.press(modifier + '+s');
                const started = Date.now();
                while (fs.readFileSync(fixture, 'utf8') !== expected) {
                    assert.ok(Date.now() - started < 10000, 'Saved underline matches current content');
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            },
            capture: async name => {
                if (!name.includes('blockquote')) return;
                await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                const bytes = await application.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows().find(window => window.__fileManager).webContents.capturePage()).toPNG().toString('base64'));
                fs.writeFileSync(path.join(evidence, name + '.png'), Buffer.from(bytes, 'base64'));
            },
            record: (name, details) => receipts.push({ name, ...details })
        });
        await page.locator('[data-action="source"]').click();
        assert.equal(await page.locator('#sourceEditor').inputValue(), before);
        await page.locator('[data-action="source"]').click();
        assert.equal(await page.locator('#editor u').count(), 1);
        assert.equal(fs.readFileSync(fixture, 'utf8'), before);
        receipts.push({ versions: await application.evaluate(() => ({ electron: process.versions.electron, chromium: process.versions.chrome })), sourceRoundTrip: true, nativeSave: true });
        fs.writeFileSync(path.join(evidence, 'receipt.json'), JSON.stringify(receipts, null, 2));
        console.log('Electron underline passed. Evidence:', evidence);
    } finally {
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()));
        await application.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
