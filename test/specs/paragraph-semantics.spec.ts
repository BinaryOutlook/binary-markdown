import { test, expect, Page } from '@playwright/test';

const sample = '## 1. Summary\n\n**Alpha Bravo Charlie.**\n\nDelta:\n\n- Echo\n\n## 2. Breakdown of Fox\n\n| Golf | Hotel | India | Juliet |\n| ---- | ----- | ----- | ------ |\n| Kilo | Lima | Mike | November |\n\nOctober';
const setMarkdown = (page: Page, markdown: string) => page.evaluate(md => (window as any).__testApi.setMarkdown(md), markdown);
const getMarkdown = (page: Page): Promise<string> => page.evaluate(() => (window as any).__testApi.getMarkdown());

async function placeCaret(page: Page, selector: string, end = true) {
    await page.locator(selector).evaluate((element, atEnd) => {
        (document.querySelector('#editor') as HTMLElement).focus();
        const range = document.createRange(); range.selectNodeContents(element); range.collapse(!atEnd);
        const selection = getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    }, end);
}

test.beforeEach(async ({ page }) => {
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
});

test('separator lines produce seven content blocks without empty paragraphs', async ({ page }) => {
    await setMarkdown(page, sample);
    await expect(page.locator('#editor > *')).toHaveCount(7);
    await expect(page.locator('#editor > p')).toHaveCount(3);
    await expect(page.locator('#editor > h2')).toHaveCount(2);
    await expect(page.locator('#editor > ul')).toHaveCount(1);
    await expect(page.locator('#editor > table')).toHaveCount(1);
});

test('ordinary source newlines remain within one visual paragraph', async ({ page }) => {
    await setMarkdown(page, 'Alpha\nBeta\n');
    await expect(page.locator('#editor > p')).toHaveCount(1);
    const height = await page.locator('#editor > p').evaluate(p => ({
        actual: p.getBoundingClientRect().height, line: parseFloat(getComputedStyle(p).lineHeight)
    }));
    expect(height.actual).toBeLessThan(height.line * 1.1);
    expect(await getMarkdown(page)).toBe('Alpha\nBeta\n');
});

test('separator count and a final newline do not increase visible spacing', async ({ page }) => {
    for (const theme of ['github', 'things', 'night', 'perplexity', 'sepia', 'dark', 'minimal']) {
        await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
        const gaps: number[] = [];
        for (const separators of ['\n', '\n\n', '\n\n\n\n']) {
            await setMarkdown(page, '## Heading' + separators + 'Text\n');
            await expect(page.locator('#editor > *')).toHaveCount(2);
            gaps.push(await page.evaluate(() => {
                const [heading, paragraph] = Array.from(document.querySelector('#editor')!.children);
                return paragraph.getBoundingClientRect().top - heading.getBoundingClientRect().bottom;
            }));
        }
        expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1);
    }
});

test('editing within a paragraph retains both hard-break syntaxes', async ({ page }) => {
    for (const breakSource of ['  \n', '\\\n']) {
        await setMarkdown(page, 'Alpha' + breakSource + 'Beta\n');
        await placeCaret(page, '#editor > p');
        await page.keyboard.type('!');
        expect(await getMarkdown(page)).toBe('Alpha' + breakSource + 'Beta!\n');
        await setMarkdown(page, await getMarkdown(page));
        const height = await page.locator('#editor > p').evaluate(p => ({ actual: p.getBoundingClientRect().height, line: parseFloat(getComputedStyle(p).lineHeight) }));
        expect(height.actual / height.line).toBeCloseTo(2, 1);
    }
});

test('splitting a paragraph retains the following authored separator and survives source switching', async ({ page }) => {
    await setMarkdown(page, 'AlphaBeta\n\n\n\nGamma\n');
    await page.locator('#editor > p').first().evaluate(p => {
        (document.getElementById('editor') as HTMLElement).focus();
        const range = document.createRange(); range.setStart(p.firstChild!, 5); range.collapse(true);
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    });
    await page.keyboard.press('Enter');
    expect(await getMarkdown(page)).toBe('Alpha\n\nBeta\n\n\n\nGamma\n');
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
    await expect(page.locator('#sourceEditor')).toHaveValue('Alpha\n\nBeta\n\n\n\nGamma\n');
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
    await expect(page.locator('#editor > p')).toHaveCount(3);
});

test('paragraph and hard-break edits undo and redo without adding separator nodes', async ({ page }) => {
    for (const key of ['Enter', 'Shift+Enter']) {
        await setMarkdown(page, 'Alpha\n');
        await placeCaret(page, '#editor > p');
        await page.keyboard.press(key);
        await page.keyboard.type('Beta');
        await page.keyboard.press('Meta+s');
        const changed = await getMarkdown(page);
        await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'performUndo' }));
        await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'performUndo' }));
        expect(await getMarkdown(page)).toBe('Alpha\n');
        await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'performRedo' }));
        await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'performRedo' }));
        expect(await getMarkdown(page)).toBe(changed);
        await setMarkdown(page, changed);
        await expect(page.locator('#editor > p')).toHaveCount(key === 'Enter' ? 2 : 1);
    }
});

test('copy and paste carry paragraph boundaries without leaking unselected source', async ({ page }) => {
    await setMarkdown(page, 'Private prefix Alpha\n\nBeta private suffix\n');
    const copied = await page.evaluate(() => {
        const paragraphs = document.querySelectorAll('#editor > p');
        const range = document.createRange(); range.setStart(paragraphs[0].firstChild!, 15); range.setEnd(paragraphs[1].firstChild!, 4);
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
        const data = new DataTransfer();
        document.getElementById('editor')!.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true }));
        return { text: data.getData('text/plain'), html: data.getData('text/html') };
    });
    expect(copied.text).toBe('Alpha\n\nBeta');
    expect(copied.html).not.toMatch(/Private|private|data-md-source/);
    await setMarkdown(page, '');
    await placeCaret(page, '#editor > p');
    await page.evaluate(text => {
        const data = new DataTransfer(); data.setData('text/plain', text);
        document.getElementById('editor')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, copied.text);
    expect(await getMarkdown(page)).toBe('Alpha\n\nBeta\n');
    await expect(page.locator('#editor > p')).toHaveCount(2);
});

test('editing a loose list retains its start and continuation paragraph on reopening', async ({ page }) => {
    await setMarkdown(page, '3. First\n\n   Continued\n\n4. Second\n');
    await placeCaret(page, '#editor > ol > li:last-child');
    await page.keyboard.type('!');
    expect(await getMarkdown(page)).toBe('3. First\n\n   Continued\n\n4. Second!\n');
    await setMarkdown(page, await getMarkdown(page));
    await expect(page.locator('#editor > ol')).toHaveAttribute('start', '3');
    await expect(page.locator('#editor > ol > li')).toHaveCount(2);
    await expect(page.locator('#editor > ol > li:first-child > p')).toHaveText('Continued');
});

test('view-only actions preserve authored source and do not send document edits', async ({ page }) => {
    const source = '\n## Heading\n\n\nText  \nNext\n\n';
    await setMarkdown(page, source);
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
    await expect(page.locator('#sourceEditor')).toHaveValue(source);
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'editorWidth', mode: 'custom', maxWidth: 600 }));
    expect(await getMarkdown(page)).toBe(source);
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'edit'))).toEqual([]);
});

test('header-only table alignment survives a cell edit and reopening', async ({ page }) => {
    await setMarkdown(page, '| Left | Right |\n| :--- | ---: |\n');
    await expect(page.locator('#editor th').last()).toHaveCSS('text-align', 'right');
    await page.locator('#editor th').last().fill('Changed');
    const source = await getMarkdown(page);
    expect(source).toContain('| :--- | ---: |');
    await setMarkdown(page, source);
    await expect(page.locator('#editor th').first()).toHaveCSS('text-align', 'left');
    await expect(page.locator('#editor th').last()).toHaveCSS('text-align', 'right');
});

test('a hard break inside underlined prose remains a break after editing', async ({ page }) => {
    await setMarkdown(page, '<u>Alpha  \nBeta</u>\n');
    await placeCaret(page, '#editor > p');
    await page.keyboard.type('!');
    const source = await getMarkdown(page);
    expect(source).toContain('  \n');
    await setMarkdown(page, source);
    await expect(page.locator('#editor > p')).toHaveCount(1);
    await expect(page.locator('#editor > p br')).toHaveCount(1);
});

test('source selection offsets include invisible separators and list continuation lines', async ({ page }) => {
    await setMarkdown(page, '# Heading\n\n3. First\n\n   Continued\n\n4. Second\n\nTail\n');
    await page.locator('#editor ol > li:last-child').evaluate(li => {
        (document.getElementById('editor') as HTMLElement).focus();
        const range = document.createRange(); range.selectNodeContents(li);
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    });
    await page.keyboard.press('Meta+l');
    const selection = await page.evaluate(() => (window as any).__testApi.messages.findLast((m: any) => m.type === 'sendToChat'));
    expect(selection).toMatchObject({ startLine: 6, endLine: 6, selectedMarkdown: '4. Second' });
});

test('unrelated edits preserve separator whitespace and explicit hard breaks', async ({ page }) => {
    const source = 'Alpha  \nBeta\n\n\n\nGamma\\\nDelta\n\nEnd\n';
    await setMarkdown(page, source);
    await placeCaret(page, '#editor > p:last-child');
    await page.keyboard.type('!');
    expect(await getMarkdown(page)).toBe(source.replace('End', 'End!'));
    await page.keyboard.press('Meta+s');
    const saved = await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'save').at(-1).content);
    expect(saved).toBe(source.replace('End', 'End!'));
    await setMarkdown(page, saved);
    await expect(page.locator('#editor > p')).toHaveCount(3);
    await expect(page.locator('#editor p br:not([data-editor-placeholder])')).toHaveCount(2);
});

test('Enter creates a paragraph whose boundary survives reopening', async ({ page }) => {
    await setMarkdown(page, 'Alpha');
    await placeCaret(page, '#editor > p');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Beta');
    expect(await getMarkdown(page)).toBe('Alpha\n\nBeta\n');
    await setMarkdown(page, await getMarkdown(page));
    await expect(page.locator('#editor > p')).toHaveCount(2);
});

test('Shift+Enter creates a hard break within the same paragraph', async ({ page }) => {
    await setMarkdown(page, 'Alpha');
    await placeCaret(page, '#editor > p');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('Beta');
    expect(await getMarkdown(page)).toBe('Alpha  \nBeta\n');
    await setMarkdown(page, await getMarkdown(page));
    await expect(page.locator('#editor > p')).toHaveCount(1);
    await expect(page.locator('#editor > p > br')).toHaveCount(1);
});

test('Backspace merges paragraphs without a hidden separator stop', async ({ page }) => {
    await setMarkdown(page, 'Alpha\n\nBeta');
    await placeCaret(page, '#editor > p:last-child', false);
    await page.keyboard.press('Backspace');
    expect(await getMarkdown(page)).toBe('AlphaBeta\n');
    await expect(page.locator('#editor > p')).toHaveCount(1);
});

test('loose ordered lists retain continuation ownership and numbering after an unrelated edit', async ({ page }) => {
    const source = '3. First\n\n   Continued paragraph\n\n4. Second\n\nEnd\n';
    await setMarkdown(page, source);
    await expect(page.locator('#editor > ol')).toHaveCount(1);
    await expect(page.locator('#editor > ol > li')).toHaveCount(2);
    await expect(page.locator('#editor > ol > li:first-child')).toContainText('Continued paragraph');
    await placeCaret(page, '#editor > p:last-child');
    await page.keyboard.type('!');
    expect(await getMarkdown(page)).toBe(source.replace('End', 'End!'));
});

test('code blank lines and trailing spaces remain content', async ({ page }) => {
    const source = '```text\nAlpha\n\nBeta  \n\n```\n\nEnd\n';
    await setMarkdown(page, source);
    await placeCaret(page, '#editor > p:last-child');
    await page.keyboard.type('!');
    expect(await getMarkdown(page)).toBe(source.replace('End', 'End!'));
    await expect(page.locator('#editor > *')).toHaveCount(2);
});

test('HTML export uses semantic blocks and excludes source separator metadata', async ({ page }) => {
    await setMarkdown(page, sample);
    await page.evaluate(markdown => (window as any).__hostMessageHandler({
        type: 'prepareExport', requestId: 'paragraphs', markdown, theme: 'github', fontSize: 16
    }), sample);
    await page.waitForFunction(() => (window as any).__testApi.messages.some((m: any) => m.requestId === 'paragraphs'));
    const html = await page.evaluate(() => (window as any).__testApi.messages.find((m: any) => m.requestId === 'paragraphs').html);
    expect(html).not.toContain('<p><br></p>');
    expect(html).not.toContain('data-md-source');
    const count = await page.evaluate(content => {
        const template = document.createElement('template'); template.innerHTML = content;
        return template.content.querySelectorAll('p').length;
    }, html);
    expect(count).toBe(3);
});
