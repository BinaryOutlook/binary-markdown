import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const css = fs.readFileSync(path.resolve(__dirname, '../../src/webview/styles.css'), 'utf8');
const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

for (const theme of ['github', 'sepia', 'minimal', 'things', 'perplexity', 'night', 'dark']) {
    test(`${theme}: quoted code stays readable without overriding syntax colors`, async ({ page }) => {
        await page.goto('/standalone-editor.html');
        await page.waitForFunction(() => (window as any).__testApi?.ready);
        await page.addStyleTag({ content: css });
        await page.evaluate(theme => {
            document.documentElement.dataset.theme = theme;
            (window as any).__testApi.setMarkdown('```\nunquoted\n```\n\n> ```\n> quoted\n> ```\n>\n> ```javascript\n> const value = "hello";\n> ```\n\nAfter');
        }, theme);
        const plain = page.locator('#editor blockquote pre').first().locator('code');
        const syntax = page.locator('#editor blockquote .hljs-keyword');
        const tokenColor = await syntax.evaluate(element => getComputedStyle(element).color);
        for (const editing of [false, true]) {
            if (editing) await plain.click();
            const colors = await plain.evaluate(element => ({
                foreground: getComputedStyle(element).color,
                background: getComputedStyle(element.closest('pre')!).backgroundColor,
                unquoted: getComputedStyle(document.querySelector('#editor > pre code')!).color,
            }));
            expect(colors.foreground).toBe(colors.unquoted);
            const light = Math.max(luminance(colors.foreground), luminance(colors.background));
            const dark = Math.min(luminance(colors.foreground), luminance(colors.background));
            expect((light + 0.05) / (dark + 0.05)).toBeGreaterThanOrEqual(4.5);
            expect(tokenColor).not.toBe(colors.foreground);
        }
        await page.locator('#editor blockquote pre').last().locator('code').click();
        await page.locator('#editor > p').filter({ hasText: 'After' }).click();
        expect(await syntax.evaluate(element => getComputedStyle(element).color)).toBe(tokenColor);
    });
}
