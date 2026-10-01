'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('@playwright/test');
const core = require('./core.cjs');

const PROSE = '# Research notes\n\nA calm writing space makes ideas easier to follow. Our research explores the relationship between clear structure and readable controls.\n\n## Background\n\nThe first study considers focused work and useful feedback.\n\n### Methods\n\nWe compare several observations and record the results.\n\n## Findings\n\nThe findings show how consistent spacing supports understanding.\n';

async function serve(root) {
    const base = core.safePath(root, 'test/html');
    const server = http.createServer((request, response) => {
        try {
            const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).slice(1);
            const file = core.safePath(base, relative);
            if (!fs.statSync(file).isFile()) throw new Error('Not a file');
            response.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream');
            fs.createReadStream(file).pipe(response);
        } catch { response.writeHead(404); response.end(); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    return { server, url: 'http://127.0.0.1:' + server.address().port + '/production-editor.html' };
}
async function commands(page, item) {
    if (item.id === 'unavailable') {
        await page.evaluate(() => window.__testApi.setMarkdown('```javascript\nconst value = 42;\n```\n'));
        await page.locator('#editor pre code').click();
    }
    if (item.id === 'palette') { await page.locator('#formatButton').click(); await page.locator('.command-palette-input').fill('table'); return; }
    await page.locator('#insertButton').click();
    if (item.id === 'category') await page.locator('[data-insert-category="equationsCategory"]').click();
    if (item.id === 'search') await page.locator('.insert-search input').fill('code');
    if (item.id === 'empty') await page.locator('.insert-search input').fill('unmatched-command');
    if (item.id === 'narrow-end') {
        for (let step = 0; step < 8 && await page.locator('.insert-scroll [data-direction="next"]').isEnabled(); step++) await page.locator('.insert-scroll [data-direction="next"]').click();
    }
}
async function capture(root, sectionId, caseFilter) {
    const { recipe } = core.sectionContract(root, sectionId);
    const cases = caseFilter ? recipe.cases.filter(item => caseFilter.includes(item.id)) : recipe.cases;
    if (!cases.length || (caseFilter && cases.length !== new Set(caseFilter).size)) throw new Error('Unknown capture case');
    execFileSync(process.execPath, ['test/build-standalone.js'], { cwd: root, stdio: 'pipe' });
    const before = core.sourceIdentity(root);
    const directory = core.newIteration(root, sectionId);
    const { server, url } = await serve(root);
    let browser;
    try {
        const executable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
        browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable, chromiumSandbox: true } : {}) });
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, locale: 'en-US', colorScheme: 'light' });
        await context.route('**/*', route => new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort());
        const captures = [];
        for (const item of cases) {
            const page = await context.newPage();
            await page.setViewportSize({ width: item.width || 1440, height: 1000 });
            await page.goto(url);
            await page.waitForFunction(() => window.__testApi?.ready && document.getElementById('exportButton')?.dataset.exportReady === 'true');
            await page.evaluate(content => { document.documentElement.dataset.theme = 'minimal'; window.__testApi.setMarkdown(content); }, PROSE);
            if (sectionId === '03-commands') await commands(page, item);
            else throw new Error('Capture recipe not implemented');
            const target = page.locator(item.selector);
            await target.waitFor({ state: 'visible' });
            await page.evaluate(() => document.fonts.ready);
            const bounds = await target.boundingBox();
            const full = directory + '/' + item.id + '-full.png', component = directory + '/' + item.id + '-target.png';
            await page.screenshot({ path: core.safePath(root, full), animations: 'disabled' });
            await target.screenshot({ path: core.safePath(root, component), animations: 'disabled' });
            captures.push({ id: item.id, state: item.state, comparison: item.comparison, targetBounds: bounds,
                inputHash: core.hash(await page.evaluate(() => window.__testApi.getMarkdown())),
                viewport: page.viewportSize(), theme: 'minimal', locale: 'en-US', zoom: 1, images: [full, component] });
            await page.close();
        }
        if (core.sourceIdentity(root).productHash !== before.productHash) throw new Error('Source changed during capture');
        const packet = core.seal(root, directory, { sectionId, cases: captures, capture: {
            kind: 'production browser fixture', hostBoundary: 'Synthetic test bridge; no installed-host or converter result is claimed.',
            browser: 'Chromium ' + browser.version(), node: process.version, inputHash: core.hash(PROSE),
            fixtureHash: core.hash(fs.readFileSync(core.safePath(root, 'test/html/production-editor.html'))), deviceScaleFactor: 1,
        } });
        return { path: directory + '/packet.json', packet };
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}
module.exports = { capture, PROSE };
