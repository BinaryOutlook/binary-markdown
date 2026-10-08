import { test, expect, Page } from '@playwright/test';

const source = '# Plan\n\n| Item | State | Owner |\n| --- | --- | --- |\n| Draft outline | In progress | Alex |\n| Review notes | Ready | Sam |\n| Final pass | Next | Jordan |\n\nAfter.\n';
const themes = ['github', 'sepia', 'night', 'dark', 'minimal', 'things', 'perplexity'];

async function setup(page: Page, theme = 'night', markdown = source) {
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(({ theme, markdown }) => {
        (window as any).__hostMessageHandler({ type: 'theme', value: theme });
        (window as any).__testApi.setMarkdown(markdown);
    }, { theme, markdown });
    await page.locator('#editor tr').nth(2).locator('td').first().click();
}

async function selectWord(page: Page) {
    await page.evaluate(() => {
        const cell = document.querySelectorAll('#editor tr')[2].querySelector('td')!;
        const range = document.createRange();
        range.setStart(cell.firstChild!, 0); range.setEnd(cell.firstChild!, 6);
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    });
    await expect.poll(() => page.evaluate(() => getSelection()!.toString())).toBe('Review');
}

async function unchanged(page: Page, markdown = source) {
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(markdown);
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => ['edit', 'save'].includes(message.type)))).toEqual([]);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
}

function luminance(color: string) {
    const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

for (const theme of themes) {
    test(`${theme}: selected characters are distinct and readable without editing`, async ({ page }) => {
        await setup(page, theme);
        await selectWord(page);
        const colors = await page.locator('#editor tr').nth(2).locator('td').first().evaluate(cell => {
            const selection = getComputedStyle(cell, '::selection');
            return { cell: getComputedStyle(cell).backgroundColor, selection: selection.backgroundColor, text: selection.color };
        });
        expect(colors.selection).not.toBe(colors.cell);
        const light = Math.max(luminance(colors.selection), luminance(colors.text));
        const dark = Math.min(luminance(colors.selection), luminance(colors.text));
        expect((light + 0.05) / (dark + 0.05)).toBeGreaterThanOrEqual(4.5);
        expect(await page.evaluate(() => getSelection()!.toString())).toBe('Review');
        expect(colors.cell).not.toBe('rgba(0, 0, 0, 0)');
        await unchanged(page);
    });
}

test('context shading, gutter highlights and the cell outline stay visible through text selection', async ({ page }) => {
    await setup(page);
    const cell = page.locator('#editor tr').nth(2).locator('td').first();
    const initial = await cell.evaluate(node => getComputedStyle(node).backgroundColor);
    await selectWord(page);
    await expect(page.locator('.table-coordinate-gutters [data-row="2"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.table-coordinate-gutters [data-column="0"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await cell.evaluate(node => getComputedStyle(node).boxShadow)).not.toBe('none');
    expect(await cell.evaluate(node => getComputedStyle(node).backgroundColor)).toBe(initial);
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => getSelection()!.isCollapsed)).toBe(true);
    expect(await cell.evaluate(node => getComputedStyle(node).backgroundColor)).toBe(initial);
    await unchanged(page);
});

test('changing themes preserves the exact text range, source and undo state', async ({ page }) => {
    await setup(page);
    await selectWord(page);
    for (const theme of themes) {
        await page.evaluate(theme => (window as any).__hostMessageHandler({ type: 'theme', value: theme }), theme);
        expect(await page.evaluate(() => {
            const selection = getSelection()!;
            return [selection.anchorOffset, selection.focusOffset, selection.toString()];
        })).toEqual([0, 6, 'Review']);
    }
    await unchanged(page);
});

test('selected bold and link text use the same readable foreground', async ({ page }) => {
    const inline = source.replace('Review notes', '**Review** [notes](https://example.com/notes)');
    await setup(page, 'night', inline);
    await page.evaluate(() => {
        const cell = document.querySelectorAll('#editor tr')[2].querySelector('td')!;
        const range = document.createRange(); range.setStart(cell.querySelector('strong')!.firstChild!, 1); range.setEnd(cell.querySelector('a')!.firstChild!, 2);
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    });
    const colors = await page.locator('#editor tr').nth(2).locator('td').first().locator('strong,a').evaluateAll(nodes => nodes.map(node => getComputedStyle(node, '::selection').color));
    expect(colors[0]).toBe(colors[1]);
    expect(await page.evaluate(() => getSelection()!.toString())).toBe('eview no');
    await unchanged(page, inline);
});

test('moving between tables removes the previous table’s context decoration', async ({ page }) => {
    const twoTables = source + '\n' + source.replace('# Plan', '# Second');
    await setup(page, 'night', twoTables);
    await selectWord(page);
    await page.locator('#editor table').nth(1).locator('td').first().click();
    await expect(page.locator('#editor table').first()).not.toHaveClass(/table-inspected/);
    await expect(page.locator('#editor table').first().locator('.table-context-row,.table-context-column')).toHaveCount(0);
    await unchanged(page, twoTables);
});

test('table selection colors do not change the surrounding prose', async ({ page }) => {
    await setup(page);
    const colors = await page.evaluate(() => {
        const cell = document.querySelector('#editor td')!;
        const prose = document.querySelector('#editor p')!;
        return { table: getComputedStyle(cell, '::selection').backgroundColor, prose: getComputedStyle(prose, '::selection').backgroundColor };
    });
    expect(colors.table).not.toBe(colors.prose);
    await unchanged(page);
});
