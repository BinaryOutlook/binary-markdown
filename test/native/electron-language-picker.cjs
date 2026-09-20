'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('native-playwright');
const { source, body, languagePickerChecks } = require('./language-picker.cjs');

async function main() {
    const root = path.resolve(__dirname, '../..'), desktop = path.join(root, 'electron');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-electron-language-'));
    const profile = path.join(directory, 'profile'); fs.mkdirSync(profile);
    const fixture = path.join(directory, 'languages.md'); fs.writeFileSync(fixture, source);
    const bootstrap = path.join(directory, 'bootstrap.cjs');
    fs.writeFileSync(bootstrap, `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(profile)}); app.setAppPath(${JSON.stringify(desktop)}); process.argv = [process.argv[0], ${JSON.stringify(desktop)}, ${JSON.stringify(fixture)}]; require(${JSON.stringify(path.join(desktop, 'out/main.js'))});`);
    const application = await _electron.launch({ executablePath: require('../../electron/node_modules/electron'), args: [bootstrap], env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } });
    const evidence = path.join(root, '.vscode-test', 'electron-language-' + Date.now()); fs.mkdirSync(evidence, { recursive: true });
    const receipts = [];
    try {
        assert.equal(await application.evaluate(({ app }) => app.getPath('userData')), profile);
        const page = await application.firstWindow(); await page.waitForSelector('.code-lang-tag');
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.__fileManager).webContents.closeDevTools());
        const capture = async name => {
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            // Electron's native capture includes the whole surface at non-default zoom.
            const bytes = await application.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows().find(window => window.__fileManager).webContents.capturePage()).toPNG().toString('base64'));
            fs.writeFileSync(path.join(evidence, name + '.png'), Buffer.from(bytes, 'base64'));
        };
        const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
        const changed = await languagePickerChecks({ editor: page, keyboard: page.keyboard,
            save: async expected => {
                await page.keyboard.press(modifier + '+s');
                const started = Date.now();
                while (fs.readFileSync(fixture, 'utf8') !== expected) {
                    assert.ok(Date.now() - started < 10000, 'Saved language choice matches current content');
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            },
            capture: async name => { if (name === 'language-cpp') await capture(name); },
            record: (name, details) => receipts.push({ name, ...details })
        });
        await page.locator('.code-copy-btn').click();
        assert.equal(await application.evaluate(({ clipboard }) => clipboard.readText()), body);
        await page.locator('[data-action="source"]').click(); assert.equal(await page.locator('#sourceEditor').inputValue(), changed);
        await page.locator('[data-action="source"]').click(); assert.equal(await page.locator('pre').getAttribute('data-lang'), 'cpp');
        for (const zoom of [1, 2]) {
            await application.evaluate(({ BrowserWindow }, zoom) => {
                const window = BrowserWindow.getAllWindows().find(window => window.__fileManager); window.webContents.setZoomFactor(zoom); window.setSize(520, 420);
            }, zoom);
            await page.locator('.code-lang-tag').click(); await page.keyboard.insertText('python');
            assert.equal(await page.locator('.lang-selector-search').isVisible(), true);
            const bounds = await page.locator('.lang-selector').evaluate(node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight }; });
            assert.ok(bounds.left >= 0 && bounds.top >= 0 && bounds.right <= bounds.width + .5 && bounds.bottom <= bounds.height + .5, JSON.stringify(bounds));
            await capture('zoom-' + zoom);
            await page.keyboard.press('Escape');
        }
        assert.equal(fs.readFileSync(fixture, 'utf8'), changed);
        receipts.push({ versions: await application.evaluate(() => ({ electron: process.versions.electron, chromium: process.versions.chrome })), sourceRoundTrip: true, nativeClipboard: true, realWindowResizeAndZoom: [1, 2] });
        fs.writeFileSync(path.join(evidence, 'receipt.json'), JSON.stringify(receipts, null, 2));
        console.log('Electron language picker passed. Evidence:', evidence);
    } finally {
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()));
        await application.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
