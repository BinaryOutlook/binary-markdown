'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('native-playwright');
const { source, equationPositionChecks } = require('./equation-source-position.cjs');

async function main() {
    const root = path.resolve(__dirname, '../..'), desktop = path.join(root, 'electron');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-electron-equation-source-position-'));
    const profile = path.join(directory, 'profile'); fs.mkdirSync(profile);
    const locale = process.env.EQUATION_POSITION_LOCALE || 'en'; assert.ok(['en', 'zh-CN'].includes(locale));
    fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({ language: locale }));
    const fixture = path.join(directory, 'equations.md'); fs.writeFileSync(fixture, source);
    const bootstrap = path.join(directory, 'bootstrap.cjs');
    fs.writeFileSync(bootstrap, `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(profile)}); app.setAppPath(${JSON.stringify(desktop)}); global.__positionStore = require(${JSON.stringify(path.join(desktop, 'node_modules/electron-store'))}); const { SettingsManager } = require(${JSON.stringify(path.join(desktop, 'out/settings-manager.js'))}); const getAll = SettingsManager.prototype.getAll; SettingsManager.prototype.getAll = function() { global.__positionSettings = this; SettingsManager.prototype.getAll = getAll; return getAll.call(this); }; process.argv = [process.argv[0], ${JSON.stringify(desktop)}, ${JSON.stringify(fixture)}]; require(${JSON.stringify(path.join(desktop, 'out/main.js'))});`);
    let application = await _electron.launch({ executablePath: require('../../electron/node_modules/electron'), args: [bootstrap], env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } });
    const evidence = path.join(root, '.vscode-test', 'electron-equation-source-position-' + Date.now()); fs.mkdirSync(evidence, { recursive: true });
    const receipts = [], messages = require('../../out/locales/' + locale.toLowerCase() + '.js').webviewMessages;
    try {
        assert.equal(await application.evaluate(({ app }) => app.getPath('userData')), profile);
        const page = await application.firstWindow(); await page.waitForSelector('.math-display');
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).webContents.closeDevTools());
        assert.equal(await page.locator('html').getAttribute('data-math-source-position'), 'above');
        // Real Preferences controls and IPC. Bypass only the OS menu focus rule.
        const [preferences] = await Promise.all([
            application.waitForEvent('window'),
            application.evaluate(({ BrowserWindow }, messages) => global.__positionSettings.openSettingsWindow(BrowserWindow.getAllWindows().find(window => window.__fileManager), messages), messages),
        ]);
        const control = preferences.getByLabel(messages.mathSourcePositionLabel, { exact: true }); await control.waitFor();
        assert.equal(await control.inputValue(), 'above');
        assert.deepEqual(await control.locator('option').allTextContents(), [messages.mathSourcePositionAbove, messages.mathSourcePositionBelow]);
        const set = async value => { await control.selectOption(value); await page.bringToFront(); };
        await set('below'); await page.waitForFunction(() => document.documentElement.dataset.mathSourcePosition === 'below');
        assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).mathSourcePosition, 'below');
        await application.evaluate(() => {
            const original = global.__positionStore.prototype.set;
            global.__positionStore.prototype.set = function(key, ...args) {
                if (key === 'mathSourcePosition') { global.__positionStore.prototype.set = original; throw new Error('Synthetic preference failure'); }
                return original.call(this, key, ...args);
            };
        });
        await set('above'); await preferences.locator('#settingsError').waitFor({ state: 'visible' });
        assert.equal(await preferences.locator('#settingsError').textContent(), messages.mathSourcePositionSaveFailed);
        assert.equal(await control.inputValue(), 'below');
        assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).mathSourcePosition, 'below');
        assert.equal(await page.locator('html').getAttribute('data-math-source-position'), 'below');
        await set('above'); await preferences.locator('#settingsError').waitFor({ state: 'hidden' });
        await page.waitForFunction(() => document.documentElement.dataset.mathSourcePosition === 'above');
        assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).__fileManager.isDirtyState()), false);
        assert.equal(await page.evaluate(() => window.htmlToMarkdown()), source);
        assert.equal(await page.locator('[data-action="undo"]').isDisabled(), true);
        await set('below'); await page.waitForFunction(() => document.documentElement.dataset.mathSourcePosition === 'below');
        const changed = await equationPositionChecks({ editor: page, keyboard: page.keyboard, set,
            save: async expected => {
                await page.keyboard.press((process.platform === 'darwin' ? 'Meta' : 'Control') + '+s');
                const start = Date.now();
                while (fs.readFileSync(fixture, 'utf8') !== expected) {
                    assert.ok(Date.now() - start < 10000, 'Saved equation matches current content');
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            },
            capture: async name => {
                await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                const bytes = await application.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows().find(window => window.__fileManager).webContents.capturePage()).toPNG().toString('base64'));
                fs.writeFileSync(path.join(evidence, name + '.png'), Buffer.from(bytes, 'base64'));
            }, record: (name, details) => receipts.push({ name, ...details }) });
        await page.locator('[data-action="source"]').click();
        assert.equal(await page.locator('#sourceEditor').inputValue(), changed);
        await page.locator('[data-action="source"]').click();
        assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).__fileManager.isDirtyState()), false);
        await preferences.bringToFront(); await control.scrollIntoViewIfNeeded();
        await preferences.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const bounds = await control.boundingBox();
        assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= await preferences.evaluate(() => innerHeight));
        receipts.push({ preferencesViewport: await preferences.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollY })), positionControlBounds: bounds });
        const png = await application.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows().find(window => window.getTitle() === 'Preferences').webContents.capturePage()).toPNG().toString('base64'));
        fs.writeFileSync(path.join(evidence, 'preferences.png'), Buffer.from(png, 'base64'));
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()));
        await application.close();
        application = await _electron.launch({ executablePath: require('../../electron/node_modules/electron'), args: [bootstrap], env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } });
        const reopened = await application.firstWindow();
        await reopened.waitForFunction(() => document.documentElement.dataset.mathSourcePosition === 'below' && Boolean(document.querySelector('.math-display')));
        assert.equal(await reopened.evaluate(() => window.htmlToMarkdown()), changed);
        assert.equal(fs.readFileSync(fixture, 'utf8'), changed);
        receipts.push({ locale, realPreferences: true, localizedLabels: true, failedSaveRestoresPreference: true, retry: true, reopenedPersistence: true, sourceAndCleanStatePreserved: true, versions: await application.evaluate(() => ({ electron: process.versions.electron, chromium: process.versions.chrome })) });
        fs.writeFileSync(path.join(evidence, 'receipt.json'), JSON.stringify(receipts, null, 2));
        console.log('Electron equation source position passed. Evidence:', evidence);
    } finally {
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()));
        await application.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
