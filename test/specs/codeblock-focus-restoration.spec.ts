import { test, expect } from '@playwright/test';

for (const [language, code] of [
    ['java', 'public class Example {\n    String value = "hello";\n}\n\n'],
    ['javascript', 'const value = "hello";\n\n'],
    ['python', 'def example():\n    return "hello"\n\n'],
]) {
    for (const quoted of [false, true]) {
        test(`${language}, ${quoted ? 'quoted' : 'top level'}: direct block clicks restore inactive highlighting`, async ({ page, context }) => {
            await context.grantPermissions(['clipboard-read', 'clipboard-write']);
            await page.goto('/standalone-editor.html');
            await page.waitForFunction(() => (window as any).__testApi?.ready);
            const first = '```' + language + '\n' + code + '\n```';
            const md = (quoted ? first.split('\n').map(line => '> ' + line).join('\n') : first)
                + '\n\nBetween\n\n```javascript\nconst second = 2;\n```\n\nAfter';
            await page.evaluate(md => (window as any).__testApi.setMarkdown(md), md);
            const blocks = page.locator('#editor pre');
            const firstCode = blocks.nth(0).locator('code');
            const secondCode = blocks.nth(1).locator('code');
            const before = await page.evaluate(() => (window as any).__testApi.getMarkdown());
            await expect(firstCode.locator('span').first()).toBeVisible();
            await firstCode.click();
            await expect(firstCode.locator('span')).toHaveCount(0);
            await secondCode.click();
            await expect(blocks.nth(0)).toHaveAttribute('data-mode', 'display');
            await expect(firstCode.locator('span').first()).toBeVisible();
            await expect(blocks.nth(1)).toHaveAttribute('data-mode', 'edit');
            await expect(secondCode.locator('span')).toHaveCount(0);
            // Moving back also restores the other block, without changing text.
            await firstCode.click();
            await expect(blocks.nth(1)).toHaveAttribute('data-mode', 'display');
            expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(before);
            await blocks.nth(0).locator('.code-copy-btn').click();
            expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(code);
            await page.locator('#editor > p').filter({ hasText: 'After' }).click();
            await expect(page.locator('#editor pre[data-mode="edit"]')).toHaveCount(0);
        });
    }
}
