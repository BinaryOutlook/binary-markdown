import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/standalone-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
});

for (const indent of [0, 1, 2, 3]) {
    for (const language of ['', 'java', 'plaintext', 'unknown']) {
        test(`${indent} leading spaces with ${language || 'no language'} preserve code, copy and export`, async ({ page }) => {
            const code = 'alpha\n    beta  \n\tgamma\n$x$\n\n';
            const md = ('```' + language + '\n' + code + '\n```').split('\n').map(line => ' '.repeat(indent) + line).join('\n');
            await page.evaluate(md => (window as any).__testApi.setMarkdown(md), md);
            await expect(page.locator('#editor pre')).toHaveCount(1);
            await expect(page.locator('#editor .math-inline, #editor .math-wrapper')).toHaveCount(0);
            await page.locator('.code-copy-btn').click();
            expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(code);
            const saved = await page.evaluate(() => (window as any).__testApi.getMarkdown());
            expect(saved).toBe(md + '\n');
            await page.evaluate(md => (window as any).__hostMessageHandler({ type: 'prepareExport', requestId: 'indented', markdown: md }), md);
            await expect.poll(() => page.evaluate(() => (window as any).__testApi.messages.find((m: any) => m.type === 'exportPrepared'))).toBeTruthy();
            const html = await page.evaluate(() => (window as any).__testApi.messages.find((m: any) => m.type === 'exportPrepared').html);
            expect(html).toContain('<pre');
            expect(html).toContain('beta  ');
            expect(html).not.toContain('math-inline');
            await page.evaluate(md => (window as any).__testApi.setMarkdown(md), saved);
            await page.locator('.code-copy-btn').click();
            expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(code);
        });
    }
}

for (const fence of ['```', '~~~~']) {
    test(`${fence} closes at a different valid indentation and keeps invalid closers literal`, async ({ page }) => {
        const md = ['   ' + fence, ' less', '     deeper', '\ttab', '    ' + fence,
            '   ' + fence[0].repeat(2), '   ' + (fence[0] === '`' ? '~~~' : '```'), ' ' + fence, 'After'].join('\n');
        await page.evaluate(md => (window as any).__testApi.setMarkdown(md), md);
        await expect(page.locator('#editor pre')).toHaveCount(1);
        await expect(page.locator('#editor > p')).toHaveText('After');
        await page.locator('.code-copy-btn').click();
        expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(
            ['less', '  deeper', '\ttab', ' ' + fence, fence[0].repeat(2), fence[0] === '`' ? '~~~' : '```'].join('\n'));
    });
}

test('four leading spaces create indented code with literal fence characters', async ({ page }) => {
    await page.evaluate(() => (window as any).__testApi.setMarkdown('    ```\n    alpha\n    ```'));
    await expect(page.locator('#editor pre')).toHaveCount(1);
    await page.locator('.code-copy-btn').click();
    // Windows clipboard text uses CRLF; preserve content while comparing logical lines.
    expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe('```\nalpha\n```');
});

test('empty and unclosed indented fences retain the existing code editing behavior', async ({ page }) => {
    await page.evaluate(() => (window as any).__testApi.setMarkdown('   ```\n ```\n\nAfter\n\n  ~~~text\n  alpha\n    beta'));
    await expect(page.locator('#editor pre')).toHaveCount(2);
    await expect(page.locator('#editor pre').first().locator('code')).toHaveText('');
    const md = await page.evaluate(() => (window as any).__testApi.getMarkdown());
    expect(md).toContain('  ~~~text\n  alpha\n    beta');
});

test('indented special fences preserve math source and Mermaid content', async ({ page }) => {
    await page.addScriptTag({ url: '/vendor/katex.min.js' });
    const math = '  ```math\n  x^2\n  ```';
    await page.evaluate(md => (window as any).__testApi.setMarkdown(md), math + '\n\n   ~~~mermaid\n   graph TD\n     A --> B\n   ~~~');
    await expect(page.locator('#editor .math-wrapper .katex')).toHaveCount(1);
    await expect(page.locator('#editor .mermaid-diagram svg')).toHaveCount(1);
    const result = await page.evaluate(() => (window as any).__testApi.getMarkdown());
    expect(result).toContain(math);
    expect(result).toContain('   ~~~mermaid\n   graph TD\n     A --> B\n   ~~~');
});
