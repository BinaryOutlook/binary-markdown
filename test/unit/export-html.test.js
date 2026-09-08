const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createResourceLoader, resourceUrl } = require('../../out/export/resources');
const { prepareStandaloneHtml } = require('../../out/export/html');

test('local references preserve bytes and job cache survives later asset edits', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'binary-export-resource-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const file = path.join(dir, '原图 one.png');
    await fs.writeFile(file, Buffer.from([137, 80, 78, 71]));
    const load = createResourceLoader(new AbortController().signal);
    const first = await load(encodeURI('原图 one.png'), path.join(dir, 'report.md'));
    await fs.writeFile(file, 'later asset bytes');
    assert.deepEqual((await load(encodeURI('原图 one.png'), path.join(dir, 'report.md'))).bytes, first.bytes);
    assert.equal(first.mime, 'image/png');
    assert.equal(resourceUrl('image.png', 'https://example.com/docs/report.md').href, 'https://example.com/docs/image.png');
    assert.throws(() => resourceUrl('javascript:alert(1)', file), /Unsupported resource scheme/);
});

test('standalone HTML embeds referenced images, preserves appearance and declares missing assets', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'binary-export-html-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    await fs.mkdir(path.join(dir, 'out/webview'), { recursive: true });
    await fs.writeFile(path.join(dir, 'out/webview/styles.css'), ':root{--font-size:__FONT_SIZE__px}');
    const source = { sourcePath: path.join(dir, 'report.md'), markdown: '# Report', version: 1, theme: 'night', fontSize: 18 };
    const warnings = [];
    const requested = [];
    const bytes = Buffer.from([137, 80, 78, 71]);
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
