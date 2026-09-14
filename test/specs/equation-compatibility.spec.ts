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

for (const markdown of [
    '$$\n\\begin{aligned}\nx&=1\\\\\ny&=2\n\\end{aligned}\n$$\n',
    '\\[\nx^2\n\n\\]\n',
    '$$x^2$$\n',
    '\\[x^2\\]\n',
    '~~~~math\nx^2\n~~~~\n',
    '> $$\n> x^2\n> $$\n'
]) {
    test('display syntax survives serialization: ' + JSON.stringify(markdown), async ({ page }) => {
        await setMarkdown(page, markdown);
        await expect(page.locator('#editor .katex')).toHaveCount(1);
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(markdown);
        await page.locator('#editor').evaluate(el => {
            const p = document.createElement('p'); p.textContent = 'Unrelated edit'; el.append(p);
            (window as any).__testApi.syncMarkdown();
        });
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toContain(markdown);
    });
}

test('display edits preserve the backslash delimiters', async ({ page }) => {
    await setMarkdown(page, '\\[\nx^2\n\\]\n');
    await page.locator('#editor .math-wrapper').click();
    await page.locator('#editor .math-wrapper code').fill('y^3');
    await expect.poll(() => page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe('\\[\ny^3\n\\]\n');
});

test('ordinary fences and unmatched delimiters remain source', async ({ page }) => {
    await setMarkdown(page, '```markdown\n$$\nx^2\n$$\n```\n\n$$\nunfinished\n# Following heading\n');
    await expect(page.locator('#editor .math-wrapper')).toHaveCount(0);
    await expect(page.locator('#editor h1')).toHaveText('Following heading');
});

test('inline equations render in prose, headings, lists, quotes and table cells', async ({ page }) => {
    const source = '# Cost $x^2$\n\nA \\(y^3\\) value.\n\n- $z^4$\n\n> \\(a^2\\)\n\n| Cost |\n| --- |\n| \\(O(V^3)\\) |\n';
    await setMarkdown(page, source);
    await expect(page.locator('#editor .math-inline .katex')).toHaveCount(5);
    const saved = await page.evaluate(() => (window as any).__testApi.getMarkdown());
    for (const expression of ['$x^2$', '\\(y^3\\)', '$z^4$', '\\(a^2\\)', '\\(O(V^3)\\)']) expect(saved).toContain(expression);
    expect(saved).not.toContain('katex');
});

test('inline source editor applies, cancels, saves and undoes without changing delimiters', async ({ page }) => {
    await setMarkdown(page, 'Before \\(x^2\\) after\n');
    await page.locator('#editor .math-inline').click();
    await page.locator('.math-inline-input').fill('y^3');
    await page.locator('.math-inline-input').press('Enter');
    await expect.poll(() => page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe('Before \\(y^3\\) after\n');
    await page.keyboard.press('Control+z');
    await expect.poll(() => page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe('Before \\(x^2\\) after\n');
    await page.locator('#editor .math-inline').click();
    await page.locator('.math-inline-input').fill('cancelled');
    await page.locator('.math-inline-input').press('Escape');
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe('Before \\(x^2\\) after\n');
    await page.locator('#editor .math-inline').click();
    await page.locator('.math-inline-input').fill('z^4');
    await page.locator('.math-inline-input').press('Control+s');
    const saved = await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'save').at(-1));
    expect(saved.content).toBe('Before \\(z^4\\) after\n');
});

test('inline notation in code, destinations, currency and front matter stays literal', async ({ page }) => {
    await setMarkdown(page, '---\ntitle: $x$\n---\n\n$5 and $10. \\$x\\$ and $ spaced $.\n`\\(code\\)` [link](path/\\(name\\))\n\n```text\n$x$\n```\n');
    await expect(page.locator('#editor .math-inline')).toHaveCount(0);
});

test('typed inline math converts after a space and remains editable', async ({ page }) => {
    await setMarkdown(page, 'Before\n');
    await page.locator('#editor p').first().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' $x^2$ ');
    await expect(page.locator('#editor .math-inline .katex')).toHaveCount(1);
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toContain('Before $x^2$');
});
