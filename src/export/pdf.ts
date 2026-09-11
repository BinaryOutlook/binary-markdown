import * as path from 'path';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { checkCancelled, ExportOperations } from './types';

const printStyles = `
@page { size: A4; margin: 16mm; background: var(--bg-color, #fff); }
html, body { height: auto !important; min-height: 0 !important; max-height: none !important; overflow: visible !important; }
body { margin: 0 !important; }
*, *::before, *::after { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
main, article, #editor { max-width: 100% !important; min-height: 0 !important; height: auto !important; overflow: visible !important; }
p, pre, blockquote, table, figure, li, h1, h2, h3, h4, h5, h6 { break-inside: avoid-page; page-break-inside: avoid; }
h1, h2, h3, h4, h5, h6 { break-after: avoid-page; page-break-after: avoid; }
pre, code { white-space: pre-wrap !important; overflow-wrap: anywhere !important; word-break: break-word !important; }
pre, blockquote { overflow: visible !important; max-height: none !important; }
table { width: 100% !important; max-width: 100% !important; table-layout: fixed; border-collapse: collapse; }
th, td { overflow-wrap: anywhere !important; word-break: break-word; }
tr { break-inside: avoid-page; page-break-inside: avoid; }
thead { display: table-header-group; } tfoot { display: table-footer-group; }
img, svg, canvas { max-width: 100% !important; height: auto; object-fit: contain; }
.export-oversized { break-inside: auto !important; page-break-inside: auto !important; }
`;

/** Print a self-contained, script-free document using an explicitly selected browser. */
export async function convertPdf(html: string, executable: string, operations: ExportOperations): Promise<Buffer> {
    checkCancelled(operations.signal);
    operations.report('rendering');
    // The extension excludes node_modules from its VSIX. copy-vendor.js owns this runtime and its licenses.
    const runtime = require(path.resolve(__dirname, '../../vendor/playwright-core')) as typeof import('playwright-core');
    let browser: Browser | undefined;
    let context: BrowserContext | undefined;
    let page: Page | undefined;
    const abort = (): void => { void browser?.close().catch(() => undefined); };
    operations.signal.addEventListener('abort', abort, { once: true });
    try {
        browser = await runtime.chromium.launch({
            executablePath: executable,
            headless: true,
            chromiumSandbox: true,
            // Chrome's updater can inherit the worker pipes and keep close()
            // pending after the browser exits. Disable it for this process only.
            args: ['--disable-updater-scheduler', '--disable-background-networking', '--no-first-run', '--disable-default-apps', '--disable-sync', '--host-resolver-rules=MAP * ~NOTFOUND']
        });
        checkCancelled(operations.signal);
        context = await browser.newContext({
            javaScriptEnabled: false,
            serviceWorkers: 'block',
            acceptDownloads: false,
            viewport: { width: 673, height: 1002 }
        });
        await context.route('**/*', route => route.abort('blockedbyclient'));
        page = await context.newPage();
        const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; font-src data:; style-src \'unsafe-inline\' data:; script-src \'none\'; connect-src \'none\'; base-uri \'none\'; form-action \'none\'">';
        // Insert trusted styles before loading: addStyleTag waits for DOM callbacks that are disabled here.
        const printHead = `${csp}<style>${printStyles}</style>`;
        const printHtml = /<head\b[^>]*>/i.test(html)
            ? html.replace(/<head\b[^>]*>/i, match => `${match}${printHead}`)
            : `<!doctype html><html><head>${printHead}</head><body>${html}</body></html>`;
        await page.setContent(printHtml, { waitUntil: 'load', timeout: 0 });
        await page.emulateMedia({ media: 'print' });
        checkCancelled(operations.signal);
        // This is extension-owned code. Document scripts stay disabled throughout the isolated context.
        const readiness = await page.evaluate<{ failedImages: number; oversizedBlocks: number }>(`(async () => {
            await document.fonts.ready;
            const images = Array.from(document.images);
            await Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise(resolve => {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
            })));
            let failedImages = 0;
            for (const image of images) {
                if (!image.naturalWidth) {
                    failedImages++;
                    const fallback = document.createElement('span');
                    fallback.textContent = '[Image unavailable: ' + (image.alt || 'embedded image') + ']';
                    image.replaceWith(fallback);
                }
            }
            const pixelsPerMm = 96 / 25.4;
            const pageWidth = (210 - 32) * pixelsPerMm;
            const pageHeight = (297 - 32) * pixelsPerMm;
            for (const graphic of document.querySelectorAll('img, svg, canvas')) {
                const rect = graphic.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    const ratio = Math.min(1, pageWidth / rect.width, pageHeight / rect.height);
                    if (ratio < 1) {
                        graphic.style.setProperty('width', (rect.width * ratio) + 'px', 'important');
                        graphic.style.setProperty('height', (rect.height * ratio) + 'px', 'important');
                    }
                }
            }
            let oversizedBlocks = 0;
            for (const block of document.querySelectorAll('p, pre, blockquote, table, tr, li, figure, h1, h2, h3, h4, h5, h6')) {
                if (block.getBoundingClientRect().height > pageHeight) {
                    block.classList.add('export-oversized');
                    oversizedBlocks++;
                }
            }
            return { failedImages, oversizedBlocks };
        })()`);
        if (readiness.failedImages) {
            operations.warnings.push({ code: 'pdf-image-fallback', message: `${readiness.failedImages} embedded image(s) could not be decoded for PDF and were replaced with visible labels.` });
        }
        checkCancelled(operations.signal);
        operations.report('converting');
        const bytes = await page.pdf({
            format: 'A4',
            margin: { top: '16mm', right: '16mm', bottom: '16mm', left: '16mm' },
            preferCSSPageSize: true,
            printBackground: true,
            displayHeaderFooter: false,
            tagged: true,
            outline: true
        });
        checkCancelled(operations.signal);
        if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-')) || !bytes.subarray(-1024).includes(Buffer.from('%%EOF'))) {
            throw new Error('The browser did not create a complete PDF document.');
        }
        return bytes;
    } catch (error) {
        checkCancelled(operations.signal);
        throw error;
    } finally {
        operations.signal.removeEventListener('abort', abort);
        await page?.close().catch(() => undefined);
        await context?.close().catch(() => undefined);
        await browser?.close().catch(() => undefined);
    }
}
