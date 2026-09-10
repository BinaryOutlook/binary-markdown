import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { checkCancelled, ExportResource } from './types';

const mimeTypes: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
    '.woff': 'font/woff', '.ttf': 'font/ttf', '.css': 'text/css'
};

export function resourceUrl(reference: string, base: string): URL {
    // Markdown references have URL query/fragment semantics. Bare percent signs
    // are also common in local filenames; preserve them without double-decoding.
    const escapedReference = reference.replace(/%(?![\da-f]{2})/gi, '%25');
    if (/^(https?:|data:|file:)/i.test(reference)) {
        return new URL(reference.startsWith('data:') ? reference : escapedReference);
    }
    if (/^[a-z][a-z\d+.-]*:/i.test(reference)) { throw new Error('Unsupported resource scheme: ' + reference); }
    if (/^https?:/i.test(base)) { return new URL(escapedReference, base); }
    const baseUrl = base.startsWith('file:') ? new URL(base) : pathToFileURL(base);
    return new URL(escapedReference, baseUrl);
}

function xmlText(value: string): string {
    return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
        const named: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
        if (named[entity.toLowerCase()]) { return named[entity.toLowerCase()]; }
        const numeric = entity.toLowerCase().startsWith('&#x') ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10);
        return numeric > 0 && numeric <= 0x10ffff ? String.fromCodePoint(numeric) : '\uFFFD';
    });
}

/** An SVG image must bring all its resources with it; this MVP does not crawl its dependencies. */
function requirePortableSvg(bytes: Buffer): void {
    const svg = bytes.toString('utf8');
    if (/<(?:[\w-]+:)?(?:script|iframe|object|embed)\b|<!DOCTYPE|<!ENTITY|<\?xml-stylesheet|\bon\w+\s*=/i.test(svg)) {
        throw new Error('SVG with active or externally defined content is not supported by experimental export.');
    }
    const local = (value: string): boolean => {
        const decoded = xmlText(value).trim();
        return decoded.startsWith('#') || /^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(decoded);
    };
    for (const match of svg.matchAll(/\b(?:[\w.-]+:)?(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
        if (!local(match[1] ?? match[2] ?? match[3])) {
            throw new Error('SVG with unresolved external or relative resources is not yet portable.');
        }
    }
    const decoded = xmlText(svg);
    if (/@import\b/i.test(decoded)) { throw new Error('SVG with imported styles is not yet portable.'); }
    const styleValues = [
        ...[...svg.matchAll(/\b(?:style|fill|stroke|filter|clip-path|mask|cursor)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map(match => match[1] ?? match[2]),
        ...[...svg.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map(match => match[1])
    ];
    if (styleValues.some(value => xmlText(value).includes('\\'))) {
        throw new Error('SVG with escaped resource styles is not supported by experimental export.');
    }
    for (const match of decoded.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) {
        if (!local(match[2])) { throw new Error('SVG with unresolved CSS resources is not yet portable.'); }
    }
}

/** Fetch only explicit references, once per job. No document content is uploaded. */
export function createResourceLoader(signal: AbortSignal) {
    const cache = new Map<string, Promise<ExportResource>>();
    return async (reference: string, base: string): Promise<ExportResource> => {
        checkCancelled(signal);
        const url = resourceUrl(reference, base);
        if (url.hash) {
            throw new Error('Resource fragments (#...) are not supported by experimental export; use the complete image instead.');
        }
        // A local query does not name another file. Reuse captured file bytes
        // even if the same image was referenced with different cache markers.
        if (url.protocol === 'file:') { url.search = ''; }
        const key = url.toString();
        let pending = cache.get(key);
        if (!pending) {
            pending = (async () => {
                let bytes: Buffer;
                let mime: string;
                if (url.protocol === 'file:') {
                    const file = fileURLToPath(url);
                    bytes = await fs.readFile(file, { signal });
                    mime = mimeTypes[path.extname(file).toLowerCase()] || 'application/octet-stream';
                } else {
                    const response = await fetch(key, { signal, credentials: 'omit' });
                    if (!response.ok) { throw new Error('Resource request failed (' + response.status + '): ' + reference); }
                    bytes = Buffer.from(await response.arrayBuffer());
                    mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
                        || mimeTypes[path.extname(url.pathname).toLowerCase()] || 'application/octet-stream';
                }
                checkCancelled(signal);
                if (mime === 'image/svg+xml') { requirePortableSvg(bytes); }
                return { bytes, mime };
            })();
            cache.set(key, pending);
        }
        return pending;
    };
}

export function dataUri(resource: ExportResource): string {
    return 'data:' + resource.mime + ';base64,' + resource.bytes.toString('base64');
}
