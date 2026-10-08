import { test, expect, Page } from '@playwright/test';

const source = '# Table\n\n| Item | State | Owner |\n| --- | --- | --- |\n| One | Ready | A |\n| Two | Draft | B |\n\nAfter table.\n';
const controls = '.table-toolbar:not(.table-toolbar-measure)';
const overflow = '.table-overflow-menu';
const { tableOverflowChecks, installedEditor } = require('../native/table-toolbar-overflow.cjs');

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

async function partialDock(page: Page) {
    await page.setViewportSize({ width: 740, height: 800 });
    await expect(page.locator(`${controls} [data-action="more"]`)).toBeVisible();
    await expect(page.locator(`${controls} .table-coordinate-chip`)).toBeVisible();
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

test('shared native overflow checks exercise reachable actions and undo', async ({ page }) => {
    await setup(page, 'top-left');
    const receipts: string[] = [];
    await tableOverflowChecks({
        editor: page,
        keyboard: page.keyboard,
        resize: (width: number, height: number) => page.setViewportSize({ width, height }),
        setPosition: (value: string) => page.evaluate(value => {
            (window as any).__hostMessageHandler({ type: 'tableToolbarPosition', value });
        }, value),
        record: (name: string) => receipts.push(name),
    });
    expect(receipts).toEqual(['table-overflow', 'table-overflow', 'table-overflow-action']);
});

for (const classicScrollbars of [false, true]) {
    test(`installed overflow checks preserve complete actions in a pane that cannot grow beyond 458px (${classicScrollbars ? 'classic' : 'overlay'} scrollbars)`, async ({ page }) => {
        await setup(page, 'top-left');
        // Simulate platform form controls whose populated selects have a larger
        // intrinsic minimum than the empty measuring copies.
        if (classicScrollbars) await page.addStyleTag({ content: '::-webkit-scrollbar { width: 17px; height: 17px; } .table-selection-inspector select:has(option) { min-width: 48px; }' });
        const nativeSource = '# Table controls\n\n| Item | State |\n| --- | --- |\n| One | Ready |\n| Two | Draft |\n';
        await page.evaluate(source => (window as any).__testApi.setMarkdown(source), nativeSource);
        const until = (probe: () => Promise<boolean>, message: string) => expect.poll(probe, { message }).toBe(true);
        const editor = installedEditor({ evaluate: (expression: string) => page.evaluate(expression) }, { until });
        const receipts: string[] = [];
        await tableOverflowChecks({
            editor, keyboard: page.keyboard, canEnlargeWindow: false,
            resize: (width: number, height: number) => page.setViewportSize({ width: Math.min(458, width), height: Math.min(664, height) }),
            setPosition: (value: string) => page.evaluate(value => (window as any).__hostMessageHandler({ type: 'tableToolbarPosition', value }), value),
            record: (name: string) => receipts.push(name),
        });
        expect(receipts).toEqual(['table-overflow', 'table-overflow', 'table-overflow-action']);
    });
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
            return { main: visible(`${controls} button[data-action]:not([data-action="more"])`), menu: visible(`${overflow} button`) };
        }, { controls, overflow });
        const actions = ['add-col-left', 'add-col-right', 'add-row-above', 'add-row-below', 'align-left', 'align-center', 'align-right', 'del-col', 'del-row', 'placement'];
        expect([...distribution.main, ...distribution.menu].sort()).toEqual([...actions].sort());
        await page.keyboard.press('Escape');
        await page.setViewportSize({ width: 1280, height: 900 });
        await expect(more).toBeVisible();
        await wholeButtons(page);
        expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
        expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => ['edit', 'save'].includes(message.type)))).toEqual([]);
        await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
        await expect(page.locator('html')).toHaveAttribute('data-table-toolbar-position', position);
    });
}

test('populated row selectors keep whole arrows with classic scrollbars across narrow widths', async ({ page }) => {
    await setup(page, 'top-left');
    await page.addStyleTag({ content: '::-webkit-scrollbar { width: 17px; height: 17px; }' });
    const manyRows = '| Item | State |\n| --- | --- |\n' + Array.from({ length: 100 }, (_, i) => `| Row ${i + 1} | Ready |`).join('\n') + '\n';
    await page.evaluate(source => {
        (window as any).__testApi.setMarkdown(source);
        const cell = document.querySelector('#editor td')!;
        document.getElementById('editor')!.focus();
        const range = document.createRange(); range.selectNodeContents(cell); range.collapse(true);
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range); (cell as HTMLElement).click();
    }, manyRows);
    for (const width of [420, 410, 400, 390, 380, 370, 360]) {
        await page.setViewportSize({ width, height: 260 });
        await page.locator('#editor td').first().scrollIntoViewIfNeeded();
        await wholeButtons(page);
    }
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(manyRows);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('a focused action follows overflow in both directions without editing', async ({ page }) => {
    await setup(page, 'left');
    const before = await page.evaluate(() => (window as any).htmlToMarkdown());
    const action = page.locator(`${controls} [data-action="align-right"]`);
    await page.keyboard.press('Alt+F10');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(action).toBeFocused();
    await page.setViewportSize({ width: 420, height: 180 });
    const menuAction = page.locator(`${overflow} [data-action="align-right"]`);
    await expect(menuAction).toBeFocused();
    await expect(menuAction).toBeInViewport();
    await wholeButtons(page);
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(page.locator('.table-placement-menu')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 240 });
    await expect(page.locator('.table-placement-menu [data-position="auto"]')).toBeInViewport();
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 420, height: 180 });
    await page.locator(`${controls} [data-action="more"]`).click();
    await menuAction.focus();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(action).toBeFocused();
    await expect(page.locator(overflow)).toBeHidden();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('docked controls retain leading actions and resize an open overflow menu', async ({ page }) => {
    await setup(page, 'top-bar');
    await partialDock(page);
    const more = page.locator(`${controls} [data-action="more"]`);
    await expect(more).toBeVisible();
    await expect(page.locator(`${controls} .table-coordinate-chip`)).toBeVisible();
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
    await page.keyboard.press('Alt+F10');
    const toggle = page.locator('.table-toolbar-toggle');
    if (await toggle.isVisible()) {
        await expect(toggle.locator('svg')).toHaveAttribute('aria-hidden', 'true');
        await page.keyboard.press('Enter');
    }
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.press('End');
    const placement = page.locator(`${overflow} [data-action="placement"]`);
    await expect(placement).toBeFocused();
    await expect(placement).toBeInViewport();
    await placement.press('Enter');
    await expect(page.locator('.table-placement-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.querySelector('#editor td')?.contains(getSelection()?.anchorNode || null))).toBe(true);
});

test('a narrow dock retains row and column navigation through its coordinate chip without editing', async ({ page }) => {
    await setup(page, 'top-bar');
    const before = await page.evaluate(() => (window as any).htmlToMarkdown());
    await partialDock(page);
    await page.locator(`${controls} .table-coordinate-chip`).click();
    const rows = page.locator('.table-navigation-menu').getByRole('combobox', { name: 'Rows', exact: true });
    await expect(rows).toBeVisible();
    await rows.selectOption({ value: '2' });
    expect(await page.evaluate(() => (window as any).activeTableCell.parentElement.rowIndex)).toBe(2);
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
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
    await expect(page.locator(`${controls} [data-action="more"]`)).toBeVisible();
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
