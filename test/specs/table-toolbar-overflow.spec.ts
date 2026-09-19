import { test, expect, Page } from '@playwright/test';

const source = '# Table\n\n| Item | State | Owner |\n| --- | --- | --- |\n| One | Ready | A |\n| Two | Draft | B |\n\nAfter table.\n';
const controls = '.table-toolbar:not(.table-toolbar-measure)';
const overflow = '.table-overflow-menu';

async function setup(page: Page, position: string) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(({ source, position }) => {
        (window as any).__testApi.setMarkdown(source);
        (window as any).__hostMessageHandler({ type: 'tableToolbarPosition', value: position });
    }, { source, position });
    await page.locator('#editor td').first().click();
    await expect(page.locator(controls)).toHaveAttribute('data-placement', position);
}

async function wholeButtons(page: Page) {
    await expect.poll(() => page.locator(controls).evaluate(toolbar => {
        const bounds = toolbar.getBoundingClientRect();
        return [...toolbar.querySelectorAll('button')].filter(button => button.getClientRects().length).every(button => {
            const rect = button.getBoundingClientRect();
            return rect.left >= bounds.left && rect.right <= bounds.right + 0.5 && rect.top >= bounds.top && rect.bottom <= bounds.bottom + 0.5;
        });
    })).toBe(true);
}

for (const position of ['top-left', 'left']) {
    test(`${position}: shrink and expand keep complete leading actions and preserve the document`, async ({ page }) => {
        await setup(page, position);
        const before = await page.evaluate(() => (window as any).htmlToMarkdown());
        await page.setViewportSize({ width: 420, height: 260 });
        await page.locator('#editor td').first().scrollIntoViewIfNeeded();
        const more = page.locator(`${controls} [data-action="more"]`);
        await expect(more).toBeVisible();
        await wholeButtons(page);
        await more.click();
        await expect(page.locator(overflow)).toBeVisible();
        const distribution = await page.evaluate(({ controls, overflow }) => {
            const visible = (selector: string) => [...document.querySelectorAll<HTMLButtonElement>(selector)].filter(button => button.getClientRects().length).map(button => button.dataset.action);
            return { main: visible(`${controls} button:not([data-action="more"])`), menu: visible(`${overflow} button`) };
        }, { controls, overflow });
        const actions = ['add-col-left', 'add-col-right', 'del-col', 'add-row-above', 'add-row-below', 'del-row', 'align-left', 'align-center', 'align-right', 'placement'];
        expect([...distribution.main, ...distribution.menu]).toEqual(actions);
        await page.keyboard.press('Escape');
        await page.setViewportSize({ width: 1280, height: 900 });
        await expect(more).toBeHidden();
        await wholeButtons(page);
        expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
        expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => ['edit', 'save'].includes(message.type)))).toEqual([]);
        await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
        await expect(page.locator('html')).toHaveAttribute('data-table-toolbar-position', position);
    });
}
