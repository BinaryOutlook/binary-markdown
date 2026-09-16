import { test, expect } from '@playwright/test';
import { EditorTestHelper } from '../utils/editor-test-helper';

test.describe('Outline reading-position tracking', () => {
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
