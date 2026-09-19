import { test, expect, Page } from '@playwright/test';
import * as path from 'node:path';
import { prepareStandaloneHtml } from '../../src/export/html';

const headers = Array.from({ length: 8 }, (_, i) => `Column ${i + 1}`);
const values = headers.map((_, i) => `VALUE_${i + 1}_${'x'.repeat(28)}`);
const tableSource = `| ${headers.join(' | ')} |\n| :--- | :---: | ---: | --- | --- | --- | --- | --- |\n| ${values.join(' | ')} |\n| **Bold** | *Emphasis* | \`code\` | [Link](https://example.invalid) | Five | Six | Seven | Eight |\n`;
const source = '# Wide table\n\nBefore.\n\n' + tableSource + '\nAfter.\n';

async function setup(page: Page, markdown = source) {
    await page.setViewportSize({ width: 620, height: 560 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(text => {
        document.documentElement.dataset.toolbarMode = 'full';
        (window as any).__testApi.setMarkdown(text);
    }, markdown);
}

async function cells(page: Page) {
    return page.locator('#editor th, #editor td').evaluateAll(nodes => nodes.map(node => ({
        tag: node.tagName, text: node.textContent, align: (node as HTMLElement).style.textAlign,
    })));
}

async function selectedCell(page: Page) {
    return page.evaluate(() => {
        const anchor = getSelection()?.anchorNode;
        const cell = (anchor?.nodeType === 3 ? anchor.parentElement : anchor as Element)?.closest('td,th') as HTMLTableCellElement;
        const table = cell.closest('table')!;
        const bounds = table.getBoundingClientRect();
        const wrapper = document.getElementById('editorWrapper')!.getBoundingClientRect();
        const caret = getSelection()!.getRangeAt(0).getBoundingClientRect();
        const visible = caret.height > 0 && caret.left >= Math.max(bounds.left, wrapper.left, 0) - 1 &&
            caret.right <= Math.min(bounds.right, wrapper.right, innerWidth) + 1;
        return { index: (cell.parentElement as HTMLTableRowElement).rowIndex * 8 + cell.cellIndex,
            visible };
    });
}

for (const nested of [false, true]) test(`${nested ? 'nested' : 'ordinary'} wide table scrolls locally without editing`, async ({ page }) => {
    // Mixed blockquotes already use the block parser; table-only quotes do not.
    const markdown = nested ? '> ```text\n> Context\n> ```\n>\n' + tableSource.trimEnd().split('\n').map(line => '> ' + line).join('\n') + '\n\nAfter.\n' : source;
    await setup(page, markdown);
    const table = page.locator('#editor table');
    await expect(table).toHaveCount(1);
    await expect(page.getByRole('table')).toHaveCount(1);
    const before = await page.evaluate(() => (window as any).htmlToMarkdown());
    const geometry = await table.evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth, overflow: getComputedStyle(node).overflowX,
        wrapperWidth: document.getElementById('editorWrapper')!.clientWidth, wrapperScrollWidth: document.getElementById('editorWrapper')!.scrollWidth }));
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.width);
    expect(geometry.overflow).toBe('auto');
    expect(geometry.wrapperScrollWidth).toBeLessThanOrEqual(geometry.wrapperWidth + 1);
    for (const cell of await table.locator('th,td').all()) {
        await cell.scrollIntoViewIfNeeded();
        await cell.click();
        expect(await cell.evaluate(node => node.contains(getSelection()?.anchorNode || null))).toBe(true);
    }
    await page.setViewportSize({ width: 490, height: 400 });
    await table.locator('td').last().scrollIntoViewIfNeeded();
    await table.locator('td').last().click();
    await page.setViewportSize({ width: 1200, height: 800 });
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => ['edit', 'save'].includes(m.type)))).toEqual([]);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'captureExportSnapshot', requestId: 'unmodified-table' }));
    expect(await page.evaluate(() => (window as any).__testApi.messages.find((m: any) => m.requestId === 'unmodified-table')))
        .toMatchObject({ content: markdown, pending: false });
});

test('Tab and Shift+Tab reveal each selected cell without adding undo', async ({ page }) => {
    await setup(page);
    await page.locator('#editor th').first().click();
    for (let i = 1; i < 24; i++) {
        await page.keyboard.press('Tab');
        const state = await selectedCell(page);
        expect(state.index).toBe(i);
        expect(state.visible, `Caret in cell ${i} is visible`).toBe(true);
    }
    for (let i = 22; i >= 0; i--) {
        await page.keyboard.press('Shift+Tab');
        expect(await selectedCell(page), `Shift+Tab reveals cell ${i}`).toEqual({ index: i, visible: true });
    }
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('header navigation skips resize handles and keeps typing undoable', async ({ page }) => {
    await setup(page);
    await page.locator('#editor th').first().click();
    await page.keyboard.press('Tab');
    await page.keyboard.type(' updated');
    await expect(page.locator('#editor th').nth(1)).toHaveText('Column 2 updated');
    await expect(page.locator('#editor th .table-col-resize-handle')).toHaveCount(8);
    await page.locator('#toolbar [data-action="undo"]').click();
    await expect(page.locator('#editor th').nth(1)).toHaveText('Column 2');
});

test('sidebar and window changes retain the active cell and Escape reveals its caret', async ({ page }) => {
    await setup(page);
    await page.locator('#editor th').first().click();
    for (let i = 0; i < 13; i++) await page.keyboard.press('Tab');
    await page.keyboard.press('Alt+F10');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.table-toolbar, .table-toolbar-dock')))).toBe(true);
    if (await page.locator('.table-toolbar-toggle').evaluate(node => node === document.activeElement)) await page.keyboard.press('Enter');
    await page.setViewportSize({ width: 500, height: 450 });
    await page.evaluate(() => { document.querySelector<HTMLElement>('.sidebar')!.style.width = '300px'; });
    await page.keyboard.press('Escape');
    expect(await selectedCell(page)).toEqual({ index: 13, visible: true });
    await page.evaluate(() => document.querySelector('.sidebar')!.classList.add('hidden'));
    await page.keyboard.press('Tab');
    expect(await selectedCell(page)).toEqual({ index: 14, visible: true });
    await page.keyboard.press('ArrowDown');
    expect(await selectedCell(page)).toEqual({ index: 22, visible: true });
    await page.keyboard.press('ArrowUp');
    expect(await selectedCell(page)).toEqual({ index: 14, visible: true });
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('Alt+F10 focuses newly selected table controls before their next layout frame', async ({ page }) => {
    await setup(page);
    const focused = await page.evaluate(() => {
        const cell = document.querySelector('#editor td')!;
        const range = document.createRange();
        range.selectNodeContents(cell.firstChild!);
        range.collapse(true);
        document.getElementById('editor')!.focus();
        getSelection()!.removeAllRanges();
        getSelection()!.addRange(range);
        // Selection capture schedules toolbar layout. A keyboard command must
        // also work when it arrives before that animation frame has executed.
        document.dispatchEvent(new Event('selectionchange'));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', altKey: true, bubbles: true, cancelable: true }));
        return Boolean(document.activeElement?.closest('.table-toolbar, .table-toolbar-dock'));
    });
    expect(focused).toBe(true);
    if (await page.locator('.table-toolbar-toggle').evaluate(node => node === document.activeElement)) await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    expect(await selectedCell(page)).toEqual({ index: 8, visible: true });
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('column resizing preserves column alignment and local scrolling', async ({ page }) => {
    await setup(page, '| First | Second | Third |\n| --- | --- | --- |\n| One | Two | Three |\n');
    await page.setViewportSize({ width: 1000, height: 700 });
    const before = await cells(page);
    const handle = page.locator('#editor th .table-col-resize-handle').first();
    const start = (await handle.boundingBox())!;
    const oldWidth = await page.locator('#editor th').first().evaluate(node => node.getBoundingClientRect().width);
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 120, start.y + start.height / 2);
    await page.mouse.up();
    const newWidth = await page.locator('#editor th').first().evaluate(node => node.getBoundingClientRect().width);
    expect(newWidth).toBeGreaterThan(oldWidth + 80);
    await page.setViewportSize({ width: 520, height: 400 });
    await page.locator('#editor td').last().scrollIntoViewIfNeeded();
    await page.locator('#editor td').last().click();
    expect(await cells(page)).toEqual(before);
    expect(await page.locator('#editorWrapper').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
});

test('scroll, source switching, unrelated editing and save/reopen preserve table cells and alignment', async ({ page }) => {
    await setup(page);
    const before = await cells(page);
    await page.locator('#editor table').evaluate(table => { table.scrollLeft = table.scrollWidth; });
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
    await expect(page.locator('#sourceEditor')).toHaveValue(source);
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
    await page.locator('#editor > p').filter({ hasText: 'After.' }).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' updated');
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })));
    const saved = await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'save').at(-1));
    expect(saved.content).toContain('After. updated');
    expect(saved.content).not.toMatch(/contenteditable|resize-handle|scrollbar|\.\.\./);
    await page.evaluate(saved => {
        (window as any).__hostMessageHandler({ type: 'saveResult', revision: saved.revision, success: true });
        (window as any).__testApi.setMarkdown(saved.content);
    }, saved);
    expect(await cells(page)).toEqual(before);
    for (let i = 0; i < 8; i++) {
        const position = await page.locator('#editor table').evaluate((table, i) => {
            const header = table.querySelectorAll('th')[i].getBoundingClientRect();
            const body = table.querySelectorAll('td')[i].getBoundingClientRect();
            return { start: Math.abs(header.left - body.left), width: Math.abs(header.width - body.width) };
        }, i);
        expect(position.start).toBeLessThan(1);
        expect(position.width).toBeLessThan(1);
    }
});

test('local scrolling stays out of prepared HTML and printed table layout', async ({ page, context }) => {
    await setup(page);
    await page.evaluate(source => (window as any).__hostMessageHandler({ type: 'prepareExport', requestId: 'table-export', markdown: source, theme: 'github', fontSize: 16 }), source);
    await expect.poll(() => page.evaluate(() => (window as any).__testApi.messages.some((m: any) => m.type === 'exportPrepared'))).toBe(true);
    const prepared = await page.evaluate(() => (window as any).__testApi.messages.find((m: any) => m.type === 'exportPrepared'));
    expect(prepared.html).not.toMatch(/contenteditable|resize-handle/);
    const html = await prepareStandaloneHtml({ sourcePath: path.resolve('table.md'), markdown: source, version: 1, theme: 'github', fontSize: 16 }, prepared, process.cwd(), {
        signal: new AbortController().signal, report() {}, warnings: [], loadResource: async () => { throw new Error('No external resources'); },
    });
    const exported = await context.newPage();
    try {
        await exported.setContent(html);
        for (const media of ['screen', 'print'] as const) {
            await exported.emulateMedia({ media });
            expect(await exported.locator('table').evaluate(table => ({ display: getComputedStyle(table).display, overflow: getComputedStyle(table).overflowX })))
                .toEqual({ display: 'table', overflow: 'visible' });
            await expect(exported.locator('th,td')).toHaveCount(24);
            for (const value of values) await expect(exported.getByText(value, { exact: true })).toBeVisible();
        }
    } finally { await exported.close(); }
});
