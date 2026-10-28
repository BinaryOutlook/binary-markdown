import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

const root = path.resolve(__dirname, '../..');
const source = 'Before.\n\n```javascript\n  const greeting = "Hello";\n\tconsole.log(greeting);\n\n```\n\nAfter.\n';
const hosts = {
    vscode: (config: object) => require('../utils/production-webview.cjs')(root, source, 7, config),
    electron: (config: object) => require('../utils/electron-webview.cjs')(root, source, config)
};
const setLabels = (page: Page, value: boolean) => page.evaluate(value =>
    (window as any).__hostMessageHandler({ type: 'codeBlockActionLabels', value }), value);

for (const [host, generate] of Object.entries(hosts)) {
    for (const labels of [undefined, false]) {
        test(`${host} initially ${labels === false ? 'hides' : 'shows'} action labels from the saved preference`, async ({ page }) => {
            await page.setViewportSize({ width: 1100, height: 740 });
            await page.route('**/action-labels.html', route => route.fulfill({ contentType: 'text/html', body: generate({ codeBlockActionLabels: labels }) }));
            await page.goto('/action-labels.html');
            await page.waitForFunction(() => (window as any).__testApi?.ready);
            for (const action of ['copy', 'wrap', 'open']) {
                const button = page.locator(`.code-${action}-btn`);
                await expect(button).toBeVisible();
                await expect(button).toHaveAttribute('aria-label', /.+/);
                await expect(button).toHaveAttribute('title', /.+/);
                if (labels === false) await expect(button.locator('.code-action-label')).toBeHidden();
                else await expect(button.locator('.code-action-label')).toBeVisible();
            }
            await expect(page.locator('.code-lang-tag')).toHaveText('javascript');
            expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
        });
    }
}

test('live icon preference preserves editing state and keyboard actions, including copy feedback', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 740 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(source => {
        (window as any).__testApi.setMarkdown(source);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (window as any).__copiedText = text; } } });
    }, source);
    const copy = page.locator('.code-copy-btn');
    await copy.focus();
    await page.keyboard.press('Enter');
    await expect(copy).toHaveAttribute('data-copy-state', 'copied');
    expect(await copy.evaluate(node => (node as HTMLElement).style.minWidth)).not.toBe('');
    await setLabels(page, false);
    await expect(copy.locator('.code-action-label')).toBeHidden();
    expect((await copy.boundingBox())!.width).toBe(28);
    await expect(copy).toBeFocused();
    expect(await page.evaluate(() => (window as any).__copiedText)).toBe('  const greeting = "Hello";\n\tconsole.log(greeting);\n');
    const wrap = page.locator('.code-wrap-btn');
    await wrap.focus();
    await page.keyboard.press('Space');
    await expect(wrap).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.code-wrap-notice')).toBeVisible();
    await page.locator('#editor pre code').click();
    const open = page.locator('.code-open-btn');
    await open.focus();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => (window as any).__testApi.messages.some((message: any) => message.type === 'openInTextEditor'))).toBe(true);
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
    // Keep references to the active code node and caret: a preference change must not re-render them.
    await page.locator('#editor pre code').click();
    await page.evaluate(() => {
        (window as any).__selectedCode = document.querySelector('#editor pre code');
        (window as any).__selection = { node: getSelection()!.anchorNode, offset: getSelection()!.anchorOffset };
        (window as any).__testApi.messages = [];
    });
    await setLabels(page, true);
    await setLabels(page, false);
    expect(await page.evaluate(() => {
        const selection = getSelection()!;
        return document.querySelector('#editor pre code') === (window as any).__selectedCode &&
            selection.anchorNode === (window as any).__selection.node && selection.anchorOffset === (window as any).__selection.offset;
    })).toBe(true);
    await expect(page.locator('#editor pre')).toHaveAttribute('data-mode', 'edit');
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => message.type === 'edit'))).toEqual([]);
    await page.locator('[data-editor-mode="source"]').click();
    await expect(page.locator('#sourceEditor')).toHaveValue(source);
    await page.locator('[data-editor-mode="visual"]').click();
    await expect(copy.locator('.code-action-label')).toBeHidden();
    await expect(wrap).toHaveAttribute('aria-pressed', 'true');
    await setLabels(page, true);
    for (const label of await page.locator('.code-action-label').all()) await expect(label).toBeVisible();
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
});

test('changing action labels preserves pending edits and undo/redo history', async ({ page }) => {
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(source => (window as any).__hostMessageHandler({ type: 'update', content: source }), source);
    await page.locator('#editor > p:last-child').evaluate(node => {
        document.getElementById('editor')!.focus();
        const range = document.createRange();
        range.selectNodeContents(node);
        range.collapse(false);
        getSelection()!.removeAllRanges();
        getSelection()!.addRange(range);
    });
    await page.keyboard.insertText('!');
    const changed = source.replace('After.', 'After.!');
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(changed);
    await setLabels(page, false);
    await setLabels(page, true);
    await page.locator('[data-action="undo"]').evaluate((node: HTMLButtonElement) => node.click());
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
    await page.locator('[data-action="redo"]').evaluate((node: HTMLButtonElement) => node.click());
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(changed);
});

test('icons remain visible in narrow panes and copy errors stay readable', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(source => {
        (window as any).__testApi.setMarkdown(source);
        document.getElementById('closeSidebar')!.click();
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Synthetic clipboard failure'); } } });
    }, source);
    await setLabels(page, false);
    for (const button of await page.locator('.code-block-header button').all()) {
        await expect(button).toBeVisible();
        const bounds = (await button.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
    }
    await page.locator('.code-copy-btn').click();
    await expect(page.locator('.code-block-status')).toBeVisible();
    await expect(page.locator('.code-block-status')).toContainText('Could not copy');
    await expect(page.locator('.code-copy-btn')).toHaveAttribute('title', /Could not copy/);
    await expect(page.locator('.code-action-label').first()).toBeHidden();
});
