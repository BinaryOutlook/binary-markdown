import { test, expect, Page } from '@playwright/test';
const { source, markerGeometry, indicatorChecks } = require('../native/width-indicators.cjs');
async function setup(page: Page, width = 1500) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/production-editor.html'); await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(source => { (window as any).__testApi.setMarkdown(source); document.getElementById('closeSidebar')!.click(); }, source);
}
async function set(page: Page, key: string, value: unknown) {
    await page.evaluate(({ key, value }) => {
        const d = document.documentElement.dataset;
        const s: any = { editorWidthMode: d.editorWidthMode, editorMaxWidth: Number(d.editorMaxWidth), editorAlignment: d.editorAlignment, editorWidthIndicators: d.editorWidthIndicators !== 'false', [key]: value };
        (window as any).__hostMessageHandler({ type: 'editorWidth', mode: s.editorWidthMode, maxWidth: s.editorMaxWidth, alignment: s.editorAlignment, indicators: s.editorWidthIndicators });
    }, { key, value });
}
test('live indicators follow the column, explain themselves and preserve the document', async ({ page }) => {
    await setup(page);
    await indicatorChecks({ editor: page, set: (key: string, value: unknown) => set(page, key, value), until: async (probe: () => Promise<boolean>) => expect.poll(probe).toBe(true), record: () => {} });
    await expect(page.locator('[data-action="undo"]')).toBeDisabled();
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'edit'))).toEqual([]);
});
for (const mode of ['default', 'custom']) for (const alignment of ['left', 'center', 'right']) {
    test(`${mode}/${alignment}: marks follow the cap and sidebar without threshold jitter`, async ({ page }) => {
        await setup(page); await set(page, 'editorMaxWidth', 600); await set(page, 'editorWidthMode', mode); await set(page, 'editorAlignment', alignment);
        const cap = mode === 'default' ? 860 : 600;
        for (const width of [cap + 100, cap - 1, cap, cap + 1, cap, cap + 100]) {
            await page.setViewportSize({ width, height: 800 });
            await expect.poll(async () => {
                const box = await page.evaluate(markerGeometry);
                return box.capped === (box.pane - box.column.width > 0.5) && Math.abs(box.column.left - box.marks.left) < 1 && Math.abs(box.column.right - box.marks.right) < 1;
            }).toBe(true);
            // Settled geometry is unchanged over several animation frames, not a sleep-based retry.
            const states = await page.evaluate(async () => {
                const states = [];
                for (let i = 0; i < 8; i++) { await new Promise(requestAnimationFrame); states.push(document.getElementById('editorWidthGuide')!.dataset.capped); }
                return states;
            });
            expect(new Set(states).size).toBe(1);
        }
        await page.locator('#sidebar').evaluate(node => { node.classList.remove('hidden'); node.style.width = '200px'; });
        await expect(page.locator('#editorWidthGuide')).toHaveAttribute('data-capped', 'false');
    });
}
test('hover, keyboard focus and Escape expose and dismiss the explanation without editing', async ({ page }, testInfo) => {
    await setup(page); const mark = page.getByRole('button', { name: 'Left: Width boundary indicators', exact: true });
    await mark.hover(); await expect(page.getByRole('tooltip')).toContainText('Maximum document width reached');
    await page.mouse.move(1, 500); await expect(page.getByRole('tooltip')).toBeHidden();
    await mark.focus(); await expect(page.getByRole('tooltip')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('width-boundaries.png') });
    await page.keyboard.press('Escape'); await expect(page.getByRole('tooltip')).toBeHidden(); await expect(page.locator('#editor')).toBeFocused();
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'edit'))).toEqual([]);
});
test('copying the selected document excludes both marks and their explanation', async ({ page, context }) => {
    await setup(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById('editor')!); document.getElementById('editor')!.focus(); getSelection()!.removeAllRanges(); getSelection()!.addRange(r); });
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+c' : 'Control+c');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('End marker.'); expect(copied).not.toContain('Maximum document width'); expect(copied).not.toContain('Width boundary indicators');
});
test('Source, document selection and export preparation exclude the guide', async ({ page }) => {
    await setup(page);
    const before = await page.evaluate(() => (window as any).htmlToMarkdown());
    const copied = await page.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById('editor')!); return r.toString(); });
    expect(copied).not.toContain('Maximum document width');
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
    await expect(page.locator('#editorWidthGuide')).toBeHidden(); await expect(page.locator('#sourceEditor')).toHaveValue(source);
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
    await expect(page.locator('#editorWidthGuide')).toBeVisible();
    const outputs: string[] = [];
    for (const indicators of [false, true]) {
        await set(page, 'editorWidthIndicators', indicators);
        await page.evaluate(({ source, indicators }) => (window as any).__hostMessageHandler({ type: 'prepareExport', requestId: 'guide-' + indicators, markdown: source, theme: 'github', fontSize: 16 }), { source, indicators });
        await expect.poll(() => page.evaluate(indicators => (window as any).__testApi.messages.some((m: any) => m.type === 'exportPrepared' && m.requestId === 'guide-' + indicators), indicators)).toBe(true);
        outputs.push(await page.evaluate(indicators => (window as any).__testApi.messages.find((m: any) => m.type === 'exportPrepared' && m.requestId === 'guide-' + indicators).html, indicators));
    }
    expect(outputs[0]).toEqual(outputs[1]);
    expect(await page.evaluate(html => new DOMParser().parseFromString(html, 'text/html').querySelector('.editor-width-guide'), outputs[0])).toBeNull();
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
});
for (const theme of ['github', 'sepia', 'night', 'dark', 'minimal', 'things', 'perplexity']) {
    test(`${theme}: marks and explanation use the theme foreground`, async ({ page }) => {
        await setup(page); await page.evaluate(value => (window as any).__hostMessageHandler({ type: 'theme', value }), theme);
        await page.locator('.editor-width-mark').first().focus();
        const colors = await page.evaluate(() => ['.editor-width-mark', '#editorWidthExplanation', '#editor'].map(selector => getComputedStyle(document.querySelector(selector)!).color));
        expect(colors[0]).toBe(colors[2]); expect(colors[1]).toBe(colors[2]);
    });
}
