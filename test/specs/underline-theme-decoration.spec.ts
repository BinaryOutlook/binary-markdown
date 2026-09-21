import { test, expect, Page } from '@playwright/test';

const contexts = [
    { name: 'paragraph', source: 'Before [target](https://example.com/) after.\n', selector: '#editor > p:first-child' },
    { name: 'bullet', source: '- Before [target](https://example.com/) after.\n', selector: '#editor li' },
    { name: 'table cell', source: '| Header |\n| --- |\n| Before [target](https://example.com/) after. |\n', selector: '#editor td' },
];

async function setup(page: Page, source: string, theme: string) {
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(({ source, theme }) => {
        (window as any).__hostMessageHandler({ type: 'theme', value: theme });
        (window as any).__testApi.setMarkdown(source);
    }, { source, theme });
}

async function selectWord(page: Page, selector: string) {
    const point = await page.locator(selector).evaluate(element => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node && !node.textContent?.includes('target')) node = walker.nextNode();
        if (!node) throw new Error('Missing target word');
        const start = node.textContent!.indexOf('target');
        const range = document.createRange();
        range.setStart(node, start); range.setEnd(node, start + 6);
        const rect = range.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    await page.mouse.dblclick(point.x, point.y);
    expect(await page.evaluate(() => getSelection()!.toString())).toBe('target');
}

async function markdown(page: Page) {
    return page.evaluate(() => (window as any).htmlToMarkdown());
}

async function decoration(page: Page, selector: string) {
    return page.locator(selector).evaluate(element => {
        const style = getComputedStyle(element);
        return { line: style.textDecorationLine, color: style.textDecorationColor, offset: style.textUnderlineOffset };
    });
}

async function checkToggleAndReopen(page: Page, selector: string, decorated: string, modifier: string) {
    const before = await markdown(page);
    const appearance = await decoration(page, decorated);
    const hovered = await page.locator(decorated).evaluate(element => element.matches(':hover'));
    await page.keyboard.press(`${modifier}+u`);
    await expect(page.locator(`${selector} u`)).toHaveText('target');
    const after = await markdown(page);
    expect(after).toContain('<u>target</u>');
    expect(await decoration(page, decorated)).toEqual(appearance);
    await page.keyboard.press(`${modifier}+z`);
    expect(await markdown(page)).toBe(before);
    await page.keyboard.press(`${modifier}+Shift+z`);
    expect(await markdown(page)).toBe(after);
    // Undo/redo restores a caret; make a fresh word selection for removal.
    await selectWord(page, selector);
    if (!hovered) await page.mouse.move(0, 0);
    await page.keyboard.press(`${modifier}+u`);
    expect(await markdown(page)).toBe(before);
    await expect(page.locator(`${selector} u`)).toHaveCount(0);
    expect(await decoration(page, decorated)).toEqual(appearance);
    await page.keyboard.press(`${modifier}+z`);
    expect(await markdown(page)).toBe(after);
    await page.keyboard.press(`${modifier}+s`);
    await expect.poll(() => page.evaluate(() => (window as any).__testApi.messages.findLast((message: any) => message.type === 'save')?.content)).toBe(after);
    await page.locator('#toolbar [data-action="source"]').click();
    await expect(page.locator('#sourceEditor')).toHaveValue(after);
    await page.locator('#toolbar [data-action="source"]').click();
    await page.evaluate(saved => (window as any).__testApi.setMarkdown(saved), after);
    await expect(page.locator(`${selector} u`)).toHaveText('target');
    expect(await markdown(page)).toBe(after);
}

for (const context of contexts) {
    for (const { theme, hover } of [
        { theme: 'things', hover: true },
        { theme: 'things', hover: false },
        { theme: 'github', hover: true },
        { theme: 'perplexity', hover: true },
        { theme: 'perplexity', hover: false },
    ]) {
        test(`${theme} ${hover ? 'hovered' : 'unhovered'} link in ${context.name} toggles authored underline`, async ({ page }) => {
            await setup(page, context.source, theme);
            await selectWord(page, context.selector);
            if (!hover) await page.mouse.move(0, 0);
            await checkToggleAndReopen(page, context.selector, `${context.selector} a`, 'Meta');
            await expect(page.locator(`${context.selector} a`)).toHaveAttribute('href', 'https://example.com/');
        });
    }
}

for (const modifier of ['Meta', 'Control']) {
    test(`${modifier}+U toggles authored underline in a decorated Perplexity heading`, async ({ page }) => {
        await setup(page, '## Before target after.\n', 'perplexity');
        await selectWord(page, '#editor h2');
        await checkToggleAndReopen(page, '#editor h2', '#editor h2', modifier);
    });

    test(`${modifier}+U toggles a hovered Things link in a bullet`, async ({ page }) => {
        await setup(page, contexts[1].source, 'things');
        await selectWord(page, '#editor li');
        await checkToggleAndReopen(page, '#editor li', '#editor li a', modifier);
    });
}

for (const theme of ['things', 'perplexity']) {
    test(`${theme} mixed selection underlines all ordinary text, then removes authored wrappers`, async ({ page }) => {
        await setup(page, '- Before <u>marked</u> [target](https://example.com/) after.\n', theme);
        await selectWord(page, '#editor li');
        await page.evaluate(() => {
            const range = document.createRange();
            range.selectNodeContents(document.querySelector('#editor li')!);
            getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
        });
        await page.keyboard.press('Meta+u');
        expect(await page.locator('#editor li').evaluate(element => {
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            while (node) {
                if (node.textContent && !node.parentElement!.closest('u')) return false;
                node = walker.nextNode();
            }
            return true;
        })).toBe(true);
        await page.keyboard.press('Meta+u');
        await expect(page.locator('#editor li u')).toHaveCount(0);
        await expect(page.locator('#editor li a')).toHaveAttribute('href', 'https://example.com/');
        expect(await markdown(page)).toBe('- Before marked [target](https://example.com/) after.\n');
    });
}
