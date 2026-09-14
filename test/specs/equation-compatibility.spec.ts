import { test, expect, Page } from '@playwright/test';

async function setMarkdown(page: Page, markdown: string) {
    await page.evaluate(md => (window as any).__testApi.setMarkdown(md), markdown);
}

test.beforeEach(async ({ page }) => {
    await page.goto('/standalone-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.addScriptTag({ url: '/vendor/katex.min.js' });
    await page.addStyleTag({ url: '/vendor/katex.min.css' });
});

test('multiline fenced math renders one complete expression and retains source', async ({ page }) => {
    const tex = String.raw`\begin{aligned}
a &= b + c \\
d &= e + f
\end{aligned}`;
    const markdown = '```math\n' + tex + '\n```\n';
    await setMarkdown(page, markdown);
    await expect(page.locator('#editor .katex')).toHaveCount(1);
    await expect(page.locator('#editor .katex-error,.math-error')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(markdown);

    await page.evaluate(md => (window as any).__hostMessageHandler({
        type: 'prepareExport', requestId: 'multiline', markdown: md
    }), markdown);
    await expect.poll(() => page.evaluate(() => (window as any).__testApi.messages
        .filter((message: any) => message.type === 'exportPrepared').length)).toBe(1);
    const result = await page.evaluate(() => (window as any).__testApi.messages
        .find((message: any) => message.type === 'exportPrepared'));
    expect(result.html).toContain('katex');
    expect(result.warnings).toEqual([]);
});

test('physical newlines no longer create separate equations', async ({ page }) => {
    await setMarkdown(page, '```math\nx=1\ny=2\n```\n');
    await expect(page.locator('#editor .katex')).toHaveCount(1);
    await setMarkdown(page, '```math\n\\begin{pmatrix}\n1&2\\\\\n3&4\n\\end{pmatrix}\n```\n');
    await expect(page.locator('#editor .katex')).toHaveCount(1);
    await expect(page.locator('#editor .katex-error,.math-error')).toHaveCount(0);
});
