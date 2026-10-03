import { test, expect, Page } from '@playwright/test';

const source = '# Heading\n\nBefore target after.\n';
async function setup(page: Page, width = 1440) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(content => (window as any).__testApi.setMarkdown(content), source);
    await page.locator('#editor > p').evaluate(node => {
        const text = node.firstChild!;
        const start = text.textContent!.indexOf('target');
        const range = document.createRange(); range.setStart(text, start); range.setEnd(text, start + 6);
        (node as HTMLElement).focus();
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    });
}
async function search(page: Page, query: string) {
    await page.locator('#toolbarMore').click();
    await expect(page.locator('#toolbarCommandSearch')).toBeFocused();
    await page.locator('#toolbarCommandSearch').fill(query);
}

for (const width of [320, 768, 1024, 1440]) {
    test(`simplified toolbar retains command access and fits at ${width}px`, async ({ page }) => {
        await setup(page, width);
        await expect(page.locator('#insertButton, #formatButton, #toolbar [data-action="openInTextEditor"]')).toHaveCount(0);
        await expect(page.locator('#toolbarMore')).toBeVisible();
        expect(await page.locator('#contextToolbarToggle > span[aria-hidden="true"]').textContent()).toBe('>>');
        await expect(page.locator('#contextToolbarToggle svg')).toHaveCount(0);
        await search(page, 'heading');
        await expect(page.locator('[data-menu-command^="heading"]')).toHaveCount(6);
        const bounds = await page.locator('#toolbarOverflow').boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        await page.keyboard.press('Escape');
        await expect(page.locator('#toolbarMore')).toBeFocused();
        expect(await page.evaluate(() => getSelection()?.toString())).toBe('target');
        await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
    });
}

test('search finds formatting outside the overflow menu and preserves one Undo/Redo', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#toolbarInner [data-action="bold"]')).toBeVisible();
    await expect(page.locator('#toolbarOverflowItems [data-action="bold"]')).toHaveCount(0);
    await search(page, 'bold');
    await page.keyboard.press('Enter');
    await expect(page.locator('#editor b, #editor strong')).toHaveText('target');
    await expect(page.locator('#toolbarOverflow')).toBeHidden();
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(source.replace('target', '**target**'));
    await page.locator('#toolbar [data-action="undo"]').click();
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(source);
    await page.locator('#toolbar [data-action="redo"]').click();
    await expect(page.locator('#editor b, #editor strong')).toHaveText('target');
});

for (const [action, selector] of [
    ['inlineMath', '.math-inline'], ['math', '.math-wrapper'], ['codeblock', '#editor pre'],
    ['table', '#editor table'], ['mermaid', '.mermaid-wrapper'], ['toc', '.toc-block'],
]) {
    test(`command search inserts ${action} at the retained location with one Undo`, async ({ page }) => {
        await setup(page);
        await search(page, action);
        await page.locator(`[data-menu-command="${action}"]`).click();
        await expect(page.locator(selector)).toHaveCount(1);
        const after = await page.evaluate(() => (window as any).htmlToMarkdown());
        expect(after).not.toBe(source);
        await page.locator('#toolbar [data-action="undo"]').click();
        expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(source);
        await page.locator('#toolbar [data-action="redo"]').click();
        expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(after);
    });
}

test('search spans the whole catalog in Simple mode and empty results recover without edits', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toolbarMode', value: 'simple' }));
    await search(page, 'table');
    await expect(page.locator('[data-menu-command="table"]')).toBeVisible();
    await page.locator('#toolbarCommandSearch').fill('<img src=x onerror=alert(1)>');
    await expect(page.locator('#toolbarCommandResults [role="status"]')).toContainText('No matching actions');
    await expect(page.locator('#toolbarCommandResults img')).toHaveCount(0);
    await page.locator('#toolbarCommandResults').getByRole('button', { name: 'Clear search', exact: true }).click();
    await expect(page.locator('#toolbarCommandSearch')).toHaveValue('');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(source);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('Source search disables visual editing and retains source selection while view commands work', async ({ page }) => {
    await setup(page);
    await page.locator('[data-editor-mode="source"]').click();
    await page.locator('#sourceEditor').evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(14, 20));
    await search(page, 'bold');
    await expect(page.locator('[data-menu-command="bold"]')).toBeDisabled();
    await page.keyboard.press('Escape');
    expect(await page.locator('#sourceEditor').evaluate((node: HTMLTextAreaElement) => [node.selectionStart, node.selectionEnd])).toEqual([14, 20]);
    await search(page, 'viewVisual');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-editor-mode', 'visual');
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(source);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('search and keyboard result focus survive toolbar resizing', async ({ page }) => {
    await setup(page);
    await search(page, 'heading');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-menu-command="heading1"]')).toBeFocused();
    await page.setViewportSize({ width: 320, height: 600 });
    await expect(page.locator('[data-menu-command="heading1"]')).toBeFocused();
    await expect(page.locator('#toolbarCommandSearch')).toHaveValue('heading');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => getSelection()?.toString())).toBe('target');
});

test('a replaced document rejects a command from the old menu selection', async ({ page }) => {
    await setup(page);
    await search(page, 'bold');
    await page.evaluate(() => (window as any).__testApi.setMarkdown('Replacement document.\n'));
    await page.locator('[data-menu-command="bold"]').click();
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe('Replacement document.\n');
    await expect(page.locator('#editor b, #editor strong')).toHaveCount(0);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});
