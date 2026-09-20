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
        'build-info.json', 'out/build-info.js',
        'vendor/MERMAID-DEPENDENCIES.json', 'vendor/MERMAID-THIRD-PARTY-LICENSES.txt',
        'LICENSE.txt', 'NOTICE', 'LICENSES/AnyMarkdown-MIT.txt', 'ACKNOWLEDGMENTS.md',
        'out/export/controller.js', 'out/export/html.js', 'out/export/resources.js',
        'out/export/output.js', 'out/export/validate.js', 'out/export/webview-rpc.js',
        'out/export/pandoc.js', 'out/export/pdf.js', 'out/export/code-language.js', 'out/export/tools.js',
        'out/export/messages.js', 'out/webview/editor.js', 'out/webview/styles.css',
        'out/shared/document-aux.js', 'out/shared/math-syntax.js',
        'out/shared/editor-body-html.js', 'out/shared/host-bridge.js', 'out/shared/vscode-host-bridge.js', 'out/export/language-tab.js', 'media/export-help.md', 'media/export-reference.docx', 'media/export-reference-top.docx',
        'vendor/playwright-core/package.json', 'vendor/playwright-core/LICENSE',
        'vendor/playwright-core/NOTICE', 'vendor/katex.min.css', 'vendor/mermaid.min.js'
    ];
    for (const name of required) assert.ok(entries.has('extension/' + name), 'Packaged ' + name);
    for (const name of entries.keys()) {
        assert.doesNotMatch(name, /(?:^|\/)(?:node_modules|\.local-browsers|ms-playwright)\/|^extension\/(?:test|electron|docs|reports|release-notes|archive)\//);
        assert.doesNotMatch(name, /\.app\/|\.(?:exe|dll|dylib|node|so)$|\/(?:pandoc|chrome|chromium|headless_shell)$/i);
    }
    const manifest = JSON.parse(entries.get('extension/package.json').toString('utf8'));
    const rootManifest = require('../../package.json');
    assert.equal(manifest.version, rootManifest.version);
    const identity = JSON.parse(entries.get('extension/build-info.json').toString('utf8'));
    assert.equal(identity.version, manifest.version);
    assert.equal(identity.license, manifest.license);
    assert.equal(identity.name, manifest.name);
    const bundled = JSON.parse(entries.get('extension/vendor/MERMAID-DEPENDENCIES.json').toString('utf8'));
    const sanitizer = bundled.find(entry => entry.name === 'dompurify');
    assert.equal(sanitizer.version, require('../../node_modules/dompurify/package.json').version);
    assert.ok(entries.get('extension/vendor/mermaid.min.js').includes(Buffer.from('version="' + sanitizer.version + '"')));
    assert.equal(manifest.license, 'AGPL-3.0-or-later');
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
    assert.equal(properties['binary-markdown.export.pdfWhiteBackground'].default, true);
    settings.push('binary-markdown.export.pdfWhiteBackground');
    const codeLanguageSetting = 'binary-markdown.export.showCodeLanguage';
    assert.equal(properties[codeLanguageSetting].type, 'boolean');
    assert.equal(properties[codeLanguageSetting].default, true);
    assert.equal(properties[codeLanguageSetting].scope, 'resource');
    settings.push(codeLanguageSetting);
    const positionSetting = 'binary-markdown.export.codeLanguagePosition';
    assert.equal(properties[positionSetting].default, 'top-left');
    assert.equal(properties[positionSetting].scope, 'resource');
    assert.deepEqual(properties[positionSetting].enum, ['top-left', 'top-right', 'bottom-left', 'bottom-right']);
    settings.push(positionSetting);
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
    assert.ok(entries.get('extension/media/export-reference-top.docx').equals(await fs.readFile(path.join(__dirname, '../../media/export-reference-top.docx'))), 'Top-label reference matches the source asset');
    assert.ok(entries.get('extension/media/export-reference.docx').equals(await fs.readFile(path.join(__dirname, '../../media/export-reference.docx'))), 'Word reference matches the source asset');
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

    if (process.env.EXPORT_REAL_TOOLS === '1') {
        const converted = spawnSync(process.execPath, ['-e', `
            const fs = require('node:fs');
            const path = require('node:path');
            const root = path.resolve('extension');
            const { discoverTool } = require(path.join(root, 'out/export/tools'));
            const { convertPandoc } = require(path.join(root, 'out/export/pandoc'));
            const { validateArtifact } = require(path.join(root, 'out/export/validate'));
            (async () => {
                const status = await discoverTool('pandoc', process.env.EXPORT_PANDOC_PATH || '');
                if (!status.available) throw new Error(status.error);
                const markdown = ['\`\`\`python', 'print("PACKAGED_CODE")', '\`\`\`'].join('\\n');
                const saved = { sourcePath: path.resolve('proof.md'), markdown, version: 1, theme: 'github', fontSize: 16 };
                const prepared = { html: '', theme: 'github', fontSize: 16, diagrams: [], warnings: [] };
                const ops = { signal: new AbortController().signal, warnings: [], report() {}, loadResource: async () => { throw new Error('No external assets'); } };
                const bytes = await convertPandoc('docx', saved, prepared, status.path, ops);
                validateArtifact('docx', bytes);
                fs.writeFileSync('packaged-proof.docx', bytes);
            })().catch(error => { console.error(error); process.exitCode = 1; });
        `], { cwd: directory, env: { ...process.env, NODE_PATH: '' }, encoding: 'utf8' });
        assert.equal(converted.status, 0, converted.stderr);
        const docx = unpack(await fs.readFile(path.join(directory, 'packaged-proof.docx')));
        assert.match(docx.get('word/document.xml').toString(), /PACKAGED_CODE/);
        assert.match(docx.get('word/document.xml').toString(), /w:pStyle w:val="CodeLanguage(?:TopLeft|TopRight|BottomLeft)?"/);
        assert.match(docx.get('word/document.xml').toString(), /w:rStyle w:val="CodeLanguageBadge"/);
        assert.match(docx.get('word/styles.xml').toString(), /w:jc w:val="right"/);
    }
});
