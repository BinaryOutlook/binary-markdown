const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { finalizeExport } = require('../../out/export/output');

async function fixture(t) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'binary-export-output-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const source = path.join(dir, 'report 日本語.md');
    await fs.writeFile(source, '# Source');
    return { dir, source, signal: new AbortController().signal };
}

test('basic, output-byte hash, identical reuse and numeric collisions preserve files', async t => {
    const { dir, source, signal } = await fixture(t);
    const bytes = Buffer.from('<!doctype html><p>export</p>');
    const hash = createHash('sha256').update(bytes).digest('hex').slice(-8);
    const basic = await finalizeExport(source, 'html', bytes, signal);
    assert.equal(path.basename(basic.outputPath), 'report 日本語.html');
    const hashed = await finalizeExport(source, 'html', bytes, signal);
    assert.equal(path.basename(hashed.outputPath), 'report 日本語_' + hash + '.html');
    const stat = await fs.stat(hashed.outputPath);
    assert.equal((await finalizeExport(source, 'html', bytes, signal)).reused, true);
    assert.equal((await fs.stat(hashed.outputPath)).mtimeMs, stat.mtimeMs);
    await fs.writeFile(hashed.outputPath, 'different bytes');
    await fs.writeFile(path.join(dir, 'report 日本語_' + hash + '_2.html'), 'occupied');
    const numbered = await finalizeExport(source, 'html', bytes, signal);
    assert.equal(path.basename(numbered.outputPath), 'report 日本語_' + hash + '_3.html');
    assert.equal(await fs.readFile(hashed.outputPath, 'utf8'), 'different bytes');
    assert.equal(await fs.readFile(source, 'utf8'), '# Source');
    assert.ok((await fs.readdir(dir)).every(name => !name.startsWith('.binary-markdown-export-')));
});

test('concurrent claims produce complete outputs without overwriting', async t => {
    const { dir, source, signal } = await fixture(t);
    const inputs = Array.from({ length: 12 }, (_, i) => Buffer.from('document ' + i));
    const results = await Promise.all(inputs.map(bytes => finalizeExport(source, 'pdf', bytes, signal)));
    assert.equal(new Set(results.map(result => result.outputPath)).size, inputs.length);
    for (let i = 0; i < inputs.length; i++) {
        assert.deepEqual(await fs.readFile(results[i].outputPath), inputs[i]);
    }
    assert.ok((await fs.readdir(dir)).every(name => !name.startsWith('.binary-markdown-export-')));
});

test('cancellation creates no output and an unwritable directory has no fallback', async t => {
    const { dir, source } = await fixture(t);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(finalizeExport(source, 'pdf', Buffer.from('pdf'), controller.signal), { name: 'AbortError' });
    await fs.chmod(dir, 0o500);
    try {
        await assert.rejects(finalizeExport(source, 'pdf', Buffer.from('pdf'), new AbortController().signal), { code: 'EACCES' });
    } finally {
        await fs.chmod(dir, 0o700);
    }
    assert.deepEqual(await fs.readdir(dir), [path.basename(source)]);
});
