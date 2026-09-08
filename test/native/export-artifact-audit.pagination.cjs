'use strict';

// Independent, controlled backend case; frozen Markdown fixtures stay unchanged.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require('../../vendor/playwright-core');
const { convertPdf } = require('../../out/export/pdf');
const { validateArtifact } = require('../../out/export/validate');
const { discoverTool } = require('../../out/export/tools');

const browserOverride = process.env.EXPORT_BROWSER_PATH || (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '');
const html = `<!doctype html><html><head><meta charset="UTF-8"><title>Controlled page movement</title><style>
@page{size:A4;margin:16mm}html,body{margin:0;padding:0;color:#111;background:#fff;font:11pt/1.35 Helvetica,Arial,sans-serif}
p{margin:0;padding:0;box-sizing:border-box}.spacer{height:700px;background:#eee}
blockquote{box-sizing:border-box;height:350px;margin:0;padding:12px;border:2px solid #345;color:#111;background:#fff}
.inside{height:230px}
</style></head><body><main>
<p class="spacer">MOVE-PRECEDING-MARKER: fixed 700-pixel ordinary preceding block.</p>
<blockquote><p>MOVE-BLOCK-FIRST-MARKER: this 350-pixel block fits one page, but not the remaining space.</p>
<div class="inside"></div><p>MOVE-BLOCK-LAST-MARKER: both markers must be together on page two.</p></blockquote>
</main></body></html>`;

(async () => {
    const browserStatus = await discoverTool('browser', browserOverride);
    if (!browserStatus.available || !browserStatus.path) {
        throw new Error(browserStatus.error || 'Install Chrome/Chromium/Edge or set EXPORT_BROWSER_PATH to its absolute executable path.');
    }
    const executable = browserStatus.path;
    const browser = await chromium.launch({ executablePath: executable, headless: true, chromiumSandbox: true });
    let measurements;
    try {
        const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 673, height: 1002 } });
        await context.route('**/*', route => route.abort());
        const page = await context.newPage();
        await page.setContent(html);
        await page.emulateMedia({ media: 'print' });
        measurements = await page.evaluate(() => {
            const first = document.querySelector('.spacer').getBoundingClientRect();
            const block = document.querySelector('blockquote').getBoundingClientRect();
            const pageHeight = (297 - 32) * 96 / 25.4;
            return { precedingHeight: first.height, ordinaryBlockHeight: block.height, ordinaryBlockUnpagedTop: block.top, printablePageHeight: pageHeight, remainingAfterPreceding: pageHeight - first.height };
        });
    } finally { await browser.close(); }
    assert.ok(measurements.ordinaryBlockHeight < measurements.printablePageHeight);
    assert.ok(measurements.ordinaryBlockHeight > measurements.remainingAfterPreceding);
    const warnings = [];
    const pdf = await convertPdf(html, executable, {
        signal: new AbortController().signal, warnings, report() {},
        loadResource: async () => { throw new Error('No resource fetch belongs to this controlled input.'); }
    });
    validateArtifact('pdf', pdf);
    const outputDirectory = path.resolve(__dirname, '../../.vscode-test/export-native/evidence/artifact-audit');
    await fs.mkdir(outputDirectory, { recursive: true });
    const output = path.join(outputDirectory, 'controlled-page-movement.pdf');
    await fs.writeFile(output, pdf);
    const text = execFileSync('pdftotext', ['-raw', output, '-'], { encoding: 'utf8' });
    const pages = text.split('\f').filter(text => text.trim());
    assert.equal(pages.length, 2);
    assert.match(pages[0], /MOVE-PRECEDING-MARKER/);
    assert.doesNotMatch(pages[0], /MOVE-BLOCK-FIRST-MARKER|MOVE-BLOCK-LAST-MARKER/);
    assert.match(pages[1], /MOVE-BLOCK-FIRST-MARKER/);
    assert.match(pages[1], /MOVE-BLOCK-LAST-MARKER/);
    const evidence = {
        kind: 'Supplemental controlled backend check; not a native saved-Markdown receipt.',
        inputSha256: createHash('sha256').update(html).digest('hex'),
        measurements, output: path.basename(output), pages: pages.length,
        outputSha256: createHash('sha256').update(pdf).digest('hex'),
        browser: browserStatus.version,
        precedingMarkerPage: 1, ordinaryBlockFirstMarkerPage: 2, ordinaryBlockLastMarkerPage: 2, warnings
    };
    await fs.writeFile(output + '.json', JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify(evidence));
})().catch(error => { console.error(error); process.exitCode = 1; });
