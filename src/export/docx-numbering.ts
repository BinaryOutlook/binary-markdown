import * as path from 'path';
import { deflateRawSync } from 'zlib';
import type { Document, Element, Node } from '@xmldom/xmldom';
import { crc32, readZip, validateArtifact } from './validate';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML = 'http://www.w3.org/XML/1998/namespace';
export const CODE_MARKER = 'binary-markdown-code-';
const MAX_PACKAGE = 128 * 1024 * 1024;
const MAX_XML = 16 * 1024 * 1024;

function assert(condition: unknown, reason: string): asserts condition {
    if (!condition) { throw new Error('DOCX code numbering: ' + reason); }
}
function children(node: Node): Element[] {
    return Array.from(node.childNodes).filter((child): child is Element => child.nodeType === 1);
}
function child(node: Node | undefined, name: string): Element | undefined {
    return node && children(node).find(item => item.namespaceURI === W && item.localName === name);
}
function value(node?: Element, name = 'val'): string {
    return node?.getAttributeNS(W, name) || '';
}
function append(parent: Node, name: string, attributes: Record<string, string> = {}): Element {
    const doc = parent.nodeType === 9 ? parent as Document : parent.ownerDocument!;
    const result = doc.createElementNS(W, 'w:' + name);
    for (const [key, val] of Object.entries(attributes)) { result.setAttributeNS(W, 'w:' + key, val); }
    parent.appendChild(result); return result;
}
function payload(nodes: Node[]): string {
    return nodes.map(node => {
        if (node.nodeType !== 1) { return ''; }
        const element = node as Element;
        if (element.namespaceURI === W) {
            if (['pPr', 'rPr'].includes(element.localName!)) { return ''; }
            if (element.localName === 't') { return element.textContent || ''; }
            if (element.localName === 'tab') { return '\t'; }
            if (element.localName === 'br') { return '\n'; }
        }
        return payload(Array.from(node.childNodes));
    }).join('');
}

/** Preserve the writer's whole-block token styles while splitting only source lines. */
function splitRuns(paragraph: Element, expected: string[]): Node[][] {
    const lines: Node[][] = [[]];
    for (const run of children(paragraph)) {
        if (run.localName === 'pPr' && run.namespaceURI === W) { continue; }
        assert(run.localName === 'r' && run.namespaceURI === W, 'unsupported code paragraph content.');
        const props = child(run, 'rPr');
        for (const item of children(run)) {
            if (item === props) { continue; }
            assert(item.namespaceURI === W && ['t', 'tab', 'br'].includes(item.localName!), 'unsupported code run.');
            if (item.localName === 'br') {
                assert(!value(item, 'type') || value(item, 'type') === 'textWrapping', 'unexpected code page break.');
                lines.push([]); continue;
            }
            const pieces = item.localName === 't' ? (item.textContent || '').split('\n') : ['\t'];
            pieces.forEach((piece, index) => {
                if (index) { lines.push([]); }
                if (!piece) { return; }
                const copy = run.cloneNode(false) as Element;
                if (props) { copy.appendChild(props.cloneNode(true)); }
                if (item.localName === 'tab') { copy.appendChild(item.cloneNode(true)); }
                else {
                    const text = append(copy, 't'); text.setAttributeNS(XML, 'xml:space', 'preserve');
                    text.appendChild(paragraph.ownerDocument!.createTextNode(piece));
                }
                lines[lines.length - 1].push(copy);
            });
        }
    }
    if (!expected.length && !payload(lines[0]) && lines.length === 1) { return []; }
    assert(lines.length === expected.length && lines.every((line, i) => payload(line) === expected[i]), 'writer code differs from saved source.');
    return lines;
}

/** Repack validated ZIP32 parts in memory; never extract document paths. */
function writeZip(parts: Map<string, Buffer>): Buffer {
    const locals: Buffer[] = [], central: Buffer[] = [];
    let offset = 0;
    for (const [name, data] of parts) {
        const encoded = Buffer.from(name), compressed = deflateRawSync(data), checksum = crc32(data);
        const local = Buffer.alloc(30), header = Buffer.alloc(46);
        local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
        local.writeUInt16LE(8, 8); local.writeUInt16LE(0x21, 12); local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(encoded.length, 26);
        header.writeUInt32LE(0x02014b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6);
        header.writeUInt16LE(0x800, 8); header.writeUInt16LE(8, 10); header.writeUInt16LE(0x21, 14);
        header.writeUInt32LE(checksum, 16); header.writeUInt32LE(compressed.length, 20); header.writeUInt32LE(data.length, 24);
        header.writeUInt16LE(encoded.length, 28); header.writeUInt32LE(offset, 42);
        locals.push(local, encoded, compressed); central.push(header, encoded); offset += local.length + encoded.length + compressed.length;
    }
    const directory = Buffer.concat(central), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(parts.size, 8); end.writeUInt16LE(parts.size, 10);
    end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, directory, end]);
}

/** Proposed #38 native-paragraph representation. Only marked, verified code changes. */
export function numberDocxCode(bytes: Buffer, models: string[][]): Buffer {
    if (!models.length) { return bytes; }
    assert(models.length <= 5000 && models.every(lines => lines.length <= 100000), 'too many code blocks or lines.');
    const entries = readZip(bytes, MAX_PACKAGE);
    const parts = new Map([...entries].map(([name, entry]) => [name, entry.bytes]));
    // Explicit runtime path: node_modules is excluded from the installed extension.
    const { DOMParser, XMLSerializer } = require(path.resolve(__dirname, '../../vendor/xmldom')) as typeof import('@xmldom/xmldom');
    const parse = (name: string): Document => {
        const data = parts.get(name);
        assert(data && data.length <= MAX_XML, 'required XML part missing or larger than 16 MiB.');
        const text = data.toString('utf8');
        assert(!/<!DOCTYPE|<!ENTITY/i.test(text), 'DTD/entity declarations are unsupported.');
        return new DOMParser({ onError: () => { throw new Error('Malformed DOCX XML.'); } }).parseFromString(text, 'application/xml');
    };
    const numbering = parse('word/numbering.xml');
    assert(numbering.documentElement?.namespaceURI === W && numbering.documentElement.localName === 'numbering', 'invalid numbering root.');
    const root = numbering.documentElement;
    const nextId = (name: string, attribute: string): number => Math.max(0, ...Array.from(root.getElementsByTagNameNS(W, name)).map(n => {
        const id = Number(value(n, attribute)); assert(Number.isSafeInteger(id) && id >= 0 && id < 0x7ffffffe, 'invalid numbering identifier.'); return id;
    })) + 1;
    let abstractId = nextId('abstractNum', 'abstractNumId'), numId = nextId('num', 'numId');
    assert(Math.max(abstractId, numId) + models.length < 0x7fffffff, 'numbering identifiers exhausted.');
    const seen = new Set<number>();
    for (const part of ['word/document.xml', 'word/footnotes.xml', 'word/endnotes.xml'].filter(name => parts.has(name))) {
        const doc = parse(part), markers: Node[] = [];
        const walk = (node: Node): void => {
            if (node.nodeType === 8 && node.nodeValue?.startsWith(CODE_MARKER)) { markers.push(node); }
            for (const item of Array.from(node.childNodes)) { walk(item); }
        };
        walk(doc);
        for (const marker of markers) {
            const index = Number(marker.nodeValue!.slice(CODE_MARKER.length));
            assert(Number.isSafeInteger(index) && index >= 0 && index < models.length && !seen.has(index), 'invalid code marker.');
            seen.add(index);
            let candidate = marker.nextSibling;
            while (candidate && (candidate.nodeType === 3 || (candidate.nodeType === 1 && (candidate as Element).localName === 'bookmarkStart'))) { candidate = candidate.nextSibling; }
            assert(candidate?.nodeType === 1, 'missing marked code paragraph.');
            const paragraph = candidate as Element;
            assert(paragraph.namespaceURI === W && paragraph.localName === 'p' && value(child(child(paragraph, 'pPr')!, 'pStyle')) === 'SourceCode', 'marked paragraph is not code.');
            const lines = splitRuns(paragraph, models[index]);
            const oldProps = child(paragraph, 'pPr');
            const oldLeft = Number(value(oldProps && child(oldProps, 'ind'), 'left') || 0);
            assert(Number.isFinite(oldLeft), 'invalid code indentation.');
            const gutter = Math.max(720, String(lines.length).length * 140 + 260), left = Math.max(0, oldLeft) + gutter;
            if (lines.length) {
                const abstract = numbering.createElementNS(W, 'w:abstractNum');
                abstract.setAttributeNS(W, 'w:abstractNumId', String(abstractId));
                append(abstract, 'multiLevelType', { val: 'singleLevel' });
                const level = append(abstract, 'lvl', { ilvl: '0' });
                append(level, 'start', { val: '1' }); append(level, 'numFmt', { val: 'decimal' });
                append(level, 'suff', { val: 'tab' }); append(level, 'lvlText', { val: '%1' }); append(level, 'lvlJc', { val: 'right' });
                const props = append(level, 'pPr'); append(append(props, 'tabs'), 'tab', { val: 'num', pos: String(left) });
                append(props, 'ind', { left: String(left), hanging: String(gutter - 180) });
                const fonts = append(level, 'rPr'); append(fonts, 'rFonts', { ascii: 'Consolas', hAnsi: 'Consolas' });
                append(fonts, 'color', { val: '57606A' }); append(fonts, 'sz', { val: '18' });
                root.insertBefore(abstract, children(root).find(n => n.localName === 'num') || null);
                const instance = append(root, 'num', { numId: String(numId) }); append(instance, 'abstractNumId', { val: String(abstractId++) });
                append(append(instance, 'lvlOverride', { ilvl: '0' }), 'startOverride', { val: '1' });
            }
            const replacement = (lines.length ? lines : [[]]).map((runs, i) => {
                const p = paragraph.cloneNode(false) as Element, props = append(p, 'pPr');
                append(props, 'pStyle', { val: 'SourceCode' });
                // Only the last logical line keeps with an adjoining metadata footer.
                let next = paragraph.nextSibling;
                while (next && next.nodeType !== 1) { next = next.nextSibling; }
                while (next && (next as Element).localName === 'bookmarkEnd') { next = next.nextSibling; while (next && next.nodeType !== 1) { next = next.nextSibling; } }
                const nextStyle = next?.nodeType === 1 ? value(child(child(next, 'pPr') || next, 'pStyle')) : '';
                append(props, 'keepNext', { val: i === Math.max(0, lines.length - 1) && /^(CodeLanguage|CodeLineCount)/.test(nextStyle) ? '1' : '0' });
                append(props, 'keepLines', { val: '0' }); append(props, 'widowControl', { val: '0' });
                if (lines.length) { const num = append(props, 'numPr'); append(num, 'ilvl', { val: '0' }); append(num, 'numId', { val: String(numId) }); }
                const borders = append(props, 'pBdr');
                for (const edge of ['top', 'left', 'bottom', 'right', 'between']) { append(borders, edge, { val: 'nil' }); }
                append(append(props, 'tabs'), 'tab', { val: 'num', pos: String(left) });
                append(props, 'spacing', { before: '0', after: '0', line: '240', lineRule: 'auto' });
                append(props, 'ind', { left: String(left), hanging: String(gutter - 180), right: value(oldProps && child(oldProps, 'ind'), 'right') || '0' });
                for (const run of runs) { p.appendChild(run); }
                return p;
            });
            assert(replacement.map(p => payload([p])).join('\n') === models[index].join('\n'), 'replacement changed code.');
            for (const p of replacement) { paragraph.parentNode!.insertBefore(p, paragraph); }
            paragraph.parentNode!.removeChild(paragraph); marker.parentNode!.removeChild(marker); numId++;
        }
        parts.set(part, Buffer.from(new XMLSerializer().serializeToString(doc)));
    }
    assert(seen.size === models.length, 'not every source block was identified.');
    parts.set('word/numbering.xml', Buffer.from(new XMLSerializer().serializeToString(numbering)));
    const result = writeZip(parts); validateArtifact('docx', result); return result;
}
