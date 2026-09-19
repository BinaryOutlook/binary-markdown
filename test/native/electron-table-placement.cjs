'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('native-playwright');

async function main() {
    const pickerOnly = process.argv.includes('--picker-only');
    const root = path.resolve(__dirname, '../..');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-electron-tables-'));
    const profile = path.join(directory, 'profile');
    fs.mkdirSync(profile);
    const source = '# Table controls\n\n| Item | State |\n| --- | --- |\n| One | Ready |\n| Two | Draft |\n\nAfter\n';
    const fixture = path.join(directory, 'table.md');
    fs.writeFileSync(fixture, source);
    const desktop = path.join(root, 'electron');
    const bootstrap = path.join(directory, 'bootstrap.cjs');
    fs.writeFileSync(bootstrap, `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(profile)}); app.setAppPath(${JSON.stringify(desktop)}); global.__tableTestStore = require(${JSON.stringify(path.join(desktop, 'node_modules/electron-store'))}); process.argv = [process.argv[0], ${JSON.stringify(desktop)}, ${JSON.stringify(fixture)}]; require(${JSON.stringify(path.join(desktop, 'out/main.js'))});`);
    const application = await _electron.launch({
        executablePath: require('../../electron/node_modules/electron'), args: [bootstrap],
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '' },
    });
    const evidence = path.join(root, '.vscode-test', 'electron-table-placement-' + Date.now());
    fs.mkdirSync(evidence, { recursive: true });
    try {
        assert.equal(await application.evaluate(({ app }) => app.getPath('userData')), profile);
        const page = await application.firstWindow();
        await page.waitForSelector('#editor td');
        await application.evaluate(({ BrowserWindow }) => {
            const window = BrowserWindow.getAllWindows()[0];
            window.webContents.closeDevTools(); window.setSize(1400, 1000);
        });
        await page.locator('#editor td').first().click();
        const before = await page.evaluate(() => {
            window.__tableBefore = document.querySelector('#editor table');
            window.__tableAnchor = getSelection().anchorNode;
            window.__tableOffset = getSelection().anchorOffset;
            return window.htmlToMarkdown();
        });
        let preferences;
        if (!pickerOnly) {
            await application.evaluate(({ app, BrowserWindow }) => {
                app.focus({ steal: true });
                BrowserWindow.getAllWindows().find(window => window.__fileManager).focus();
            });
            // Native Preferences requires an unlocked desktop and a focused editor.
            await page.waitForFunction(() => document.hasFocus(), undefined, { timeout: 10000 });
            [preferences] = await Promise.all([
                application.waitForEvent('window'),
                application.evaluate(({ Menu }) => Menu.getApplicationMenu().items.flatMap(item => item.submenu?.items || []).find(item => item.label === 'Preferences...').click()),
            ]);
            await preferences.waitForSelector('#tableToolbarPosition');
        }
        const controls = '.table-toolbar:not(.table-toolbar-measure)';
        const choose = async value => {
            await page.waitForFunction(controls => document.querySelector(controls).classList.contains('visible') || document.querySelector('.table-toolbar-toggle').getClientRects().length > 0, controls);
            if (!await page.locator(controls).isVisible()) await page.locator('.table-toolbar-toggle').click();
            await page.locator(controls + ' [data-action="placement"]').click();
            if (!['auto', 'top-bar'].includes(value)) await page.locator('[data-position="fixed"]').click();
            await page.locator(`.table-placement-menu [data-position="${value}"]`).click();
        };
        const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right', 'top-bar', 'auto'];
        const receipts = [];
        for (const route of pickerOnly ? ['picker'] : ['preferences', 'picker']) {
            for (const value of positions) {
                if (route === 'preferences') await preferences.locator('#tableToolbarPosition').selectOption(value);
                else {
                    await page.bringToFront();
                    await choose(value);
                }
                await page.waitForFunction(value => document.documentElement.dataset.tableToolbarPosition === value, value);
                if (value !== 'auto') await page.waitForFunction(({ controls, value }) => document.querySelector(controls).dataset.placement === value, { controls, value });
                if (preferences) assert.equal(await preferences.locator('#tableToolbarPosition').inputValue(), value);
                assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).tableToolbarPosition, value);
                assert.equal(await page.evaluate(() => window.__tableBefore === document.querySelector('#editor table') && window.__tableAnchor === getSelection().anchorNode && window.__tableOffset === getSelection().anchorOffset), true);
                assert.equal(await page.evaluate(() => window.htmlToMarkdown()), before);
                assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).__fileManager.isDirtyState()), false);
                receipts.push({ route, value, selectionPreserved: true, sourceUnchanged: true });
            }
        }
        for (const route of pickerOnly ? ['picker'] : ['preferences', 'picker']) {
            await choose('auto');
            await page.waitForFunction(() => document.documentElement.dataset.tableToolbarPosition === 'auto');
            // Inject one persistence failure in this disposable app. IPC and
            // rendering remain real; normal user preferences are never touched.
            await application.evaluate(() => {
                const original = global.__tableTestStore.prototype.set;
                global.__tableTestStore.prototype.set = function(key, ...args) {
                    if (key === 'tableToolbarPosition') {
                        global.__tableTestStore.prototype.set = original;
                        throw new Error('Synthetic settings write failure');
                    }
                    return original.call(this, key, ...args);
                };
            });
            if (route === 'preferences') await preferences.locator('#tableToolbarPosition').selectOption('left');
            else await choose('left');
            if (preferences) {
                await preferences.locator('#settingsError').waitFor({ state: 'visible' });
                assert.equal(await preferences.locator('#tableToolbarPosition').inputValue(), 'auto');
            }
            if (route === 'picker') await page.getByRole('status').waitFor({ state: 'visible' });
            assert.equal(await page.locator('html').getAttribute('data-table-toolbar-position'), 'auto');
            assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).tableToolbarPosition, 'auto');
            await choose('right');
            await page.waitForFunction(() => document.documentElement.dataset.tableToolbarPosition === 'right');
            if (preferences) await preferences.locator('#settingsError').waitFor({ state: 'hidden' });
            receipts.push({ route, injectedSaveFailureReported: true, previousPreferenceRetained: true, retrySucceeded: true });
        }
        await page.evaluate(() => {
            window.hostBridge.setTableToolbarPosition('left');
            window.hostBridge.setTableToolbarPosition('right');
        });
        await page.waitForFunction(() => document.documentElement.dataset.tableToolbarPosition === 'right');
        assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).tableToolbarPosition, 'right');
        await page.locator(controls + ' [data-action="add-row-below"]').click();
        await page.waitForFunction(() => document.querySelectorAll('#editor tr').length === 4);
        await choose('top-bar');
        await page.waitForFunction(() => document.documentElement.dataset.tableToolbarPosition === 'top-bar');
        await page.locator('#toolbar [data-action="undo"]').click();
        await page.waitForFunction(() => document.querySelectorAll('#editor tr').length === 3);
        assert.equal(await page.evaluate(() => window.htmlToMarkdown()), before);
        await require('./table-toolbar-overflow.cjs').tableOverflowChecks({
            editor: page, keyboard: page.keyboard,
            resize: async (width, height) => {
                await application.evaluate(({ BrowserWindow }, { width, height }) =>
                    BrowserWindow.getAllWindows().find(window => window.__fileManager).setContentSize(width, height), { width, height });
                await page.waitForFunction(({ width, height }) => innerWidth === width && innerHeight === height, { width, height });
            },
            setPosition: value => page.evaluate(value => window.hostBridge.setTableToolbarPosition(value), value),
            record: (name, details) => receipts.push({ name, ...details }),
        });
        await choose('top-bar');
        await page.waitForFunction(() => document.documentElement.dataset.tableToolbarPosition === 'top-bar');
        const [newEditor] = await Promise.all([
            application.waitForEvent('window'),
            application.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(item => item.label === 'File').submenu.items.find(item => item.label === 'New').click()),
        ]);
        await newEditor.waitForFunction(() => document.documentElement.dataset.tableToolbarPosition === 'top-bar');
        receipts.push({ rapidChoicesLastWins: true, actionAndUndo: true, preferenceRestoredInNewEditor: true });
        assert.equal(fs.readFileSync(fixture, 'utf8'), source);
        await page.screenshot({ path: path.join(evidence, 'table-placement.png') });
        const versions = await application.evaluate(() => ({ electron: process.versions.electron, chromium: process.versions.chrome, platform: process.platform, arch: process.arch }));
        fs.writeFileSync(path.join(evidence, 'receipt.json'), JSON.stringify({ versions, preferencesChecked: !pickerOnly, receipts }, null, 2));
        console.log('Electron table placement checks passed:', JSON.stringify(versions), 'Evidence:', evidence);
    } finally {
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()));
        await application.close();
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
