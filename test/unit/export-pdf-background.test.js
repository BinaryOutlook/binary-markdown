const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { prepareStandaloneHtml } = require('../../out/export/html');
const { convertPdf } = require('../../out/export/pdf');
const { discoverTool, runTool } = require('../../out/export/tools');

// Inspect the actual PDF raster, not a DOM background that can stop at the margins.
function readPpm(bytes) {
    const header = /^P6\s+(\d+)\s+(\d+)\s+255\s/.exec(bytes.subarray(0, 100).toString('latin1'));
    assert.ok(header, 'Poppler produced an RGB PPM image');
    const width = Number(header[1]), height = Number(header[2]);
    const pixels = bytes.subarray(header[0].length);
    assert.equal(pixels.length, width * height * 3);
    return { width, height, pixel: (x, y) => [...pixels.subarray((y * width + x) * 3, (y * width + x) * 3 + 3)] };
}

test('real PDFs paint every theme through all page edges without losing text margins', {
    skip: process.env.EXPORT_REAL_TOOLS !== '1'
}, async t => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'binary-pdf-background-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const browser = await discoverTool('browser', process.env.EXPORT_BROWSER_PATH || '');
    assert.equal(browser.available, true, browser.error);
    const themes = {
        github: [255, 255, 255], sepia: [251, 248, 241], night: [26, 27, 38],
        dark: [30, 30, 30], minimal: [250, 250, 250], things: [255, 255, 255], perplexity: [251, 250, 244]
    };
    for (const [theme, expected] of Object.entries(themes)) {
        await t.test(theme, async () => {
            const operations = { signal: new AbortController().signal, warnings: [], report() {},
                loadResource: async () => { throw new Error('Offline theme fixture uses system fonts.'); } };
            const source = { sourcePath: path.join(directory, 'report.md'), markdown: '', version: 1, theme, fontSize: 16 };
            const prepared = { theme, fontSize: 16, diagrams: [], warnings: [],
                html: '<article class="editor">' + [1, 2, 3].map(page =>
                    `<p style="${page > 1 ? 'break-before:page;' : ''}margin:0">PAGE_${page}_MARKER</p>`).join('') + '</article>' };
            const html = await prepareStandaloneHtml(source, prepared, path.resolve(__dirname, '../..'), operations);
            const file = path.join(directory, theme + '.pdf');
            await fs.writeFile(file, await convertPdf(html, browser.path, operations));
            const text = (await runTool(process.env.EXPORT_PDFTOTEXT_PATH || 'pdftotext', ['-bbox', file, '-'])).stdout.toString('utf8');
            assert.equal((text.match(/<page /g) || []).length, 3, 'Three pages, including the short final page');
            for (const page of [1, 2, 3]) {
                const word = new RegExp(`<word xMin="([\\d.]+)" yMin="([\\d.]+)"[^>]*>PAGE_${page}_MARKER</word>`).exec(text);
                assert.ok(word, 'Page marker survives as searchable text');
                assert.ok(Number(word[1]) >= 44 && Number(word[1]) <= 47, 'Text retains its 16 mm left margin');
                const rendered = await runTool(process.env.EXPORT_PDFTOPPM_PATH || 'pdftoppm', ['-f', String(page), '-singlefile', '-r', '72', file]);
                const { width, height, pixel } = readPpm(rendered.stdout);
                assert.ok(Math.abs(width - 595) <= 2 && Math.abs(height - 842) <= 2, 'A4 dimensions');
                for (let x = 0; x < width; x++) {
                    assert.deepEqual(pixel(x, 0), expected, `${theme} page ${page} top edge`);
                    assert.deepEqual(pixel(x, height - 1), expected, `${theme} page ${page} bottom edge`);
                }
                for (let y = 0; y < height; y++) {
                    assert.deepEqual(pixel(0, y), expected, `${theme} page ${page} left edge`);
                    assert.deepEqual(pixel(width - 1, y), expected, `${theme} page ${page} right edge`);
                }
                for (const [x, y] of [[10, height / 2], [width - 11, height / 2], [width / 2, 10], [width / 2, height - 11], [width / 2, height - 65]]) {
                    assert.deepEqual(pixel(Math.floor(x), Math.floor(y)), expected, 'Margins and unused content area share the page colour');
                }
                // PDF font bounding boxes include ascenders above the actual ink.
                // Measure rendered ink to check the physical 16 mm top margin.
                let firstInk = height;
                for (let y = 0; y < height && firstInk === height; y++) {
                    for (let x = 0; x < width; x++) {
                        if (pixel(x, y).some((value, channel) => Math.abs(value - expected[channel]) > 16)) {
                            firstInk = y;
                            break;
                        }
                    }
                }
                assert.ok(firstInk >= 44 && firstInk <= 65, `Text retains its 16 mm top margin: ${firstInk} pt`);
            }
        });
    }
});
