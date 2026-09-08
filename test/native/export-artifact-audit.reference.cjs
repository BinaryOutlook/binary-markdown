'use strict';

// Supplemental reference typography, not a native export receipt or source edit.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { convertPdf } = require('../../out/export/pdf');
const { validateArtifact } = require('../../out/export/validate');

const root = path.resolve(__dirname, '../..');
const mode = process.argv[2] || 'declared';
const directory = path.join(root, '.vscode-test/export-native/evidence/artifact-audit');
const receiptsPath = path.resolve(process.argv[3] || path.join(root, '.vscode-test/export-native/evidence/formats.json'));
const browser = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const declared = '@media print{body,.editor{font-family:Helvetica,Arial,sans-serif!important;font-size:11pt!important;line-height:1.35!important}}';
const compact = `@media print{
body,.editor{font-family:Helvetica,Arial,sans-serif!important;font-size:11pt!important;line-height:1.35!important}
.editor p{margin:.5em 0!important}
.editor p:empty,.editor p:has(>br:only-child){height:0!important;line-height:0!important;margin:0!important;padding:0!important}
.editor table{table-layout:auto!important}.editor td,.editor th{font-size:10pt!important;line-height:1.3!important;padding:3pt 5pt!important}
.editor pre,.editor code{font-size:9pt!important;line-height:1.3!important}
.editor h1,.editor h2,.editor h3{margin-top:.65em!important;margin-bottom:.3em!important}
}`;

(async () => {
    if (!['declared', 'compact'].includes(mode)) { throw new Error('Use declared or compact reference layout.'); }
    const receipts = JSON.parse(await fs.readFile(receiptsPath, 'utf8'));
    const receipt = receipts.find(value => value.file === 'w30-report.md' && value.format === 'html' && value.state === 'complete');
    if (!receipt?.outputPath) { throw new Error('A complete W-30 HTML receipt is required for reference rendering.'); }
    const source = receipt.outputPath;
    const original = await fs.readFile(source);
    const css = mode === 'declared' ? declared : compact;
    const html = original.toString('utf8').replace('</head>', '<style>' + css + '</style></head>');
    const warnings = [];
    const stages = [];
    const bytes = await convertPdf(html, browser, {
        signal: new AbortController().signal, warnings,
        report: stage => { stages.push(stage); },
        loadResource: async () => { throw new Error('Reference HTML must already embed its resources.'); }
    });
    validateArtifact('pdf', bytes);
    await fs.mkdir(directory, { recursive: true });
    const output = path.join(directory, 'w30-reference-' + mode + '.pdf');
    await fs.writeFile(output, bytes);
    const info = execFileSync('pdfinfo', [output], { encoding: 'utf8' });
    const metadata = {
        kind: 'Supplemental reference render; does not replace actual native output.',
        mode, sourceHtml: path.basename(source), sourceHtmlSha256: createHash('sha256').update(original).digest('hex'),
        frozenMarkdownSha256: '1db4863436896ffa05bcfcc1d413a5fc88cd1ce73ce5f1c8cd78eb37686cbe33',
        output: path.basename(output), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
        browser: execFileSync(browser, ['--version'], { encoding: 'utf8' }).trim(),
        bodyFont: 'Helvetica, Arial, sans-serif', bodyPoints: 11, lineHeight: 1.35,
        paper: 'A4 portrait', marginsMm: 16, css,
        pages: Number(/^Pages:\s+(\d+)/m.exec(info)[1]), stages, warnings
    };
    await fs.writeFile(output + '.json', JSON.stringify(metadata, null, 2) + '\n');
    console.log(JSON.stringify(metadata));
})().catch(error => { console.error(error); process.exitCode = 1; });
