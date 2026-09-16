import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/standalone-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.addScriptTag({ url: '/vendor/katex.min.js' });
});

for (const language of ['', 'javascript', 'mermaid']) {
    test(`unrelated edits preserve quoted ${language || 'unlabelled'} code through save and reopen`, async ({ page }) => {
        const code = language === 'mermaid' ? 'graph TD\n  A --> B\n\n' : 'alpha\n    beta  \n\tindented\n\n';
        const quoted = ('```' + language + '\n' + code + '\n```').split('\n').map(line => '> ' + line).join('\n');
        const md = quoted + '\n\nAfter\n';
        await page.evaluate(md => (window as any).__testApi.setMarkdown(md), md);
        const after = page.locator('#editor > p').filter({ hasText: 'After' });
        await after.click();
        await after.evaluate(element => {
            const range = document.createRange();
            range.selectNodeContents(element);
            range.collapse(false);
            const selection = window.getSelection()!;
            selection.removeAllRanges();
            selection.addRange(range);
        });
        await page.keyboard.type(' updated');
        await page.keyboard.press('Control+s');
        const saved = await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'save').at(-1).content);
        expect(saved).toContain(quoted);
        expect(saved).toContain('After updated');
        expect(saved).not.toMatch(/plaintextCopy|code-block-header|⤢/);
        await page.evaluate(md => (window as any).__testApi.setMarkdown(md), saved);
        await expect(page.locator('#editor blockquote pre')).toHaveCount(1);
        await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
        expect(await page.locator('#sourceEditor').evaluate((element: HTMLTextAreaElement) => element.value)).toBe(saved);
    });
}

test('quoted code fences and blank lines stay separate from surrounding prose and math', async ({ page }) => {
    const quote = '> Before $x$\n>\n> ````text\n> ```\n>   content\n>\n> ````\n>\n> After\n>\n> ```math\n> x^2\n> ```\n';
    await page.evaluate(md => (window as any).__testApi.setMarkdown(md), quote);
    const result = await page.evaluate(() => (window as any).__testApi.getMarkdown());
    expect(result).toContain('> ````text\n> ```\n>   content\n> \n> ````');
    expect(result).toContain('> Before $x$');
    expect(result).toContain('> After');
    expect(result).toContain('> ```math\n> x^2\n> ```');
    await page.evaluate(md => (window as any).__testApi.setMarkdown(md), result);
    await expect(page.locator('#editor blockquote pre[data-lang="text"]')).toHaveCount(1);
    await expect(page.locator('#editor blockquote .math-wrapper')).toHaveCount(1);
});
