import { test, expect, Page } from '@playwright/test';

const body = '  const value = 1;\n\t// β\n\n';
const source = '# Languages\n\n```custom-lang\n' + body + '\n```\n\nEnd marker.\n';
async function setup(page: Page, markdown = source) {
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(markdown => { (window as any).__testApi.setMarkdown(markdown); document.getElementById('closeSidebar')!.click(); }, markdown);
}
async function open(page: Page) {
    await page.locator('.code-lang-tag').first().click();
    await expect(page.getByRole('combobox', { name: 'Code language' })).toBeFocused();
}
async function markdown(page: Page) { return page.evaluate(() => (window as any).htmlToMarkdown()); }

for (const [query, id] of [['JS', 'javascript'], ['JavaScript', 'javascript'], ['C++', 'cpp'], ['cpp', 'cpp'], ['C#', 'csharp'], ['csharp', 'csharp'], ['text', 'plaintext'], ['MarkDown', 'markdown']]) {
    test(`search ${query} matches ${id} without changing source`, async ({ page }) => {
        await setup(page); await open(page);
        await page.keyboard.insertText(query);
        await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveAttribute('data-language', id);
        expect(await markdown(page)).toBe(source);
        await page.keyboard.press('Escape');
        await expect(page.locator('.lang-selector')).toHaveCount(0);
        await expect(page.locator('.code-lang-tag')).toBeFocused();
        await expect(page.locator('[data-action="undo"]')).toBeDisabled();
        expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'edit'))).toEqual([]);
    });
}

test('unknown language, empty results and repeated cancellation preserve source and undo', async ({ page }) => {
    await setup(page);
    for (let i = 0; i < 3; i++) {
        await open(page); await expect(page.locator('.lang-selector-current')).toContainText('custom-lang');
        await page.keyboard.insertText('no-such-language');
        await expect(page.getByRole('status')).toHaveText('No matching languages.');
        await expect(page.getByRole('option')).toHaveCount(0);
        await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
        await expect(page.locator('.lang-selector')).toBeVisible();
        await page.keyboard.press('Escape');
    }
    expect(await markdown(page)).toBe(source);
    await expect(page.locator('[data-action="undo"]')).toBeDisabled();
});

test('keyboard confirmation preserves whitespace, copy, Source and one-step undo/redo', async ({ page, context }) => {
    await setup(page); await open(page); await page.keyboard.insertText('java');
    await expect(page.locator('[aria-selected="true"]')).toHaveAttribute('data-language', 'java');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[aria-selected="true"]')).toHaveAttribute('data-language', 'javascript');
    await page.keyboard.press('Enter');
    const changed = source.replace('```custom-lang', '```javascript');
    expect(await markdown(page)).toBe(changed);
    await expect(page.locator('pre code .hljs-keyword')).not.toHaveCount(0);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('.code-copy-btn').click();
    // Windows clipboard reads expose CRLF; retain all tabs and blank lines.
    await expect.poll(() => page.evaluate(async () => (await navigator.clipboard.readText()).replace(/\r\n/g, '\n'))).toBe(body);
    await page.locator('[data-action="source"]').click();
    await expect(page.locator('#sourceEditor')).toHaveValue(changed);
    await page.locator('[data-action="source"]').click();
    await page.locator('[data-action="undo"]').click(); expect(await markdown(page)).toBe(source);
    await expect(page.locator('[data-action="undo"]')).toBeDisabled();
    await page.locator('[data-action="redo"]').click(); expect(await markdown(page)).toBe(changed);
});

test('opening from active code retains its caret and editing mode; the choice has a separate undo step', async ({ page }) => {
    await setup(page);
    await page.locator('pre code').click();
    await page.evaluate(() => {
        const code = document.querySelector('pre code')!;
        const range = document.createRange(); range.setStart(code.firstChild!, 2); range.collapse(true);
        code.focus(); getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
        (window as any).__savedCode = code.firstChild;
    });
    await page.keyboard.insertText('X');
    const typed = await markdown(page);
    await open(page); await page.keyboard.insertText('py'); await page.keyboard.press('Escape');
    await expect(page.locator('pre')).toHaveAttribute('data-mode', 'edit');
    expect(await page.evaluate(() => ({ sameNode: getSelection()!.anchorNode === (window as any).__savedCode, offset: getSelection()!.anchorOffset }))).toEqual({ sameNode: true, offset: 3 });
    expect(await markdown(page)).toBe(typed);
    await open(page); await page.keyboard.insertText('py'); await page.keyboard.press('Enter');
    expect(await markdown(page)).toBe(typed.replace('```custom-lang', '```python'));
    await page.locator('[data-action="undo"]').click(); expect(await markdown(page)).toBe(typed);
    await page.locator('[data-action="undo"]').click(); expect(await markdown(page)).toBe(source);
});

test('the current language is a no-op and keyboard activation/Tab stay usable', async ({ page }) => {
    const original = source.replace('custom-lang', 'python'); await setup(page, original);
    await page.locator('.code-lang-tag').focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('combobox')).toBeFocused(); await page.keyboard.press('Enter');
    expect(await markdown(page)).toBe(original); await expect(page.locator('[data-action="undo"]')).toBeDisabled();
    await open(page); await page.keyboard.press('Tab'); await expect(page.locator('.lang-selector')).toHaveCount(0);
    await expect(page.locator('.code-copy-btn')).toBeFocused();
});

test('narrow and short panes keep the input and selectable results in view', async ({ page }) => {
    await page.setViewportSize({ width: 340, height: 250 }); await setup(page);
    await open(page); await page.keyboard.insertText('kotlin');
    const boxes = await page.locator('.lang-selector, .lang-selector-search, [role="option"]').evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, viewport: { width: innerWidth, height: innerHeight } };
    }));
    for (const r of boxes) { expect(r.left).toBeGreaterThanOrEqual(0); expect(r.right).toBeLessThanOrEqual(r.viewport.width); expect(r.top).toBeGreaterThanOrEqual(0); expect(r.bottom).toBeLessThanOrEqual(r.viewport.height); }
    await page.keyboard.press('Enter'); await expect(page.locator('pre')).toHaveAttribute('data-lang', 'kotlin');
});

for (const language of ['math', 'mermaid']) {
    test(`${language} conversion is explicit, preserves source whitespace and can be undone`, async ({ page }) => {
        const content = language === 'math' ? '  x^2\n\n' : 'graph TD\n\tA --> B\n\n';
        const original = '```plaintext\n' + content + '\n```\n\nAfter.\n';
        await setup(page, original); await open(page); await page.keyboard.insertText(language);
        expect(await markdown(page)).toBe(original);
        await page.keyboard.press('Enter');
        const changed = original.replace('```plaintext', '```' + language);
        expect(await markdown(page)).toBe(changed);
        await expect(page.locator('.' + language + '-wrapper')).toHaveCount(1);
        await page.locator('[data-action="undo"]').click(); expect(await markdown(page)).toBe(original);
        await page.locator('[data-action="redo"]').click(); expect(await markdown(page)).toBe(changed);
    });
}

test('outside click and source replacement remove the picker without stale choices', async ({ page }) => {
    await setup(page); await open(page);
    await page.locator('#editor > p').last().click(); await expect(page.locator('.lang-selector')).toHaveCount(0);
    await open(page); await page.evaluate(() => (window as any).__testApi.setMarkdown('Replacement.\n'));
    await expect(page.locator('.lang-selector')).toHaveCount(0);
    expect(await markdown(page)).toBe('Replacement.\n');
});

test('long custom identifiers leave room for search results without changing the identifier', async ({ page }) => {
    const custom = 'custom'.repeat(70), original = source.replace('custom-lang', custom);
    await page.setViewportSize({ width: 400, height: 300 }); await setup(page, original); await open(page);
    await expect(page.locator('.lang-selector-current')).toHaveAttribute('title', 'Current language: ' + custom);
    await page.keyboard.insertText('python');
    const option = page.locator('[data-language="python"]');
    expect(await option.evaluate(node => {
        const r = node.getBoundingClientRect(), list = node.parentElement!.getBoundingClientRect();
        return r.top >= list.top && r.bottom <= list.bottom && r.bottom <= innerHeight;
    })).toBe(true);
    await page.keyboard.press('Escape'); expect(await markdown(page)).toBe(original);
});

test('a host Source toggle closes the picker synchronously without accepting a choice', async ({ page }) => {
    await setup(page); await open(page); await page.keyboard.insertText('python');
    const state = await page.evaluate(() => {
        (window as any).__hostMessageHandler({ type: 'toggleSourceMode' });
        return { picker: Boolean(document.querySelector('.lang-selector')), source: (document.getElementById('sourceEditor') as HTMLTextAreaElement).value };
    });
    expect(state).toEqual({ picker: false, source });
});
