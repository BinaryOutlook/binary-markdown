import { test, expect, Page } from '@playwright/test';
import { lineEndKey } from '../utils/editor-test-helper';

async function setMarkdown(page: Page, markdown: string) {
    await page.evaluate(md => (window as any).__testApi.setMarkdown(md), markdown);
}

async function pressInlineEquationKey(page: Page, key: string) {
    await expect(page.locator('.math-inline-input')).toBeFocused();
    // These keys remove the input. Send once to the focused page so locator
    // actionability retries cannot try to reuse an input the action just closed.
    await page.keyboard.press(key);
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
    await pressInlineEquationKey(page, 'Enter');
    await expect.poll(() => page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe('Before \\(y^3\\) after\n');
    await page.keyboard.press('Control+z');
    await expect.poll(() => page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe('Before \\(x^2\\) after\n');
    await page.locator('#editor .math-inline').click();
    await page.locator('.math-inline-input').fill('cancelled');
    await pressInlineEquationKey(page, 'Escape');
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe('Before \\(x^2\\) after\n');
    await page.locator('#editor .math-inline').click();
    await page.locator('.math-inline-input').fill('z^4');
    await pressInlineEquationKey(page, 'Control+s');
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
    await page.keyboard.press(lineEndKey);
    await page.keyboard.type(' $x^2$ ');
    await expect(page.locator('#editor .math-inline .katex')).toHaveCount(1);
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toContain('Before $x^2$');
});

test('nested display equations retain their position before and after sublists', async ({ page }) => {
    const source = '- Parent\n  $$\n  x^2\n  $$\n  - Child\n    \\[\n    y^3\n    \\]\n  $$\n  z^4\n  $$\n';
    await setMarkdown(page, source);
    await expect(page.locator('#editor .math-wrapper .katex')).toHaveCount(3);
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
    await setMarkdown(page, '- Parent\n\n  $$\n  x^2\n  $$\n');
    await expect(page.locator('#editor li > .math-wrapper .katex')).toHaveCount(1);
});

test('math-looking text inside quoted fences remains code', async ({ page }) => {
    await setMarkdown(page, '> ```text\n> $x$ and \\(y\\)\n> ```\n');
    await expect(page.locator('#editor .math-inline')).toHaveCount(0);
    await expect(page.locator('#editor blockquote pre')).toHaveCount(1);
});

test('Insert Equation creates dollars and Insert Inline Equation edits selected text', async ({ page }) => {
    await setMarkdown(page, 'Before\n');
    await page.locator('#editor p').first().click();
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+/`);
    await page.locator('.command-palette-item[data-action="math"]').click();
    await page.locator('#editor .math-wrapper code').fill('a^2');
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toContain('$$\na^2\n$$');

    await setMarkdown(page, 'x^2\n');
    await page.locator('#editor p').first().evaluate(el => {
        const r = document.createRange(); r.selectNodeContents(el);
        const s = window.getSelection()!; s.removeAllRanges(); s.addRange(r);
    });
    await page.keyboard.press(`${modifier}+/`);
    await page.locator('.command-palette-item[data-action="inlineMath"]').click();
    await expect(page.locator('.math-inline-input')).toHaveValue('x^2');
    await page.locator('.math-inline-input').fill('y^3');
    await pressInlineEquationKey(page, 'Enter');
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe('$y^3$\n');
});

test('typing a display opener followed by Enter creates an editable block', async ({ page }) => {
    for (const opener of ['$$', '\\[']) {
        await setMarkdown(page, '\n');
        await page.locator('#editor p').first().click();
        await page.keyboard.type(opener);
        await page.keyboard.press('Enter');
        await expect(page.locator('#editor .math-wrapper')).toHaveCount(1);
        await page.keyboard.type('x^2');
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toContain(opener + '\nx^2\n' + (opener === '$$' ? '$$' : '\\]'));
    }
});

test('clearing an inline equation removes it and undo restores its source', async ({ page }) => {
    await setMarkdown(page, 'Before $x$ after\n');
    await page.locator('#editor .math-inline').click();
    await page.locator('.math-inline-input').fill('');
    await pressInlineEquationKey(page, 'Enter');
    await expect(page.locator('#editor .math-inline')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe('Before  after\n');
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe('Before $x$ after\n');
});

test('copying rendered equations keeps their TeX and delimiters', async ({ page }) => {
    const source = 'Inline \\(x^2\\) and **$y^3$**.\n\n$$\n\\frac{a}{b}\n$$\n';
    await setMarkdown(page, source);
    await expect(page.locator('#editor .katex')).toHaveCount(3);
    const copied = await page.locator('#editor').evaluate(editor => {
        const range = document.createRange(); range.selectNodeContents(editor);
        const selection = getSelection()!; selection.removeAllRanges(); selection.addRange(range);
        const clipboard = new DataTransfer();
        editor.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, clipboardData: clipboard }));
        return clipboard.getData('text/plain');
    });
    expect(copied).toBe(source.trim());
});

test('unrecognized inline delimiters stay literal after save and reopen', async ({ page }) => {
    const source = String.raw`Currency $5 and $10; escaped \$x\$; code \(unfinished.` + '\n';
    await setMarkdown(page, source);
    const saved = await page.evaluate(() => (window as any).__testApi.getMarkdown());
    await setMarkdown(page, saved);
    await expect(page.locator('#editor .math-inline')).toHaveCount(0);
    expect(saved).toContain(String.raw`\$x\$`);
});

test('an inline input ignores composing Enter and exports invalid TeX as visible source', async ({ page }) => {
    await setMarkdown(page, '$x$\n');
    await page.locator('#editor .math-inline').click();
    await page.locator('.math-inline-input').dispatchEvent('keydown', { key: 'Enter', isComposing: true });
    await expect(page.locator('.math-inline-input')).toBeVisible();
    await page.locator('.math-inline-input').fill('\\invalidcommand');
    await pressInlineEquationKey(page, 'Enter');
    await page.evaluate(() => (window as any).__hostMessageHandler({
        type: 'prepareExport', requestId: 'invalid-inline', markdown: '$\\invalidcommand$\n'
    }));
    await expect.poll(() => page.evaluate(() => (window as any).__testApi.messages
        .filter((message: any) => message.type === 'exportPrepared').length)).toBe(1);
    const result = await page.evaluate(() => (window as any).__testApi.messages.find((message: any) => message.type === 'exportPrepared'));
    expect(result.html).toContain('class="export-warning"');
    expect(result.html).toContain('$\\invalidcommand$');
    expect(result.warnings.some((warning: any) => warning.code === 'math-fallback')).toBe(true);
});

test('saving an open equation edit refreshes TOC and preserves YAML and code', async ({ page }) => {
    const front = '---\ntitle: "Keep: exact" # metadata\n---\n';
    await setMarkdown(page, front + '\n[TOC]\n\n# Cost $x^2$\n\n```python\nprint("kept")\n```\n');
    await page.locator('#editor h1 .math-inline').click();
    await page.locator('.math-inline-input').fill('y^3');
    await pressInlineEquationKey(page, 'Control+s');
    const saves = () => page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'save'));
    await expect.poll(async () => (await saves()).length).toBe(1);
    const saved = (await saves())[0].content;
    expect(saved.startsWith(front)).toBe(true);
    expect(saved).toContain('# Cost $y^3$');
    expect(saved).toContain('[Cost $y^3$](#cost-y3)');
    expect(saved).toContain('```python\nprint("kept")\n```');
    await expect(page.locator('#editor h1')).toHaveAttribute('id', 'cost-y3');
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })));
    await expect.poll(async () => (await saves()).length).toBe(2);
    expect((await saves())[1].content).toBe(saved);
    await page.evaluate(md => (window as any).__hostMessageHandler({ type: 'prepareExport', requestId: 'combined', markdown: md }), saved);
    await expect.poll(() => page.evaluate(() => (window as any).__testApi.messages.some((m: any) => m.type === 'exportPrepared' && m.requestId === 'combined'))).toBe(true);
    const exported = await page.evaluate(() => (window as any).__testApi.messages.find((m: any) => m.type === 'exportPrepared' && m.requestId === 'combined'));
    expect(exported.html).toContain('katex');
    expect(exported.html).toContain('href="#cost-y3"');
    expect(exported.html).not.toContain('front-matter-source');
    expect(exported.html).not.toContain('toc-refresh');
    // TOC labels are plain source text, so the literal equation label is disclosed.
    expect(exported.html).toContain('Cost $y^3$');
    expect(exported.warnings.map((warning: { code: string }) => warning.code)).toEqual(['renderer-math-source']);
});
