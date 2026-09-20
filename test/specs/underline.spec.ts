import { test, expect, Page } from '@playwright/test';

async function setup(page: Page, source: string) {
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(source => (window as any).__testApi.setMarkdown(source), source);
}

async function select(page: Page, selector: string, text?: string) {
    await page.evaluate(({ selector, text }) => {
        const element = document.querySelector(selector)!;
        const range = document.createRange();
        if (text) {
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode()!;
            while (node && !node.textContent!.includes(text)) node = walker.nextNode()!;
            if (!node) throw new Error('Missing selection text');
            const start = node.textContent!.indexOf(text);
            range.setStart(node, start); range.setEnd(node, start + text.length);
        } else range.selectNodeContents(element);
        document.getElementById('editor')!.focus();
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    }, { selector, text });
}

async function markdown(page: Page) { return page.evaluate(() => (window as any).htmlToMarkdown()); }
async function underline(page: Page) { await page.locator('#toolbar [data-action="underline"]').click(); }

for (const [name, source, selector] of [
    ['paragraph', 'Before <u>marked</u> after.\n', '#editor > p u'],
    ['bold', '<u>**marked**</u>\n', '#editor u :is(strong,b)'],
    ['italic', '*<u>marked</u>*\n', '#editor :is(em,i) u'],
    ['strike', '~~<u>marked</u>~~\n', '#editor del u'],
    ['link', '[<u>**marked**</u>](https://example.com/reference)\n', '#editor a u :is(strong,b)'],
    ['outer link', '<u>[marked](https://example.com/reference)</u>\n', '#editor u a'],
    ['list', '- <u>marked</u> item\n', '#editor li u'],
    ['table', '| Name |\n| --- |\n| <u>marked</u> cell |\n', '#editor td u'],
    ['quote', '> <u>marked</u>\n', '#editor blockquote u'],
]) {
    test(`${name} underline survives unrelated editing, source/save and reopening`, async ({ page }) => {
        await setup(page, source + '\nEnd paragraph.\n');
        await expect(page.locator(selector)).toHaveText('marked');
        await page.locator('#editor > p').filter({ hasText: 'End paragraph.' }).click();
        await page.keyboard.press('End'); await page.keyboard.type(' edited');
        await page.locator('[data-action="source"]').click();
        const saved = await page.locator('#sourceEditor').inputValue();
        expect(saved).toContain('<u>'); expect(saved).toContain('End paragraph. edited');
        await page.keyboard.press('Control+s');
        await expect.poll(() => page.evaluate(() => (window as any).__testApi.messages.findLast((m: any) => m.type === 'save')?.content)).toBe(saved);
        await page.locator('[data-action="source"]').click();
        await page.evaluate(saved => (window as any).__testApi.setMarkdown(saved), saved);
        await expect(page.locator('#editor u')).toHaveText('marked');
        expect(await markdown(page)).toBe(saved);
        await expect(page.locator('#editor u u')).toHaveCount(0);
        if (name.includes('link')) await expect(page.locator('#editor a')).toHaveAttribute('href', 'https://example.com/reference');
    });
}

for (const [source, expected] of [
    ['Before target after.\n', 'Before <u>target</u> after.'],
    ['Before <u>target</u> after.\n', 'Before target after.'],
    ['Before <u>whole target phrase</u> after.\n', 'Before <u>whole </u>target<u> phrase</u> after.'],
    ['Before **target** after.\n', 'Before <u>**target**</u> after.'],
    ['Before [target](https://example.com/) after.\n', 'Before [<u>target</u>](https://example.com/) after.'],
]) {
    test(`toggle preserves surrounding formatting: ${source.trim()}`, async ({ page }) => {
        await setup(page, source); await select(page, '#editor > p', 'target');
        const before = await markdown(page);
        await underline(page);
        const after = await markdown(page); expect(after.trim()).toBe(expected);
        expect(await page.evaluate(() => getSelection()!.toString())).toBe('target');
        await page.locator('[data-action="undo"]').click(); expect(await markdown(page)).toBe(before);
        await page.locator('[data-action="redo"]').click(); expect(await markdown(page)).toBe(after);
    });
}

test('mixed selection becomes fully underlined, then removes underline', async ({ page }) => {
    await setup(page, 'Before <u>marked</u> after.\n'); await select(page, '#editor > p');
    await underline(page); expect((await markdown(page)).trim()).toBe('<u>Before marked after.</u>');
    await underline(page); expect((await markdown(page)).trim()).toBe('Before marked after.');
});

for (const [source, selector] of [
    ['- **target** item\n', '#editor li'],
    ['| Name |\n| --- |\n| **target** cell |\n', '#editor td'],
    ['> **target** quote\n', '#editor blockquote'],
]) {
    test(`GUI underline preserves ${selector} and nested formatting`, async ({ page }) => {
        await setup(page, source); await select(page, selector, 'target');
        const before = await markdown(page); await underline(page);
        expect(await page.locator(selector).textContent()).toContain('target');
        expect(await markdown(page)).toContain('<u>');
        const saved = await markdown(page);
        await page.evaluate(saved => (window as any).__testApi.setMarkdown(saved), saved);
        await expect(page.locator(selector + ' u')).toHaveText('target');
        await expect(page.locator(selector + ' :is(strong,b)')).toHaveText('target');
        await select(page, selector, 'target'); await underline(page);
        expect(await markdown(page)).toBe(before);
    });
}

test('selection across paragraphs gets separate inline wrappers', async ({ page }) => {
    await setup(page, 'First paragraph.\n\nSecond paragraph.\n');
    await select(page, '#editor'); await underline(page);
    const saved = await markdown(page);
    expect(saved).toContain('<u>First paragraph.</u>');
    expect(saved).toContain('<u>Second paragraph.</u>');
    await page.evaluate(saved => (window as any).__testApi.setMarkdown(saved), saved);
    await expect(page.locator('#editor > p u')).toHaveCount(2);
});

test('code, escaped tags, attributes and unrelated HTML stay literal', async ({ page }) => {
    const source = String.raw`Literal \<u>example\</u> and \<u>one-sided</u>.

Inline ` + '`<u>code</u>`' + String.raw`.

<u onclick="window.__unsafe = true">attributes</u> <script>window.__unsafe = true</script>

` + '```html\n<u>fenced</u>\n\n```\n\nEnd paragraph.\n';
    await setup(page, source);
    await expect(page.locator('#editor u, #editor script')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__unsafe)).toBeUndefined();
    await page.locator('#editor > p').filter({ hasText: 'End paragraph.' }).click();
    await page.keyboard.press('End'); await page.keyboard.type(' edited');
    const saved = await markdown(page);
    expect(saved).toContain(String.raw`\<u>example\</u>`);
    expect(saved).toContain('`<u>code</u>`'); expect(saved).toContain('<u onclick=');
    expect(saved).toContain('```html\n<u>fenced</u>\n\n```');
    await page.evaluate(saved => (window as any).__testApi.setMarkdown(saved), saved);
    await expect(page.locator('#editor u, #editor script')).toHaveCount(0);
});

test('code selection rejects underline without changing source or undo', async ({ page }) => {
    await setup(page, 'Before `target` after.\n'); await select(page, '#editor code', 'target');
    const before = await markdown(page); await underline(page);
    expect(await markdown(page)).toBe(before);
    await expect(page.locator('[data-action="undo"]')).toBeDisabled();
});

test('keyboard shortcut and caret typing preserve underline through source mode', async ({ page }) => {
    await setup(page, 'Before target after.\n'); await select(page, '#editor > p', 'target');
    await page.keyboard.press('Control+u'); expect(await markdown(page)).toContain('<u>target</u>');
    await page.locator('[data-action="undo"]').click();
    await select(page, '#editor > p', 'target');
    await page.evaluate(() => getSelection()!.collapseToEnd());
    await page.keyboard.press('Control+u');
    await page.keyboard.type(' added');
    await page.locator('[data-action="source"]').click();
    expect(await page.locator('#sourceEditor').inputValue()).toContain('<u> added</u>');
});

for (const [source, selector] of [
    ['> First line\n> Second line\n', '#editor blockquote'],
    ['| Name |\n| --- |\n| First line<br>Second line |\n', '#editor td'],
]) {
    test(`multiline underline retains line boundaries in ${selector}`, async ({ page }) => {
        await setup(page, source); await select(page, selector);
        const before = await markdown(page); await underline(page);
        const saved = await markdown(page);
        expect(saved).toContain('First line'); expect(saved).toContain('Second line');
        await page.locator('[data-action="undo"]').click(); expect(await markdown(page)).toBe(before);
        await page.locator('[data-action="redo"]').click(); expect(await markdown(page)).toBe(saved);
        await page.evaluate(saved => (window as any).__testApi.setMarkdown(saved), saved);
        if (selector.includes('blockquote')) {
            expect(await page.locator(selector).textContent()).toBe('First line\nSecond line');
        } else await expect(page.locator(selector + ' br')).toHaveCount(1);
        expect((await page.locator(selector + ' u').allTextContents()).join(' ')).toContain('First line');
        expect((await page.locator(selector + ' u').allTextContents()).join(' ')).toContain('Second line');
    });
}

test('HTML paste retains only underline semantics, without attributes', async ({ page }) => {
    await setup(page, ''); await select(page, '#editor');
    await page.evaluate(() => {
        const data = new DataTransfer();
        data.setData('text/html', '<p><u title="external" onclick="window.__unsafe=true"><strong>marked</strong></u></p>');
        data.setData('text/plain', 'marked');
        document.getElementById('editor')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await expect(page.locator('#editor u')).toHaveText('marked');
    await expect(page.locator('#editor u')).not.toHaveAttribute('onclick');
    expect(await markdown(page)).toContain('<u>**marked**</u>');
});

test('nested and adjacent underline wrappers normalize without accumulating', async ({ page }) => {
    await setup(page, '<u>one <u>二</u></u><u> three</u>\n');
    const saved = await markdown(page);
    expect(saved.trim()).toBe('<u>one 二 three</u>');
    for (let repeat = 0; repeat < 3; repeat++) {
        await page.evaluate(saved => (window as any).__testApi.setMarkdown(saved), saved);
        expect(await markdown(page)).toBe(saved);
        await expect(page.locator('#editor u')).toHaveCount(1);
    }
});

test('underline-looking tags in link destinations stay in the destination', async ({ page }) => {
    const source = '[label](https://example.com/<u>path</u>)\n';
    await setup(page, source);
    await expect(page.locator('#editor u')).toHaveCount(0);
    expect((await markdown(page)).trim()).toBe(source.trim());
});

test('underline is available through the Action Palette in Simple mode', async ({ page }) => {
    await setup(page, 'Before target after.\n'); await select(page, '#editor > p', 'target');
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toolbarMode', value: 'simple' }));
    await page.keyboard.press('Control+/');
    await page.locator('.command-palette-input').fill('Underline');
    await page.keyboard.press('Enter');
    expect(await markdown(page)).toContain('<u>target</u>');
    await page.locator('[data-action="undo"]').click();
    expect((await markdown(page)).trim()).toBe('Before target after.');
});

test('underline can undo and redo before the next animation frame', async ({ page }) => {
    await setup(page, 'Before target after.\n'); await select(page, '#editor > p', 'target');
    const result = await page.evaluate(() => {
        const md = () => (window as any).htmlToMarkdown();
        const click = (action: string) => (document.querySelector(`#toolbar [data-action="${action}"]`) as HTMLButtonElement).click();
        const before = md(); click('underline'); const after = md(); click('undo'); const undone = md(); click('redo');
        return { before, after, undone, redone: md() };
    });
    expect(result.after).toContain('<u>target</u>');
    expect(result.undone).toBe(result.before); expect(result.redone).toBe(result.after);
});
