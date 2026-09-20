import { test, expect, Page } from '@playwright/test';
const { source, geometry } = require('../native/editor-width.cjs');

async function setup(page: Page, width = 1500) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(source => {
        (window as any).__testApi.setMarkdown(source);
        document.getElementById('closeSidebar')!.click();
    }, source);
}

async function set(page: Page, mode: unknown, maxWidth: unknown) {
    await page.evaluate(({ mode, maxWidth }) => (window as any).__hostMessageHandler({ type: 'editorWidth', mode, maxWidth }), { mode, maxWidth });
}

for (const pane of [320, 650, 1600]) for (const mode of ['default', 'custom', 'full']) {
    test(`${mode}: pane ${pane} adapts to sidebar and font size without whole-pane clipping`, async ({ page }) => {
        await setup(page, pane);
        await set(page, mode, 1100);
        const before = await page.evaluate(() => (window as any).htmlToMarkdown());
        for (const font of [14, 26]) for (const sidebar of [false, true]) {
            await page.evaluate(({ font, sidebar }) => {
                document.documentElement.style.setProperty('--font-size', font + 'px');
                const outline = document.getElementById('sidebar')!;
                outline.classList.toggle('hidden', !sidebar); outline.style.width = '120px';
            }, { font, sidebar });
            await expect.poll(() => page.evaluate(geometry).then((box: any) => {
                const width = mode === 'full' ? box.pane : Math.min(box.pane, mode === 'custom' ? 1100 : 860);
                return Math.abs(box.width - width) < 1 && Math.abs(box.left - (box.pane - box.width) / 2) < 1;
            })).toBe(true);
            const box = await page.evaluate(geometry);
            expect(box.padding).toBeLessThanOrEqual(60);
            if (pane === 320) expect(box.padding).toBeLessThan(25);
            expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
            expect(await page.evaluate(() => document.getElementById('editorWrapper')!.scrollWidth <= document.getElementById('editorWrapper')!.clientWidth + 1)).toBe(true);
        }
        expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'edit'))).toEqual([]);
    });
}

test('invalid preferences fall back safely; default ignores the remembered custom width', async ({ page }) => {
    await setup(page);
    for (const invalid of [null, '1000', -1, 0, 319, 4001, 900.5, 'none;display:none']) {
        await set(page, 'custom', invalid);
        expect((await page.evaluate(geometry)).maximum).toBe('860px');
    }
    await set(page, 'arbitrary', 1000);
    expect((await page.evaluate(geometry)).maximum).toBe('860px');
    await set(page, 'custom', 4000);
    expect((await page.evaluate(geometry)).maximum).toBe('4000px');
    await set(page, 'default', 320);
    expect((await page.evaluate(geometry)).maximum).toBe('860px');
});

test('live width changes preserve nodes, selection, clean state, and undo/redo', async ({ page }) => {
    await setup(page);
    const { widthChecks } = require('../native/editor-width.cjs');
    await widthChecks({ editor: page, set: async (key: string, value: unknown) => {
        const settings = await page.evaluate(() => ({ mode: document.documentElement.dataset.editorWidthMode, maxWidth: Number(document.documentElement.dataset.editorMaxWidth) }));
        await set(page, key === 'editorWidthMode' ? value : settings.mode, key === 'editorMaxWidth' ? value : settings.maxWidth);
    }, until: async (probe: () => Promise<boolean>) => expect.poll(probe).toBe(true), record: () => {} });
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'edit'))).toEqual([]);
    await expect(page.locator('[data-action="undo"]')).toBeDisabled();
    await page.keyboard.insertText('changed');
    await expect(page.locator('[data-action="undo"]')).toBeEnabled();
    const edited = await page.evaluate(() => (window as any).htmlToMarkdown());
    await set(page, 'full', 4000);
    await set(page, 'custom', 500);
    await page.locator('[data-action="undo"]').click();
    await expect(page.locator('#editor > p').filter({ hasText: /^Plain target\.$/ })).toHaveText('Plain target.');
    await page.locator('[data-action="redo"]').click();
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(edited);
});

test('source layout and export preparation stay independent of editor width', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
    const before = await page.locator('#sourceEditor').evaluate(node => ({ maximum: getComputedStyle(node).maxWidth, width: node.getBoundingClientRect().width, text: (node as HTMLTextAreaElement).value }));
    await set(page, 'custom', 320);
    expect(await page.locator('#sourceEditor').evaluate(node => ({ maximum: getComputedStyle(node).maxWidth, width: node.getBoundingClientRect().width, text: (node as HTMLTextAreaElement).value }))).toEqual(before);
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
    const outputs = [];
    for (const mode of ['default', 'custom', 'full']) {
        await set(page, mode, 320);
        await page.evaluate(({ source, mode }) => (window as any).__hostMessageHandler({ type: 'prepareExport', requestId: mode, markdown: source, theme: 'github', fontSize: 16 }), { source, mode });
        await expect.poll(() => page.evaluate(mode => (window as any).__testApi.messages.some((m: any) => m.type === 'exportPrepared' && m.requestId === mode), mode)).toBe(true);
        outputs.push(await page.evaluate(mode => (window as any).__testApi.messages.find((m: any) => m.type === 'exportPrepared' && m.requestId === mode).html, mode));
    }
    expect(outputs[0]).toBe(outputs[1]); expect(outputs[1]).toBe(outputs[2]);
});

test('a visible caret retains its screen position after a width change', async ({ page }) => {
    await setup(page);
    await page.locator('#editor p').filter({ hasText: 'End marker.' }).scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => {
        const paragraph = [...document.querySelectorAll('#editor p')].find(node => node.textContent === 'End marker.')!, range = document.createRange();
        range.setStart(paragraph.firstChild!, 3); range.collapse(true);
        document.getElementById('editor')!.focus(); getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
        return range.getBoundingClientRect().top;
    });
    await set(page, 'custom', 320);
    const after = await page.evaluate(() => getSelection()!.getRangeAt(0).getBoundingClientRect().top);
    expect(Math.abs(after - before)).toBeLessThan(2);
});
