import { inflateRawSync } from 'zlib';
import { ExportFormat } from './types';

interface ZipEntry {
    name: string;
    bytes: Buffer;
    method: number;
    offset: number;
    extraLength: number;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
    for (let bit = 0; bit < 8; bit++) { value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); }
    return value >>> 0;
});

function crc32(bytes: Buffer): number {
    let crc = 0xffffffff;
    for (const value of bytes) { crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ value) & 0xff]; }
    return (crc ^ 0xffffffff) >>> 0;
}

function requireValid(condition: unknown, reason: string): asserts condition {
    if (!condition) { throw new Error(reason); }
}

/** Check the ZIP32 subset produced by our converters; never extract paths to disk. */
function readZip(bytes: Buffer): Map<string, ZipEntry> {
    requireValid(bytes.length >= 22, 'ZIP end-of-central-directory is missing.');
    let end = -1;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 22 - 0xffff); offset--) {
        if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) {
            end = offset;
            break;
        }
    }
    requireValid(end >= 0, 'ZIP end-of-central-directory is missing or truncated.');
    const count = bytes.readUInt16LE(end + 10);
    const size = bytes.readUInt32LE(end + 12);
    const start = bytes.readUInt32LE(end + 16);
    requireValid(count !== 0xffff && size !== 0xffffffff && start !== 0xffffffff, 'ZIP64 output is not supported by this export validator.');
    requireValid(bytes.readUInt16LE(end + 4) === 0 && bytes.readUInt16LE(end + 6) === 0 &&
        bytes.readUInt16LE(end + 8) === count, 'Split or multidisk ZIP output is not supported.');
    requireValid(count > 0 && start + size === end, 'ZIP central-directory bounds are inconsistent.');
    const entries = new Map<string, ZipEntry>();
    const ranges: Array<{ start: number; end: number }> = [];
    let cursor = start;
    for (let index = 0; index < count; index++) {
        requireValid(cursor + 46 <= end && bytes.readUInt32LE(cursor) === 0x02014b50, 'ZIP central-directory entry is incomplete.');
        const flags = bytes.readUInt16LE(cursor + 8);
        const method = bytes.readUInt16LE(cursor + 10);
        const checksum = bytes.readUInt32LE(cursor + 16);
        const compressedSize = bytes.readUInt32LE(cursor + 20);
        const plainSize = bytes.readUInt32LE(cursor + 24);
        const nameLength = bytes.readUInt16LE(cursor + 28);
        const extraLength = bytes.readUInt16LE(cursor + 30);
        const commentLength = bytes.readUInt16LE(cursor + 32);
        const local = bytes.readUInt32LE(cursor + 42);
        const next = cursor + 46 + nameLength + extraLength + commentLength;
        requireValid(next <= end && nameLength > 0, 'ZIP entry name or metadata is truncated.');
        requireValid(compressedSize !== 0xffffffff && plainSize !== 0xffffffff && local !== 0xffffffff, 'ZIP64 entries are not supported by this export validator.');
        requireValid(bytes.readUInt16LE(cursor + 34) === 0 && (flags & 0x2041) === 0, 'Encrypted or multidisk ZIP entries are not supported.');
        requireValid(method === 0 || method === 8, 'ZIP entry uses an unsupported compression method.');
        const rawName = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
        const name = rawName.toString('utf8');
        requireValid(!name.startsWith('/') && !name.includes('\\') && !name.includes('\0') &&
            !name.split('/').some(part => part === '..' || part === '.'), 'ZIP entry has an invalid package path.');
        requireValid(!entries.has(name), 'ZIP contains a duplicate entry: ' + name);
        requireValid(local + 30 <= start && bytes.readUInt32LE(local) === 0x04034b50, 'ZIP local entry header is missing: ' + name);
        const localNameLength = bytes.readUInt16LE(local + 26);
        const localExtraLength = bytes.readUInt16LE(local + 28);
        const dataStart = local + 30 + localNameLength + localExtraLength;
        const dataEnd = dataStart + compressedSize;
        requireValid(dataEnd <= start && dataStart <= dataEnd, 'ZIP entry data is truncated: ' + name);
        requireValid(localNameLength === nameLength && bytes.subarray(local + 30, local + 30 + localNameLength).equals(rawName),
            'ZIP local and central entry names disagree: ' + name);
        requireValid(bytes.readUInt16LE(local + 6) === flags && bytes.readUInt16LE(local + 8) === method,
            'ZIP local and central entry methods disagree: ' + name);
        let recordEnd = dataEnd;
        if (flags & 8) {
            requireValid(dataEnd + 12 <= start, 'ZIP data descriptor is missing: ' + name);
            const signed = bytes.readUInt32LE(dataEnd) === 0x08074b50;
            const descriptor = dataEnd + (signed ? 4 : 0);
            requireValid(descriptor + 12 <= start && bytes.readUInt32LE(descriptor) === checksum &&
                bytes.readUInt32LE(descriptor + 4) === compressedSize && bytes.readUInt32LE(descriptor + 8) === plainSize,
            'ZIP data descriptor is incomplete or inconsistent: ' + name);
            recordEnd = descriptor + 12;
        } else {
            requireValid(bytes.readUInt32LE(local + 14) === checksum && bytes.readUInt32LE(local + 18) === compressedSize &&
                bytes.readUInt32LE(local + 22) === plainSize, 'ZIP local and central entry sizes or CRC disagree: ' + name);
        }
        const compressed = bytes.subarray(dataStart, dataEnd);
        let plain: Buffer;
        try {
            if (method === 0) { plain = compressed; }
            else {
                // Node's runtime supports info; its type declaration still describes only Buffer.
                const inflated = inflateRawSync(compressed, { maxOutputLength: Math.max(1, plainSize), info: true }) as unknown as {
                    buffer: Buffer; engine: { bytesWritten: number };
                };
                requireValid(inflated.engine.bytesWritten === compressed.length, 'Compressed ZIP entry contains trailing data: ' + name);
                plain = inflated.buffer;
            }
        } catch {
            throw new Error('ZIP entry cannot be decompressed completely: ' + name);
        }
        requireValid(plain.length === plainSize && crc32(plain) === checksum, 'ZIP entry length or CRC is invalid: ' + name);
        entries.set(name, { name, bytes: plain, method, offset: local, extraLength: localExtraLength });
        ranges.push({ start: local, end: recordEnd });
        cursor = next;
    }
    requireValid(cursor === end, 'ZIP central-directory size or entry count is inconsistent.');
    ranges.sort((left, right) => left.start - right.start);
    requireValid(ranges[0].start === 0, 'ZIP output has an unexpected prefix.');
    for (let index = 1; index < ranges.length; index++) {
        requireValid(ranges[index - 1].end === ranges[index].start, 'ZIP local records overlap or contain unaccounted bytes.');
    }
    requireValid(ranges[ranges.length - 1].end === start, 'ZIP contains incomplete or unaccounted local records.');
    return entries;
}

function validXmlText(value: string): boolean {
    return !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value) &&
        !/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/i.test(value);
}

/** Lightweight well-formedness checks for required XML parts, not schema validation. */
function requiredXml(entries: Map<string, ZipEntry>, name: string, rootName: string): string {
    const entry = entries.get(name);
    requireValid(entry, 'Required package entry is missing: ' + name);
    const xml = entry.bytes.toString('utf8').replace(/^\uFEFF/, '');
    requireValid(!/<!DOCTYPE|<!ENTITY/i.test(xml), 'Unexpected XML declaration in ' + name);
    const tokens = xml.matchAll(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<[^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g);
    const stack: string[] = [];
    let root = '';
    let finished = false;
    let offset = 0;
    for (const token of tokens) {
        const text = xml.slice(offset, token.index);
        requireValid(!text.includes('<') && validXmlText(text) && (stack.length > 0 || !text.trim()), 'Malformed XML content in ' + name);
        offset = (token.index || 0) + token[0].length;
        const tag = token[0];
        if (tag.startsWith('<!--') || tag.startsWith('<?')) { continue; }
        if (tag.startsWith('<![CDATA[')) {
            requireValid(stack.length > 0, 'XML CDATA is outside its root in ' + name);
            continue;
        }
        const close = /^<\/([A-Za-z_][\w.:-]*)\s*>$/.exec(tag);
        if (close) {
            requireValid(stack.pop() === close[1], 'Unbalanced XML elements in ' + name);
            if (!stack.length) { finished = true; }
            continue;
        }
        const open = /^<([A-Za-z_][\w.:-]*)(?:\s+[A-Za-z_][\w.:-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*\s*(\/?)>$/.exec(tag);
        requireValid(open && !finished && validXmlText(tag), 'Malformed XML element in ' + name);
        if (!root) { root = open[1].split(':').pop() || ''; }
        if (!open[2]) { stack.push(open[1]); }
        else if (!stack.length) { finished = true; }
    }
    requireValid(root === rootName && finished && stack.length === 0 && !xml.slice(offset).trim(),
        'Required XML root is missing or incomplete in ' + name);
    return xml;
}

function decodeXmlAttribute(value: string): string {
    return value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, entity => {
        const names: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
        if (names[entity]) { return names[entity]; }
        return String.fromCodePoint(entity.startsWith('&#x') ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10));
    });
}

function validatePackage(format: 'docx' | 'epub', bytes: Buffer): void {
    const entries = readZip(bytes);
    if (format === 'docx') {
        requiredXml(entries, '[Content_Types].xml', 'Types');
        requiredXml(entries, '_rels/.rels', 'Relationships');
        requiredXml(entries, 'word/document.xml', 'document');
        return;
    }
    const mime = entries.get('mimetype');
    requireValid(mime && mime.bytes.equals(Buffer.from('application/epub+zip')) && mime.offset === 0 && mime.method === 0 && mime.extraLength === 0,
        'EPUB requires an exact, first, uncompressed mimetype entry without extra fields.');
    const container = requiredXml(entries, 'META-INF/container.xml', 'container');
    const roots = [...container.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g, '')
        .matchAll(/<(?:[\w.-]+:)?rootfile\b[^>]*>/g)];
    const packagePaths = roots.map(root => {
        const type = /\bmedia-type\s*=\s*(["'])(.*?)\1/.exec(root[0]);
        const fullPath = /\bfull-path\s*=\s*(["'])(.*?)\1/.exec(root[0]);
        return type?.[2] === 'application/oebps-package+xml' && fullPath ? decodeXmlAttribute(fullPath[2]) : undefined;
    }).filter((value): value is string => Boolean(value));
    requireValid(packagePaths.length > 0, 'EPUB container does not reference a package document.');
    for (const packagePath of packagePaths) { requiredXml(entries, packagePath, 'package'); }
}

function validateHtml(bytes: Buffer): void {
    const html = bytes.toString('utf8').replace(/^\uFEFF/, '');
    const structural = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    requireValid(/^\s*<!doctype\s+html\s*>\s*<html\b/i.test(structural), 'Standalone HTML doctype or root is missing.');
    const tags = [...structural.matchAll(/<(\/?)(html|head|body)\b[^>]*>/gi)];
    requireValid(tags.map(tag => tag[1] + tag[2].toLowerCase()).join(',') === 'html,head,/head,body,/body,/html' &&
        /<\/html\s*>\s*$/i.test(structural), 'Standalone HTML head/body/root is incomplete or out of order.');
}

function validatePdf(bytes: Buffer): void {
    requireValid(/^%PDF-(?:1\.[0-7]|2\.0)(?:\r|\n)/.test(bytes.subarray(0, 16).toString('ascii')), 'PDF header is missing or invalid.');
    const tail = bytes.subarray(Math.max(0, bytes.length - 1024)).toString('latin1');
    const ending = /startxref\s+(\d+)\s+%%EOF[\t\r\n\f ]*$/.exec(tail);
    requireValid(ending, 'PDF final startxref/EOF record is missing or truncated.');
    const offset = Number(ending[1]);
    requireValid(Number.isSafeInteger(offset) && offset > 0 && offset < bytes.length,
        'PDF cross-reference offset is outside the completed file.');
    const target = bytes.subarray(offset, Math.min(offset + 80, bytes.length)).toString('latin1');
    requireValid(/^(?:xref\b|\d+\s+\d+\s+obj\b)/.test(target), 'PDF cross-reference target is missing.');
}

/** Completion/integrity guard; native viewers and content-fidelity tests remain required. */
export function validateArtifact(format: ExportFormat, bytes: Buffer): void {
    try {
        requireValid(bytes.length > 0, 'Converter returned an empty artifact.');
        if (format === 'html') { validateHtml(bytes); }
        else if (format === 'pdf') { validatePdf(bytes); }
        else { validatePackage(format, bytes); }
    } catch (error) {
        throw new Error(format.toUpperCase() + ' export is incomplete or invalid: ' + (error instanceof Error ? error.message : String(error)));
    }
}
