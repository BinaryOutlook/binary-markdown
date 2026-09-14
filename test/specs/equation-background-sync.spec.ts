import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.goto('/standalone-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.addScriptTag({ url: '/vendor/katex.min.js' });
    await page.addStyleTag({ url: '/vendor/katex.min.css' });
    await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
});

for (const pending of ['outline refresh', 'document synchronization']) {
    test(`pending ${pending} leaves an inline equation edit cancellable`, async ({ page }) => {
        const source = 'Before \\(x^2\\) after\n';
        await page.evaluate(md => (window as any).__testApi.setMarkdown(md), source);
        await page.locator('#editor .math-inline').click();
        await page.locator('.math-inline-input').fill('y^3');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Control+z');
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);

        await page.locator('#editor .math-inline').click();
        await page.locator('.math-inline-input').fill('cancelled');
        if (pending === 'document synchronization') {
            await page.evaluate(() => (window as any).__testApi.syncMarkdown());
        }
        // Run the earlier edit's queued notification, or the queued document
        // synchronization, while the new equation input is still active.
        await page.clock.runFor(400);
        await expect(page.locator('.math-inline-input')).toBeFocused();
        await expect(page.locator('.math-inline-input')).toHaveValue('cancelled');
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
        await page.keyboard.press('Escape');
        await expect(page.locator('.math-inline-input')).toHaveCount(0);
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
    });
}
