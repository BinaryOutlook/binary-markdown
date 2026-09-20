import { test, expect, Page } from '@playwright/test';

const set = (page: Page, value: string) => page.evaluate(value => (window as any).__hostMessageHandler({ type: 'mathSourcePosition', value }), value);
const markdown = (page: Page) => page.evaluate(() => (window as any).htmlToMarkdown());
async function setup(page: Page, source: string) {
    await page.goto('/production-editor.html'); await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.addScriptTag({ url: '/vendor/katex.min.js' }); await page.addStyleTag({ url: '/vendor/katex.min.css' });
    await page.evaluate(source => { (window as any).__testApi.setMarkdown(source); document.getElementById('closeSidebar')!.click(); }, source);
    await expect(page.locator('.math-display')).toBeVisible();
}
async function position(page: Page, mode: string) {
    const pre = await page.locator('.math-wrapper pre').first().boundingBox();
    const preview = await page.locator('.math-display').first().boundingBox();
    if (mode === 'above') expect(pre!.y + pre!.height).toBeLessThanOrEqual(preview!.y + 1);
    else expect(preview!.y + preview!.height).toBeLessThanOrEqual(pre!.y + 1);
}

for (const block of ['$$x^2$$', '$$\nx^2\ny^3\n$$', '\\[\nx^2\n\\]', '```math\nx^2\n```', '$$\n\\frac{unfinished\n$$']) {
    test(`source placement preserves ${JSON.stringify(block)} and its active selection`, async ({ page }) => {
        const source = 'Before.\n\n' + block + '\n\nAfter.\n'; await setup(page, source);
        await page.locator('.math-wrapper').click();
        await page.evaluate(() => {
            const code = document.querySelector('.math-wrapper code')!;
            (window as any).__sourceNode = code; (window as any).__preview = document.querySelector('.math-display');
            const range = document.createRange(); range.setStart(code.firstChild!, 0); range.setEnd(code.firstChild!, 1);
            getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
        });
        for (const mode of ['below', 'above', 'below']) {
            await set(page, mode); await position(page, mode);
            expect(await page.evaluate(() => {
                const s = getSelection()!;
                return { same: (window as any).__sourceNode === document.querySelector('.math-wrapper code') && (window as any).__preview === document.querySelector('.math-display'), start: s.anchorOffset, end: s.focusOffset, edit: document.querySelector('.math-wrapper')!.getAttribute('data-mode') };
            })).toEqual({ same: true, start: 0, end: 1, edit: 'edit' });
            expect(await markdown(page)).toBe(source); await expect(page.locator('[data-action="undo"]')).toBeDisabled();
        }
        expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'edit'))).toEqual([]);
        await page.locator('[data-action="source"]').click(); await expect(page.locator('#sourceEditor')).toHaveValue(source);
        await page.locator('[data-action="source"]').click(); await page.locator('.math-wrapper').click(); await position(page, 'below');
    });
}

test('pending preview work and undo survive a placement change during typing', async ({ page }) => {
    const source = 'Before.\n\n$$\nx\n$$\n\nAfter.\n'; await setup(page, source);
    await page.locator('.math-wrapper').click(); await page.keyboard.insertText('+y');
    const edited = await markdown(page); expect(edited).toContain('x+y');
    await set(page, 'below'); await position(page, 'below');
    await expect(page.locator('.math-display .katex')).toContainText('y');
    await expect(page.locator('.math-wrapper')).toHaveAttribute('data-mode', 'edit');
    expect(await markdown(page)).toBe(edited);
    // Ordinary typing reaches the existing undo buffer after background sync.
    // Immediate pre-sync redo also fails in the unchanged Above layout.
    await expect.poll(() => page.evaluate(() => (window as any).__testApi.messages.some((m: any) => m.type === 'edit' && m.content?.includes('x+y')))).toBe(true);
    await page.keyboard.press('Control+z'); expect(await markdown(page)).toBe(source);
    await page.keyboard.press('Control+Shift+z'); expect(await markdown(page)).toBe(edited);
    await set(page, 'above'); await page.locator('.math-wrapper').click();
    await expect(page.locator('.math-wrapper')).toHaveAttribute('data-mode', 'edit');
    await page.keyboard.press('Shift+Enter');
    expect(await page.evaluate(() => !document.querySelector('.math-wrapper')!.contains(getSelection()!.anchorNode))).toBe(true);
});

test('a visible source caret keeps its viewport position when layout permits', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 450 });
    const source = 'Before.\n\n'.repeat(25) + '$$\nx^2+y^2\n$$\n\n' + 'After.\n\n'.repeat(25);
    await setup(page, source); await page.locator('.math-wrapper').click();
    await page.locator('.math-wrapper code').evaluate(node => node.scrollIntoView({ block: 'center' }));
    const top = () => page.evaluate(() => getSelection()!.getRangeAt(0).getBoundingClientRect().top);
    const before = await top(); await set(page, 'below'); expect(Math.abs(await top() - before)).toBeLessThan(2);
    await set(page, 'above'); expect(Math.abs(await top() - before)).toBeLessThan(2);
});

test('view preference leaves exported math unchanged and invalid values use Above', async ({ page }) => {
    const source = '$$\nx^2\n$$\n'; await setup(page, source); await page.locator('.math-wrapper').click();
    const outputs: string[] = [];
    for (const value of ['above', 'below']) {
        await set(page, value);
        await page.evaluate(({ source, value }) => (window as any).__hostMessageHandler({ type: 'prepareExport', requestId: value, markdown: source, theme: 'github', fontSize: 16 }), { source, value });
        await expect.poll(() => page.evaluate(value => (window as any).__testApi.messages.some((m: any) => m.type === 'exportPrepared' && m.requestId === value), value)).toBe(true);
        outputs.push(await page.evaluate(value => (window as any).__testApi.messages.find((m: any) => m.type === 'exportPrepared' && m.requestId === value).html, value));
    }
    expect(outputs[0]).toBe(outputs[1]); expect(await markdown(page)).toBe(source);
    await set(page, 'invalid'); await position(page, 'above');
});
