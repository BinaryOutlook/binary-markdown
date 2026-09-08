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
    if (/^(https?:|data:|file:)/i.test(reference)) { return new URL(reference); }
    if (/^[a-z][a-z\d+.-]*:/i.test(reference)) { throw new Error('Unsupported resource scheme: ' + reference); }
    if (/^https?:/i.test(base)) { return new URL(reference, base); }
    const directory = base.startsWith('file:') ? path.dirname(fileURLToPath(base)) : path.dirname(base);
    return pathToFileURL(path.resolve(directory, decodeURIComponent(reference)));
}

/** Fetch only explicit references, once per job. No document content is uploaded. */
export function createResourceLoader(signal: AbortSignal) {
    const cache = new Map<string, Promise<ExportResource>>();
    return async (reference: string, base: string): Promise<ExportResource> => {
        checkCancelled(signal);
        const url = resourceUrl(reference, base);
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
                if (mime === 'image/svg+xml' && /(?:href|url\()\s*=?\s*["']?https?:/i.test(bytes.toString('utf8'))) {
                    throw new Error('SVG with external resources is not yet portable: ' + reference);
                }
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
