import { test, expect, Page } from '@playwright/test';
const { source, alignmentChecks } = require('../native/editor-alignment.cjs');
const { geometry } = require('../native/editor-width.cjs');

async function setup(page: Page, width = 1700) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.addScriptTag({ url: '/vendor/katex.min.js' });
    await page.addStyleTag({ url: '/vendor/katex.min.css' });
    await page.evaluate(source => { (window as any).__testApi.setMarkdown(source); document.getElementById('closeSidebar')!.click(); }, source);
}
async function set(page: Page, key: string, value: unknown) {
    await page.evaluate(({ key, value }) => {
        const data = document.documentElement.dataset;
        const settings: any = { editorWidthMode: data.editorWidthMode, editorMaxWidth: Number(data.editorMaxWidth), editorAlignment: data.editorAlignment, [key]: value };
        (window as any).__hostMessageHandler({ type: 'editorWidth', mode: settings.editorWidthMode, maxWidth: settings.editorMaxWidth, alignment: settings.editorAlignment });
    }, { key, value });
}

for (const width of [350, 1700]) for (const mode of ['default', 'custom', 'full']) for (const alignment of ['left', 'center', 'right']) {
    test(`${mode}/${alignment}/${width}: only surplus pane width changes sides`, async ({ page }) => {
        await setup(page, width);
        await set(page, 'editorMaxWidth', 600); await set(page, 'editorWidthMode', mode); await set(page, 'editorAlignment', alignment);
        for (const sidebar of [false, true]) {
            await page.locator('#sidebar').evaluate((node, shown) => { node.classList.toggle('hidden', !shown); node.style.width = '120px'; }, sidebar);
            await expect.poll(async () => {
                const box = await page.evaluate(geometry), unused = box.pane - box.width;
                const expected = alignment === 'left' ? 0 : alignment === 'right' ? unused : unused / 2;
                return Math.abs(box.left - expected) < 1 && Math.abs(box.width - (mode === 'full' ? box.pane : Math.min(box.pane, mode === 'default' ? 860 : 600))) < 1;
            }).toBe(true);
        }
        expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'edit'))).toEqual([]);
    });
}

test('alignment retains text/table formatting, selection, an active equation, and table controls', async ({ page }) => {
    await setup(page);
    await alignmentChecks({ editor: page, set: (key: string, value: unknown) => set(page, key, value), until: async (probe: () => Promise<boolean>) => expect.poll(probe).toBe(true), record: () => {} });
    await expect(page.locator('[data-action="undo"]')).toBeDisabled();
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'edit'))).toEqual([]);
    await page.keyboard.insertText('changed');
    await expect(page.locator('[data-action="undo"]')).toBeEnabled();
    const edited = await page.evaluate(() => (window as any).htmlToMarkdown());
    await set(page, 'editorAlignment', 'left');
    await page.locator('[data-action="undo"]').click();
    await expect(page.locator('#editor td').first()).toHaveText('One');
    await page.locator('[data-action="redo"]').click();
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(edited);
});

test('an open language menu follows its tag through alignment and sidebar changes', async ({ page }) => {
    await setup(page); await set(page, 'editorMaxWidth', 600); await set(page, 'editorWidthMode', 'custom');
    const before = await page.evaluate(() => (window as any).htmlToMarkdown());
    await page.locator('pre[data-lang="js"] .code-lang-tag').click();
    const menu = page.locator('.lang-selector');
    await expect(menu).toBeVisible();
    for (const alignment of ['left', 'right', 'center']) {
        await set(page, 'editorAlignment', alignment);
        for (const sidebar of [false, true]) {
            await page.locator('#sidebar').evaluate((node, shown) => { node.classList.toggle('hidden', !shown); node.style.width = '320px'; }, sidebar);
            await expect.poll(() => page.evaluate(() => {
                const anchor = document.querySelector('pre[data-lang="js"] .code-lang-tag')!.getBoundingClientRect();
                const popup = document.querySelector('.lang-selector')!.getBoundingClientRect();
                return Math.abs(popup.left - Math.max(4, Math.min(anchor.left, innerWidth - popup.width - 4))) < 1 && popup.right <= innerWidth && popup.bottom <= innerHeight;
            })).toBe(true);
        }
    }
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
    await page.locator('.lang-selector-item').filter({ hasText: /^python$/ }).click();
    await expect(page.locator('#editor pre[data-lang="python"]')).toBeVisible();
});

test('invalid alignment defaults to center and leaves Source and export layout independent', async ({ page }) => {
    await setup(page); await set(page, 'editorAlignment', '<unsafe>');
    await expect(page.locator('html')).toHaveAttribute('data-editor-alignment', 'center');
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
    const bounds = await page.locator('#sourceEditor').boundingBox();
    await set(page, 'editorAlignment', 'right');
    expect(await page.locator('#sourceEditor').boundingBox()).toEqual(bounds);
    await expect(page.locator('#sourceEditor')).toHaveValue(source);
    const outputs = [];
    for (const alignment of ['left', 'center', 'right']) {
        await set(page, 'editorAlignment', alignment);
        await page.evaluate(({ source, alignment }) => (window as any).__hostMessageHandler({ type: 'prepareExport', requestId: alignment, markdown: source, theme: 'github', fontSize: 16 }), { source, alignment });
        await expect.poll(() => page.evaluate(alignment => (window as any).__testApi.messages.some((m: any) => m.type === 'exportPrepared' && m.requestId === alignment), alignment)).toBe(true);
        outputs.push(await page.evaluate(alignment => (window as any).__testApi.messages.find((m: any) => m.type === 'exportPrepared' && m.requestId === alignment).html, alignment));
    }
    expect(outputs[0]).toBe(outputs[1]); expect(outputs[1]).toBe(outputs[2]);
});
