import { test, expect, Page } from '@playwright/test';

const source = '# Example\n\n[Jump](#legacy-section)\n\n<a id="legacy-section"></a>\n<a name=\'old-section\'></a>\n\n## Renamed section\n\nBody text\n\n<a id="end"></a>\n';
const setMarkdown = (page: Page, markdown: string) => page.evaluate(value => (window as any).__testApi.setMarkdown(value), markdown);
const markdown = (page: Page): Promise<string> => page.evaluate(() => (window as any).__testApi.getMarkdown());
const host = (page: Page, message: object) => page.evaluate(value => (window as any).__hostMessageHandler(value), message);

test.beforeEach(async ({ page }) => {
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
});

test('anchors occupy no visible line and survive edits, save, undo and source switching', async ({ page }) => {
    await setMarkdown(page, source);
    await expect(page.locator('#editor > .markdown-anchor')).toHaveCount(2);
    await expect(page.locator('#editor')).not.toContainText('<a');
    expect(await markdown(page)).toBe(source);
    for (const theme of ['github', 'things', 'night', 'perplexity', 'sepia', 'dark', 'minimal']) {
        await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
        expect(await page.locator('.markdown-anchor').first().evaluate(element => element.getBoundingClientRect().height)).toBe(0);
    }
    await page.locator('#editor > p').filter({ hasText: 'Body text' }).fill('Changed body');
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })));
    const saved = await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => message.type === 'save').at(-1));
    expect(saved.content).toBe(source.replace('Body text', 'Changed body'));
    await host(page, { type: 'performUndo' });
    expect(await markdown(page)).toBe(source);
    await host(page, { type: 'performRedo' });
    expect(await markdown(page)).toBe(saved.content);
    await host(page, { type: 'toggleSourceMode' });
    await expect(page.locator('#sourceEditor')).toHaveValue(saved.content);
    await host(page, { type: 'toggleSourceMode' });
    expect(await markdown(page)).toBe(saved.content);
    await setMarkdown(page, saved.content);
    expect(await markdown(page)).toBe(saved.content);
});

test('custom fragments locate document targets without changing content or selection', async ({ page }) => {
    await setMarkdown(page, source);
    await page.evaluate(() => {
        const wrapper = document.querySelector('#editorWrapper') as any;
        wrapper.scrollTo = (options: any) => { (window as any).__anchorScroll = options.top; };
        const paragraph = document.querySelector('#editor > p')!;
        const range = document.createRange(); range.selectNodeContents(paragraph); range.collapse(true);
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    });
    await page.evaluate(() => {
        const selection = getSelection()!;
        (window as any).__anchorSelection = [selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset];
    });
    for (const anchor of ['legacy-section', 'old-section', 'renamed-section', 'end']) {
        await page.evaluate(() => { (window as any).__anchorScroll = undefined; });
        await host(page, { type: 'scrollToAnchor', anchor });
        expect(await page.evaluate(() => Number.isFinite((window as any).__anchorScroll))).toBe(true);
        expect(await markdown(page)).toBe(source);
    }
    expect(await page.evaluate(() => {
        const selection = getSelection()!;
        return [selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset]
            .every((value, index) => value === (window as any).__anchorSelection[index]);
    })).toBe(true);
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => ['edit', 'save'].includes(message.type)))).toEqual([]);
    await page.locator('#editor a[href="#legacy-section"]').click();
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => message.type === 'openLink').at(-1).href)).toBe('#legacy-section');
});

test('encoded names, duplicate targets and application ID collisions stay scoped to document', async ({ page }) => {
    await setMarkdown(page, '<a id="editor"></a>\n\n## First\n\n<a name="editor"></a>\n\n## Second\n\n<a id="章"></a>\n\nText\n\n<a id="100%"></a>\n');
    await page.evaluate(() => {
        const wrapper = document.querySelector('#editorWrapper') as any;
        wrapper.scrollTo = (options: any) => { (window as any).__anchorScroll = options.top; };
    });
    await host(page, { type: 'scrollToAnchor', anchor: 'editor' });
    expect(await page.locator('#editor > h2').first().evaluate(element => (element as HTMLElement).style.backgroundColor)).toBe('var(--selection-bg)');
    expect(await page.locator('#editor > h2').last().evaluate(element => (element as HTMLElement).style.backgroundColor)).toBe('');
    for (const anchor of ['%E7%AB%A0', '100%']) {
        await page.evaluate(() => { (window as any).__anchorScroll = undefined; });
        await host(page, { type: 'scrollToAnchor', anchor });
        expect(await page.evaluate(() => Number.isFinite((window as any).__anchorScroll))).toBe(true);
    }
    await expect(page.locator('#editor')).toHaveCount(1);
});

test('export emits only inert anchors and preserves literal unsupported HTML', async ({ page }) => {
    const input = source + '\n<a id="unsafe" onclick="bad"></a>\n\n`<a id="code"></a>`\n';
    await setMarkdown(page, input);
    await host(page, { type: 'prepareExport', requestId: 'anchors', markdown: input });
    await page.waitForFunction(() => (window as any).__testApi.messages.some((message: any) => message.type === 'exportPrepared'));
    const prepared = await page.evaluate(() => (window as any).__testApi.messages.find((message: any) => message.type === 'exportPrepared'));
    const result = await page.evaluate(html => {
        const template = document.createElement('template'); template.innerHTML = html;
        return {
            targets: [...template.content.querySelectorAll('a:not([href])')].map(element => element.id || element.getAttribute('name')),
            text: template.content.textContent,
            active: template.content.querySelectorAll('[onclick],.markdown-anchor,[data-anchor-source]').length
        };
    }, prepared.html);
    expect(result.targets).toEqual(['legacy-section', 'old-section', 'end']);
    expect(result.active).toBe(0);
    expect(result.text).toContain('<a id="unsafe" onclick="bad"></a>');
    expect(result.text).toContain('<a id="code"></a>');
    expect(await markdown(page)).toBe(input);
});


test('leading anchors do not change the first visible heading position', async ({ page }) => {
    for (const theme of ['github', 'things', 'night', 'perplexity', 'sepia', 'dark', 'minimal']) {
        await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
        await setMarkdown(page, '# Heading\n\nBody\n');
        const baseline = await page.locator('#editor > h1').evaluate(element => element.getBoundingClientRect().top);
        await setMarkdown(page, '<a id="first"></a>\n\n<a name="second"></a>\n\n# Heading\n\nBody\n');
        expect(await page.locator('#editor > h1').evaluate(element => element.getBoundingClientRect().top)).toBe(baseline);
    }
});


test('deletion and selection replacement retain invisible anchors with undo', async ({ page }) => {
    const original = 'Before\n\n<a id="target"></a>\n\nAfter\n';
    for (const action of ['Delete', 'Backspace', 'selection-delete', 'replace', 'select-all']) {
        await setMarkdown(page, original);
        await page.evaluate(action => {
            const paragraphs = document.querySelectorAll('#editor > p');
            document.getElementById('editor')!.focus();
            const range = document.createRange();
            if (action === 'Delete' || action === 'Backspace') {
                range.selectNodeContents(paragraphs[action === 'Delete' ? 0 : 1]); range.collapse(action === 'Backspace');
            } else if (action === 'select-all') range.selectNodeContents(document.getElementById('editor')!);
            else { range.setStart(paragraphs[0].firstChild!, 3); range.setEnd(paragraphs[1].firstChild!, 2); }
            getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
        }, action);
        if (action === 'replace' || action === 'select-all') await page.keyboard.insertText('Replacement');
        else await page.keyboard.press(action === 'selection-delete' ? 'Backspace' : action);
        const changed = await markdown(page);
        expect(changed).toContain('<a id="target"></a>');
        expect(changed).not.toBe(original);
        await host(page, { type: 'performUndo' });
        expect(await markdown(page)).toBe(original);
        await host(page, { type: 'performRedo' });
        expect(await markdown(page)).toBe(changed);
    }
});


test('deleting at document boundaries leaves anchor-only metadata and undo unchanged', async ({ page }) => {
    for (const [input, key] of [['<a id="first"></a>\n\nVisible\n', 'Backspace'], ['Visible\n\n<a id="last"></a>\n', 'Delete']]) {
        await setMarkdown(page, input);
        await page.locator('#editor > p').evaluate((element, key) => {
            document.getElementById('editor')!.focus();
            const range = document.createRange(); range.selectNodeContents(element); range.collapse(key === 'Backspace');
            getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
        }, key);
        await page.keyboard.press(key);
        expect(await markdown(page)).toBe(input);
        expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => message.type === 'edit'))).toEqual([]);
    }
});


test('replacing an anchor-only document preserves every target in source order', async ({ page }) => {
    const input = '<a id="first"></a>\n\n<a name="second"></a>\n';
    await setMarkdown(page, input);
    await page.evaluate(() => {
        const editor = document.getElementById('editor')!; editor.focus();
        const range = document.createRange(); range.selectNodeContents(editor);
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    });
    await page.keyboard.insertText('New');
    expect(await markdown(page)).toBe('<a id="first"></a>\n\n<a name="second"></a>\n\nNew\n');
    await host(page, { type: 'performUndo' });
    expect(await markdown(page)).toBe(input);
});


test('Delete beside lists, quotes and tables preserves following anchor metadata', async ({ page }) => {
    for (const block of ['- Before', '> Before', '| Before |\n| --- |']) {
        const input = block + '\n\n<a id="target"></a>\n\nAfter\n';
        await setMarkdown(page, input);
        await page.evaluate(() => {
            const block = document.getElementById('editor')!.firstElementChild!;
            document.getElementById('editor')!.focus();
            const range = document.createRange(); range.selectNodeContents(block); range.collapse(false);
            getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
        });
        await page.keyboard.press('Delete');
        expect(await markdown(page)).toContain('<a id="target"></a>');
        await host(page, { type: 'performUndo' });
        expect(await markdown(page)).toBe(input);
    }
});


test('root-level caret boundaries cannot delete hidden metadata', async ({ page }) => {
    const input = 'Before\n\n<a id="target"></a>\n\nAfter\n';
    for (const [key, offset] of [['Delete', 1], ['Backspace', 2]] as const) {
        await setMarkdown(page, input);
        await page.evaluate(offset => {
            const editor = document.getElementById('editor')!; editor.focus();
            const range = document.createRange(); range.setStart(editor, offset); range.collapse(true);
            getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
        }, offset);
        await page.keyboard.press(key);
        expect(await markdown(page)).toContain('<a id="target"></a>');
        await host(page, { type: 'performUndo' });
        expect(await markdown(page)).toBe(input);
    }
});
