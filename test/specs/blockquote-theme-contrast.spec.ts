import { test, expect } from '@playwright/test';

const themes = ['github', 'sepia', 'minimal', 'things', 'perplexity', 'night', 'dark'];
const markdown = '> Ordinary quote with **strong** and *emphasis*, [a link](https://example.invalid), and `inline code`.\n>\n> > Nested quote.\n>\n> ```\n> plain code\n> ```\n>\n> ```javascript\n> const value = "hello";\n> ```\n\nAfter';

function luminance(color: string) {
    const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

for (const theme of themes) {
    test(`${theme}: quote prose, inline formatting and selection have readable contrast`, async ({ page }, testInfo) => {
        await page.goto('/production-editor.html');
        await page.waitForFunction(() => (window as any).__testApi?.ready);
        // Model the independent defaults injected by a dark VS Code workbench.
        await page.addStyleTag({ content: 'blockquote { background: #242526; } code { color: #8c8c8c; }' });
        await page.evaluate(({ markdown, theme }) => {
            (window as any).__testApi.setMarkdown(markdown);
            document.documentElement.dataset.theme = theme;
        }, { markdown, theme });
        const colors = await page.locator('#editor blockquote p, #editor blockquote strong, #editor blockquote em, #editor blockquote a, #editor blockquote p code').evaluateAll(elements => elements.map(element => {
            let background: Element | null = element;
            while (background && getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)') background = background.parentElement;
            return {
                text: element.textContent,
                foreground: getComputedStyle(element).color,
                background: getComputedStyle(background!).backgroundColor,
                selectionForeground: getComputedStyle(element, '::selection').color,
                selectionBackground: getComputedStyle(element, '::selection').backgroundColor,
            };
        }));
        expect(colors.length).toBeGreaterThanOrEqual(6);
        for (const color of colors) {
            for (const [foreground, background] of [[color.foreground, color.background], [color.selectionForeground, color.selectionBackground]]) {
                const levels = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
                expect((levels[1] + 0.05) / (levels[0] + 0.05), `${theme}: ${color.text} on ${background}`).toBeGreaterThanOrEqual(4.5);
            }
        }
        await page.screenshot({ path: testInfo.outputPath(`${theme}-quotes.png`) });
    });
}

test('live theme changes retain the document, selection, DOM and undo history', async ({ page }) => {
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(markdown => (window as any).__testApi.setMarkdown(markdown), markdown);
    await page.locator('#editor > p').last().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' edited');
    await expect.poll(() => page.evaluate(() => (window as any).__testApi.getMarkdown())).toContain('After edited');
    const before = await page.evaluate(() => {
        const selection = getSelection()!;
        (window as any).quoteNodeBeforeTheme = document.querySelector('#editor blockquote');
        (window as any).__testApi.messages = [];
        return { markdown: (window as any).__testApi.getMarkdown(), offset: selection.anchorOffset, text: selection.anchorNode?.textContent };
    });
    for (const theme of themes) {
        await page.evaluate(theme => (window as any).__hostMessageHandler({ type: 'theme', value: theme }), theme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    }
    const after = await page.evaluate(() => ({
        markdown: (window as any).__testApi.getMarkdown(), offset: getSelection()!.anchorOffset,
        text: getSelection()!.anchorNode?.textContent,
        sameNode: (window as any).quoteNodeBeforeTheme === document.querySelector('#editor blockquote'),
        edits: (window as any).__testApi.messages.filter((message: any) => message.type === 'edit'),
    }));
    expect(after).toEqual({ ...before, sameNode: true, edits: [] });
    await page.locator('[data-action="undo"]').click();
    await expect.poll(() => page.evaluate(() => (window as any).__testApi.getMarkdown())).not.toContain(' edited');
});

test('live theme changes refresh diagram appearance without editing its source', async ({ page }) => {
    await page.goto('/standalone-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(() => (window as any).__testApi.setMarkdown('> Quote\n\n```mermaid\ngraph TD\n A-->B\n```\n\nAfter'));
    await expect(page.locator('.mermaid-diagram svg')).toHaveCount(1);
    const before = await page.evaluate(() => (window as any).__testApi.getMarkdown());
    const previous = await page.locator('.mermaid-diagram').innerHTML();
    await page.evaluate(() => {
        (window as any).__testApi.messages = [];
        (window as any).__hostMessageHandler({ type: 'theme', value: 'night' });
    });
    await expect.poll(() => page.locator('.mermaid-diagram').innerHTML()).not.toBe(previous);
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(before);
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => message.type === 'edit'))).toEqual([]);
});
