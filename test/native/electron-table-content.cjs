'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('native-playwright');
const { source, tableCells, tableContentChecks } = require('./table-content-overflow.cjs');

async function main() {
    const root = path.resolve(__dirname, '../..');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-electron-table-content-'));
    const profile = path.join(directory, 'profile');
    fs.mkdirSync(profile);
    const file = path.join(directory, 'wide-table.md');
    fs.writeFileSync(file, source);
    const desktop = path.join(root, 'electron');
    const bootstrap = path.join(directory, 'bootstrap.cjs');
    fs.writeFileSync(bootstrap, `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(profile)}); app.setAppPath(${JSON.stringify(desktop)}); process.argv = [process.argv[0], ${JSON.stringify(desktop)}, ${JSON.stringify(file)}]; require(${JSON.stringify(path.join(desktop, 'out/main.js'))});`);
    const launch = () => _electron.launch({ executablePath: require('../../electron/node_modules/electron'), args: [bootstrap], env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } });
    let application = await launch();
    const close = async () => {
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()));
        await application.close();
    };
    const evidence = path.join(root, '.vscode-test', 'electron-table-content-' + Date.now());
    fs.mkdirSync(evidence, { recursive: true });
    const receipts = [];
    try {
        assert.equal(await application.evaluate(({ app }) => app.getPath('userData')), profile);
        let page = await application.firstWindow();
        await page.waitForSelector('#editor td');
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.closeDevTools());
        const cells = await tableContentChecks({ editor: page, keyboard: page.keyboard, record: (name, details) => receipts.push({ name, ...details }),
            resize: async (width, height) => {
                await application.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height), { width, height });
                await page.waitForFunction(size => innerWidth === size.width && innerHeight === size.height, { width, height });
            },
        });
        assert.equal(fs.readFileSync(file, 'utf8'), source);
        await page.locator('#editor > p').filter({ hasText: 'After.' }).click();
        await page.keyboard.press('End');
        await page.keyboard.type(' updated');
        assert.equal(await page.locator('#editor > p').filter({ hasText: 'After.' }).textContent(), 'After. updated');
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');
        const started = Date.now();
        while (!fs.readFileSync(file, 'utf8').includes('After. updated')) {
            assert.ok(Date.now() - started < 10000, 'Electron Save writes the edited file');
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        await close();
        application = await launch();
        page = await application.firstWindow();
        await page.waitForSelector('#editor td');
        assert.deepEqual(await page.evaluate(tableCells), cells);
        await page.locator('#editor > p').filter({ hasText: 'After. updated' }).waitFor();
        receipts.push({ saveAndReopen: true, tableCellsAndAlignmentPreserved: true });
        for (const theme of ['github', 'night']) for (const zoom of [1, 2]) {
            await application.evaluate(({ BrowserWindow }, { theme, zoom }) => {
                const window = BrowserWindow.getAllWindows()[0];
                window.webContents.closeDevTools(); window.setContentSize(900, 700); window.webContents.setZoomFactor(zoom);
                window.webContents.send('host-message', { type: 'theme', value: theme });
            }, { theme, zoom });
            await page.locator('#editor td').first().click();
            await page.keyboard.press('Tab');
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const capture = await application.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
            fs.writeFileSync(path.join(evidence, `${theme}-${zoom}.png`), Buffer.from(capture, 'base64'));
        }
        const versions = await application.evaluate(() => ({ electron: process.versions.electron, chromium: process.versions.chrome, platform: process.platform, arch: process.arch }));
        fs.writeFileSync(path.join(evidence, 'receipt.json'), JSON.stringify({ versions, receipts }, null, 2));
        console.log('Electron table content checks passed. Evidence:', evidence);
    } finally { await close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
