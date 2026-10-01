'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('@playwright/test');
const core = require('./core.cjs');

const PROSE = '# Research notes\n\nA calm writing space makes ideas easier to follow. Our research explores the relationship between clear structure and readable controls.\n\n## Background\n\nThe first study considers focused work and useful feedback.\n\n### Methods\n\nWe compare several observations and record the results.\n\n## Findings\n\nThe findings show how consistent spacing supports understanding.\n';
const TABLE = '| Experiment | Accuracy | Duration | Status |\n| --- | ---: | ---: | --- |\n| Baseline | 91% | 120 ms | Reviewed |\n| Optimized | 95% | 82 ms | Pending |\n| Follow-up | 94% | 90 ms | Planned |\n';
const CANVAS = '# Research notes\n\nA focused writing space for a small technical report.\n\n## Method\n\nUse a representative sample, record assumptions, and compare the results.\n\n```javascript\nconst message = "Ready to review";\nconst count = 24;\n// Keep the original data unchanged.\nconsole.log(message, count);\n```\n\n## Results\n\n' + TABLE + '\n## Review checklist\n\n- [x] Collect measurements\n- [ ] Review the explanation\n- [ ] Confirm next steps\n';
const hostMessage = (page, message) => page.evaluate(message => window.__hostMessageHandler(message), message);
const exportMessage = (page, message) => page.evaluate(message => window.dispatchEvent(new MessageEvent('message', { data: message })), message);
async function loadDocument(page, content) {
    await page.evaluate(content => {
        window.__testApi.setMarkdown(content);
        window.__hostMessageHandler({ type: 'update', content });
    }, content);
}
async function selectText(page, selector, start = 0, end = 12) {
    await page.evaluate(({ selector, start, end }) => {
        const parent = document.querySelector(selector), walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
        const node = walker.nextNode();
        const range = document.createRange(); range.setStart(node, start); range.setEnd(node, Math.min(end, node.textContent.length));
        document.getElementById('editor').focus({ preventScroll: true });
        getSelection().removeAllRanges(); getSelection().addRange(range);
    }, { selector, start, end });
}

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
async function prepare(page, section, item) {
    const id = item.id;
    if (section === '03-commands') return commands(page, item);
    if (section === '01-canvas') {
        await loadDocument(page, id === 'empty' ? '' : CANVAS);
        if (id === 'focused') await page.locator('#editor p').first().click();
        else await page.locator('#insertButton').focus();
        // The rail may be hidden. A hidden tab cannot transfer actual focus,
        // so verify the requested state through the live active element.
        await page.waitForFunction(focused => document.getElementById('editor').contains(document.activeElement) === focused, id === 'focused');
    } else if (section === '02-toolbar') {
        await loadDocument(page, id === 'protected' ? '```javascript\nconst value = 42;\n```\n' : PROSE);
        if (!await page.locator('#contextToolbarToggle').isVisible()) await page.locator('#toolbarMore').click();
        await page.locator('#contextToolbarToggle').click();
        if (await page.locator('#toolbarOverflow').isVisible()) await page.keyboard.press('Escape');
        if (id === 'selection') await selectText(page, '#editor p');
        if (id === 'protected') await selectText(page, '#editor pre code');
        if (id === 'actions') await page.locator('#formatButton').click();
        if (id === 'source') await page.locator('[data-editor-mode="source"]').click();
        if (id === 'overflow') await page.locator('#toolbarMore').click();
    } else if (section === '04-outline') {
        const long = '# Research notes\n\n## Background\n\n### A deliberately long heading explaining the relationship between readable structure and a focused writing workflow\n\n#### Observations\n\n## Findings\n\n';
        await loadDocument(page, id === 'long' ? long : PROSE + Array.from({ length: 8 }, (_, i) => '\n## Study ' + (i + 1) + '\n\n' + 'A synthetic paragraph records observations and keeps the discussion readable. '.repeat(10)).join('\n'));
        if (id === 'document') await page.locator('#documentTab').click();
        if (id === 'scrolled') await page.locator('#editorWrapper').evaluate(node => { node.scrollTop = node.scrollHeight / 2; });
        if (id === 'narrow') await page.locator('#openSidebarBtn').click();
    } else if (section === '05-tables') {
        const wide = '| ' + Array.from({ length: 12 }, (_, i) => 'Measure ' + (i + 1)).join(' | ') + ' |\n| ' + Array(12).fill('---').join(' | ') + ' |\n| ' + Array(12).fill('Recorded observation').join(' | ') + ' |\n';
        await loadDocument(page, '# Results\n\n' + (id === 'wide' ? wide : TABLE) + '\n\nThe table records synthetic results for review.\n');
        await hostMessage(page, { type: 'tableToolbarPosition', value: item.placement || 'auto' });
        await page.locator(id === 'header' ? '#editor th' : '#editor td').first().click();
        if (id === 'wide') await page.locator('#editor table').evaluate(node => { const column = node.rows[0].cells[6]; node.scrollLeft = column.getBoundingClientRect().left - node.getBoundingClientRect().left - 1; });
        if (id === 'narrow-scrolled') {
            await page.locator('#editor table').evaluate(node => { node.scrollLeft = node.scrollWidth - node.clientWidth; });
            await page.locator('#editor td').nth(3).click();
        }
        await page.waitForTimeout(250); // Placement settles after pointer release.
    } else if (section === '06-code') {
        await loadDocument(page, '# Implementation notes\n\n```javascript\nconst message = "Ready to build";\nconst count = 24;\n// Keep the original data unchanged.\nconsole.log(message, count);\nconst observation = "' + 'A long source line keeps its authored spacing. '.repeat(8) + '";\n```\n\nCheck readability before copying the example.\n');
        await page.locator('#editor pre').hover();
        if (id === 'wrapped') await page.locator('.code-wrap-btn').click();
        if (id === 'scrolled') await page.locator('#editor pre code').evaluate(node => { node.scrollLeft = 90; });
        if (id === 'language' || id === 'search') {
            await page.locator('.code-lang-tag').click();
            if (id === 'search') await page.locator('.lang-selector-search').fill('java');
        }
        if (id === 'copied') {
            await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
            await page.locator('.code-copy-btn').click();
            await page.locator('.code-copy-btn[data-copy-state="copied"]').waitFor();
        }
    } else if (section === '07-equations') {
        const tex = id === 'unsupported' || id === 'narrow' ? '\\frac{a+b}{c} + \\unknowncommand{x}' : id === 'long' ? Array(18).fill('\\frac{a+b}{c}').join(' + ') : '\\frac{a+b}{c}';
        await loadDocument(page, '# Equation notes\n\nThe estimate uses $x^2+1$ as a simple example.\n\n$$\n' + tex + '\n$$\n\nContinue the explanation here.\n');
        if (id !== 'preview') await page.locator('.math-display').click();
        // The initial warning stays concise; details are an explicit separate state.
    } else if (section === '08-diagrams') {
        const bad = ['invalid', 'diagnostic', 'narrow'].includes(id);
        await loadDocument(page, '# Process sketch\n\n```mermaid\n' + (bad ? 'graph LR\n A[Draft -->\n B[Review]\n C[Export]' : 'graph LR\n A[Draft] --> B[Review] --> C[Export]') + '\n```\n\nReview the process before continuing.\n');
        await page.waitForFunction(() => document.querySelector('.mermaid-wrapper')?.dataset.renderError || document.querySelector('.mermaid-diagram svg'));
        if (id !== 'preview') await page.locator('[data-block-mode="edit"]').click();
        if (id === 'diagnostic') await page.locator('.block-diagnostic summary').click();
    } else if (section === '09-find') {
        await loadDocument(page, id === 'expensive' ? '# Review\n\n' + 'a'.repeat(24000) + '!\n' : '# Research notes\n\nA focused writing space supports the method.\n\n## Method\n\nRecord the method, observations, and assumptions.\n\n## Results\n\nThe method supports an independent review.\n');
        await page.locator('#editor').click(); await page.keyboard.press('ControlOrMeta+h');
        if (id === 'regex' || id === 'expensive') await page.locator('#searchRegex').check();
        await page.locator('#searchInput').fill(id === 'empty' ? 'unmatched-term' : id === 'regex' ? '[' : id === 'expensive' ? '(a+)+$' : 'method');
        await page.locator('#replaceInput').fill('approach');
        if (['filled', 'selected', 'narrow'].includes(id)) {
            await page.locator('.search-result').first().waitFor();
            if (id === 'selected' || id === 'narrow') { await page.locator('.search-result input').nth(1).check(); await page.locator('.search-result button').nth(1).click(); }
        } else await page.waitForFunction(() => document.getElementById('searchFeedback').textContent.trim());
    } else if (section === '10-metadata') {
        await loadDocument(page, '---\ntitle: "Research notes" # preserved\nauthor: "Example Author"\ntags: [research, review]\n---\n\n[TOC]\n\n# Research notes\n\n## Method\n\nWrite a short explanation.\n\n## Results\n\nReview the comparison.\n');
        await page.locator('.toc-refresh').click();
        if (['expanded', 'pending', 'refreshed'].includes(id)) await page.locator('.front-matter summary').click();
        if (id === 'pending' || id === 'refreshed') await page.locator('#editor > h2').last().fill('Conclusions');
        if (id === 'refreshed') await page.locator('.toc-refresh').click();
    } else if (section === '11-source') {
        await loadDocument(page, CANVAS);
        if (id !== 'visual') await page.locator('[data-editor-mode="' + (id === 'source' ? 'source' : 'split') + '"]').click();
        if (id === 'correspondence') {
            await page.locator('#sourceEditor').evaluate(node => { const start = node.value.indexOf('## Results'); node.setSelectionRange(start, start + 10); node.dispatchEvent(new Event('select')); });
        }
        if (id === 'editing') {
            await page.locator('#sourceEditor').press('ControlOrMeta+a'); await page.keyboard.press('ArrowRight'); await page.keyboard.insertText('\nA live source edit appears in the same preview.\n');
            await page.locator('#editor').getByText('A live source edit appears in the same preview.').waitFor();
        }
    } else if (section === '12-export') {
        if (!await page.locator('#exportButton').isVisible()) await page.locator('#toolbarMore').click();
        await page.locator('#exportButton').click();
        await exportMessage(page, { type: 'exportCapabilities', host: { available: true }, pandoc: { available: id !== 'missing' }, browser: { available: true } });
        if (id === 'running' || id === 'canceling') {
            // Reproduce the host's actual checking -> dependencies -> resources
            // sequence rather than starting a screenshot midway through a job.
            for (const stage of ['checking', 'dependencies']) await exportMessage(page, { type: 'exportStatus', state: 'running', stage });
            await exportMessage(page, { type: 'exportStatus', state: 'running', stage: 'resources', message: 'Preparing referenced resources…' });
            if (id === 'canceling') await page.locator('#exportCancel').click();
        }
        if (id === 'failure') await page.locator('[data-export-format="html"]').click();
        if (id === 'failure') await exportMessage(page, { type: 'exportStatus', state: 'failed', stage: 'saving', message: 'Could not save the output. Choose a writable folder and export again.' });
        if (id === 'complete' || id === 'narrow') {
            for (const stage of ['checking','dependencies','resources','rendering','saving']) await exportMessage(page, { type: 'exportStatus', state: 'running', stage });
            await exportMessage(page, { type: 'exportStatus', state: 'complete', message: 'Export complete', outputPath: '/documents/research-notes.html', warnings: [{ code: 'asset-missing', message: 'One referenced image was unavailable; a placeholder was used.' }, { code: 'fallback', message: 'One unsupported expression was preserved as source text.' }] });
        }
    } else throw new Error('Capture recipe not implemented');
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
            await page.setViewportSize({ width: item.width || 1440, height: item.height || 1000 });
            await page.goto(url);
            await page.waitForFunction(() => window.__testApi?.ready && document.getElementById('exportButton')?.dataset.exportReady === 'true');
            await hostMessage(page, { type: 'theme', value: item.theme || 'minimal' });
            await loadDocument(page, PROSE);
            await prepare(page, sectionId, item);
            const target = page.locator(item.selector);
            await target.waitFor({ state: 'visible' });
            await page.evaluate(() => document.fonts.ready);
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            let bounds = await target.boundingBox();
            if (sectionId === '05-tables') bounds = await page.evaluate(() => {
                const boxes = [...document.querySelectorAll('#editor table,.table-toolbar:not(.table-toolbar-measure),.table-boundary-actions button,.table-coordinate-gutters,.table-scroll-hint')]
                    .filter(node => node.getClientRects().length).map(node => node.getBoundingClientRect());
                const x = Math.max(0, Math.min(...boxes.map(r => r.left)) - 12), y = Math.max(0, Math.min(...boxes.map(r => r.top)) - 12);
                return { x, y, width: Math.min(innerWidth, Math.max(...boxes.map(r => r.right)) + 12) - x, height: Math.min(innerHeight, Math.max(...boxes.map(r => r.bottom)) + 12) - y };
            });
            const full = directory + '/' + item.id + '-full.png', component = directory + '/' + item.id + '-target.png';
            await page.screenshot({ path: core.safePath(root, full), animations: 'disabled' });
            await page.screenshot({ path: core.safePath(root, component), clip: bounds, animations: 'disabled' });
            const observedThemeTokens = await page.evaluate(() => {
                const style = getComputedStyle(document.documentElement);
                return Object.fromEntries(['--bg-color', '--text-color', '--link-color', '--outline-active-color', '--selection-bg']
                    .map(name => [name, style.getPropertyValue(name).trim()]));
            });
            captures.push({ id: item.id, state: item.state, comparison: item.comparison, targetBounds: bounds,
                inputHash: core.hash(await page.evaluate(() => window.__testApi.getMarkdown())),
                viewport: page.viewportSize(), theme: item.theme || 'minimal', observedThemeTokens, locale: 'en-US', zoom: 1, images: [full, component] });
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
