import { test, expect } from '@playwright/test';
import * as path from 'path';

const root = path.resolve(__dirname, '../..');
const hosts = {
    vscode: (content: string, config: object) => require('../utils/production-webview.cjs')(root, content, 7, config),
    electron: (content: string, config: object) => require('../utils/electron-webview.cjs')(root, content, config)
};

for (const [name, generate] of Object.entries(hosts)) {
    test(`${name} keeps hostile directory names and substitution tokens as data`, async ({ page }) => {
        const original = '# Preserved\n\n![photo](image.png)\n';
        const documentBaseUri = 'file:///synthetic/";window.__injectionProbe=true;//\' </script><script>window.__injectionProbe=true</script> $& $\' $` __CONTENT__ __I18N__ &quot;';
        const html = generate(original, { documentBaseUri });
        await page.route('**/security-editor.html', route => route.fulfill({ contentType: 'text/html', body: html }));
        await page.goto('/security-editor.html');
        await page.waitForFunction(() => (window as any).__testApi?.ready);
        expect(await page.evaluate(() => (window as any).__injectionProbe)).toBeUndefined();
        await expect(page.locator('#editor img')).toHaveAttribute('src', documentBaseUri + '/image.png');
        await expect(page.locator('#editor img')).not.toHaveAttribute('onerror');
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(original);
        await page.locator('[data-editor-mode="source"]').click();
        await expect(page.locator('#sourceEditor')).toHaveValue(original);
        await page.locator('[data-editor-mode="visual"]').click();
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(original);
    });

    test(`${name} renders quoted Markdown attributes without creating event handlers`, async ({ page }) => {
        const alt = 'photo" onerror="window.__injectionProbe=true';
        const original = `![${alt}](https://example.invalid/quote" onerror="window.__injectionProbe=true)\n\n[quoted link](https://example.invalid/quote" onclick="window.__injectionProbe=true)\n\nA "quote" and 'apostrophe'.\n`;
        const html = generate(original, {});
        await page.route('**/security-image.html', route => route.fulfill({ contentType: 'text/html', body: html }));
        await page.goto('/security-image.html');
        await page.waitForFunction(() => (window as any).__testApi?.ready);
        const image = page.locator('#editor img');
        await expect(image).toHaveCount(1);
        await expect(image).toHaveAttribute('alt', alt);
        await expect(image).not.toHaveAttribute('onerror');
        await image.evaluate(node => node.dispatchEvent(new Event('error')));
        await expect(page.locator('#editor a')).not.toHaveAttribute('onclick');
        await expect(page.locator('#editor a')).toHaveAttribute('href', 'https://example.invalid/quote" onclick="window.__injectionProbe=true');
        expect(await page.evaluate(() => (window as any).__injectionProbe)).toBeUndefined();
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(original);
        await page.locator('[data-editor-mode="source"]').click();
        await expect(page.locator('#sourceEditor')).toHaveValue(original);
    });
}
