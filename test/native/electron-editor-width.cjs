'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('native-playwright');
const { source, geometry, widthChecks } = require('./editor-width.cjs');

async function main() {
    const root = path.resolve(__dirname, '../..'), desktop = path.join(root, 'electron');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-electron-width-'));
    const profile = path.join(directory, 'profile'); fs.mkdirSync(profile);
    fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({ language: 'en' }));
    const fixture = path.join(directory, 'width.md'); fs.writeFileSync(fixture, source);
    const bootstrap = path.join(directory, 'bootstrap.cjs');
    fs.writeFileSync(bootstrap, `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(profile)}); app.setAppPath(${JSON.stringify(desktop)}); global.__widthStore = require(${JSON.stringify(path.join(desktop, 'node_modules/electron-store'))}); const { SettingsManager } = require(${JSON.stringify(path.join(desktop, 'out/settings-manager.js'))}); const getAll = SettingsManager.prototype.getAll; SettingsManager.prototype.getAll = function() { global.__widthSettings = this; SettingsManager.prototype.getAll = getAll; return getAll.call(this); }; process.argv = [process.argv[0], ${JSON.stringify(desktop)}, ${JSON.stringify(fixture)}]; require(${JSON.stringify(path.join(desktop, 'out/main.js'))});`);
    const application = await _electron.launch({ executablePath: require('../../electron/node_modules/electron'), args: [bootstrap], env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } });
    const evidence = path.join(root, '.vscode-test', 'electron-width-' + Date.now()); fs.mkdirSync(evidence, { recursive: true });
    const receipts = [];
    const until = async (probe, label) => {
        const started = Date.now();
        while (!await probe()) {
            assert.ok(Date.now() - started < 10000, label);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    };
    try {
        assert.equal(await application.evaluate(({ app }) => app.getPath('userData')), profile);
        const page = await application.firstWindow(); await page.waitForSelector('#editor td');
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).webContents.closeDevTools());
        assert.equal(await page.locator('html').getAttribute('data-editor-width-mode'), 'default');
        // Real Preferences controls/IPC; bypass only the OS menu's focus rule.
        const [preferences] = await Promise.all([
            application.waitForEvent('window'),
            application.evaluate(({ BrowserWindow }) => global.__widthSettings.openSettingsWindow(BrowserWindow.getAllWindows().find(window => window.__fileManager))),
        ]);
        await preferences.waitForSelector('#editorWidthMode');
        const set = async (key, value) => {
            const control = preferences.locator('#' + key);
            if (key === 'editorWidthMode') await control.selectOption(value);
            else { await control.fill(String(value)); await control.press('Tab'); }
        };
        const before = await widthChecks({ editor: page, set, until, record: (name, details) => receipts.push({ name, ...details }) });
        assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).__fileManager.isDirtyState()), false);
        await set('editorMaxWidth', 300);
        await preferences.locator('#settingsError').waitFor({ state: 'visible' });
        assert.equal(await preferences.locator('#editorMaxWidth').inputValue(), '1200');
        await application.evaluate(() => {
            const original = global.__widthStore.prototype.set;
            global.__widthStore.prototype.set = function(key, ...args) {
                if (key === 'editorMaxWidth') { global.__widthStore.prototype.set = original; throw new Error('Synthetic preference failure'); }
                return original.call(this, key, ...args);
            };
        });
        await set('editorMaxWidth', 1500);
        await preferences.locator('#settingsError').waitFor({ state: 'visible' });
        await until(async () => await preferences.locator('#editorMaxWidth').inputValue() === '1200', 'failed save restores field');
        assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).editorMaxWidth, 1200);
        await set('editorMaxWidth', 1000);
        await preferences.locator('#settingsError').waitFor({ state: 'hidden' });
        await set('editorWidthMode', 'custom');
        await page.waitForFunction(() => document.documentElement.dataset.editorWidthMode === 'custom');
        assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).editorMaxWidth, 1000);
        await page.locator('[data-action="bold"]').click();
        const edited = await page.evaluate(() => window.htmlToMarkdown()); assert.notEqual(edited, before);
        await set('editorWidthMode', 'full');
        await page.waitForFunction(() => document.documentElement.dataset.editorWidthMode === 'full');
        await page.locator('[data-action="undo"]').click();
        assert.equal(await page.evaluate(() => window.htmlToMarkdown()), before);
        await page.keyboard.press((process.platform === 'darwin' ? 'Meta' : 'Control') + '+s');
        await until(async () => fs.readFileSync(fixture, 'utf8') === before, 'native saved source');
        for (const zoom of [1, 2]) for (const width of [500, 1400]) {
            await application.evaluate(({ BrowserWindow }, { zoom, width }) => {
                const window = BrowserWindow.getAllWindows().find(window => window.__fileManager);
                window.setContentSize(width, 900); window.webContents.setZoomFactor(zoom);
            }, { zoom, width });
            await page.waitForFunction(({ zoom, width }) => Math.abs(innerWidth * zoom - width) <= 2, { zoom, width });
            const box = await page.evaluate(geometry);
            assert.ok(Math.abs(box.width - box.pane) < 1);
            assert.ok(box.padding <= 60);
            const png = await application.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows().find(window => window.__fileManager).webContents.capturePage()).toPNG().toString('base64'));
            fs.writeFileSync(path.join(evidence, `width-${width}-${zoom}x.png`), Buffer.from(png, 'base64'));
            receipts.push({ width, zoom, box, realWindowSizeAndZoom: true });
        }
        const [reopened] = await Promise.all([
            application.waitForEvent('window'),
            application.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(item => item.label === 'File').submenu.items.find(item => item.label === 'New').click()),
        ]);
        await reopened.waitForFunction(() => document.documentElement.dataset.editorWidthMode === 'full');
        assert.equal(await reopened.locator('html').getAttribute('data-editor-max-width'), '1000');
        receipts.push({ realPreferences: true, invalidValueRejected: true, failedSaveRetried: true, reopenedPreference: true,
            cleanStateAndUndo: true, nativeSave: true, versions: await application.evaluate(() => ({ electron: process.versions.electron, chromium: process.versions.chrome })) });
        fs.writeFileSync(path.join(evidence, 'receipt.json'), JSON.stringify(receipts, null, 2));
        console.log('Electron width checks passed. Evidence:', evidence);
    } finally {
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()));
        await application.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
