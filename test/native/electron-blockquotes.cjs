'use strict';

// Run after the root compile and `npx tsc -p electron`, with Electron dependencies installed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('native-playwright');
const { themes, source, measureQuotes } = require('./blockquote-contrast.cjs');

async function main() {
    const root = path.resolve(__dirname, '../..');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-electron-quotes-'));
    const profile = path.join(directory, 'profile');
    fs.mkdirSync(profile);
    const fixture = path.join(directory, 'quotes.md');
    fs.writeFileSync(fixture, source);
    const bootstrap = path.join(directory, 'bootstrap.cjs');
    const desktop = path.join(root, 'electron');
    // Set userData before electron-store is constructed; normal preferences are untouched.
    fs.writeFileSync(bootstrap, `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(profile)}); app.setAppPath(${JSON.stringify(desktop)}); process.argv = [process.argv[0], ${JSON.stringify(desktop)}, ${JSON.stringify(fixture)}]; require(${JSON.stringify(path.join(desktop, 'out/main.js'))});`);
    const application = await _electron.launch({
        executablePath: require('../../electron/node_modules/electron'), args: [bootstrap],
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '' },
    });
    const evidence = path.join(root, '.vscode-test', 'electron-blockquotes-' + Date.now());
    fs.mkdirSync(evidence, { recursive: true });
    try {
        assert.equal(await application.evaluate(({ app }) => app.getPath('userData')), profile);
        const page = await application.firstWindow();
        await page.waitForSelector('#editor blockquote');
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.webContents.closeDevTools()));
        const before = await page.evaluate(() => {
            window.__quoteBeforeTheme = document.querySelector('#editor blockquote');
            document.getElementById('editor').focus();
            const range = document.createRange(); range.setStart(window.__quoteBeforeTheme.querySelector('p').firstChild, 3); range.collapse(true);
            getSelection().removeAllRanges(); getSelection().addRange(range);
            return window.htmlToMarkdown();
        });
        const [preferences] = await Promise.all([
            application.waitForEvent('window'),
            application.evaluate(({ Menu, BrowserWindow }) => {
                BrowserWindow.getAllWindows()[0].focus();
                const item = Menu.getApplicationMenu().items.flatMap(item => item.submenu?.items || []).find(item => item.label === 'Preferences...');
                item.click();
            }),
        ]);
        await preferences.waitForSelector('#theme');
        const receipts = [];
        for (const theme of themes) {
            await preferences.locator('#theme').selectOption(theme);
            await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
            assert.equal(await page.evaluate(() => window.__quoteBeforeTheme === document.querySelector('#editor blockquote') && getSelection().anchorOffset === 3), true);
            assert.equal(await page.evaluate(() => window.htmlToMarkdown()), before);
            const colors = await page.evaluate(measureQuotes);
            assert.ok(colors.length >= 6 && colors.every(color => color.contrast >= 4.5));
            assert.equal(fs.readFileSync(fixture, 'utf8'), source);
            await page.screenshot({ path: path.join(evidence, theme + '.png') });
            receipts.push({ theme, colors, noReload: true, selectionPreserved: true, sourceUnchanged: true });
        }
        await page.bringToFront();
        await page.locator('#editor > p').last().click();
        await page.keyboard.press('End');
        await page.keyboard.type(' edited');
        await preferences.locator('#theme').selectOption('github');
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'github');
        await page.locator('[data-action="undo"]').click({ force: true });
        assert.equal(await page.evaluate(() => window.htmlToMarkdown()), before);
        const versions = await application.evaluate(() => ({ electron: process.versions.electron, chromium: process.versions.chrome, platform: process.platform, arch: process.arch }));
        fs.writeFileSync(path.join(evidence, 'receipt.json'), JSON.stringify({ versions, undoPreserved: true, receipts }, null, 2));
        console.log('Electron quote checks passed:', JSON.stringify(versions), 'Evidence:', evidence);
    } finally {
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()));
        await application.close();
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
