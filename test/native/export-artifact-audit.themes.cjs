'use strict';

// Supplemental production-preparation check; no native editor/theme state changes.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require('../../vendor/playwright-core');
const { prepareStandaloneHtml } = require('../../out/export/html');
const { convertPdf } = require('../../out/export/pdf');
const { validateArtifact } = require('../../out/export/validate');
const { discoverTool } = require('../../out/export/tools');

const root = path.resolve(__dirname, '../..');
const browserOverride = process.env.EXPORT_BROWSER_PATH || (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '');
const outputDirectory = path.join(root, '.vscode-test/export-native/evidence/artifact-audit');
const body = '<div class="editor"><h1>Theme print check</h1>' +
    '<p>THEME-BODY-MARKER: Ordinary report text should remain readable.</p>' +
    '<blockquote><p>THEME-QUOTE-FIRST-MARKER: This quotation must be readable against its page background.</p>' +
    '<p>THEME-QUOTE-LAST-MARKER: The whole quotation remains visible.</p></blockquote>' +
    '<pre><code>THEME-CODE-MARKER: const result = 42;</code></pre>' +
    '<table><thead><tr><th>Label</th><th>Result</th></tr></thead><tbody><tr>' +
    '<td>THEME-TABLE-MARKER</td><td>Readable table content</td></tr></tbody></table></div>';

function luminance(rgb) {
    const channels = rgb.match(/[\d.]+/g).slice(0, 3).map(value => {
        const channel = Number(value) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

(async () => {
    const browserStatus = await discoverTool('browser', browserOverride);
    if (!browserStatus.available || !browserStatus.path) {
        throw new Error(browserStatus.error || 'Install Chrome/Chromium/Edge or set EXPORT_BROWSER_PATH to its absolute executable path.');
    }
    const executable = browserStatus.path;
    await fs.mkdir(outputDirectory, { recursive: true });
    const browser = await chromium.launch({ executablePath: executable, headless: true, chromiumSandbox: true });
    const evidence = [];
    try {
        for (const theme of ['github', 'dark', 'night']) {
            const warnings = [];
            const operations = {
                signal: new AbortController().signal, warnings, report() {},
                loadResource: async () => { throw new Error('This supplemental theme case has no external resources.'); }
            };
            const html = await prepareStandaloneHtml({ sourcePath: path.join(outputDirectory, 'theme-' + theme + '.md'), markdown: '', version: 1, theme, fontSize: 16 },
                { html: body, theme, fontSize: 16, diagrams: [], warnings: [] }, root, operations);
            validateArtifact('html', Buffer.from(html));
            const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 673, height: 1002 } });
            let colors;
            try {
                await context.route('**/*', route => route.abort());
                const page = await context.newPage();
                await page.setContent(html);
                await page.emulateMedia({ media: 'print' });
                colors = await page.evaluate(() => ({
                    quoteForeground: getComputedStyle(document.querySelector('blockquote')).color,
                    quoteBackground: getComputedStyle(document.querySelector('blockquote')).backgroundColor,
                    pageBackground: getComputedStyle(document.body).backgroundColor,
                    bodyForeground: getComputedStyle(document.body).color
                }));
            } finally { await context.close(); }
            const foreground = luminance(colors.quoteForeground);
            const background = luminance(colors.quoteBackground === 'rgba(0, 0, 0, 0)' ? colors.pageBackground : colors.quoteBackground);
            const contrastRatio = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
            assert.ok(contrastRatio >= 4.5, theme + ' quotation contrast was ' + contrastRatio);
            const pdf = await convertPdf(html, executable, operations);
            validateArtifact('pdf', pdf);
            const output = path.join(outputDirectory, 'theme-' + theme + '.pdf');
            await fs.writeFile(output, pdf);
            const content = execFileSync('pdftotext', ['-raw', output, '-'], { encoding: 'utf8' });
            for (const marker of ['BODY', 'QUOTE-FIRST', 'QUOTE-LAST', 'CODE', 'TABLE']) {
                assert.ok(content.includes('THEME-' + marker + '-MARKER'), theme + ' lost ' + marker);
            }
            evidence.push({ theme, ...colors, quoteContrastRatio: contrastRatio, output: path.basename(output),
                htmlSha256: createHash('sha256').update(html).digest('hex'),
                outputSha256: createHash('sha256').update(pdf).digest('hex'), warnings });
        }
    } finally { await browser.close(); }
    const result = { kind: 'Supplemental production HTML/PDF check; not a native editor-theme receipt.',
        browser: browserStatus.version, themes: evidence };
    await fs.writeFile(path.join(outputDirectory, 'themes.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exitCode = 1; });
