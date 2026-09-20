'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('native-playwright');
const { source, languageOrderChecks } = require('./language-order.cjs');

async function main() {
    const root = path.resolve(__dirname, '../..'), desktop = path.join(root, 'electron');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-electron-language-order-'));
    const profile = path.join(directory, 'profile'); fs.mkdirSync(profile);
    const locale = process.env.LANGUAGE_ORDER_LOCALE || 'en'; assert.ok(['en', 'zh-CN'].includes(locale));
    fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({ language: locale }));
    const fixture = path.join(directory, 'languages.md'); fs.writeFileSync(fixture, source);
    const bootstrap = path.join(directory, 'bootstrap.cjs');
    fs.writeFileSync(bootstrap, `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(profile)}); app.setAppPath(${JSON.stringify(desktop)}); global.__orderStore = require(${JSON.stringify(path.join(desktop, 'node_modules/electron-store'))}); const { SettingsManager } = require(${JSON.stringify(path.join(desktop, 'out/settings-manager.js'))}); const getAll = SettingsManager.prototype.getAll; SettingsManager.prototype.getAll = function() { global.__orderSettings = this; SettingsManager.prototype.getAll = getAll; return getAll.call(this); }; process.argv = [process.argv[0], ${JSON.stringify(desktop)}, ${JSON.stringify(fixture)}]; require(${JSON.stringify(path.join(desktop, 'out/main.js'))});`);
    const application = await _electron.launch({ executablePath: require('../../electron/node_modules/electron'), args: [bootstrap], env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } });
    const evidence = path.join(root, '.vscode-test', 'electron-language-order-' + Date.now()); fs.mkdirSync(evidence, { recursive: true });
    const receipts = [], messages = require('../../out/locales/' + locale.toLowerCase() + '.js').webviewMessages;
    try {
        assert.equal(await application.evaluate(({ app }) => app.getPath('userData')), profile);
        const page = await application.firstWindow(); await page.waitForSelector('.code-lang-tag');
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).webContents.closeDevTools());
        assert.equal(await page.locator('html').getAttribute('data-code-language-order'), 'default');
        // Real Preferences controls and IPC. Bypass only the OS menu focus rule.
        const [preferences] = await Promise.all([
            application.waitForEvent('window'),
            application.evaluate(({ BrowserWindow }, messages) => global.__orderSettings.openSettingsWindow(BrowserWindow.getAllWindows().find(window => window.__fileManager), messages), messages),
        ]);
        const control = preferences.getByLabel(messages.codeLanguageOrderLabel, { exact: true }); await control.waitFor();
        assert.equal(await control.inputValue(), 'default');
        assert.deepEqual(await control.locator('option').allTextContents(), [messages.codeLanguageOrderDefault, messages.codeLanguageOrderAscending, messages.codeLanguageOrderDescending]);
        const set = async value => { await control.selectOption(value); await page.bringToFront(); };
        if (locale === 'en') await languageOrderChecks({ editor: page, keyboard: page.keyboard, set, record: (name, details) => receipts.push({ name, ...details }) });
        else {
            await page.locator('.code-lang-tag').click();
            assert.deepEqual(await page.locator('[role="option"]').evaluateAll(nodes => nodes.slice(0, 2).map(node => node.dataset.language)), ['plaintext', 'markdown']);
            await page.keyboard.press('Escape'); await set('a-z');
            await page.waitForFunction(() => document.documentElement.dataset.codeLanguageOrder === 'a-z');
            await page.locator('.code-lang-tag').click(); await page.keyboard.insertText('纯文本');
            assert.deepEqual(await page.locator('[role="option"]').evaluateAll(nodes => nodes.map(node => node.dataset.language)), ['plaintext']);
            await page.keyboard.press('Escape');
        }
        await set('z-a'); await page.waitForFunction(() => document.documentElement.dataset.codeLanguageOrder === 'z-a');
        assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).codeLanguageOrder, 'z-a');
        await application.evaluate(() => {
            const original = global.__orderStore.prototype.set;
            global.__orderStore.prototype.set = function(key, ...args) {
                if (key === 'codeLanguageOrder') { global.__orderStore.prototype.set = original; throw new Error('Synthetic preference failure'); }
                return original.call(this, key, ...args);
            };
        });
        await set('default'); await preferences.locator('#settingsError').waitFor({ state: 'visible' });
        assert.equal(await preferences.locator('#settingsError').textContent(), messages.codeLanguageOrderSaveFailed);
        assert.equal(await control.inputValue(), 'z-a');
        assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).codeLanguageOrder, 'z-a');
        assert.equal(await page.locator('html').getAttribute('data-code-language-order'), 'z-a');
        await set('default'); await preferences.locator('#settingsError').waitFor({ state: 'hidden' });
        await page.waitForFunction(() => document.documentElement.dataset.codeLanguageOrder === 'default');
        assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).__fileManager.isDirtyState()), false);
        assert.equal(await page.evaluate(() => window.htmlToMarkdown()), source);
        assert.equal(await page.locator('[data-action="undo"]').isDisabled(), true);
        await set('z-a'); await page.waitForFunction(() => document.documentElement.dataset.codeLanguageOrder === 'z-a');
        const [reopened] = await Promise.all([
            application.waitForEvent('window'),
            application.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(item => item.label === 'File').submenu.items.find(item => item.label === 'New').click()),
        ]);
        await reopened.waitForFunction(() => document.documentElement.dataset.codeLanguageOrder === 'z-a');
        await preferences.bringToFront(); await control.scrollIntoViewIfNeeded();
        await preferences.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const bounds = await control.boundingBox();
        assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= await preferences.evaluate(() => innerHeight));
        receipts.push({ preferencesViewport: await preferences.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollY })), orderControlBounds: bounds });
        const png = await application.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows().find(window => window.getTitle() === 'Preferences').webContents.capturePage()).toPNG().toString('base64'));
        fs.writeFileSync(path.join(evidence, 'preferences.png'), Buffer.from(png, 'base64'));
        assert.equal(fs.readFileSync(fixture, 'utf8'), source);
        receipts.push({ locale, realPreferences: true, localizedLabels: true, failedSaveRestoresPreference: true, retry: true, reopenedPersistence: true, sourceAndCleanStateAndUndoUnchanged: true, versions: await application.evaluate(() => ({ electron: process.versions.electron, chromium: process.versions.chrome })) });
        fs.writeFileSync(path.join(evidence, 'receipt.json'), JSON.stringify(receipts, null, 2));
        console.log('Electron language order passed. Evidence:', evidence);
    } finally {
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()));
        await application.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
