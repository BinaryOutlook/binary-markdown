import { test, expect, Page } from '@playwright/test';

const source = '# Plan\n\nBefore.\n\n| Item | State | Owner |\n| --- | --- | --- |\n| One | Ready | Alex |\n| Two | Draft | Sam |\n| Three | Next | Jordan |\n\nAfter.\n';
const controls = '.table-toolbar:not(.table-toolbar-measure)';

async function setup(page: Page) {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(source => {
        (window as any).__testApi.setMarkdown(source);
        (window as any).__hostMessageHandler({ type: 'tableToolbarPosition', value: 'top-right' });
    }, source);
    await page.locator('#editor tr').nth(2).locator('td').nth(1).click();
    await expect(page.locator(`${controls} .table-coordinate-chip`)).toHaveText('B3 ▾');
}

async function unchanged(page: Page) {
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(source);
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => ['edit', 'save'].includes(message.type)))).toEqual([]);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
}

test('the compact strip keeps navigation, alignment and More outside the table gutters', async ({ page }) => {
    await setup(page);
    const bar = page.locator(controls);
    expect(await bar.evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(36);
    await expect(bar.locator('[data-action="align-left"]')).toBeVisible();
    await expect(bar.locator('[data-action="more"]')).toBeVisible();
    await expect(bar.locator('[data-action="del-row"]')).toBeHidden();
    const gutters = page.locator('.table-coordinate-gutters');
    await expect(gutters.locator('button[data-column="1"]')).toHaveText('B');
    await expect(gutters.locator('button[data-row="2"]')).toHaveText('3');
    const collision = await page.evaluate(controls => {
        const strip = document.querySelector(controls)!.getBoundingClientRect();
        return [...document.querySelectorAll('.table-coordinate-gutters button')].some(node => {
            const rect = node.getBoundingClientRect();
            return strip.left < rect.right && strip.right > rect.left && strip.top < rect.bottom && strip.bottom > rect.top;
        });
    }, controls);
    expect(collision).toBe(false);
    await unchanged(page);
});

test('gutter navigation keeps the other coordinate and never changes Markdown', async ({ page }) => {
    await setup(page);
    await page.locator('.table-coordinate-gutters [data-row="3"]').click();
    await expect(page.locator(`${controls} .table-coordinate-chip`)).toHaveText('B4 ▾');
    await page.locator('.table-coordinate-gutters [data-column="0"]').click();
    await expect(page.locator(`${controls} .table-coordinate-chip`)).toHaveText('A4 ▾');
    expect(await page.evaluate(() => (window as any).activeTableCell.textContent)).toBe('Three');
    await unchanged(page);
});

test('coordinate selectors remain keyboard reachable and Escape restores the selected cell', async ({ page }) => {
    await setup(page);
    await page.keyboard.press('Alt+F10');
    await expect(page.locator(`${controls} .table-coordinate-chip`)).toBeFocused();
    await page.keyboard.press('Enter');
    const navigation = page.locator('.table-navigation-menu');
    const rows = navigation.getByRole('combobox', { name: 'Rows', exact: true });
    await expect(rows).toBeFocused();
    await rows.selectOption({ value: '1' });
    await navigation.getByRole('combobox', { name: 'Columns', exact: true }).selectOption({ value: '2' });
    await expect(page.locator(`${controls} .table-coordinate-chip`)).toHaveText('C2 ▾');
    await page.keyboard.press('Escape');
    await expect(navigation).toBeHidden();
    expect(await page.evaluate(() => (window as any).activeTableCell.contains(getSelection()!.anchorNode))).toBe(true);
    await unchanged(page);
});

test('gutter arrows move focus and Enter navigates without adding an undo step', async ({ page }) => {
    await setup(page);
    await page.locator('.table-coordinate-gutters [data-column="1"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.table-coordinate-gutters [data-column="2"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator(`${controls} .table-coordinate-chip`)).toHaveText('C3 ▾');
    await unchanged(page);
});

for (const [action, axis, inserted] of [
    ['add-col-left', 'column', 1], ['add-col-right', 'column', 2],
    ['add-row-above', 'row', 2], ['add-row-below', 'row', 3],
] as const) {
    test(`${action}: the boundary handle inserts around the active cell and undoes once`, async ({ page }) => {
        await setup(page);
        const button = page.locator(`.table-boundary-actions [data-action="${action}"]`);
        await expect(button).toBeVisible();
        expect(await button.evaluate(node => {
            const rect = node.getBoundingClientRect();
            return node.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
        })).toBe(true);
        await button.click();
        if (axis === 'column') {
            await expect(page.locator('#editor th')).toHaveCount(4);
            await expect(page.locator('#editor tr').nth(2).locator('td').nth(inserted)).toHaveText('');
            await expect(page.locator('#editor tr').nth(2)).toContainText('Draft');
        } else {
            await expect(page.locator('#editor tr')).toHaveCount(5);
            await expect(page.locator('#editor tr').nth(inserted)).toHaveText('');
            await expect(page.locator('#editor tr').nth(action === 'add-row-above' ? 3 : 2)).toContainText('Two');
        }
        await page.locator('#toolbar [data-action="undo"]').click();
        expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(source);
        await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
    });
}

test('header restrictions apply to boundary handles and the More menu', async ({ page }) => {
    await setup(page);
    await page.locator('#editor th').nth(1).click();
    await expect(page.locator('.table-boundary-actions [data-action="add-row-above"]')).toBeDisabled();
    await page.locator(`${controls} [data-action="more"]`).click();
    await expect(page.locator('.table-overflow-menu [data-action="add-row-above"]')).toBeDisabled();
    await expect(page.locator('.table-overflow-menu [data-action="del-row"]')).toBeDisabled();
    await unchanged(page);
});

test('gutters and insertion handles disappear when the editor leaves the table', async ({ page }) => {
    await setup(page);
    await page.locator('#editor p').filter({ hasText: 'After.' }).click();
    await expect(page.locator('.table-coordinate-gutters')).toBeHidden();
    await expect(page.locator('.table-boundary-actions')).toBeHidden();
    await expect(page.locator(controls)).toBeHidden();
    await unchanged(page);
});
