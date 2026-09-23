'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('native-playwright');
const { source, insertMenuChecks } = require('./insert-menu.cjs');

async function main() {
    const root = path.resolve(__dirname, '../..'), desktop = path.join(root, 'electron');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-electron-insert-'));
    const profile = path.join(directory, 'profile'); fs.mkdirSync(profile);
    const fixture = path.join(directory, 'document.md'); fs.writeFileSync(fixture, source);
    const image = path.join(directory, 'selected-image.png');
    fs.copyFileSync(path.join(root, 'test/fixtures/exports/assets/Field sample 图像.png'), image);
    const bootstrap = path.join(directory, 'bootstrap.cjs');
    fs.writeFileSync(bootstrap, `const { app, dialog } = require('electron'); app.setPath('userData', ${JSON.stringify(profile)}); app.setAppPath(${JSON.stringify(desktop)}); const { SettingsManager } = require(${JSON.stringify(path.join(desktop, 'out/settings-manager.js'))}); const getAll = SettingsManager.prototype.getAll; SettingsManager.prototype.getAll = function() { global.__insertSettings = this; SettingsManager.prototype.getAll = getAll; return getAll.call(this); }; dialog.showOpenDialog = () => new Promise(resolve => { global.__insertImageResolve = resolve; }); process.argv = [process.argv[0], ${JSON.stringify(desktop)}, ${JSON.stringify(fixture)}]; require(${JSON.stringify(path.join(desktop, 'out/main.js'))});`);
    const application = await _electron.launch({ executablePath: require('../../electron/node_modules/electron'), args: [bootstrap], env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } });
    const evidence = path.join(root, '.vscode-test', 'electron-insert-menu-' + Date.now()); fs.mkdirSync(evidence, { recursive: true });
    const receipts = [];
    try {
        assert.equal(await application.evaluate(({ app }) => app.getPath('userData')), profile);
        const page = await application.firstWindow(); await page.waitForSelector('#editor td');
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).webContents.closeDevTools());
        const [preferences] = await Promise.all([application.waitForEvent('window'), application.evaluate(({ BrowserWindow }) => global.__insertSettings.openSettingsWindow(BrowserWindow.getAllWindows().find(window => window.__fileManager)))]);
        await preferences.waitForSelector('#toolbarMode');
        const capture = async name => {
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            if (name.endsWith('-insert')) assert.equal(await page.locator('#insertMenu').isVisible(), true);
            const bytes = await application.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows().find(window => window.__fileManager).webContents.capturePage()).toPNG().toString('base64'));
            fs.writeFileSync(path.join(evidence, name + '.png'), Buffer.from(bytes, 'base64'));
        };
        await insertMenuChecks({ editor: page, keyboard: page.keyboard,
            setMode: value => preferences.locator('#toolbarMode').selectOption(value),
            capture, record: (name, details) => receipts.push({ name, ...details }),
            save: async expected => {
                await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');
                const started = Date.now();
                while (fs.readFileSync(fixture, 'utf8') !== expected) {
                    assert.ok(Date.now() - started < 10000, 'Saved insertion matches the renderer content');
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            },
            dialog: async (action, accepted) => {
                if (action === 'link') {
                    await page.locator('.host-link-dialog').waitFor({ state: 'visible' });
                    if (accepted) {
                        await page.locator('.host-link-dialog input[name="url"]').fill('https://example.com/reference');
                        await capture('link-dialog');
                        await page.keyboard.press('Enter');
                    } else await page.keyboard.press('Escape');
                    await page.locator('.host-link-dialog').waitFor({ state: 'hidden' });
                } else {
                    // Control only the OS picker result; IPC, file copying and
                    // insertion all execute in the real owned Electron host.
                    const started = Date.now();
                    while (!await application.evaluate(() => Boolean(global.__insertImageResolve))) {
                        assert.ok(Date.now() - started < 10000, 'Image picker was requested');
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    await application.evaluate((_, { accepted, image }) => {
                        global.__insertImageResolve({ canceled: !accepted, filePaths: accepted ? [image] : [] });
                        delete global.__insertImageResolve;
                    }, { accepted, image });
                }
            }
        });
        await page.locator('[data-action="source"]').click();
        assert.equal(await page.locator('#sourceEditor').inputValue(), source);
        await page.locator('[data-action="source"]').click();
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');
        const started = Date.now();
        while (await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).__fileManager.isDirtyState())) {
            assert.ok(Date.now() - started < 10000, 'Electron Save clears dirty state');
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.equal(fs.readFileSync(fixture, 'utf8'), source);
        receipts.push({ versions: await application.evaluate(() => ({ electron: process.versions.electron, chromium: process.versions.chrome })), sourceModeAndSaveUnchanged: true,
            settingsRoute: 'real Preferences controls and IPC; direct window opening', linkRoute: 'real modal form, keyboard confirmation and Escape',
            imageRoute: 'controlled OS-picker result; real IPC, file copy, insertion and undo; OS-picker interaction unverified' });
        fs.writeFileSync(path.join(evidence, 'receipt.json'), JSON.stringify(receipts, null, 2));
        console.log('Electron Insert passed. Evidence:', evidence);
    } finally {
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()));
        await application.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
