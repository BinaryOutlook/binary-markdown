import { test, expect } from '@playwright/test';

const source = Array.from({ length: 65 }, (_, index) => `## Section ${index + 1}\n\nSynthetic content.\n`).join('\n');

test.beforeEach(async ({ page }) => {
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(source => {
        (window as any).__testApi.setMarkdown(source);
        (window as any).__testApi.updateOutline();
    }, source);
    await expect(page.locator('#outline .outline-item')).toHaveCount(65);
    expect(await page.locator('#outline').evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
});

test('an overflowing outline follows all seven palettes live with a visible thumb', async ({ page }) => {
    const colors = new Set<string>();
    for (const theme of ['github', 'sepia', 'night', 'dark', 'minimal', 'perplexity', 'things']) {
        const measured = await page.evaluate(theme => {
            const outline = document.getElementById('outline')!;
            outline.scrollTop = 120;
            const firstVisibleHeading = () => Array.from(outline.children).find(item =>
                item.getBoundingClientRect().bottom > outline.getBoundingClientRect().top)?.textContent;
            const headingBefore = firstVisibleHeading();
            (window as any).__testApi.messages = [];
            (window as any).__hostMessageHandler({ type: 'theme', value: theme });
            const style = getComputedStyle(outline);
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            const rgb = (color: string) => {
                context.fillStyle = color;
                context.fillRect(0, 0, 1, 1);
                return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
            };
            const luminance = (values: number[]) => values.map(value => {
                const channel = value / 255;
                return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
            const thumb = rgb(getComputedStyle(outline, '::-webkit-scrollbar-thumb').backgroundColor);
            const track = rgb(getComputedStyle(outline, '::-webkit-scrollbar-track').backgroundColor);
            const luminances = [luminance(thumb), luminance(track)].sort((a, b) => b - a);
            return { thumb, track, contrast: (luminances[0] + 0.05) / (luminances[1] + 0.05),
                color: style.scrollbarColor, width: style.scrollbarWidth, scrollTop: outline.scrollTop,
                headingBefore, headingAfter: firstVisibleHeading(),
                unrelated: getComputedStyle(document.getElementById('editorWrapper')!).scrollbarColor,
                source: (window as any).__testApi.getMarkdown(), edits: (window as any).__testApi.messages.filter((message: any) => message.type === 'edit') };
        }, theme);
        expect(measured.width).toBe('thin');
        expect(measured.contrast, theme).toBeGreaterThanOrEqual(3);
        // Theme fonts change row heights; retain the visible section rather than a pixel offset.
        expect(measured.scrollTop).toBeGreaterThan(0);
        expect(measured.headingAfter).toBe(measured.headingBefore);
        expect(measured.unrelated).toBe('auto');
        expect(measured.source).toBe(source);
        expect(measured.edits).toEqual([]);
        colors.add(measured.color);
    }
    expect(colors.size).toBe(7);
});

test('outline scrollbars follow palette-token overrides and system high contrast', async ({ page }) => {
    await page.locator('#outline').evaluate(node => {
        (node as HTMLElement).style.setProperty('--text-color', '#ffff00');
        (node as HTMLElement).style.setProperty('--sidebar-bg', '#001122');
    });
    const custom = await page.locator('#outline').evaluate(node => getComputedStyle(node).scrollbarColor);
    expect(custom).toContain('rgb(0, 17, 34)');
    expect(custom).not.toBe('auto');
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(page.locator('#outline')).toHaveCSS('scrollbar-color', 'auto');
    await page.locator('#outline').evaluate(node => { node.scrollTop = 180; });
    expect(await page.locator('#outline').evaluate(node => node.scrollTop)).toBe(180);
});
