import { test, expect, Page } from '@playwright/test';

const source = '```custom-lang\n  value\n\t// β\n\n```\n';
const curated = ['plaintext', 'markdown', 'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'bash', 'shell', 'json', 'yaml', 'html', 'css', 'sql', 'dockerfile', 'php', 'ruby', 'swift', 'kotlin', 'xml', 'mermaid', 'math'];
const alphabetical = ['bash', 'c', 'csharp', 'cpp', 'css', 'dockerfile', 'go', 'html', 'java', 'javascript', 'json', 'kotlin', 'markdown', 'math', 'mermaid', 'php', 'plaintext', 'python', 'ruby', 'rust', 'shell', 'sql', 'swift', 'typescript', 'xml', 'yaml'];
const ids = (page: Page) => page.getByRole('option').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.language));
const order = (page: Page, value: string) => page.evaluate(value => (window as any).__hostMessageHandler({ type: 'codeLanguageOrder', value }), value);

test.beforeEach(async ({ page }) => {
    await page.goto('/production-editor.html'); await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(source => (window as any).__testApi.setMarkdown(source), source);
    await page.locator('.code-lang-tag').click();
});

for (const [mode, expected] of [['default', curated], ['a-z', alphabetical], ['z-a', [...alphabetical].reverse()]] as const) {
    test(`${mode}: complete deterministic order and query relevance`, async ({ page }) => {
        await order(page, mode); expect(await ids(page)).toEqual(expected);
        const input = page.getByRole('combobox');
        await input.fill('java'); expect(await ids(page)).toEqual(['java', 'javascript']);
        await input.fill('CS'); expect(await ids(page)).toEqual(['csharp', 'css']);
        await input.fill('script'); expect(await ids(page)).toEqual(mode === 'z-a' ? ['typescript', 'javascript'] : ['javascript', 'typescript']);
        await input.fill('no-language'); expect(await ids(page)).toEqual([]);
        await input.fill(''); expect(await ids(page)).toEqual(expected);
        await page.keyboard.press('Escape');
        expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(source);
        await expect(page.locator('[data-action="undo"]')).toBeDisabled();
    });
}

test('live ordering preserves the input, active language, editable DOM and undo history', async ({ page }) => {
    const input = page.getByRole('combobox'); await input.fill('script');
    await page.evaluate(() => { (window as any).__beforeCode = document.querySelector('pre code'); });
    await input.press('ArrowDown');
    await expect(page.locator('[aria-selected="true"]')).toHaveAttribute('data-language', 'typescript');
    await input.evaluate((node: HTMLInputElement) => node.setSelectionRange(1, 4));
    await order(page, 'z-a');
    await expect(input).toBeFocused(); await expect(input).toHaveValue('script');
    expect(await input.evaluate((node: HTMLInputElement) => [node.selectionStart, node.selectionEnd])).toEqual([1, 4]);
    await expect(page.locator('[aria-selected="true"]')).toHaveAttribute('data-language', 'typescript');
    expect(await page.evaluate(() => (window as any).__beforeCode === document.querySelector('pre code'))).toBe(true);
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'edit'))).toEqual([]);
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(source.replace('custom-lang', 'typescript'));
    await order(page, 'a-z'); await page.locator('[data-action="undo"]').click();
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(source);
    await expect(page.locator('[data-action="undo"]')).toBeDisabled();
});

test('invalid mode falls back to curated order without rewriting the unknown identifier', async ({ page }) => {
    await order(page, 'z-a'); await order(page, 'invalid');
    expect(await ids(page)).toEqual(curated); await expect(page.locator('.lang-selector-current')).toContainText('custom-lang');
});
