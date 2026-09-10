const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inflateRawSync } = require('node:zlib');
const test = require('node:test');

const crcTable = Array.from({ length: 256 }, (_, value) => {
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    return value >>> 0;
});
function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
    return (crc ^ 0xffffffff) >>> 0;
}

function unpack(bytes) {
    const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    assert.ok(end >= 0, 'VSIX has a ZIP end record');
    const count = bytes.readUInt16LE(end + 10);
    let offset = bytes.readUInt32LE(end + 16);
    const entries = new Map();
    for (let index = 0; index < count; index++) {
        assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
        const method = bytes.readUInt16LE(offset + 10);
        assert.ok(method === 0 || method === 8);
        const checksum = bytes.readUInt32LE(offset + 16);
        const size = bytes.readUInt32LE(offset + 20);
        const originalSize = bytes.readUInt32LE(offset + 24);
        const nameLength = bytes.readUInt16LE(offset + 28);
        const extraLength = bytes.readUInt16LE(offset + 30);
        const commentLength = bytes.readUInt16LE(offset + 32);
        const local = bytes.readUInt32LE(offset + 42);
        const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
        assert.ok(!path.isAbsolute(name) && !name.includes('\\') && !name.split('/').includes('..'));
        assert.equal(bytes.readUInt32LE(local), 0x04034b50);
        const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
        const data = bytes.subarray(start, start + size);
        const plain = method === 8 ? inflateRawSync(data) : data;
        assert.equal(plain.length, originalSize, name + ' length');
        assert.equal(crc32(plain), checksum, name + ' CRC');
        entries.set(name, plain);
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

// Packaging is a separate gate: invoke with EXPORT_VSIX_PATH after npm run package.
test('packaged VSIX contains an isolated export runtime, UI, guidance and localization without native engines', {
    skip: !process.env.EXPORT_VSIX_PATH
}, async t => {
    const bytes = await fs.readFile(path.resolve(process.env.EXPORT_VSIX_PATH));
    const entries = unpack(bytes);
    const required = [
        'LICENSE.txt', 'NOTICE', 'LICENSES/AnyMarkdown-MIT.txt', 'ACKNOWLEDGMENTS.md',
        'out/export/controller.js', 'out/export/html.js', 'out/export/resources.js',
        'out/export/output.js', 'out/export/validate.js', 'out/export/webview-rpc.js',
        'out/export/pandoc.js', 'out/export/pdf.js', 'out/export/tools.js',
        'out/export/messages.js', 'out/webview/editor.js', 'out/webview/styles.css',
        'out/shared/editor-body-html.js', 'out/shared/host-bridge.js', 'media/export-help.md',
        'vendor/playwright-core/package.json', 'vendor/playwright-core/LICENSE',
        'vendor/playwright-core/NOTICE', 'vendor/katex.min.css', 'vendor/mermaid.min.js'
    ];
    for (const name of required) assert.ok(entries.has('extension/' + name), 'Packaged ' + name);
    for (const name of entries.keys()) {
        assert.doesNotMatch(name, /(?:^|\/)(?:node_modules|\.local-browsers|ms-playwright)\/|^extension\/(?:test|electron)\//);
        assert.doesNotMatch(name, /\.app\/|\.(?:exe|dll|dylib|node|so)$|\/(?:pandoc|chrome|chromium|headless_shell)$/i);
    }
    const manifest = JSON.parse(entries.get('extension/package.json').toString('utf8'));
    const rootManifest = require('../../package.json');
    assert.equal(manifest.version, rootManifest.version);
    assert.equal(manifest.license, 'AGPL-3.0-only');
    assert.match(entries.get('extension/LICENSE.txt').toString('utf8'), /GNU AFFERO GENERAL PUBLIC LICENSE/);
    assert.match(entries.get('extension/LICENSES/AnyMarkdown-MIT.txt').toString('utf8'), /Permission is hereby granted/);
    for (const name of ['LICENSE', 'NOTICE', 'LICENSES/AnyMarkdown-MIT.txt']) {
        // vsce normalizes the root licence filename to LICENSE.txt.
        const packagedName = name === 'LICENSE' ? 'LICENSE.txt' : name;
        assert.ok(entries.get('extension/' + packagedName).equals(await fs.readFile(path.join(__dirname, '../..', name))), name + ' differs from source');
    }
    assert.equal(manifest.engines.vscode, '^1.85.0');
    const properties = manifest.contributes.configuration.properties;
    const settings = ['binary-markdown.export.pandocPath', 'binary-markdown.export.browserPath'];
    for (const setting of settings) assert.equal(properties[setting].scope, 'machine');
    for (const locale of ['', '.es', '.fr', '.ja', '.ko', '.zh-cn', '.zh-tw']) {
        const dictionary = JSON.parse(entries.get('extension/package.nls' + locale + '.json').toString('utf8'));
        for (const setting of settings) {
            const key = properties[setting].description.replace(/^%|%$/g, '');
            assert.ok(dictionary[key], locale + ' describes ' + setting);
        }
    }
    for (const locale of ['en', 'es', 'fr', 'ja', 'ko', 'zh-cn', 'zh-tw']) {
        assert.ok(entries.has('extension/out/locales/' + locale + '.js'), locale + ' runtime catalog');
    }
    assert.match(entries.get('extension/out/shared/editor-body-html.js').toString('utf8'), /exportButton/);
    assert.match(entries.get('extension/out/webview/editor.js').toString('utf8'), /captureExportSnapshot/);
    assert.match(entries.get('extension/out/webview/editor.js').toString('utf8'), /validateExportImage/);
    assert.match(entries.get('extension/media/export-help.md').toString('utf8'), /Pandoc/);
    for (const file of required.filter(name => name.startsWith('out/'))) {
        assert.ok(entries.get('extension/' + file).equals(await fs.readFile(path.join(__dirname, '../..', file))), file + ' differs from the current compiled build; package it again');
    }

    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'binary-markdown-packaged-runtime-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    for (const [name, value] of entries) {
        if (!name.startsWith('extension/') || name.endsWith('/')) continue;
        const target = path.join(directory, name);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, value);
    }
    const check = spawnSync(process.execPath, ['-e', `
        const path = require('node:path');
        const root = path.resolve('extension');
        const library = require(path.join(root, 'vendor/playwright-core'));
        if (typeof library.chromium.launch !== 'function') throw new Error('Browser control API is absent');
        for (const file of ['html', 'resources', 'output', 'validate', 'webview-rpc', 'pandoc', 'pdf', 'tools']) {
            require(path.join(root, 'out/export', file + '.js'));
        }
        process.stdout.write(JSON.stringify({ playwright: require(path.join(root, 'vendor/playwright-core/package.json')).version }));
    `], { cwd: directory, env: { ...process.env, NODE_PATH: '' }, encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr);
    assert.equal(JSON.parse(check.stdout).playwright, '1.58.1');
});
