const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { inflateRawSync } = require('node:zlib');
const test = require('node:test');
const { discoverTool, runTool } = require('../../out/export/tools');
const { preparePandocMarkdown, convertPandoc } = require('../../out/export/pandoc');
const { convertPdf } = require('../../out/export/pdf');

async function temporary(t) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'binary-markdown-backend-test-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    return directory;
}

async function executable(directory, source, name = 'test executable') {
    const file = path.join(directory, name);
    await fs.writeFile(file, `#!${process.execPath}\n${source}\n`, { mode: 0o700 });
    return file;
}

function operations(loadResource = async () => { throw new Error('Unavailable test image'); }) {
    const controller = new AbortController();
    const stages = [];
    return { controller, stages, signal: controller.signal, report: stage => stages.push(stage), warnings: [], loadResource };
}

function archiveEntries(bytes) {
    const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    assert.ok(end >= 0, 'ZIP end record exists');
    const count = bytes.readUInt16LE(end + 10);
    let offset = bytes.readUInt32LE(end + 16);
    const entries = new Map();
    for (let index = 0; index < count; index++) {
        assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
        const method = bytes.readUInt16LE(offset + 10);
        const size = bytes.readUInt32LE(offset + 20);
        const nameLength = bytes.readUInt16LE(offset + 28);
        const extraLength = bytes.readUInt16LE(offset + 30);
        const commentLength = bytes.readUInt16LE(offset + 32);
        const local = bytes.readUInt32LE(offset + 42);
        const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
        assert.equal(bytes.readUInt32LE(local), 0x04034b50);
        const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
        const data = bytes.subarray(start, start + size);
        entries.set(name, method === 8 ? inflateRawSync(data) : data);
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

test('tool invocation preserves arguments and does not execute shell metacharacters', async t => {
    const directory = await temporary(t);
    const file = await executable(directory, 'process.stdout.write(JSON.stringify(process.argv.slice(2)));');
    const args = ['a space', '; touch should-not-exist', '$(touch should-not-exist)', '`touch should-not-exist`'];
    const result = await runTool(file, args, { cwd: directory });
    assert.deepEqual(JSON.parse(result.stdout.toString()), args);
    assert.deepEqual(await fs.readdir(directory), ['test executable']);
});

test('invalid explicit tool paths fail visibly without selecting an installed fallback', async t => {
    const directory = await temporary(t);
    const missing = path.join(directory, 'missing pandoc');
    const result = await discoverTool('pandoc', missing);
    assert.equal(result.available, false);
    assert.equal(result.path, missing);
    assert.match(result.error, /Configured pandoc path is unusable/);
    assert.equal((await discoverTool('browser', 'relative/chrome')).available, false);
});

test('Pandoc discovery rejects an executable that lacks required conversion capabilities', async t => {
    const directory = await temporary(t);
    const file = await executable(directory, `
        const argument = process.argv[2];
        process.stdout.write(argument === '--version' ? 'pandoc 3.8.3\\n' : argument === '--list-input-formats' ? 'commonmark_x\\njson\\n' : 'html\\n');
    `);
    const result = await discoverTool('pandoc', file);
    assert.equal(result.available, false);
    assert.match(result.error, /DOCX, and EPUB support/);
});

test('process cancellation terminates an uncooperative worker and retains cancellation identity', async t => {
    const directory = await temporary(t);
    const pidFile = path.join(directory, 'pid');
    const file = await executable(directory, `
        require('node:fs').writeFileSync(process.argv[2], String(process.pid));
        process.on('SIGTERM', () => {});
        setInterval(() => {}, 1000);
    `);
    const controller = new AbortController();
    const pending = runTool(file, [pidFile], { signal: controller.signal });
    while (!(await fs.stat(pidFile).catch(() => undefined))) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    const pid = Number(await fs.readFile(pidFile, 'utf8'));
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});

test('probe timeouts terminate broken executables instead of hanging discovery', async t => {
    const directory = await temporary(t);
    const file = await executable(directory, 'setInterval(() => {}, 1000);');
    await assert.rejects(runTool(file, [], { timeoutMs: 30 }), /capability check/);
});

test('temporary Markdown normalization preserves YAML and fenced directive examples', () => {
    const frontMatter = '---\ntitle: A report\n---\n\nText\n';
    assert.equal(preparePandocMarkdown(frontMatter), frontMatter);
    const fenced = '```text\n---\nIMAGE_DIR: images\nFORCE_RELATIVE_PATH: true\n```\n';
    assert.equal(preparePandocMarkdown(fenced), fenced);
    const unclosedFence = '```text\n---\nIMAGE_DIR: images\n';
    assert.equal(preparePandocMarkdown(unclosedFence), unclosedFence);
    const directives = frontMatter + '\n---\nIMAGE_DIR: images\nFORCE_RELATIVE_PATH: true\n';
    assert.equal(preparePandocMarkdown(directives), frontMatter);
});

test('failed Pandoc conversion removes its owned intermediate directory', async t => {
    const directory = await temporary(t);
    const receipt = path.join(directory, 'worker-directory');
    const file = await executable(directory, `
        require('node:fs').writeFileSync(${JSON.stringify(receipt)}, process.cwd());
        process.stderr.write('Controlled converter failure');
        process.exitCode = 4;
    `);
    const saved = { sourcePath: path.join(directory, 'report.md'), markdown: '# Report', version: 1, theme: 'github', fontSize: 16 };
    await assert.rejects(convertPandoc('docx', saved, { html: '', theme: 'github', fontSize: 16, diagrams: [], warnings: [] }, file, operations()), /Controlled converter failure/);
    const workerDirectory = await fs.readFile(receipt, 'utf8');
    await assert.rejects(fs.stat(workerDirectory), { code: 'ENOENT' });
});

const realTools = process.env.EXPORT_REAL_TOOLS === '1';

test('real DOCX pages do not acquire editor background or text colours', { skip: !realTools }, async t => {
    const directory = await temporary(t);
    const status = await discoverTool('pandoc', process.env.EXPORT_PANDOC_PATH || '');
    assert.equal(status.available, true, status.error);
    let reference;
    for (const theme of ['github', 'sepia', 'night', 'dark', 'minimal', 'things', 'perplexity']) {
        const saved = { sourcePath: path.join(directory, 'theme.md'), version: 1, theme, fontSize: 16,
            markdown: '# DOCX heading\n\nReadable body.\n\n> Readable quotation.\n\nDOCX-LAST-MARKER\n' };
        const entries = archiveEntries(await convertPandoc('docx', saved,
            { html: '', theme, fontSize: 16, diagrams: [], warnings: [] }, status.path, operations()));
        const document = entries.get('word/document.xml').toString('utf8');
        assert.doesNotMatch(document, /<w:(?:background|shd)\b/);
        assert.match(document, /DOCX-LAST-MARKER/);
        // Timestamp metadata can differ; compare the paper and typography parts.
        const appearance = ['word/document.xml', 'word/styles.xml', 'word/settings.xml'].map(name => entries.get(name));
        if (reference) assert.deepEqual(appearance, reference, theme + ' DOCX appearance matches the light export');
        else reference = appearance;
    }
});

test('real Pandoc exports structured content, native math and original assets without active raw HTML', { skip: !realTools }, async t => {
    const directory = await temporary(t);
    const status = await discoverTool('pandoc', process.env.EXPORT_PANDOC_PATH || '');
    assert.equal(status.available, true, status.error);
    // A generated 2x2 RGB PNG with verified chunk CRCs (several common one-pixel snippets have a corrupt IDAT).
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP4z8DAAMIM/4EAAB/uBfsL2WiLAAAAAElFTkSuQmCC', 'base64');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="white"/><text x="5" y="25">Start to End</text></svg>';
    const source = [
        '---', 'title: Export proof', 'header-includes: "<script>unexpected()</script>"', '---',
        '# First heading', '', '[TOC]', '', '[TOC]', '',
        'Editable **prose** and a [link](https://example.com).', '',
        '| Column A | Column B |', '| --- | --- |', '| One | Two |', '',
        'A footnote.[^note]', '', '[^note]: Footnote survives.', '',
        '$x^2$ and native math:', '', '```math', 'a^2+b^2=c^2', '```', '',
        '![Original image](assets/image.png)', '',
        '```mermaid', 'graph LR; A-->B', '```', '',
        '<div onclick="unexpected()">Raw HTML fallback</div>', '',
        '# Final heading', '', 'LAST_SENTINEL', '',
        '---', 'IMAGE_DIR: assets', 'FORCE_RELATIVE_PATH: true', ''
    ].join('\n');
    const sourceFile = path.join(directory, 'report.md');
    await fs.writeFile(sourceFile, source);
    const saved = { sourcePath: sourceFile, markdown: source, version: 1, theme: 'github', fontSize: 16 };
    const prepared = { html: '', theme: 'github', fontSize: 16, diagrams: [{ source: 'graph LR; A-->B', svg }], warnings: [] };
    for (const format of ['docx', 'epub']) {
        const requested = [];
        const ops = operations(async (reference, base) => {
            requested.push([reference, base]);
            assert.equal(reference, 'assets/image.png');
            assert.equal(base, sourceFile);
            return { bytes: png, mime: 'image/png' };
        });
        const bytes = await convertPandoc(format, saved, prepared, status.path, ops);
        const entries = archiveEntries(bytes);
        const content = [...entries].filter(([name]) => /(?:document\.xml|footnotes\.xml|\.xhtml)$/.test(name)).map(([, value]) => value.toString('utf8')).join('\n');
        assert.match(content, /LAST_SENTINEL/);
        assert.match(content, /Footnote survives/);
        assert.match(content, /Raw HTML fallback/);
        assert.doesNotMatch(content, /IMAGE_DIR|FORCE_RELATIVE_PATH|\[TOC\]/);
        assert.match(content, format === 'docx' ? /m:oMath/ : /<math/);
        assert.ok([...entries.values()].some(value => value.equals(png)), `${format} preserves the source PNG bytes`);
        assert.ok([...entries.values()].some(value => value.toString('utf8').includes('Start to End')), `${format} contains the diagram SVG`);
        assert.deepEqual(requested, [['assets/image.png', sourceFile]]);
        assert.ok(ops.warnings.some(warning => warning.code === 'raw-content-fallback'));
        assert.ok(ops.warnings.some(warning => warning.code === 'pandoc-metadata'));
        assert.ok(!ops.warnings.some(warning => warning.code === 'pandoc-writer'), JSON.stringify(ops.warnings));
        assert.deepEqual(ops.stages, ['converting', 'resources', 'converting']);
        await fs.writeFile(path.join(directory, `report.${format}`), bytes);
    }
    assert.equal(await fs.readFile(sourceFile, 'utf8'), source);
});

test('real Pandoc preserves visible fallbacks when media and diagrams cannot be exported', { skip: !realTools }, async t => {
    const directory = await temporary(t);
    const status = await discoverTool('pandoc', process.env.EXPORT_PANDOC_PATH || '');
    assert.equal(status.available, true, status.error);
    const ops = operations();
    const saved = { sourcePath: path.join(directory, 'fallback.md'), markdown: '![Missing asset](missing.png)\n\n```mermaid\ngraph INVALID\n```\n', version: 1, theme: 'github', fontSize: 16 };
    const bytes = await convertPandoc('docx', saved, { html: '', theme: 'github', fontSize: 16, diagrams: [], warnings: [] }, status.path, ops);
    const content = archiveEntries(bytes).get('word/document.xml').toString('utf8');
    assert.match(content, /Image unavailable: Missing asset/);
    assert.match(content, /Diagram unavailable/);
    assert.match(content, /graph INVALID/);
    assert.ok(ops.warnings.some(warning => warning.code === 'image-fallback'));
    assert.ok(ops.warnings.some(warning => warning.code === 'diagram-fallback'));
});

test('real headless browser produces complete, offline PDF with oversized content and safe script handling', { skip: !realTools }, async t => {
    const directory = await temporary(t);
    const status = await discoverTool('browser', process.env.EXPORT_BROWSER_PATH || '');
    assert.equal(status.available, true, status.error);
    const lines = Array.from({ length: 160 }, (_, index) => `CODE_LINE_${index}`).join('\n');
    const rows = Array.from({ length: 80 }, (_, index) => `<tr><td>TABLE_ROW_${index}</td><td>Content stays editable and visible.</td></tr>`).join('');
    const html = `<!doctype html><html><head><style>body{font:14px sans-serif}pre{font:12px monospace}td{padding:5px;border:1px solid}svg{width:600px;height:2000px}</style></head><body><h1>FIRST_SENTINEL</h1><p><a href="https://example.com">A working link</a></p><script>document.body.textContent='SCRIPT_EXECUTED'</script><pre>${lines}</pre><table><thead><tr><th>Reference</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 2000"><rect width="600" height="2000" fill="pink"/><text x="10" y="40">GRAPHIC_SENTINEL</text></svg><img src="https://example.invalid/should-not-fetch.png" alt="blocked external image"><p>LAST_SENTINEL</p></body></html>`;
    const ops = operations();
    const bytes = await convertPdf(html, status.path, ops);
    assert.ok(bytes.subarray(0, 5).equals(Buffer.from('%PDF-')));
    const file = path.join(directory, 'report.pdf');
    await fs.writeFile(file, bytes);
    const textTool = process.env.EXPORT_PDFTOTEXT_PATH || 'pdftotext';
    const extracted = (await runTool(textTool, [file, '-'])).stdout.toString('utf8');
    assert.match(extracted, /FIRST_SENTINEL/);
    assert.match(extracted, /LAST_SENTINEL/);
    assert.match(extracted, /GRAPHIC_SENTINEL/);
    assert.match(extracted, /CODE_LINE_159/);
    assert.match(extracted, /TABLE_ROW_79/);
    assert.doesNotMatch(extracted, /SCRIPT_EXECUTED/);
    assert.match(extracted, /Image unavailable: blocked external image/);
    assert.ok(ops.warnings.some(warning => warning.code === 'pdf-image-fallback'));
    assert.deepEqual(ops.stages, ['rendering', 'converting']);
});

test('real browser cancellation closes the worker and returns cancellation instead of a PDF', { skip: !realTools }, async () => {
    const status = await discoverTool('browser', process.env.EXPORT_BROWSER_PATH || '');
    assert.equal(status.available, true, status.error);
    const ops = operations();
    ops.report = stage => {
        ops.stages.push(stage);
        if (stage === 'converting') { ops.controller.abort(); }
    };
    await assert.rejects(convertPdf('<!doctype html><html><body><p>Cancel this export.</p></body></html>', status.path, ops), { name: 'AbortError' });
    assert.deepEqual(ops.stages, ['rendering', 'converting']);
});
