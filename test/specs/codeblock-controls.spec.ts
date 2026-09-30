import { test, expect, Page } from '@playwright/test';

const longCode = '  const value = "' + 'abcdefghij'.repeat(80) + '";  \n\tconsole.log(value);\n\n';
const source = 'Before.\n\n```javascript\n' + longCode + '\n```\n\nAfter.\n';

async function setup(page: Page, markdown = source) {
    await page.setViewportSize({ width: 500, height: 700 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(markdown => {
        (window as any).__testApi.setMarkdown(markdown);
        document.getElementById('closeSidebar')!.click();
    }, markdown);
}

test('horizontal code scrolling keeps the toolbar anchored and the first line unobstructed', async ({ page }) => {
    await setup(page);
    const block = page.locator('#editor pre').first();
    const header = block.locator('.code-block-header');
    const code = block.locator('code');
    const before = await header.boundingBox();
    expect(before).not.toBeNull();
    expect(await code.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    await code.evaluate(node => { node.scrollLeft = node.scrollWidth; });
    expect(await code.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    const after = await header.boundingBox();
    expect(after!.x).toBeCloseTo(before!.x, 1);
    expect(after!.y).toBeCloseTo(before!.y, 1);
    const codeBounds = await code.boundingBox();
    expect(codeBounds!.y).toBeGreaterThanOrEqual(after!.y + after!.height);
    for (const selector of ['.code-expand-btn', '.code-lang-tag', '.code-copy-btn', '.code-delete-btn']) {
        await expect(block.locator(selector)).toBeVisible();
        const bounds = await block.locator(selector).boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(after!.x);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(after!.x + after!.width + 1);
    }
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
});
