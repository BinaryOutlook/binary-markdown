import { test, expect } from '@playwright/test';
import { EditorTestHelper } from '../utils/editor-test-helper';

test.describe('Outline reading-position tracking', () => {
    test('Minimal uses the chosen blue and progress follows an explicit outline color', async ({ page }) => {
        await page.goto('/production-editor.html');
        await page.waitForFunction(() => (window as any).__testApi?.ready);
        await page.evaluate(() => {
            (window as any).__hostMessageHandler({ type: 'theme', value: 'minimal' });
            (window as any).__hostMessageHandler({ type: 'update', content: '# First\n\nRead the first section.\n\n## Second\n\nNext section.\n' });
        });
        await expect(page.locator('#outline [aria-current="location"]')).toHaveCount(1);
        const accents = () => page.evaluate(() => ({
            marker: getComputedStyle(document.querySelector('#outline .is-active')!).boxShadow,
            progress: getComputedStyle(document.getElementById('readingProgress')!).accentColor
        }));
        await expect.poll(async () => (await accents()).marker).toContain('rgb(66, 102, 176)');
        await expect.poll(async () => (await accents()).progress).toBe('rgb(66, 102, 176)');
        // The installed template emits this token for an explicit saved color.
        // Both orientation signals must consume that preference consistently.
        await page.evaluate(() => document.documentElement.style.setProperty('--outline-active-color', '#16a34a'));
        await expect.poll(async () => (await accents()).marker).toContain('rgb(22, 163, 74)');
        await expect.poll(async () => (await accents()).progress).toBe('rgb(22, 163, 74)');
        expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe('# First\n\nRead the first section.\n\n## Second\n\nNext section.\n');
    });

    test('highlights the heading at the 30% reading line while scrolling', async ({ page }) => {
        await page.goto('/standalone-editor.html');
        await page.waitForSelector('#editor');
        const editor = new EditorTestHelper(page);

        const spacer = Array.from({ length: 24 }, (_, index) => `Paragraph ${index + 1}`).join('\n\n');
        await editor.setMarkdown(`# First\n\n${spacer}\n\n## Second\n\n${spacer}\n\n## Third\n\nEnd`);
        await page.evaluate(() => (window as any).__testApi.updateOutline());

        const items = page.locator('#outline .outline-item');
        await expect(items).toHaveCount(3);
        await expect(items.nth(0)).toHaveClass(/is-active/);
        await expect(items.nth(0)).toHaveAttribute('aria-current', 'location');

        await page.evaluate(() => {
            const wrapper = document.getElementById('editorWrapper')!;
            const heading = document.querySelectorAll('#editor h2')[0] as HTMLElement;
            const wrapperRect = wrapper.getBoundingClientRect();
            const headingRect = heading.getBoundingClientRect();
            wrapper.scrollTop += headingRect.top - wrapperRect.top - wrapper.clientHeight * 0.2;
            wrapper.dispatchEvent(new Event('scroll'));
        });

        await expect(items.nth(1)).toHaveClass(/is-active/);
        await expect(items.nth(1)).toHaveAttribute('aria-current', 'location');
        await expect(items.nth(0)).not.toHaveClass(/is-active/);
        await expect(page.locator('#outline [aria-current="location"]')).toHaveCount(1);
    });
});
