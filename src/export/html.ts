import * as fs from 'fs/promises';
import * as path from 'path';
import { checkCancelled, ExportOperations, PreparedExportDocument, SavedExportDocument } from './types';
import { dataUri } from './resources';

function escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function decodeAttribute(value: string): string {
    return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
        const named: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
        return named[entity.toLowerCase()] || String.fromCodePoint(
            entity.toLowerCase().startsWith('&#x') ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10));
    });
}

async function replaceAsync(value: string, pattern: RegExp, replace: (match: RegExpMatchArray) => Promise<string>) {
    let result = '';
    let offset = 0;
    for (const match of value.matchAll(pattern)) {
        result += value.slice(offset, match.index) + await replace(match);
        offset = (match.index || 0) + match[0].length;
    }
    return result + value.slice(offset);
}

export async function prepareStandaloneHtml(
    document: SavedExportDocument, prepared: PreparedExportDocument, extensionPath: string, operations: ExportOperations
): Promise<string> {
    operations.report('resources');
    const imageHtml = await replaceAsync(prepared.html, /<img\b[^>]*>/gi, async match => {
        checkCancelled(operations.signal);
        const tag = match[0];
        const reference = /\bdata-markdown-path="([^"]*)"/i.exec(tag)?.[1] || /\bsrc="([^"]*)"/i.exec(tag)?.[1];
        if (!reference) { return tag; }
        const decoded = decodeAttribute(reference);
        try {
            const resource = await operations.loadResource(decoded, document.sourcePath);
            if (!/^image\/(png|jpeg|gif|webp|svg\+xml)$/.test(resource.mime)) {
                throw new Error('Unsupported image type: ' + resource.mime);
            }
            const clean = tag.replace(/\s(?:src|srcset|data-markdown-path)="[^"]*"/gi, '');
            return clean.replace(/\s*\/?>(\s*)$/, ' src="' + dataUri(resource) + '">');
        } catch (error) {
            checkCancelled(operations.signal);
            operations.warnings.push({ code: 'image-unavailable', message: decoded + ': ' + String(error) });
            return '<span class="export-fallback">[Image unavailable: ' + escapeText(decoded) + ']</span>';
        }
    });
    let styles = (await fs.readFile(path.join(extensionPath, 'out/webview/styles.css'), 'utf8'))
        .replace(/__FONT_SIZE__/g, String(document.fontSize));
    const embedCss = async (css: string, base: string) => replaceAsync(css, /url\(\s*(['"]?)(.*?)\1\s*\)/gi, async match => {
        if (match[2].startsWith('#') || match[2].startsWith('data:')) { return match[0]; }
        try {
            const resource = await operations.loadResource(match[2], base);
            return 'url("' + dataUri(resource) + '")';
        } catch (error) {
            checkCancelled(operations.signal);
            operations.warnings.push({ code: 'font-unavailable', message: match[2] + ': ' + String(error) });
            return 'url("data:application/octet-stream;base64,")';
        }
    });
    if (imageHtml.includes('katex')) {
        const katexPath = path.join(extensionPath, 'vendor/katex.min.css');
        styles += await embedCss(await fs.readFile(katexPath, 'utf8'), katexPath);
    }
    if (document.theme === 'perplexity') {
        const fontCss = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
        try {
            const resource = await operations.loadResource(fontCss, document.sourcePath);
            styles += await embedCss(resource.bytes.toString('utf8'), fontCss);
        } catch (error) {
            checkCancelled(operations.signal);
            operations.warnings.push({ code: 'font-unavailable', message: 'Inter font unavailable; using the system sans-serif fallback.' });
        }
    }
    const title = path.basename(document.sourcePath, path.extname(document.sourcePath));
    const warningNote = operations.warnings.length ? '<aside class="export-warning-note">' +
        operations.warnings.map(warning => '<p>' + escapeText(warning.message) + '</p>').join('') + '</aside>' : '';
    checkCancelled(operations.signal);
    return '<!DOCTYPE html>\n<html lang="en" data-theme="' + escapeText(document.theme) + '">' +
        '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; font-src data:;">' +
        '<title>' + escapeText(title) + '</title><style>' + styles.replace(/<\/style/gi, '<\\/style') +
        '\nhtml,body{height:auto!important;overflow:visible!important}body{margin:0;padding:24px}' +
        '.editor{height:auto!important;max-height:none!important;overflow:visible!important;max-width:860px;margin:auto;outline:0}' +
        '.editor pre,.editor table{max-height:none!important;overflow:visible!important}' +
        '.editor img,.editor svg{max-width:100%;height:auto}.export-fallback,.export-warning-note{border:1px solid #a66;padding:8px;white-space:normal}' +
        '@page{size:A4;margin:16mm}@media print{body{padding:0}.editor{max-width:none;padding:0}' +
        '.editor>*,.editor pre,.editor table{break-inside:avoid}.editor pre{white-space:pre-wrap!important;overflow-wrap:anywhere}' +
        '.editor table{width:100%;table-layout:fixed}.editor td,.editor th{overflow-wrap:anywhere}' +
        '.export-split{break-inside:auto!important}.editor img,.editor svg{max-height:265mm;object-fit:contain}}' +
        '</style></head><body><main class="editor">' + imageHtml + '</main>' + warningNote + '</body></html>';
}
