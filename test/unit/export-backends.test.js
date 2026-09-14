const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { inflateRawSync } = require('node:zlib');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const { discoverTool, runTool } = require('../../out/export/tools');
const { preparePandocMarkdown, convertPandoc } = require('../../out/export/pandoc');
const { convertPdf } = require('../../out/export/pdf');

async function temporary(t) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'binary-markdown-backend-test-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    return directory;
}

const { toolFixture: executable } = require('../utils/tool-fixture.cjs');

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
    const file = await executable(directory, 'echo');
    const args = ['a space', '; touch should-not-exist', '$(touch should-not-exist)', '`touch should-not-exist`'];
    const result = await runTool(file, args, { cwd: directory });
    assert.deepEqual(JSON.parse(result.stdout.toString()), args);
    assert.deepEqual((await fs.readdir(directory)).sort(), process.platform === 'win32'
        ? ['test executable.exe', 'test executable.exe.fixture'] : ['test executable']);
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
    const file = await executable(directory, 'incomplete-pandoc');
    const result = await discoverTool('pandoc', file);
    assert.equal(result.available, false);
    assert.match(result.error, /DOCX, and EPUB support/);
});

test('process cancellation terminates an uncooperative worker and retains cancellation identity', async t => {
    const directory = await temporary(t);
    const pidFile = path.join(directory, 'pid');
    const file = await executable(directory, 'hang');
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
    const file = await executable(directory, 'hang');
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

test('Pandoc receives generated links without managed comments, preserving code examples', () => {
    const { refreshTocs, START } = require('../../src/shared/document-aux');
    const source = refreshTocs('[TOC]\n\n# Heading\n') + '\n```html\n' + START + '\n```\n';
    const prepared = preparePandocMarkdown(source);
    assert.ok(prepared.includes('[Heading](#heading)'));
    assert.equal(prepared.split(START).length - 1, 1);
    assert.ok(prepared.includes('```html\n' + START));
});

test('failed Pandoc conversion removes its owned intermediate directory', async t => {
    const directory = await temporary(t);
    const receipt = path.join(directory, 'worker-directory');
    const file = await executable(directory, 'fail-pandoc', receipt);
    const saved = { sourcePath: path.join(directory, 'report.md'), markdown: '# Report', version: 1, theme: 'github', fontSize: 16 };
    await assert.rejects(convertPandoc('docx', saved, { html: '', theme: 'github', fontSize: 16, diagrams: [], warnings: [] }, file, operations()), /Controlled converter failure/);
    const workerDirectory = await fs.readFile(receipt, 'utf8');
    await assert.rejects(fs.stat(workerDirectory), { code: 'ENOENT' });
});

const realTools = process.env.EXPORT_REAL_TOOLS === '1';

test('real Pandoc exports all supported equation delimiters as native math without changing source', { skip: !realTools }, async t => {
    const directory = await temporary(t);
    const status = await discoverTool('pandoc', process.env.EXPORT_PANDOC_PATH || '');
    assert.equal(status.available, true, status.error);
    const source = [
        '# Equation compatibility', '',
        'Inline $a^2$ and \\(b^3\\).', '',
        '$$', '\\begin{aligned}', 'x&=1\\\\', 'y&=2', '\\end{aligned}', '$$', '',
        '\\[', '\\begin{pmatrix}', '1&2\\\\', '3&4', '\\end{pmatrix}', '\\]', '',
        '$$c^2$$', '', '\\[d^3\\]', '',
        '```math', '\\begin{gathered}', 'e=1\\\\', 'f=2', '\\end{gathered}', '```', '',
        '| Cost |', '| --- |', '| \\(O(V^3)\\) |', '',
        '> \\[', '> g^2', '> \\]', '',
        '- Parent', '  - Child', '', '    \\[', '    h^3', '    \\]', '',
        '`\\(literal-code\\)`', '', '```text', '\\[literal-fence\\]', '```', '',
        'EQUATION-LAST-MARKER', ''
    ].join('\n');
    const sourcePath = path.join(directory, 'equations.md');
    await fs.writeFile(sourcePath, source);
    const saved = { sourcePath, markdown: source, version: 1, theme: 'github', fontSize: 16 };
    const prepared = { html: '', theme: 'github', fontSize: 16, diagrams: [], warnings: [] };
    for (const format of ['docx', 'epub']) {
        const ops = operations();
        const entries = archiveEntries(await convertPandoc(format, saved, prepared, status.path, ops));
        const content = [...entries].filter(([name]) => /(?:document\.xml|\.xhtml)$/.test(name)).map(([, value]) => value.toString('utf8')).join('\n');
        const math = content.match(format === 'docx' ? /<m:oMath[ >]/g : /<math[ >]/g) || [];
        assert.equal(math.length, 10, `${format} contains ten native equations`);
        assert.match(content, /EQUATION-LAST-MARKER/);
        assert.match(content, /\\\(literal-code\\\)/);
        assert.match(content, /\\\[literal-fence\\\]/);
        assert.deepEqual(ops.warnings, []);
    }
    assert.equal(await fs.readFile(sourcePath, 'utf8'), source);
    assert.equal(saved.markdown, source);
});

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

const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function xmlDocument(bytes) {
    return new JSDOM(bytes.toString('utf8'), { contentType: 'text/xml' }).window.document;
}
function wordElements(parent, name) { return [...parent.getElementsByTagNameNS(wordNamespace, name)]; }
function wordValue(element, name = 'val') { return element?.getAttributeNS(wordNamespace, name); }
function wordText(element) {
    return [...element.getElementsByTagName('*')].map(child => {
        if (child.namespaceURI !== wordNamespace) return '';
        if (child.localName === 't') return child.textContent;
        if (child.localName === 'br') return '\n';
        if (child.localName === 'tab') return '\t';
        return '';
    }).join('');
}

test('DOCX puts declared-language labels after intact code blocks, including nested blocks; EPUB stays unchanged', async t => {
    const directory = await temporary(t);
    const receipt = path.join(directory, 'writer.json');
    const code = (language, text) => ({ t: 'CodeBlock', c: [['anchor', language, [['data-example', 'kept']]], text] });
    const examples = [
        code(['js'], 'const x = "<&>";\n\n\tconsole.log(x);'),
        code([], 'no declared language'),
        code(['numberLines', 'cpp'], 'return 0;'),
        code(['mydsl'], 'emit result'),
        code(['numberLines'], 'control class only'),
        code(['__proto__'], 'unknown language')
    ];
    const ast = { 'pandoc-api-version': [1, 23, 1, 1], meta: {}, blocks: [
        ...examples.slice(0, 2), { t: 'BlockQuote', c: examples.slice(2, 4) },
        { t: 'BulletList', c: [[...examples.slice(4)]] },
        { t: 'Para', c: [{ t: 'Code', c: [['', [], []], 'inline code'] }] }
    ] };
    const file = await executable(directory, 'ast-pandoc', receipt, ast);
    const saved = { sourcePath: path.join(directory, 'source.md'), markdown: 'fixture', version: 1, theme: 'github', fontSize: 16 };
    function collect(value, predicate, result = []) {
        if (!value || typeof value !== 'object') return result;
        if (predicate(value)) result.push(value);
        for (const child of Object.values(value)) collect(child, predicate, result);
        return result;
    }
    for (const [format, showCodeLanguage] of [['docx', undefined], ['docx', true], ['docx', false], ['epub', true], ['epub', false]]) {
        await convertPandoc(format, saved, { html: '', theme: 'github', fontSize: 16, diagrams: [], warnings: [] }, file, operations(), { showCodeLanguage });
        const output = JSON.parse(await fs.readFile(receipt, 'utf8'));
        assert.ok(output.args.includes('--sandbox'));
        assert.deepEqual(collect(output.ast, value => value.t === 'CodeBlock'), examples);
        const labelled = collect(output.ast, value => value.t === 'Div' && value.c[1][0]?.t === 'CodeBlock');
        if (format === 'epub') {
            assert.deepEqual(output.ast.blocks, ast.blocks);
            assert.ok(!output.args.some(arg => arg.startsWith('--reference-doc=')));
            continue;
        }
        const reference = output.args.find(arg => arg.startsWith('--reference-doc='))?.slice('--reference-doc='.length);
        assert.equal(reference, path.resolve(__dirname, '../../media/export-reference.docx'));
        await fs.access(reference);
        if (showCodeLanguage === false) {
            assert.deepEqual(output.ast.blocks, ast.blocks, 'disabling labels preserves original blocks and nesting');
            continue;
        }
        const shapes = labelled.map(value => {
            const [attributes, paragraphs] = value.c[1][1].c;
            assert.deepEqual(attributes, ['', [], [['custom-style', 'Code Language']]]);
            const raw = paragraphs[0].c[1];
            assert.equal(raw.t, 'RawInline');
            assert.equal(raw.c[0], 'openxml');
            return xmlDocument(Buffer.from(raw.c[1]));
        });
        assert.deepEqual(shapes.map(wordText), ['JavaScript', 'C++', 'mydsl', '__proto__']);
        const ids = shapes.map(shape => shape.getElementsByTagNameNS('urn:schemas-microsoft-com:vml', 'shape')[0].getAttribute('id'));
        assert.equal(new Set(ids).size, shapes.length, 'each native shape has a distinct ID');
    }
});

test('bundled Word styles provide a shaded code container and a right-aligned footer without altering inline code', async () => {
    const entries = archiveEntries(await fs.readFile(path.join(__dirname, '../../media/export-reference.docx')));
    const styles = wordElements(xmlDocument(entries.get('word/styles.xml')), 'style');
    const style = id => styles.find(element => wordValue(element, 'styleId') === id);
    const code = style('SourceCode');
    const label = style('CodeLanguage');
    const badge = style('CodeLanguageBadge');
    assert.equal(wordValue(wordElements(code, 'shd')[0], 'fill'), 'F6F8FA');
    assert.equal(wordElements(code, 'pBdr')[0].children.length, 5);
    assert.equal(wordValue(wordElements(code, 'between')[0]), 'single', 'adjacent unlabeled blocks remain visually separated');
    assert.equal(wordElements(code, 'keepNext').length, 1, 'code end stays with its footer');
    assert.equal(wordValue(wordElements(code, 'keepLines')[0]), '0', 'long code can span pages');
    assert.equal(wordValue(wordElements(code, 'wordWrap')[0]), 'off', 'character-level wrapping is retained');
    assert.equal(wordValue(wordElements(label, 'jc')[0]), 'right');
    assert.equal(wordValue(wordElements(label, 'keepNext')[0]), '0', 'footer ends the paragraph grouping');
    assert.equal(wordValue(wordElements(label, 'sz')[0]), '18');
    assert.equal(wordValue(badge, 'type'), 'character');
    assert.equal(wordElements(badge, 'i').length, 1, 'language is italic');
    assert.equal(wordElements(badge, 'iCs').length, 1, 'complex-script language names are also italic');
    assert.equal(wordElements(badge, 'bdr').length, 0, 'native shape provides the outline, without a rectangle around its text');
    assert.equal(wordValue(wordElements(badge, 'sz')[0]), '18', 'text inside the shape retains the small label size');
    assert.equal(wordElements(label, 'bdr').length, 0, 'list indentation does not inherit the text border');
    assert.equal(wordElements(label, 'pBdr').length, 0, 'border fits the text instead of spanning the paragraph');
    assert.equal(wordElements(style('VerbatimChar'), 'shd').length, 0);
    assert.equal(wordElements(style('VerbatimChar'), 'pBdr').length, 0);
    assert.equal(wordElements(style('VerbatimChar'), 'bdr').length, 0);
});

test('real Pandoc exports editable code with bottom language labels, safe unknown names, nested blocks and native highlighting', { skip: !realTools }, async t => {
    const directory = await temporary(t);
    const status = await discoverTool('pandoc', process.env.EXPORT_PANDOC_PATH || '');
    assert.equal(status.available, true, status.error);
    const python = 'def greet(name):\n    # 中文 <&>\n\n    return "Hello, " + name';
    const long = Array.from({ length: 140 }, (_, index) => `console.log("CODE_LINE_${String(index).padStart(3, '0')}");`).join('\n');
    const markdown = [
        'Inline `count = 0` stays in this paragraph.', '',
        '```python', python, '```', '',
        '```', 'unlabeled code', '```', '',
        '```mydsl<&', 'emit "result"', '```', '',
        '- List item', '', '  ```cpp', '  return 0;', '  ```', '',
        '> ```text', '> quoted text', '> ```', '',
        '```js', long, '```', '', 'END_OF_CODE_TEST'
    ].join('\n');
    const saved = { sourcePath: path.join(directory, 'source.md'), markdown, version: 1, theme: 'github', fontSize: 16 };
    const ops = operations();
    const bytes = await convertPandoc('docx', saved, { html: '', theme: 'github', fontSize: 16, diagrams: [], warnings: [] }, status.path, ops);
    const entries = archiveEntries(bytes);
    const document = xmlDocument(entries.get('word/document.xml'));
    const paragraphs = wordElements(document, 'p');
    const style = paragraph => wordValue(wordElements(paragraph, 'pStyle')[0]);
    const blocks = paragraphs.filter(paragraph => style(paragraph) === 'SourceCode');
    assert.deepEqual(blocks.map(wordText), [python, 'unlabeled code', 'emit "result"', 'return 0;', 'quoted text', long]);
    const labels = paragraphs.filter(paragraph => style(paragraph) === 'CodeLanguage');
    assert.deepEqual(labels.map(label => wordText(label).trim()), ['Python', 'mydsl<&', 'C++', 'Plain text', 'JavaScript']);
    for (const label of labels) {
        assert.equal(style(label.previousElementSibling), 'SourceCode', 'label immediately follows complete code');
        assert.equal(wordValue(wordElements(label, 'rStyle')[0]), 'CodeLanguageBadge', 'only label text receives the badge style');
        const firstRun = wordElements(label, 'r')[0];
        assert.equal(wordText(firstRun), ' ');
        assert.equal(wordElements(firstRun, 'rStyle').length, 0, 'list continuation spacing stays outside the badge');
        const shape = label.getElementsByTagNameNS('urn:schemas-microsoft-com:vml', 'shape')[0];
        assert.ok(shape, 'language is editable text inside a native shape');
        assert.equal(wordElements(shape, 'txbxContent').length, 1);
    }
    assert.ok(wordElements(blocks[0], 'rStyle').some(element => wordValue(element) === 'KeywordTok'));
    const inline = paragraphs.find(paragraph => wordText(paragraph).startsWith('Inline '));
    assert.notEqual(style(inline), 'SourceCode');
    assert.equal(wordValue(wordElements(inline, 'rStyle')[0]), 'VerbatimChar');
    assert.ok(paragraphs.some(paragraph => wordText(paragraph) === 'END_OF_CODE_TEST'));
    assert.deepEqual(ops.warnings, []);
    const hidden = archiveEntries(await convertPandoc('docx', saved, { html: '', theme: 'github', fontSize: 16, diagrams: [], warnings: [] },
        status.path, operations(), { showCodeLanguage: false }));
    const hiddenParagraphs = wordElements(xmlDocument(hidden.get('word/document.xml')), 'p');
    assert.equal(hiddenParagraphs.filter(paragraph => style(paragraph) === 'CodeLanguage').length, 0);
    assert.deepEqual(hiddenParagraphs.filter(paragraph => style(paragraph) === 'SourceCode').map(wordText), blocks.map(wordText),
        'hidden badges preserve every styled code block');
    assert.ok(wordElements(hiddenParagraphs.find(paragraph => style(paragraph) === 'SourceCode'), 'rStyle')
        .some(element => wordValue(element) === 'KeywordTok'), 'hiding badges keeps highlighting');
    const epub = archiveEntries(await convertPandoc('epub', saved, { html: '', theme: 'github', fontSize: 16, diagrams: [], warnings: [] }, status.path, operations()));
    const html = [...epub].filter(([name]) => name.endsWith('.xhtml')).map(([, contents]) => contents.toString()).join('\n');
    assert.doesNotMatch(html, /Code Language|CodeLanguage/);
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

test('real PDF adds declared-language badges after complete code and hides them without losing code', { skip: !realTools }, async t => {
    const directory = await temporary(t);
    const status = await discoverTool('browser', process.env.EXPORT_BROWSER_PATH || '');
    assert.equal(status.available, true, status.error);
    const long = Array.from({ length: 140 }, (_, i) => 'CODE_MARKER_' + String(i).padStart(3, '0')).join('\n');
    const html = '<!doctype html><html><head><style>body{font:14px sans-serif}pre{font:12px monospace;padding:8px;background:#f6f8fa;border:1px solid #d0d7de}</style></head><body>' +
        '<p>Inline <code>value = 1</code></p><pre data-lang="js"><code>FIRST_CODE</code></pre>' +
        '<ul><li>Nested<pre data-lang="mydsl&lt;&amp;"><code>NESTED_CODE</code></pre></li></ul>' +
        '<pre data-lang=""><code>UNLABELED_CODE</code></pre>' +
        '<pre data-lang="rust"><code>' + long + '</code></pre><p>END_OF_PDF</p></body></html>';
    for (const showCodeLanguage of [undefined, false]) {
        const ops = operations();
        const bytes = await convertPdf(html, status.path, ops, { showCodeLanguage });
        const file = path.join(directory, showCodeLanguage === false ? 'hidden.pdf' : 'shown.pdf');
        await fs.writeFile(file, bytes);
        const text = (await runTool(process.env.EXPORT_PDFTOTEXT_PATH || 'pdftotext', [file, '-'])).stdout.toString();
        for (const marker of ['FIRST_CODE', 'NESTED_CODE', 'UNLABELED_CODE', 'END_OF_PDF', 'value = 1']) assert.ok(text.includes(marker));
        for (let i = 0; i < 140; i++) assert.equal(text.split('CODE_MARKER_' + String(i).padStart(3, '0')).length, 2);
        if (showCodeLanguage === false) {
            assert.doesNotMatch(text, /JavaScript|mydsl|Rust/);
        } else {
            assert.match(text, /FIRST_CODE\s+JavaScript/);
            assert.match(text, /NESTED_CODE\s+mydsl<&/);
            assert.match(text.split('\f').find(page => page.includes('CODE_MARKER_139')), /Rust/);
        }
        assert.deepEqual(ops.warnings, []);
    }
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

test('real exports retain TOC destinations for equation headings and following headings', { skip: !realTools }, async t => {
    const { refreshTocs, scan } = require('../../src/shared/document-aux');
    const directory = await temporary(t);
    const status = await discoverTool('pandoc', process.env.EXPORT_PANDOC_PATH || '');
    assert.equal(status.available, true, status.error);
    const source = refreshTocs('---\ntitle: Integrated report\n---\n\n[TOC]\n\n# Cost $x^2$\n\n## Complexity \\(O(V^3)\\)\n\n# Following heading\n\n```python\nprint("kept")\n```\n');
    const saved = { sourcePath: path.join(directory, 'integrated.md'), markdown: source, version: 1, theme: 'github', fontSize: 16 };
    const prepared = { html: '', theme: 'github', fontSize: 16, diagrams: [], warnings: [] };
    for (const format of ['docx', 'epub']) {
        const entries = archiveEntries(await convertPandoc(format, saved, prepared, status.path, operations()));
        if (format === 'docx') {
            const xml = xmlDocument(entries.get('word/document.xml'));
            const targets = new Set(wordElements(xml, 'bookmarkStart').map(element => wordValue(element, 'name')));
            const links = wordElements(xml, 'hyperlink').map(element => wordValue(element, 'anchor')).filter(Boolean);
            assert.equal(links.length, scan(source).headings.length);
            for (const link of links) assert.ok(targets.has(link), 'DOCX TOC target exists: ' + link);
            assert.match(wordText(xml), /Python/);
        } else {
            const content = [...entries].filter(([name]) => name.endsWith('.xhtml')).map(([, bytes]) => bytes.toString()).join('\n');
            for (const heading of scan(source).headings) assert.ok(content.includes('id="' + heading.id + '"'), 'EPUB TOC target exists: ' + heading.id);
        }
    }
    assert.equal(saved.markdown, source);
});
