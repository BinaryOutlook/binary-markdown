'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('native-playwright');
const { toolbarGeometry } = require('./text-toolbar.cjs');

async function main() {
    const root = path.resolve(__dirname, '../..');
    const desktop = path.join(root, 'electron');
    const evidence = path.join(root, '.vscode-test', 'electron-text-toolbar-' + Date.now());
    fs.mkdirSync(evidence, { recursive: true });
    const receipts = [];
    for (const initial of [undefined, 'simple', 'full']) {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-electron-toolbar-'));
        const profile = path.join(directory, 'profile');
        fs.mkdirSync(profile);
        if (initial) fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({ toolbarMode: initial }));
        const source = 'Paragraph target.\n';
        const fixture = path.join(directory, 'toolbar.md');
        fs.writeFileSync(fixture, source);
        const bootstrap = path.join(directory, 'bootstrap.cjs');
        fs.writeFileSync(bootstrap, `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(profile)}); app.setAppPath(${JSON.stringify(desktop)}); global.__toolbarStore = require(${JSON.stringify(path.join(desktop, 'node_modules/electron-store'))}); const { SettingsManager } = require(${JSON.stringify(path.join(desktop, 'out/settings-manager.js'))}); const getAll = SettingsManager.prototype.getAll; SettingsManager.prototype.getAll = function() { global.__toolbarSettings = this; SettingsManager.prototype.getAll = getAll; return getAll.call(this); }; process.argv = [process.argv[0], ${JSON.stringify(desktop)}, ${JSON.stringify(fixture)}]; require(${JSON.stringify(path.join(desktop, 'out/main.js'))});`);
        const application = await _electron.launch({ executablePath: require('../../electron/node_modules/electron'), args: [bootstrap], env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } });
        try {
            assert.equal(await application.evaluate(({ app }) => app.getPath('userData')), profile);
            const page = await application.firstWindow();
            await page.waitForSelector('#editor p');
            assert.equal(await page.locator('html').getAttribute('data-toolbar-mode'), initial || 'full');
            receipts.push({ initial: initial || 'unset', effective: initial || 'full' });
            if (initial) continue;
            await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).webContents.closeDevTools());
            // Open the real Preferences window directly. This bypasses only the
            // OS menu's focused-window requirement, not its controls or IPC.
            const [preferences] = await Promise.all([
                application.waitForEvent('window'),
                application.evaluate(({ BrowserWindow }) => global.__toolbarSettings.openSettingsWindow(BrowserWindow.getAllWindows().find(window => window.__fileManager))),
            ]);
            await preferences.waitForSelector('#toolbarMode', { state: 'attached' });
            await page.evaluate(() => {
                window.__retainedParagraph = document.querySelector('#editor p');
                const range = document.createRange(), node = window.__retainedParagraph.firstChild;
                range.setStart(node, 10); range.setEnd(node, 16);
                document.getElementById('editor').focus(); getSelection().removeAllRanges(); getSelection().addRange(range);
            });
            for (const value of ['simple', 'full', 'simple', 'full']) {
                await preferences.locator('#toolbarMode').selectOption(value);
                await page.waitForFunction(value => document.documentElement.dataset.toolbarMode === value, value);
                assert.equal(await page.evaluate(() => document.querySelector('#editor p') === window.__retainedParagraph && getSelection().toString() === 'target'), true);
                assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).toolbarMode, value);
                assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).__fileManager.isDirtyState()), false);
            }
            await application.evaluate(() => {
                const original = global.__toolbarStore.prototype.set;
                global.__toolbarStore.prototype.set = function(key, ...args) {
                    if (key === 'toolbarMode') { global.__toolbarStore.prototype.set = original; throw new Error('Synthetic preference failure'); }
                    return original.call(this, key, ...args);
                };
            });
            await preferences.locator('#toolbarMode').selectOption('simple');
            await preferences.locator('#settingsError').waitFor({ state: 'visible' });
            assert.equal(await preferences.locator('#toolbarMode').inputValue(), 'full');
            assert.equal(await page.locator('html').getAttribute('data-toolbar-mode'), 'full');
            assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).toolbarMode, 'full');
            await preferences.locator('#toolbarMode').selectOption('simple');
            await page.waitForFunction(() => document.documentElement.dataset.toolbarMode === 'simple');
            await preferences.locator('#settingsError').waitFor({ state: 'hidden' });
            await preferences.locator('#toolbarMode').selectOption('full');
            await page.waitForFunction(() => document.documentElement.dataset.toolbarMode === 'full');
            for (const zoom of [1, 2]) {
                for (const width of [900, 500]) {
                    await application.evaluate(({ BrowserWindow }, { zoom, width }) => {
                        const window = BrowserWindow.getAllWindows().find(window => window.__fileManager);
                        window.webContents.closeDevTools(); window.setContentSize(width, 800); window.webContents.setZoomFactor(zoom);
                    }, { zoom, width });
                    await page.waitForFunction(({ zoom, width }) => Math.abs(innerWidth * zoom - width) <= 2, { zoom, width });
                    // Hide the outline using its actual view-only control at high zoom.
                    await page.evaluate(() => document.getElementById('closeSidebar').click());
                    await page.waitForFunction(() => document.getElementById('sidebar').getBoundingClientRect().width <= 1);
                    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                    await page.waitForFunction(toolbarGeometry => {
                        const state = (0, eval)('(' + toolbarGeometry + ')')();
                        return !state.clipped.length && !state.overlaps.length;
                    }, toolbarGeometry.toString());
                    const geometry = await page.evaluate(toolbarGeometry);
                    const capture = await application.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows().find(window => window.__fileManager).webContents.capturePage()).toPNG().toString('base64'));
                    fs.writeFileSync(path.join(evidence, `toolbar-${width}-${zoom}x.png`), Buffer.from(capture, 'base64'));
                    receipts.push({ width, zoom, geometry, resizeRoute: 'Electron content size and zoom' });
                }
            }
            await preferences.locator('#theme').selectOption('night');
            await page.waitForFunction(() => document.documentElement.dataset.theme === 'night');
            await page.locator('#toolbarMore').click();
            await page.locator('#toolbarOverflow').waitFor({ state: 'visible' });
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            assert.equal(await page.locator('#toolbarMore').getAttribute('aria-expanded'), 'true');
            const menuCapture = await application.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows().find(window => window.__fileManager).webContents.capturePage()).toPNG().toString('base64'));
            fs.writeFileSync(path.join(evidence, 'toolbar-overflow-night-2x.png'), Buffer.from(menuCapture, 'base64'));
            await page.keyboard.press('Escape');
            const [reopened] = await Promise.all([
                application.waitForEvent('window'),
                application.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(item => item.label === 'File').submenu.items.find(item => item.label === 'New').click()),
            ]);
            await reopened.waitForFunction(() => document.documentElement.dataset.toolbarMode === 'full');
            assert.equal(fs.readFileSync(fixture, 'utf8'), source);
            receipts.push({ realPreferencesControls: true, viewOnlyAndSelectionPreserved: true, saveFailureAndRetry: true, reopenedPreference: true });
            receipts.push({ versions: await application.evaluate(() => ({ electron: process.versions.electron, chromium: process.versions.chrome })) });
        } finally {
            await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()));
            await application.close();
        }
    }
    fs.writeFileSync(path.join(evidence, 'receipt.json'), JSON.stringify(receipts, null, 2));
    console.log('Electron toolbar checks passed. Evidence:', evidence);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
