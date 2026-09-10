const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deflateRawSync } = require('node:zlib');
const { validateArtifact } = require('../../out/export/validate');

// Deliberately small independent ZIP writer; production code only reads archives.
function checksum(bytes) {
    let crc = -1;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) { crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    }
    return (crc ^ -1) >>> 0;
}

function zip(files, comment = '') {
    const locals = [];
    const central = [];
    let offset = 0;
    for (const file of files) {
        const name = Buffer.from(file.name);
        const data = Buffer.from(file.data);
        const method = file.method ?? 8;
        const compressed = Buffer.concat([method === 8 ? deflateRawSync(data) : data, Buffer.from(file.trailingData || '')]);
        const crc = checksum(data);
        const flags = 0x800 | (file.descriptor ? 8 : 0);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(flags, 6);
        local.writeUInt16LE(method, 8);
        if (!file.descriptor) {
            local.writeUInt32LE(crc, 14);
            local.writeUInt32LE(compressed.length, 18);
            local.writeUInt32LE(data.length, 22);
        }
        local.writeUInt16LE(name.length, 26);
        const descriptor = Buffer.alloc(file.descriptor ? (file.descriptor === 'unsigned' ? 12 : 16) : 0);
        if (file.descriptor) {
            const start = file.descriptor === 'unsigned' ? 0 : 4;
            if (start) { descriptor.writeUInt32LE(0x08074b50); }
            descriptor.writeUInt32LE(crc, start);
            descriptor.writeUInt32LE(compressed.length, start + 4);
            descriptor.writeUInt32LE(data.length, start + 8);
        }
        locals.push(local, name, compressed, descriptor);
        const header = Buffer.alloc(46);
        header.writeUInt32LE(0x02014b50, 0);
        header.writeUInt16LE(20, 4);
        header.writeUInt16LE(20, 6);
        header.writeUInt16LE(flags, 8);
        header.writeUInt16LE(method, 10);
        header.writeUInt32LE(crc, 16);
        header.writeUInt32LE(compressed.length, 20);
        header.writeUInt32LE(data.length, 24);
        header.writeUInt16LE(name.length, 28);
        header.writeUInt32LE(offset, 42);
        central.push(header, name);
        offset += local.length + name.length + compressed.length + descriptor.length;
    }
    const directory = Buffer.concat(central);
    const trailer = Buffer.alloc(22);
    const note = Buffer.from(comment);
    trailer.writeUInt32LE(0x06054b50);
    trailer.writeUInt16LE(files.length, 8);
    trailer.writeUInt16LE(files.length, 10);
    trailer.writeUInt32LE(directory.length, 12);
    trailer.writeUInt32LE(offset, 16);
    trailer.writeUInt16LE(note.length, 20);
    return Buffer.concat([...locals, directory, trailer, note]);
}

const docx = () => [
    { name: '[Content_Types].xml', data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>VALIDATION-DOCX-MARKER</w:t></w:r></w:p></w:body></w:document>' },
];

const epub = (packagePath = 'EPUB/content.opf') => [
    { name: 'mimetype', data: 'application/epub+zip', method: 0 },
    { name: 'META-INF/container.xml', data: '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="' + packagePath + '" media-type="application/oebps-package+xml"/></rootfiles></container>' },
    { name: packagePath.replaceAll('&amp;', '&'), data: '<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">validation</dc:identifier><dc:title>Validation</dc:title><dc:language>en</dc:language></metadata><manifest><item id="text" href="text.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="text"/></spine></package>' },
    { name: 'EPUB/text.xhtml', data: '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Validation</title></head><body><p>VALIDATION-EPUB-MARKER</p></body></html>' },
];

function edit(bytes, mutation) {
    const copy = Buffer.from(bytes);
    const end = copy.length - 22;
    const central = copy.readUInt32LE(end + 16);
    mutation(copy, { end, central });
    return copy;
}

function rejects(format, bytes, reason) {
    assert.throws(() => validateArtifact(format, bytes), reason);
}

test('complete standalone HTML accepts comments, styles and document content', () => {
    validateArtifact('html', Buffer.from('\uFEFF<!doctype html><!-- note --><html lang="en"><head><style>.example::after{content:"<body>"}</style><title>Test</title></head><body><main><p>Document</p></main></body></html>\n'));
});

test('HTML fragments, missing end tags, reordered structure and empty output fail', () => {
    for (const text of ['', '<p>fragment</p>', '<!doctype html><html><head></head><body>unfinished', '<!doctype html><html><body></body><head></head></html>']) {
        rejects('html', Buffer.from(text), /HTML export is incomplete or invalid/);
    }
});

function pdf() {
    const prefix = '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n';
    return Buffer.from(prefix + 'xref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n' + Buffer.byteLength(prefix) + '\n%%EOF\n');
}

test('PDF completion guard accepts header, cross-reference and final EOF', () => {
    validateArtifact('pdf', pdf());
    const streamPrefix = '%PDF-2.0\n';
    validateArtifact('pdf', Buffer.from(streamPrefix + '1 0 obj\n<< /Type /XRef >>\nendobj\nstartxref\n' + streamPrefix.length + '\n%%EOF'));
});

test('PDF signature-only, truncated, trailing-garbage and invalid offsets fail', () => {
    for (const bytes of [Buffer.from('%PDF-1.7'), pdf().subarray(0, -8), Buffer.concat([pdf(), Buffer.from('garbage')]), Buffer.from('%PDF-1.7\nstartxref\n999999\n%%EOF'), Buffer.from('%PDF-1.7\nstartxref\n4\n%%EOF')]) {
        rejects('pdf', bytes, /PDF export is incomplete or invalid/);
    }
});

test('DOCX store/deflate entries and signed/unsigned data descriptors validate', () => {
    validateArtifact('docx', zip(docx(), 'ZIP comment'));
    validateArtifact('docx', zip(docx().map(file => ({ ...file, method: 0 }))));
    validateArtifact('docx', zip(docx().map(file => ({ ...file, descriptor: true }))));
    validateArtifact('docx', zip(docx().map(file => ({ ...file, descriptor: 'unsigned' }))));
});

test('a ZIP signature or incomplete central-directory/trailer never counts as a document', () => {
    const bytes = zip(docx());
    rejects('docx', Buffer.from('PK\x03\x04'), /end-of-central-directory/);
    rejects('docx', bytes.subarray(0, -1), /end-of-central-directory/);
    rejects('docx', edit(bytes, (copy, { end }) => copy.writeUInt32LE(0, end + 12)), /central-directory bounds/);
    rejects('docx', edit(bytes, (copy, { end }) => { copy.writeUInt16LE(4, end + 8); copy.writeUInt16LE(4, end + 10); }), /central-directory entry/);
    rejects('docx', edit(bytes, (copy, { end }) => copy.writeUInt32LE(0xffffffff, end + 16)), /ZIP64/);
});

test('corrupt payload, CRC, data length and local offsets are rejected', () => {
    const bytes = zip(docx().map(file => ({ ...file, method: 0 })));
    rejects('docx', edit(bytes, copy => { copy[30 + copy.readUInt16LE(26)] ^= 0x01; }), /length or CRC/);
    rejects('docx', edit(bytes, (copy, { central }) => copy.writeUInt32LE(7, central + 16)), /sizes or CRC disagree/);
    rejects('docx', edit(bytes, (copy, { central }) => copy.writeUInt32LE(0xfffffffe, central + 20)), /entry data is truncated/);
    rejects('docx', edit(bytes, (copy, { central }) => copy.writeUInt32LE(0xfffffffe, central + 42)), /local entry header/);
    const compressed = zip(docx());
    rejects('docx', edit(compressed, copy => { copy.fill(0xff, 30 + copy.readUInt16LE(26), 34 + copy.readUInt16LE(26)); }), /cannot be decompressed|length or CRC/);
    rejects('docx', zip(docx().map(file => ({ ...file, trailingData: 'unaccounted bytes' }))), /cannot be decompressed completely/);
});

test('descriptor inconsistency and local/central names are rejected', () => {
    const bytes = zip(docx().map(file => ({ ...file, descriptor: true })));
    rejects('docx', edit(bytes, (copy, { central }) => {
        const descriptor = 30 + copy.readUInt16LE(26) + copy.readUInt32LE(central + 20);
        copy.writeUInt32LE(7, descriptor + 4);
    }), /data descriptor/);
    rejects('docx', edit(zip(docx()), copy => { copy[30] ^= 0x01; }), /entry names disagree/);
});

test('duplicate names, invalid paths and unsupported compression fail explicitly', () => {
    rejects('docx', zip([...docx(), docx()[2]]), /duplicate entry/);
    rejects('docx', zip([...docx(), { name: '../escape.xml', data: '<test/>' }]), /invalid package path/);
    rejects('docx', zip(docx().map(file => ({ ...file, method: 99 }))), /unsupported compression/);
    rejects('docx', edit(zip(docx()), (copy, { central }) => copy.writeUInt16LE(0x801, central + 8)), /Encrypted/);
});

test('DOCX needs complete required XML parts, not only a valid generic ZIP', () => {
    for (let index = 0; index < 3; index++) {
        rejects('docx', zip(docx().filter((_, item) => item !== index)), /Required package entry is missing/);
    }
    const broken = docx();
    broken[2].data = '<w:document><w:body></w:document>';
    rejects('docx', zip(broken), /Unbalanced XML/);
    broken[2].data = '<notADocument/>';
    rejects('docx', zip(broken), /Required XML root/);
    broken[2].data = '<w:document><w:body/>';
    rejects('docx', zip(broken), /Required XML root/);
    broken[2].data = '<w:document><w:body>invalid & text</w:body></w:document>';
    rejects('docx', zip(broken), /Malformed XML content/);
});

test('EPUB validates mimetype, container and its referenced package path', () => {
    validateArtifact('epub', zip(epub()));
    validateArtifact('epub', zip(epub('EPUB/package &amp; notes.opf')));
});

test('EPUB rejects compressed, misplaced or incorrect mimetype', () => {
    const compressed = epub();
    compressed[0].method = 8;
    rejects('epub', zip(compressed), /mimetype/);
    rejects('epub', zip([...epub().slice(1), epub()[0]]), /mimetype/);
    const incorrect = epub();
    incorrect[0].data += '\n';
    rejects('epub', zip(incorrect), /mimetype/);
});

test('EPUB requires the declared OPF and a complete package root', () => {
    rejects('epub', zip(epub().filter(file => !file.name.endsWith('.opf'))), /Required package entry is missing/);
    const noReference = epub();
    noReference[1].data = '<container><rootfiles/></container>';
    rejects('epub', zip(noReference), /does not reference/);
    noReference[1].data = '<container><!-- <rootfile full-path="EPUB/content.opf" media-type="application/oebps-package+xml"/> --><rootfiles/></container>';
    rejects('epub', zip(noReference), /does not reference/);
    const broken = epub();
    broken[2].data = '<package><metadata/>';
    rejects('epub', zip(broken), /Required XML root/);
});
