import { test, expect, Page } from '@playwright/test';

const source = '# Table\n\n| Item | State | Owner |\n| --- | --- | --- |\n| One | Ready | A |\n| Two | Draft | B |\n\nAfter table.\n';
const controls = '.table-toolbar:not(.table-toolbar-measure)';
const overflow = '.table-overflow-menu';

async function setup(page: Page, position: string) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(({ source, position }) => {
        (window as any).__hostMessageHandler({ type: 'toolbarMode', value: 'simple' });
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

test('a focused action follows overflow in both directions without editing', async ({ page }) => {
    await setup(page, 'top-left');
    const before = await page.evaluate(() => (window as any).htmlToMarkdown());
    const action = page.locator(`${controls} [data-action="placement"]`);
    await page.keyboard.press('Alt+F10');
    await page.keyboard.press('End');
    await expect(action).toBeFocused();
    await page.setViewportSize({ width: 420, height: 260 });
    const menuAction = page.locator(`${overflow} [data-action="placement"]`);
    await expect(menuAction).toBeFocused();
    await expect(menuAction).toBeInViewport();
    await wholeButtons(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('.table-placement-menu')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 240 });
    await expect(page.locator('.table-placement-menu [data-position="auto"]')).toBeInViewport();
    await page.keyboard.press('Escape');
    await page.locator(`${controls} [data-action="more"]`).click();
    await page.keyboard.press('End');
    await expect(menuAction).toBeFocused();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(action).toBeFocused();
    await expect(page.locator(overflow)).toBeHidden();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('docked controls retain leading actions and resize an open overflow menu', async ({ page }) => {
    await setup(page, 'top-bar');
    // Leave room for the persistent Insert control while still overflowing
    // table actions; the narrower compact-menu state has its own check below.
    await page.setViewportSize({ width: 720, height: 800 });
    const more = page.locator(`${controls} [data-action="more"]`);
    await expect(more).toBeVisible();
    await expect(page.locator(`${controls} [data-action="add-col-left"]`)).toBeVisible();
    await expect(page.locator(controls)).toHaveAttribute('data-docked', 'true');
    await wholeButtons(page);
    await more.click();
    await more.click();
    await expect(page.locator(overflow)).toBeHidden();
    await expect(more).toBeFocused();
    await more.click();
    await page.setViewportSize({ width: 420, height: 260 });
    await wholeButtons(page);
    await page.keyboard.press('End');
    await expect(page.locator(`${overflow} [data-action="placement"]`)).toBeFocused();
    await expect(page.locator(`${overflow} [data-action="placement"]`)).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(page.locator('html')).toHaveAttribute('data-table-toolbar-position', 'top-bar');
});

test('compact menu reveals its last action with the keyboard in a short pane', async ({ page }) => {
    await setup(page, 'top-bar');
    await page.setViewportSize({ width: 420, height: 260 });
    const toggle = page.getByRole('button', { name: 'Table controls', exact: true });
    await expect(toggle.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    await toggle.click();
    await page.keyboard.press('End');
    const placement = page.locator(`${controls} [data-action="placement"]`);
    await expect(placement).toBeFocused();
    await expect(placement).toBeInViewport();
    await placement.press('Enter');
    await expect(page.locator('.table-placement-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.querySelector('#editor td')?.contains(getSelection()?.anchorNode || null))).toBe(true);
});

test('overflow respects header restrictions and closes on Source mode', async ({ page }) => {
    await setup(page, 'left');
    await page.locator('#editor th').first().click();
    const before = await page.evaluate(() => (window as any).htmlToMarkdown());
    await page.setViewportSize({ width: 420, height: 240 });
    await page.locator('#editor th').first().scrollIntoViewIfNeeded();
    await page.locator(`${controls} [data-action="more"]`).click();
    for (const action of ['add-row-above', 'del-row']) {
        await expect(page.locator(`${controls} [data-action="${action}"]`)).toBeDisabled();
        await expect(page.locator(`${overflow} [data-action="${action}"]`)).toBeDisabled();
    }
    await expect(page.locator(`${overflow} [data-action="del-row"]`)).toBeVisible();
    await page.keyboard.press('Home');
    expect(await page.locator(`${overflow} button:focus`).isDisabled()).toBe(false);
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
    await expect(page.locator(overflow)).toBeHidden();
    await expect(page.locator(controls)).toBeHidden();
    await expect(page.locator('#sourceEditor')).toHaveValue(source);
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
});

test('sidebar width changes recompute overflow without changing an explicit placement', async ({ page }) => {
    await setup(page, 'top-left');
    await page.setViewportSize({ width: 750, height: 600 });
    const before = await page.evaluate(() => (window as any).htmlToMarkdown());
    // Exercise the editor's ResizeObserver without resizing the outer window.
    await page.locator('#sidebar').evaluate(node => { node.classList.remove('hidden'); node.style.width = '400px'; });
    await page.locator('#editor td').first().scrollIntoViewIfNeeded();
    await expect(page.locator(`${controls} [data-action="more"]`)).toBeVisible();
    await wholeButtons(page);
    await page.locator('#sidebar').evaluate(node => { node.classList.add('hidden'); node.style.width = ''; });
    await expect(page.locator(`${controls} [data-action="more"]`)).toBeHidden();
    await wholeButtons(page);
    await expect(page.locator('html')).toHaveAttribute('data-table-toolbar-position', 'top-left');
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

for (const action of ['add-col-left', 'add-col-right', 'del-col', 'add-row-above', 'add-row-below', 'del-row', 'align-left', 'align-center', 'align-right']) {
    test(`after overflow, ${action} targets the retained cell and undoes once`, async ({ page }) => {
        await setup(page, 'top-left');
        const before = await page.evaluate(() => (window as any).htmlToMarkdown());
        await page.setViewportSize({ width: 420, height: 320 });
        await page.locator('#editor td').first().scrollIntoViewIfNeeded();
        await expect(page.locator(`${controls} [data-action="more"]`)).toBeVisible();
        const direct = page.locator(`${controls} [data-action="${action}"]`);
        if (await direct.isVisible()) await direct.click();
        else {
            await page.locator(`${controls} [data-action="more"]`).click();
            await page.locator(`${overflow} [data-action="${action}"]`).click();
        }
        await expect(page.locator('#editor tr')).toHaveCount(action.startsWith('add-row') ? 4 : action === 'del-row' ? 2 : 3);
        await expect(page.locator('#editor th')).toHaveCount(action.startsWith('add-col') ? 4 : action === 'del-col' ? 2 : 3);
        if (action.startsWith('align-')) await expect(page.locator('#editor tr').nth(1).locator('td').first()).toHaveCSS('text-align', action.slice(6));
        await page.locator('#toolbar [data-action="undo"]').click();
        expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
    });
}
