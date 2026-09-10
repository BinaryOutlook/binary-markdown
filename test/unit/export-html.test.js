const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { createResourceLoader, resourceUrl } = require('../../out/export/resources');
const { prepareStandaloneHtml } = require('../../out/export/html');
const validPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP4z8DAAMIM/4EAAB/uBfsL2WiLAAAAAElFTkSuQmCC', 'base64');

async function htmlFixture(t) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'binary-export-html-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    await fs.mkdir(path.join(dir, 'out/webview'), { recursive: true });
    await fs.writeFile(path.join(dir, 'out/webview/styles.css'), ':root{--font-size:__FONT_SIZE__px}');
    const source = { sourcePath: path.join(dir, 'report.md'), markdown: '# Report', version: 1, theme: 'night', fontSize: 18 };
    return { dir, source };
}

test('local references preserve bytes and job cache survives later asset edits', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'binary-export-resource-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const file = path.join(dir, '原图 one.png');
    await fs.writeFile(file, validPng);
    const load = createResourceLoader(new AbortController().signal);
    const first = await load(encodeURI('原图 one.png'), path.join(dir, 'report.md'));
    await fs.writeFile(file, 'later asset bytes');
    assert.deepEqual((await load(encodeURI('原图 one.png'), path.join(dir, 'report.md'))).bytes, first.bytes);
    assert.equal(first.mime, 'image/png');
    assert.equal(resourceUrl('image.png', 'https://example.com/docs/report.md').href, 'https://example.com/docs/image.png');
    assert.throws(() => resourceUrl('javascript:alert(1)', file), /Unsupported resource scheme/);
});

test('standalone HTML embeds referenced images, preserves appearance and declares missing assets', async t => {
    const { dir, source } = await htmlFixture(t);
    const warnings = [];
    const requested = [];
    const bytes = validPng;
    const operations = {
        signal: new AbortController().signal, report() {}, warnings,
        async loadResource(reference) {
            requested.push(reference);
            if (reference === 'original.png') return { mime: 'image/png', bytes };
            throw new Error('missing');
        }
    };
    const html = await prepareStandaloneHtml(source, {
        html: '<p>START</p><img src="webview://old" data-markdown-path="original.png"><img src="missing.png"><a href="https://example.com/">Reference</a><p>END</p>',
        theme: 'night', fontSize: 18, diagrams: [], warnings
    }, dir, operations);
    assert.deepEqual(requested, ['original.png', 'missing.png']);
    assert.ok(html.includes('data:image/png;base64,' + bytes.toString('base64')));
    assert.ok(html.includes('data-theme="night"'));
    assert.ok(html.includes('--font-size:18px'));
    assert.ok(html.includes('Image unavailable: missing.png'));
    assert.ok(html.includes('START') && html.includes('END'));
    assert.equal(warnings.length, 1);
    assert.ok(!html.includes('webview://old'));
    assert.ok(!html.includes('<script'));
});

test('local resources handle literal percent, escaped separators, queries and unsupported fragments deliberately', async t => {
    const { dir, source } = await htmlFixture(t);
    for (const name of ['原图 100%.png', 'hash#question?.png']) { await fs.writeFile(path.join(dir, name), validPng); }
    const load = createResourceLoader(new AbortController().signal);
    const plain = await load('原图 100%.png', source.sourcePath);
    assert.deepEqual(plain.bytes, validPng);
    assert.equal(await load(encodeURI('原图 100%.png'), source.sourcePath), plain);
    assert.equal(await load('原图 100%.png?revision=2', source.sourcePath), plain);
    assert.deepEqual((await load('hash%23question%3F.png', source.sourcePath)).bytes, validPng);
    assert.equal(resourceUrl('chart.svg#view', source.sourcePath).hash, '#view');
    assert.equal(resourceUrl('chart.svg#view', source.sourcePath).pathname.endsWith('/chart.svg'), true);
    await assert.rejects(load('chart.svg#view', source.sourcePath), /Resource fragments/);
    assert.equal(resourceUrl('//images.example.com/one.png', 'https://example.com/doc.md').href, 'https://images.example.com/one.png');
});

test('standalone SVG retains original bytes and unresolved dependencies fail explicitly', async () => {
    const wrap = body => '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="40" height="40">' + body + '</svg>';
    const dataReference = svg => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    const load = createResourceLoader(new AbortController().signal);
    const portable = wrap('<defs><rect id="shape" width="40" height="40"/></defs><use href="#shape"/><rect fill="url(#shape)"/>');
    assert.deepEqual((await load(dataReference(portable), '/tmp/report.md')).bytes, Buffer.from(portable));
    for (const content of [
        '<image href="relative.png"/>',
        '<image xlink:href="//images.example.com/picture.png"/>',
        '<image href="&#x68;ttps://example.com/image.png"/>',
        '<rect style="fill:url(../paint.svg)"/>',
        '<rect fill="url(https://example.com/paint.svg#paint)"/>',
        '<style>@import "relative.css";</style>',
        '<style>.shape{fill:u\\72l(https://example.com/paint.svg)}</style>',
        '<script>unexpected()</script>'
    ]) {
        await assert.rejects(load(dataReference(wrap(content)), '/tmp/report.md'), /SVG with/);
    }
});

test('quoted greater-than signs and source-like alt text survive image embedding with one styled wrapper', async t => {
    const { dir, source } = await htmlFixture(t);
    const requested = [];
    const operations = {
        signal: new AbortController().signal, report() {}, warnings: [],
        async loadResource(reference) { requested.push(reference); return { bytes: validPng, mime: 'image/png' }; }
    };
    const content = '<article class="editor export-document"><img alt=\'data-markdown-path="fake.png" > b\' src="real.png"><img src=\'second.png\' alt="a &gt; b &amp; c" data-markdown-path="original.png"></article>';
    const html = await prepareStandaloneHtml(source, { html: content, diagrams: [], warnings: [], theme: 'night', fontSize: 18 }, dir, operations);
    const document = new JSDOM(html).window.document;
    const images = document.querySelectorAll('img');
    assert.deepEqual(requested, ['real.png', 'original.png']);
    assert.equal(images[0].alt, 'data-markdown-path="fake.png" > b');
    assert.equal(images[1].alt, 'a > b & c');
    for (const image of images) {
        assert.deepEqual(Buffer.from(image.src.split(',')[1], 'base64'), validPng);
        assert.equal(image.hasAttribute('data-markdown-path'), false);
    }
    assert.equal(document.querySelectorAll('.editor').length, 1);
    assert.equal(document.querySelector('main').classList.contains('editor'), false);
    assert.equal(operations.warnings.length, 0);
});

test('unsupported SVG fragments produce a visible HTML fallback with a warning', async t => {
    const { dir, source } = await htmlFixture(t);
    const signal = new AbortController().signal;
    const operations = { signal, report() {}, warnings: [], loadResource: createResourceLoader(signal) };
    const html = await prepareStandaloneHtml(source, { html: '<article class="editor"><img src="chart.svg#view"></article>', diagrams: [], warnings: [], theme: 'night', fontSize: 18 }, dir, operations);
    assert.match(html, /Image unavailable: chart.svg#view/);
    assert.match(operations.warnings[0].message, /Resource fragments/);
});

test('missing image fallbacks preserve decoded alternative text and path without injecting markup', async t => {
    const { dir, source } = await htmlFixture(t);
    const operations = {
        signal: new AbortController().signal, report() {}, warnings: [],
        async loadResource() { throw new Error('Unavailable image'); }
    };
    const content = '<article class="editor"><img src="missing&quot;&amp;&lt;.png" alt="MISSING-IMAGE-MARKER &amp; &quot;quoted&quot; &lt;img src=\'injected\'&gt;"><img src="w30-missing.png" alt="W30-MISSING-IMAGE-MARKER"></article>';
    const html = await prepareStandaloneHtml(source, { html: content, diagrams: [], warnings: [], theme: 'night', fontSize: 18 }, dir, operations);
    const document = new JSDOM(html).window.document;
    const labels = Array.from(document.querySelectorAll('.export-fallback'), element => element.textContent);
    assert.equal(labels[0], '[Image unavailable: MISSING-IMAGE-MARKER & "quoted" <img src=\'injected\'> (missing"&<.png)]');
    assert.equal(labels[1], '[Image unavailable: W30-MISSING-IMAGE-MARKER (w30-missing.png)]');
    assert.equal(document.querySelectorAll('img,script').length, 0);
    assert.match(operations.warnings[0].message, /MISSING-IMAGE-MARKER & "quoted"/);
    assert.ok(operations.warnings[0].message.includes('missing"&<.png'));
    assert.match(operations.warnings[1].message, /W30-MISSING-IMAGE-MARKER/);
});
