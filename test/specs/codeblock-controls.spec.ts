import { toggleEditorView } from '../utils/view-mode';
import { test, expect, Page } from '@playwright/test';
import { lineStartKey, lineEndKey } from '../utils/editor-test-helper';

const longCode = '  const value = "' + 'abcdefghij'.repeat(80) + '";  \n\tconsole.log(value);\n\n';
const source = 'Before.\n\n```javascript\n' + longCode + '\n```\n\nAfter.\n';

async function setup(page: Page, markdown = source) {
    await page.setViewportSize({ width: 500, height: 700 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(markdown => {
        (window as any).__testApi.setMarkdown(markdown);
        document.getElementById('closeSidebar')!.click();
    }, markdown);
}

test('horizontal code scrolling keeps the toolbar anchored and the first line unobstructed', async ({ page }) => {
    await setup(page);
    const block = page.locator('#editor pre').first();
    const header = block.locator('.code-block-header');
    const code = block.locator('code');
    const before = await header.boundingBox();
    expect(before).not.toBeNull();
    expect(await code.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    await code.evaluate(node => { node.scrollLeft = node.scrollWidth; });
    expect(await code.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    const after = await header.boundingBox();
    expect(after!.x).toBeCloseTo(before!.x, 1);
    expect(after!.y).toBeCloseTo(before!.y, 1);
    const codeBounds = await code.boundingBox();
    expect(codeBounds!.y).toBeGreaterThanOrEqual(after!.y + after!.height);
    for (const selector of ['.code-expand-btn', '.code-lang-tag', '.code-copy-btn', '.code-delete-btn']) {
        await expect(block.locator(selector)).toBeVisible();
        const bounds = await block.locator(selector).boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(after!.x);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(after!.x + after!.width + 1);
    }
    await code.evaluate(node => { node.scrollLeft = 0; });
    await page.mouse.move(codeBounds!.x + 12, codeBounds!.y + 12);
    await page.mouse.wheel(300, 0);
    await expect.poll(() => code.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    expect((await header.boundingBox())!.x).toBeCloseTo(before!.x, 1);
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
});

for (const locale of ['en', 'es', 'fr', 'ja', 'ko', 'zh-cn', 'zh-tw']) {
    test(`${locale}: code controls use localized labels and a persistent wrap notice`, async ({ page }) => {
        const messages = require('../../out/locales/' + locale + '.js').webviewMessages;
        await page.route('**/production-editor.html', async route => {
            const response = await route.fetch();
            const body = (await response.text()).replace(/const i18n = \{[^\n]*\};/, () => 'const i18n = ' + JSON.stringify(messages) + ';');
            await route.fulfill({ response, body });
        });
        await setup(page);
        await expect(page.getByRole('button', { name: messages.copyCode, exact: true })).toBeVisible();
        const wrap = page.getByRole('button', { name: messages.wrapCode, exact: true });
        await wrap.click();
        await expect(wrap).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.code-wrap-notice')).toHaveText(messages.codeWrapped);
        await expect(page.locator('.code-wrap-notice')).toHaveAttribute('title', messages.codeWrappedHelp);
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
    });
}

test('the labeled copy control supports keyboard activation and stable success feedback', async ({ page }) => {
    await page.addInitScript(() => {
        (window as any).__copied = [];
        Object.defineProperty(navigator.clipboard, 'writeText', { value: async (text: string) => (window as any).__copied.push(text) });
    });
    await setup(page);
    const button = page.getByRole('button', { name: 'Copy code', exact: true });
    await expect(button).toHaveAttribute('title', 'Copy code');
    await expect(button.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(button).toHaveText('Copy code');
    const before = await button.boundingBox();
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('data-copy-state', 'copied');
    await expect(page.getByRole('status').filter({ hasText: 'Copied' })).toHaveCount(1);
    const announcement = page.getByRole('status').filter({ hasText: 'Copied' });
    expect(await announcement.evaluate(node => ({ width: node.getBoundingClientRect().width, clip: getComputedStyle(node).clipPath })))
        .toEqual({ width: 1, clip: 'inset(50%)' });
    await expect(button.locator('.code-action-label')).toHaveText('Copied');
    const after = await button.boundingBox();
    expect(after!.width).toBe(before!.width);
    expect(after!.x).toBe(before!.x);
    expect(await page.evaluate(() => (window as any).__copied)).toEqual([longCode]);
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
    await expect(button).toHaveAttribute('data-copy-state', 'idle');
    await expect(button.locator('svg')).toHaveCount(1);
});

test('clipboard rejection announces failure without showing copied feedback', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator.clipboard, 'writeText', { value: async () => { throw new Error('Synthetic clipboard denial'); } });
    });
    await setup(page);
    const button = page.getByRole('button', { name: 'Copy code', exact: true });
    await button.click();
    await expect(button).toHaveAttribute('data-copy-state', 'error');
    await expect(button).toHaveAttribute('title', 'Could not copy code. Try again.');
    await expect(button.locator('svg rect')).toHaveCount(1);
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
});

test('wrapping is per block, default off, and changes only presentation', async ({ page }) => {
    const duplicate = source + '\n```javascript\n' + longCode + '\n```\n';
    await setup(page, duplicate);
    const blocks = page.locator('#editor pre');
    const first = blocks.first();
    await expect(blocks.locator('.code-wrap-btn')).toHaveCount(2);
    for (const block of [blocks.nth(0), blocks.nth(1)]) {
        await expect(block.locator('.code-wrap-btn')).toHaveAttribute('aria-pressed', 'false');
        await expect(block.locator('.code-wrap-notice')).toBeHidden();
    }
    const original = await first.locator('code').innerHTML();
    const height = (await first.locator('code').boundingBox())!.height;
    const count = await page.locator('#wordCount').textContent();
    await first.locator('.code-wrap-btn').click();
    await expect(first.locator('.code-wrap-notice')).toBeVisible();
    await expect(first.locator('.code-wrap-notice')).toHaveText('Wrapped');
    await expect(first.locator('.code-wrap-btn')).toHaveAttribute('aria-pressed', 'true');
    await expect(blocks.nth(1).locator('.code-wrap-btn')).toHaveAttribute('aria-pressed', 'false');
    for (const width of [360, 750, 500]) {
        await page.setViewportSize({ width, height: 700 });
        const metrics = await first.locator('code').evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth, height: node.clientHeight }));
        expect(metrics.scroll).toBeLessThanOrEqual(metrics.width + 1);
        expect(metrics.height).toBeGreaterThan(height);
        expect(await first.locator('code').innerHTML()).toBe(original);
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(duplicate);
    }
    await expect(page.locator('#wordCount')).toHaveText(count!);
    await expect(page.locator('[data-action="undo"]')).toBeDisabled();
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => message.type === 'edit'))).toEqual([]);
    await first.locator('.code-wrap-btn').click();
    expect(await first.locator('code').evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    await expect(first.locator('.code-wrap-notice')).toBeHidden();
});

test('wrapping preserves the editable code node, selection, mode, and scroll position', async ({ page }) => {
    await setup(page);
    const block = page.locator('#editor pre').first();
    await block.locator('code').click();
    await block.locator('code').evaluate(code => {
        (window as any).__wrapCode = code;
        const range = document.createRange(); range.setStart(code.firstChild!, 10); range.setEnd(code.firstChild!, 18);
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
        code.scrollLeft = 100;
    });
    const selected = await page.evaluate(() => getSelection()!.toString());
    for (const wrapped of [true, false, true]) {
        await block.locator('.code-wrap-btn').click();
        await expect(block).toHaveAttribute('data-mode', 'edit');
        await expect(block.locator('.code-wrap-btn')).toHaveAttribute('aria-pressed', String(wrapped));
        expect(await page.evaluate(() => getSelection()!.toString())).toBe(selected);
        expect(await block.locator('code').evaluate(code => code === (window as any).__wrapCode)).toBe(true);
        expect(await block.locator('code').evaluate(code => code.scrollLeft)).toBe(wrapped ? 0 : 100);
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
    }
    await expect(page.locator('[data-action="undo"]')).toBeDisabled();
});

test('wrap keyboard activation does not insert code or a document undo step', async ({ page }) => {
    await setup(page);
    const button = page.getByRole('button', { name: 'Wrap code', exact: true });
    await button.focus(); await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
    await expect(page.locator('[data-action="undo"]')).toBeDisabled();
});

test('wrapped copy preserves original tabs, spaces, and line breaks', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator.clipboard, 'writeText', { value: async (text: string) => { (window as any).__copied = text; } });
    });
    await setup(page);
    const block = page.locator('#editor pre').first();
    await block.locator('.code-wrap-btn').click();
    await block.locator('code').click();
    await block.locator('.code-copy-btn').click();
    await expect(block.locator('.code-copy-btn')).toHaveAttribute('data-copy-state', 'copied');
    expect(await page.evaluate(() => (window as any).__copied)).toBe(longCode);
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
    await expect(block.locator('.code-wrap-btn')).toHaveAttribute('aria-pressed', 'true');
});

test('wrapping survives source mode, content undo/redo, deletion and restoration', async ({ page }) => {
    await setup(page);
    const block = page.locator('#editor pre').first();
    await block.locator('.code-wrap-btn').click();
    await toggleEditorView(page);
    await expect(page.locator('#sourceEditor')).toHaveValue(source);
    await toggleEditorView(page);
    await expect(block.locator('.code-wrap-btn')).toHaveAttribute('aria-pressed', 'true');
    await block.locator('code').click();
    await page.keyboard.insertText('new_');
    const changed = source.replace('  const', 'new_  const');
    await expect.poll(() => page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(changed);
    await page.locator('[data-action="undo"]').click();
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
    await expect(block.locator('.code-wrap-btn')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-action="redo"]').click();
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(changed);
    await expect(block.locator('.code-wrap-btn')).toHaveAttribute('aria-pressed', 'true');
    await block.locator('.code-delete-btn').click();
    await expect(page.locator('#editor pre')).toHaveCount(0);
    await page.locator('[data-action="undo"]').click();
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(changed);
    await expect(block.locator('.code-wrap-btn')).toHaveAttribute('aria-pressed', 'true');
    // A new webview session starts with wrapping off again.
    await page.reload();
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(source => (window as any).__testApi.setMarkdown(source), changed);
    await expect(block.locator('.code-wrap-btn')).toHaveAttribute('aria-pressed', 'false');
});

test('new source blocks default off while an existing wrapped block retains its view', async ({ page }) => {
    await setup(page);
    await page.locator('.code-wrap-btn').click();
    await toggleEditorView(page);
    const changed = '```text\nnew block\n```\n\n' + source;
    await page.locator('#sourceEditor').fill(changed);
    await toggleEditorView(page);
    await expect(page.locator('.code-wrap-btn').nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.code-wrap-btn').nth(1)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(changed);
});

test('wrapped arrow keys and line-start/end move along visual rows before exiting the block', async ({ page }) => {
    const text = 'x'.repeat(320);
    const markdown = 'Before.\n\n```text\n' + text + '\n```\n\nAfter.\n';
    await setup(page, markdown);
    const block = page.locator('#editor pre').first();
    await block.locator('.code-wrap-btn').click(); await block.locator('code').click();
    const at = (offset: number) => block.locator('code').evaluate((code, offset) => {
        const range = document.createRange(); range.setStart(code.firstChild!, offset); range.collapse(true);
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    }, offset);
    const y = () => page.evaluate(() => getSelection()!.getRangeAt(0).getBoundingClientRect().y);
    await at(100); const middle = await y();
    await page.keyboard.press('ArrowUp'); await expect(block).toHaveAttribute('data-mode', 'edit');
    expect(await y()).toBeLessThan(middle);
    await page.keyboard.press('ArrowDown'); await expect(block).toHaveAttribute('data-mode', 'edit');
    expect(Math.abs(await y() - middle)).toBeLessThan(2);
    // A DOM Range at a soft-wrap boundary can report downstream affinity even
    // when the native caret is at the previous row's end. Check text offsets.
    await page.keyboard.press(lineEndKey); const end = await page.evaluate(() => getSelection()!.anchorOffset);
    await page.keyboard.press(lineStartKey); const start = await page.evaluate(() => getSelection()!.anchorOffset);
    expect(start).toBeGreaterThan(0); expect(end).toBeLessThan(text.length); expect(start).toBeLessThan(end);
    await at(0); await page.keyboard.press('ArrowUp'); await expect(block).toHaveAttribute('data-mode', 'display');
    expect(await page.evaluate(() => document.querySelector('#editor > p')!.contains(getSelection()!.anchorNode))).toBe(true);
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(markdown);
});

test('controls remain accessible in narrow, expanded, nested and quoted blocks', async ({ page }) => {
    const nested = '1. Code\n\n   ```custom-language\n   ' + 'x'.repeat(300) + '\n   ```\n\n> ```bash\n> ' + 'x'.repeat(300) + '\n> ```\n';
    await setup(page, nested);
    const blocks = page.locator('#editor pre');
    for (const width of [320, 500, 900]) {
        await page.setViewportSize({ width, height: 700 });
        for (const block of [blocks.nth(0), blocks.nth(1)]) {
            await block.locator('.code-wrap-btn').click();
            for (const button of await block.locator('.code-block-header button').all()) {
                await expect(button).toBeVisible();
                const bounds = (await button.boundingBox())!;
                expect(bounds.x).toBeGreaterThanOrEqual(0);
                expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
            }
            await block.locator('.code-expand-btn').click();
            await expect(block.locator('.code-wrap-notice')).toBeVisible();
            await block.locator('.code-expand-btn').click(); await block.locator('.code-wrap-btn').click();
        }
    }
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(nested);
});

test('wrap controls are excluded from prepared exports and special math/diagram blocks', async ({ page }) => {
    await setup(page);
    const outputs: string[] = [];
    for (const wrapped of [false, true]) {
        if (wrapped) await page.locator('.code-wrap-btn').click();
        await page.evaluate(({ source, wrapped }) => (window as any).__hostMessageHandler({ type: 'prepareExport', requestId: String(wrapped), markdown: source, theme: 'github', fontSize: 16 }), { source, wrapped });
        await expect.poll(() => page.evaluate(wrapped => (window as any).__testApi.messages.some((message: any) => message.type === 'exportPrepared' && message.requestId === String(wrapped)), wrapped)).toBe(true);
        outputs.push(await page.evaluate(wrapped => (window as any).__testApi.messages.find((message: any) => message.type === 'exportPrepared' && message.requestId === String(wrapped)).html, wrapped));
    }
    expect(outputs[0]).toBe(outputs[1]);
    expect(outputs[0]).not.toContain('code-wrap-notice');
    expect(outputs[0]).not.toContain('code-wrapped');
    await page.evaluate(() => (window as any).__testApi.setMarkdown('```math\nx^2\n```\n\n```mermaid\ngraph TD; A-->B;\n```\n'));
    await expect(page.locator('.code-wrap-btn')).toHaveCount(0);
});
