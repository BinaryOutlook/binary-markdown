'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('native-playwright');
const { source, tableRowChecks } = require('./table-toolbar-row.cjs');

async function main() {
    const root = path.resolve(__dirname, '../..'), desktop = path.join(root, 'electron');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-electron-table-row-'));
    const profile = path.join(directory, 'profile'); fs.mkdirSync(profile);
    const fixture = path.join(directory, 'table.md'); fs.writeFileSync(fixture, source);
    const bootstrap = path.join(directory, 'bootstrap.cjs');
    fs.writeFileSync(bootstrap, `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(profile)}); app.setAppPath(${JSON.stringify(desktop)}); const { SettingsManager } = require(${JSON.stringify(path.join(desktop, 'out/settings-manager.js'))}); const getAll = SettingsManager.prototype.getAll; SettingsManager.prototype.getAll = function() { global.__rowSettings = this; SettingsManager.prototype.getAll = getAll; return getAll.call(this); }; process.argv = [process.argv[0], ${JSON.stringify(desktop)}, ${JSON.stringify(fixture)}]; require(${JSON.stringify(path.join(desktop, 'out/main.js'))});`);
    const application = await _electron.launch({ executablePath: require('../../electron/node_modules/electron'), args: [bootstrap], env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } });
    const evidence = path.join(root, '.vscode-test', 'electron-table-row-' + Date.now()); fs.mkdirSync(evidence, { recursive: true });
    const receipts = [];
    try {
        assert.equal(await application.evaluate(({ app }) => app.getPath('userData')), profile);
        const page = await application.firstWindow(); await page.waitForSelector('#editor td');
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).webContents.closeDevTools());
        const [preferences] = await Promise.all([application.waitForEvent('window'), application.evaluate(({ BrowserWindow }) => global.__rowSettings.openSettingsWindow(BrowserWindow.getAllWindows().find(window => window.__fileManager)))]);
        await preferences.waitForSelector('#toolbarMode');
        await tableRowChecks({ editor: page, keyboard: page.keyboard,
            setMode: value => preferences.locator('#toolbarMode').selectOption(value),
            setPosition: value => preferences.locator('#tableToolbarPosition').selectOption(value),
            resize: async (width, height) => {
                await application.evaluate(({ BrowserWindow }, { width, height }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).setContentSize(width, height), { width, height });
                await page.waitForFunction(({ width, height }) => innerWidth === width && innerHeight === height, { width, height });
            },
            capture: async name => {
                const image = await application.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows().find(window => window.__fileManager).webContents.capturePage()).toPNG().toString('base64'));
                fs.writeFileSync(path.join(evidence, name + '.png'), Buffer.from(image, 'base64'));
            },
            record: (name, details) => receipts.push({ name, ...details }),
        });
        assert.equal(fs.readFileSync(fixture, 'utf8'), source);
        await page.locator('#toolbar [data-action="source"]').click();
        assert.equal(await page.locator('#sourceEditor').inputValue(), source);
        await page.locator('#toolbar [data-action="source"]').click();
        // The table action and its undo are saved through the real file manager.
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');
        const started = Date.now();
        while (await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).__fileManager.isDirtyState())) {
            assert.ok(Date.now() - started < 10000, 'Electron Save clears the dirty state');
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.equal(fs.readFileSync(fixture, 'utf8'), source);
        receipts.push({ versions: await application.evaluate(() => ({ electron: process.versions.electron, chromium: process.versions.chrome })), sourceModeAndSaveUnchanged: true, settingsRoute: 'real Preferences controls and IPC; direct window opening' });
        fs.writeFileSync(path.join(evidence, 'receipt.json'), JSON.stringify(receipts, null, 2));
        console.log('Electron contextual row passed. Evidence:', evidence);
    } finally {
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()));
        await application.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
