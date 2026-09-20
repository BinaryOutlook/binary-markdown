// eslint-disable-next-line @typescript-eslint/no-var-requires
const { normalizeForPandoc } = require('../shared/math-syntax');
import { scan as scanDocumentAux, START as TOC_START, END as TOC_END, headingText } from '../shared/document-aux';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { checkCancelled, codeLanguagePosition, CodeLanguagePosition, CodePresentationOptions, ExportOperations, PreparedExportDocument, SavedExportDocument } from './types';
import { runTool } from './tools';
import { codeLanguageLabel } from './code-language';
import { docxLanguageTab } from './language-tab';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
interface AstNode { t: string; c?: Json; }
const emptyAttributes: Json = ['', [], []];

function withDocxLanguageLabel(block: Json, classes: Json[], id: number, position: CodeLanguagePosition): Json {
    const label = codeLanguageLabel(classes);
    if (!label) { return block; }
    // Keep the code itself intact for Pandoc highlighting and exact copy/paste.
    // Position-specific metadata paragraphs keep the inline native shape beside
    // the corresponding code edge without changing the code node or its tokens.
    // Only extension-generated, escaped OpenXML enters this branch.
    const styles = { 'top-left': 'Code Language Top Left', 'top-right': 'Code Language Top Right',
        'bottom-left': 'Code Language Bottom Left', 'bottom-right': 'Code Language' };
    const metadata: Json = {
        t: 'Div', c: [['', [], [['custom-style', styles[position]]]], [
            { t: 'Para', c: [{ t: 'Space' }, { t: 'RawInline', c: ['openxml', docxLanguageTab(label, id, position)] }] }
        ]]
    };
    return { t: 'Div', c: [emptyAttributes, position.startsWith('top') ? [metadata, block] : [block, metadata]] };
}

function node(value: Json): AstNode | undefined {
    return value && !Array.isArray(value) && typeof value === 'object' && typeof value.t === 'string'
        ? value as unknown as AstNode : undefined;
}

function textIn(value: Json): string {
    if (Array.isArray(value)) { return value.map(textIn).join(''); }
    const item = node(value);
    if (!item) { return ''; }
    if (item.t === 'Str') { return String(item.c || ''); }
    if (['Space', 'SoftBreak', 'LineBreak'].includes(item.t)) { return ' '; }
    if (item.t === 'Code' && Array.isArray(item.c)) { return String(item.c[1]); }
    return item.c ? textIn(item.c) : '';
}

/** Only the editor's trailing directive block is metadata; fenced examples remain content. */
export function preparePandocMarkdown(markdown: string): string {
    // Remove only managed boundary comments; leave examples and author HTML alone.
    const managed = scanDocumentAux(markdown).tocs;
    for (const block of managed.slice().reverse()) {
        const list = block.source.slice(TOC_START.length, -TOC_END.length);
        markdown = markdown.slice(0, block.start) + list + markdown.slice(block.end);
    }
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    let fence: { marker: string; length: number } | undefined;
    const outsideFence: boolean[] = [];
    for (let index = 0; index < lines.length; index++) {
        outsideFence[index] = !fence;
        const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(lines[index]);
        if (!match) { continue; }
        if (!fence) { fence = { marker: match[1][0], length: match[1].length }; }
        else if (match[1][0] === fence.marker && match[1].length >= fence.length && !match[2].trim()) { fence = undefined; }
    }
    let end = lines.length;
    while (end > 0 && !lines[end - 1].trim()) { end--; }
    let start = end;
    while (start > 0 && /^(?:IMAGE_DIR:\s*.+|FORCE_RELATIVE_PATH:\s*(?:true|false))\s*$/i.test(lines[start - 1])) { start--; }
    if (start < end && start > 0 && lines[start - 1] === '---' && outsideFence[start - 1]) {
        return lines.slice(0, start - 1).join('\n');
    }
    return markdown;
}

function safeSvg(bytes: Buffer): boolean {
    const svg = bytes.toString('utf8');
    if (!/<svg\b/i.test(svg) || /<(?:[\w-]+:)?(?:script|foreignObject|iframe|object|embed)\b|<!DOCTYPE|<!ENTITY|\bon\w+\s*=/i.test(svg)) {
        return false;
    }
    const localReference = (value: string): boolean => {
        const decoded = value.replace(/&#(?:x([0-9a-f]+)|(\d+));?/gi, (_match, hex, decimal) => String.fromCodePoint(parseInt(hex || decimal, hex ? 16 : 10))).replace(/&amp;/g, '&').trim();
        return decoded.startsWith('#') || /^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(decoded);
    };
    for (const match of svg.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi)) {
        if (!localReference(match[2])) { return false; }
    }
    for (const match of svg.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) {
        if (!localReference(match[2])) { return false; }
    }
    return !/@import\b/i.test(svg);
}

function warn(operations: ExportOperations, code: string, message: string): void {
    if (!operations.warnings.some(item => item.code === code && item.message === message)) {
        operations.warnings.push({ code, message });
    }
}

export async function convertPandoc(
    format: 'docx' | 'epub', document: SavedExportDocument, prepared: PreparedExportDocument,
    executable: string, operations: ExportOperations, options: CodePresentationOptions = {}
): Promise<Buffer> {
    checkCancelled(operations.signal);
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'binary-markdown-pandoc-'));
    try {
        const dataDirectory = path.join(directory, 'data');
        await fs.mkdir(dataDirectory);
        operations.report('converting');
        const commonArguments = ['--sandbox', `--data-dir=${dataDirectory}`];
        const read = await runTool(executable, [...commonArguments, '--from=commonmark_x+tex_math_gfm-smart', '--to=json'], {
            input: normalizeForPandoc(preparePandocMarkdown(document.markdown), document.mathBackslashDelimiters !== false), cwd: directory, signal: operations.signal
        });
        if (read.stderr) { warn(operations, 'pandoc-reader', read.stderr); }
        const ast = JSON.parse(read.stdout.toString('utf8')) as Record<string, Json>;
        if (!Array.isArray(ast.blocks) || !Array.isArray(ast['pandoc-api-version'])) {
            throw new Error('Pandoc returned an invalid intermediate document.');
        }

        // Writer-affecting metadata (CSS, cover files, includes, templates, filters) is never taken from the document.
        const allowedMetadata = new Set(['title', 'subtitle', 'author', 'date', 'lang', 'description', 'subject', 'keywords']);
        const metadata = ast.meta && !Array.isArray(ast.meta) && typeof ast.meta === 'object' ? ast.meta : {};
        const omitted = Object.keys(metadata).filter(key => !allowedMetadata.has(key));
        ast.meta = Object.fromEntries(Object.entries(metadata).filter(([key]) => allowedMetadata.has(key)));
        if (omitted.length) { warn(operations, 'pandoc-metadata', `Metadata without an MVP export mapping was omitted: ${omitted.join(', ')}.`); }
        if (!Object.prototype.hasOwnProperty.call(ast.meta, 'title')) {
            ast.meta.title = { t: 'MetaString', c: path.basename(document.sourcePath, path.extname(document.sourcePath)) };
        }

        const headings = ast.blocks.filter(value => node(value)?.t === 'Header');
        const managedSource = scanDocumentAux(document.markdown);
        if (managedSource.tocs.length) {
            // Managed links use the editor's ATX anchors. Match in document order,
            // leaving other Pandoc-only heading forms on their existing path.
            let sourceIndex = 0;
            for (const heading of headings) {
                const content = node(heading)?.c as Json[];
                const text = textIn(content[2]);
                const expected = managedSource.headings[sourceIndex];
                if (expected && Number(content[0]) === expected.level &&
                    headingText(expected.label).replace(/\s+#+\s*$/, '') === text) {
                    (content[1] as Json[])[0] = expected.id;
                    sourceIndex++;
                }
            }
        }
        const toc: Json = {
            t: 'BulletList',
            c: headings.map(value => {
                const content = node(value)?.c as Json[];
                const attributes = content[1] as Json[];
                return [{ t: 'Plain', c: [{ t: 'Link', c: [emptyAttributes, content[2], [`#${String(attributes[0])}`, '']] }] }];
            })
        };
        const diagramMap = new Map(prepared.diagrams.map(diagram => [diagram.source.trim(), diagram.svg]));
        const imageCache = new Map<string, Promise<string>>();
        let tocInserted = false;
        let languageTabId = 0;
        operations.report('resources');
        const imageData = async (reference: string): Promise<string> => {
            let result = imageCache.get(reference);
            if (!result) {
                result = operations.loadResource(reference, document.sourcePath).then(resource => {
                    const mime = resource.mime.split(';')[0].trim().toLowerCase();
                    const supported = format === 'docx'
                        ? ['image/png', 'image/jpeg', 'image/gif', 'image/tiff', 'image/svg+xml']
                        : ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];
                    if (!supported.includes(mime)) { throw new Error(`The ${mime || 'unknown'} image type is not supported by this ${format.toUpperCase()} exporter.`); }
                    if (mime === 'image/svg+xml' && !safeSvg(resource.bytes)) {
                        throw new Error('The SVG contains active, external, or unsupported HTML content.');
                    }
                    return `data:${mime};base64,${resource.bytes.toString('base64')}`;
                });
                imageCache.set(reference, result);
            }
            return result;
        };
        const transform = async (value: Json): Promise<Json> => {
            checkCancelled(operations.signal);
            if (Array.isArray(value)) {
                const output: Json[] = [];
                // CommonMark keeps inline HTML as raw nodes. Pair only the
                // editor's attribute-free underline tags within this inline
                // sequence; code, escaped examples and other HTML retain their
                // existing conversion/fallback behavior.
                const openings: number[] = [];
                const pairs = new Map<number, number>();
                value.forEach((child, index) => {
                    const inline = node(child);
                    if (inline?.t !== 'RawInline' || !Array.isArray(inline.c) || inline.c[0] !== 'html') { return; }
                    if (/^<u>$/i.test(String(inline.c[1]))) { openings.push(index); }
                    else if (/^<\/u>$/i.test(String(inline.c[1])) && openings.length) { pairs.set(openings.pop()!, index); }
                });
                for (let index = 0; index < value.length; index++) {
                    const closing = pairs.get(index);
                    if (closing !== undefined) {
                        output.push({ t: 'Underline', c: await transform(value.slice(index + 1, closing)) });
                        index = closing;
                    } else { output.push(await transform(value[index])); }
                }
                return output;
            }
            if (!value || typeof value !== 'object') { return value; }
            const item = node(value);
            const content = item && Array.isArray(item.c) ? item.c : [];
            if (item?.t === 'Image') {
                const target = content[2] as Json[];
                const reference = String(target[0]);
                try {
                    return { t: 'Image', c: [content[0], await transform(content[1]), [await imageData(reference), target[1]]] };
                } catch (error) {
                    checkCancelled(operations.signal);
                    warn(operations, 'image-fallback', `Image could not be included (${reference}): ${error instanceof Error ? error.message : String(error)}`);
                    return { t: 'Span', c: [emptyAttributes, [{ t: 'Str', c: `[Image unavailable: ${textIn(content[1]) || reference}]` }]] };
                }
            }
            if (item?.t === 'CodeBlock') {
                const attributes = content[0] as Json[];
                const classes = attributes[1] as Json[];
                if (classes.includes('mermaid')) {
                    const source = String(content[1]);
                    const svg = diagramMap.get(source.trim());
                    if (svg && safeSvg(Buffer.from(svg))) {
                        return { t: 'Para', c: [{ t: 'Image', c: [emptyAttributes, [{ t: 'Str', c: 'Mermaid diagram' }], [`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, '']] }] };
                    }
                    warn(operations, 'diagram-fallback', 'A Mermaid diagram could not be represented as a portable SVG; its source is included instead.');
                    return { t: 'Div', c: [emptyAttributes, [
                        { t: 'Para', c: [{ t: 'Str', c: '[Diagram unavailable; Mermaid source follows]' }] },
                        { t: 'CodeBlock', c: [emptyAttributes, source] }
                    ]] };
                }
                if (format === 'docx' && options.showCodeLanguage !== false) {
                    return withDocxLanguageLabel(value, classes, ++languageTabId, codeLanguagePosition(options.codeLanguagePosition));
                }
            }
            if (item?.t === 'RawBlock' || item?.t === 'RawInline') {
                warn(operations, 'raw-content-fallback', `Raw ${String(content[0])} content is included as readable source because ${format.toUpperCase()} cannot preserve its displayed behavior reliably.`);
                return { t: item.t === 'RawBlock' ? 'CodeBlock' : 'Code', c: [emptyAttributes, String(content[1])] };
            }
            if ((item?.t === 'Para' || item?.t === 'Plain') && textIn(item.c || []) === '[TOC]') {
                if (tocInserted) { return { t: 'Div', c: [emptyAttributes, []] }; }
                tocInserted = true;
                return toc;
            }
            if (item?.t === 'Link') {
                const target = content[2] as Json[];
                if (/^(?:javascript|vbscript|data):/i.test(String(target[0]).trim())) {
                    warn(operations, 'link-fallback', 'An active-content link was exported as visible text without its executable target.');
                    return { t: 'Span', c: [emptyAttributes, await transform(content[1])] };
                }
            }
            const output: Record<string, Json> = {};
            for (const [key, child] of Object.entries(value)) { output[key] = await transform(child); }
            return output;
        };
        const normalized = await transform(ast);
        checkCancelled(operations.signal);
        operations.report('converting');
        const outputFile = path.join(directory, `document.${format}`);
        const topLabel = options.showCodeLanguage !== false && codeLanguagePosition(options.codeLanguagePosition).startsWith('top');
        const writerArguments = format === 'docx'
            ? [`--reference-doc=${path.resolve(__dirname, topLabel ? '../../media/export-reference-top.docx' : '../../media/export-reference.docx')}`]
            : ['--mathml'];
        const write = await runTool(executable, [...commonArguments, '--from=json', `--to=${format === 'epub' ? 'epub3' : 'docx'}`, ...writerArguments, '--standalone', `--output=${outputFile}`], {
            input: JSON.stringify(normalized), cwd: directory, signal: operations.signal
        });
        if (write.stderr) { warn(operations, 'pandoc-writer', write.stderr); }
        checkCancelled(operations.signal);
        const bytes = await fs.readFile(outputFile);
        if (bytes.length < 4 || bytes.readUInt32LE(0) !== 0x04034b50) {
            throw new Error(`Pandoc did not create a valid ${format.toUpperCase()} container.`);
        }
        return bytes;
    } finally {
        await fs.rm(directory, { recursive: true, force: true });
    }
}
