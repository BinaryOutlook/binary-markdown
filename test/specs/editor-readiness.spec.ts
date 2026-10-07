import { test, expect } from '@playwright/test';
import * as path from 'path';

const root = path.resolve(__dirname, '../..');
const productionWebview = require('../utils/production-webview.cjs');

test('production readiness waits for the runtime and answers only the current generation', async ({ page }) => {
    const original = '# Ready\n\nPreserved source.\n';
    const html = productionWebview(root, original, 7);
    const nonce = html.match(/<script nonce="([^"]+)"/)[1];
    const scripts = [...html.matchAll(/<script nonce="[^"]+">([\s\S]*?)<\/script>/g)];
    const runtime = scripts.find(item => item[1].includes('BinaryWorkspaceUi') && item[1].includes('htmlToMarkdown'))!;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/ready-runtime.js', async route => {
        await gate;
        await route.fulfill({ contentType: 'text/javascript', body: runtime[1] });
    });
    await page.route('**/ready-editor.html', route => route.fulfill({ contentType: 'text/html',
        body: html.replace(runtime[0], `<script nonce="${nonce}" src="/ready-runtime.js"></script>`) }));
    try {
        await page.goto('/ready-editor.html', { waitUntil: 'commit' });
        await expect(page.locator('#editor')).toBeVisible();
        expect(await page.evaluate(() => (window as any).__testApi.messages.some((message: any) => message.type === 'renderLoaded'))).toBe(false);
        release();
        await page.waitForFunction(() => (window as any).__testApi.messages.some((message: any) => message.type === 'renderLoaded'));
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(original);
        expect(await page.evaluate(() => typeof (window as any).BinaryMath.inline)).toBe('function');
        await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'renderProbe', generation: 6 } })));
        expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => message.type === 'renderReady'))).toEqual([]);
        await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'renderProbe', generation: 7 } })));
        expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => message.type === 'renderReady'))).toEqual([{ type: 'renderReady', generation: 7 }]);
        await expect(page.locator('#exportButton')).toHaveAttribute('data-export-ready', 'true');
        await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'captureExportSnapshot', requestId: 'ready' } })));
        expect(await page.evaluate(() => (window as any).__testApi.messages.find((message: any) => message.type === 'exportSnapshot'))).toMatchObject({ content: original, pending: false });
    } finally { release(); }
});
