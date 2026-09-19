import { test, expect, Page } from '@playwright/test';
const { toolbarGeometry } = require('../native/text-toolbar.cjs');

const source = '# Table context\n\nBefore.\n\n| Item | State |\n| --- | --- |\n| One | Ready |\n| Two | Draft |\n\nAfter.\n';
const controls = '.table-toolbar:not(.table-toolbar-measure)';

async function setup(page: Page, mode = 'full', position = 'top-bar', width = 1400) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(({ source, mode, position }) => {
        (window as any).__testApi.setMarkdown(source);
        (window as any).__hostMessageHandler({ type: 'toolbarMode', value: mode });
        (window as any).__hostMessageHandler({ type: 'tableToolbarPosition', value: position });
    }, { source, mode, position });
    await expect(page.locator('.table-toolbar-row')).toBeHidden();
    await page.locator('#editor td').first().click();
    await expect(page.locator(controls)).toHaveAttribute('data-placement', /.+/);
}

async function geometry(page: Page) {
    await expect.poll(() => page.evaluate(() => {
        const header = document.getElementById('toolbar')!.getBoundingClientRect();
        const row = document.querySelector<HTMLElement>('.table-toolbar-row')!;
        const dock = document.querySelector<HTMLElement>('.table-toolbar-dock')!;
        const wrapper = document.getElementById('editorWrapper')!.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const parent = row.hidden ? header : rowRect;
        const visible = [...dock.querySelectorAll('button')].filter(button => button.getClientRects().length);
        return {
            wrapperBelow: Math.abs(wrapper.top - (row.hidden ? header.bottom : rowRect.bottom)) <= 1,
            rowBelow: row.hidden || Math.abs(rowRect.top - header.bottom) <= 1,
            buttonsFit: dock.hidden || visible.every(button => {
                const rect = button.getBoundingClientRect();
                return rect.left >= parent.left && rect.right <= parent.right + .5 && rect.top >= parent.top && rect.bottom <= parent.bottom + .5;
            }),
        };
    })).toEqual({ wrapperBelow: true, rowBelow: true, buttonsFit: true });
    await expect.poll(() => page.evaluate(toolbarGeometry).then((state: any) => [state.clipped, state.overlaps])).toEqual([[], []]);
}

for (const mode of ['simple', 'full']) {
    for (const position of ['auto', 'top-bar', 'left']) {
        for (const width of [600, 1400]) {
            test(`${mode}/${position}/${width}: context uses only its required rows`, async ({ page }) => {
                await setup(page, mode, position, width);
                const before = await page.evaluate(() => (window as any).htmlToMarkdown());
                const placement = await page.locator(controls).getAttribute('data-placement');
                await expect(page.locator('.table-toolbar-row')).toBeVisible({ visible: mode === 'full' && placement === 'top-bar' });
                if (placement === 'top-bar') await expect(page.locator(`${mode === 'full' ? '.table-toolbar-row' : '#toolbar'} > .table-toolbar-dock`)).toBeVisible();
                await geometry(page);
                await page.locator('#editor p').filter({ hasText: /^After\.$/ }).click();
                await expect(page.locator('.table-toolbar-row')).toBeHidden();
                await expect(page.locator(controls)).toBeHidden();
                await geometry(page);
                await page.locator('#editor td').first().click();
                await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
                await expect(page.locator('.table-toolbar-row')).toBeHidden();
                await expect(page.locator('.table-toolbar-dock')).toBeHidden();
                await expect(page.locator('#sourceEditor')).toHaveValue(source);
                await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
                expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
                await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
                expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => message.type === 'edit'))).toEqual([]);
            });
        }
    }
}

test('mode changes preserve focused table controls and an open placement menu', async ({ page }) => {
    await setup(page);
    await page.keyboard.press('Alt+F10');
    const first = page.locator(`${controls} [data-action="add-col-left"]`);
    await expect(first).toBeFocused();
    for (const mode of ['simple', 'full']) {
        await page.evaluate(value => (window as any).__hostMessageHandler({ type: 'toolbarMode', value }), mode);
        await expect(first).toBeFocused();
        await expect(page.locator('.table-toolbar-row')).toBeVisible({ visible: mode === 'full' });
    }
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    const auto = page.locator('.table-placement-menu [data-position="auto"]');
    await expect(auto).toBeFocused();
    for (const mode of ['simple', 'full']) {
        await page.evaluate(value => (window as any).__hostMessageHandler({ type: 'toolbarMode', value }), mode);
        await expect(auto).toBeFocused();
        await page.setViewportSize({ width: mode === 'simple' ? 600 : 390, height: 420 });
        await expect(auto).toBeInViewport();
        await geometry(page);
    }
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.querySelector('#editor td')!.contains(getSelection()!.anchorNode))).toBe(true);
});

test('second-row overflow responds to sidebar changes and clears with table context', async ({ page }) => {
    await setup(page, 'full', 'top-bar', 750);
    await page.locator('#sidebar').evaluate(node => { node.classList.remove('hidden'); node.style.width = '440px'; });
    const more = page.locator(`${controls} [data-action="more"]`);
    await expect(more).toBeVisible();
    await more.click();
    await page.keyboard.press('End');
    await expect(page.locator('.table-overflow-menu [data-action="placement"]')).toBeFocused();
    await page.locator('#sidebar').evaluate(node => { node.classList.add('hidden'); node.style.width = ''; });
    await expect(page.locator(`${controls} [data-action="placement"]`)).toBeFocused();
    await expect(page.locator('.table-overflow-menu')).toBeHidden();
    await geometry(page);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 300, height: 420 });
    await more.click();
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
    await expect(page.locator('.table-toolbar-row')).toBeHidden();
    await expect(page.locator('.table-overflow-menu')).toBeHidden();
});

test('docking leaves one undo step for the actual table edit and both rows are keyboard reachable', async ({ page }) => {
    await setup(page);
    const before = await page.evaluate(() => (window as any).htmlToMarkdown());
    await page.locator('#toolbar [data-action="source"]').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator(`${controls} [data-action="add-col-left"]`)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.locator('#editor th')).toHaveCount(3);
    for (const value of ['simple', 'full']) await page.evaluate(value => (window as any).__hostMessageHandler({ type: 'toolbarMode', value }), value);
    await page.locator('#toolbar [data-action="undo"]').click();
    await expect(page.locator('#editor th')).toHaveCount(2);
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('Automatic docking remains stable after the contextual row changes viewport height', async ({ page }) => {
    await setup(page, 'full', 'auto', 600);
    await expect(page.locator(controls)).toHaveAttribute('data-placement', 'top-bar');
    const placements = await page.evaluate(async controls => {
        const result = [];
        for (let frame = 0; frame < 30; frame++) {
            await new Promise(requestAnimationFrame);
            result.push(document.querySelector<HTMLElement>(controls)!.dataset.placement);
        }
        return result;
    }, controls);
    expect(new Set(placements)).toEqual(new Set(['top-bar']));
    await geometry(page);
});

test('layout changes retain the primary More button focus with a contextual row', async ({ page }) => {
    await setup(page, 'full', 'top-bar', 600);
    const more = page.locator('#toolbarMore');
    await more.focus();
    await page.evaluate(async () => {
        window.dispatchEvent(new Event('resize'));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await expect(more).toBeFocused();
    await expect(page.locator('.table-toolbar-row')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#toolbarOverflow')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(more).toBeFocused();
});
