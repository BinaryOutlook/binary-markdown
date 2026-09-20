import { test, expect, Page } from '@playwright/test';
import { lineStartKey, lineEndKey } from '../utils/editor-test-helper';

const set = (page: Page, value: boolean) => page.evaluate(value => (window as any).__hostMessageHandler({ type: 'mathSourceWrap', value }), value);
const markdown = (page: Page) => page.evaluate(() => (window as any).htmlToMarkdown());
const long = 'x^2+'.repeat(70) + 'y^2';
async function setup(page: Page, block: string, position = 'above') {
    await page.setViewportSize({ width: 500, height: 700 });
    await page.goto('/production-editor.html'); await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.addScriptTag({ url: '/vendor/katex.min.js' }); await page.addStyleTag({ url: '/vendor/katex.min.css' });
    await page.evaluate(({ block, position }) => {
        (window as any).__testApi.setMarkdown(block); document.getElementById('closeSidebar')!.click();
        (window as any).__hostMessageHandler({ type: 'mathSourcePosition', value: position });
    }, { block, position });
    await page.locator('.math-display').click();
}
async function metrics(page: Page) {
    return page.locator('.math-wrapper pre').evaluate(pre => ({ width: pre.clientWidth, scroll: pre.scrollWidth, height: pre.clientHeight }));
}

for (const position of ['above', 'below']) {
    for (const [name, block] of Object.entries({
        dollar: '$$\n' + long + '\n$$\n', backslash: '\\[\n' + long + '\n\\]\n', fence: '```math\n' + long + '\n```\n',
        whitespace: '$$\n  ' + long + '   \n\n\t z^2  \n\n$$\n', invalid: '$$\n\\frac{' + long + '\n$$\n'
    })) {
        test(`${position}/${name}: wrapping, resizing and source round trips preserve authored bytes`, async ({ page }) => {
            await setup(page, block, position);
            await page.evaluate(() => {
                const code = document.querySelector('.math-wrapper code')!; (window as any).__wrapNode = code;
                const range = document.createRange(); range.setStart(code.firstChild!, 3); range.setEnd(code.firstChild!, 9);
                getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
            });
            const selected = await page.evaluate(() => getSelection()!.toString());
            const before = await metrics(page); expect(before.scroll).toBeGreaterThan(before.width);
            await set(page, true);
            for (const width of [500, 750, 360]) {
                await page.setViewportSize({ width, height: 700 });
                const wrapped = await metrics(page); expect(wrapped.scroll).toBeLessThanOrEqual(wrapped.width + 1); expect(wrapped.height).toBeGreaterThan(before.height);
                expect(await markdown(page)).toBe(block);
                expect(await page.evaluate(() => getSelection()!.toString())).toBe(selected);
            }
            await page.locator('.math-wrapper pre').evaluate(node => { (node as HTMLElement).style.fontSize = '22px'; });
            expect((await metrics(page)).scroll).toBeLessThanOrEqual((await metrics(page)).width + 1);
            expect(await page.evaluate(() => (window as any).__wrapNode === document.querySelector('.math-wrapper code'))).toBe(true);
            await expect(page.locator('.math-wrapper')).toHaveAttribute('data-mode', 'edit');
            await expect(page.locator('[data-action="undo"]')).toBeDisabled();
            await set(page, false); expect((await metrics(page)).scroll).toBeGreaterThan((await metrics(page)).width);
            expect(await markdown(page)).toBe(block);
            expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'edit'))).toEqual([]);
            await page.locator('[data-action="source"]').click(); await expect(page.locator('#sourceEditor')).toHaveValue(block);
            await page.locator('[data-action="source"]').click(); expect(await markdown(page)).toBe(block);
        });
    }
}

test('wrapped source copy and paste retain tabs, authored blank lines and spaces', async ({ page }) => {
    const tex = '  ' + long + '  \n\n\tz^2  \n'; const block = '$$\n' + tex + '\n$$\n';
    await setup(page, block); await set(page, true);
    const copied = await page.evaluate(() => {
        const code = document.querySelector('.math-wrapper code')!; const range = document.createRange(); range.selectNodeContents(code);
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
        const data = new DataTransfer(); code.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: data }));
        return data.getData('text/plain');
    });
    expect(copied).toBe(tex); expect(await markdown(page)).toBe(block);
    await page.evaluate(tex => {
        const code = document.querySelector('.math-wrapper code')!; const data = new DataTransfer(); data.setData('text/plain', tex + 'k^2');
        code.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
    }, tex);
    expect(await markdown(page)).toBe('$$\n' + tex + 'k^2\n$$\n');
    await set(page, false); await page.keyboard.press('Control+z'); expect(await markdown(page)).toBe(block);
});

test('native visual-line movement and IME composition stay inside wrapped source', async ({ page }) => {
    await setup(page, '$$\n' + long + '\n$$\n'); await set(page, true);
    await page.evaluate(() => {
        const code = document.querySelector('.math-wrapper code')!; (code.parentElement as HTMLElement).focus();
        const range = document.createRange(); range.setStart(code.firstChild!, 50); range.collapse(true);
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    });
    const caret = () => page.evaluate(() => { const r = getSelection()!.getRangeAt(0).getBoundingClientRect(); return { x: r.x, y: r.y, offset: getSelection()!.anchorOffset }; });
    await page.keyboard.press(lineEndKey); const end = await caret();
    await page.keyboard.press(lineStartKey); const start = await caret();
    expect(Math.abs(start.y - end.y)).toBeLessThan(2); expect(start.x).toBeLessThan(end.x); expect(start.offset).toBeLessThan(end.offset);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.imeSetComposition', { text: '数学', selectionStart: 2, selectionEnd: 2 });
    await set(page, false); await set(page, true);
    await cdp.send('Input.insertText', { text: '数学' });
    expect(await markdown(page)).toBe('$$\n' + long.slice(0, start.offset) + '数学' + long.slice(start.offset) + '\n$$\n');
    await expect(page.locator('.math-wrapper')).toHaveAttribute('data-mode', 'edit');
    await page.keyboard.insertText('+1'); expect(await markdown(page)).toContain('数学+1');
    expect((await metrics(page)).scroll).toBeLessThanOrEqual((await metrics(page)).width + 1);
    await cdp.detach();
});
