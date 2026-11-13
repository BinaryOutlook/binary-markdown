import { test, expect } from '@playwright/test';
const { renderPreferences } = require('../helpers/preferences.cjs');

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        (window as any).preferenceSaves = [];
        (window as any).settingsBridge = {
            save: (key: string, value: unknown) => (window as any).preferenceSaves.push({ key, value }),
            selectDirectory: async () => './selected-images',
            onValue: (callback: unknown) => { (window as any).updatePreference = callback; },
        };
    });
    await page.goto('/');
});

test('category links move keyboard focus without saving; controls retain the existing IPC contract', async ({ page }) => {
    await page.setContent(renderPreferences({ editorMaxWidth: 1234 }));
    await page.locator('nav a[href="#settings-writing"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#settings-writing')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#tableToolbarPosition')).toBeFocused();
    expect(await page.evaluate(() => (window as any).preferenceSaves)).toEqual([]);
    await page.locator('#tableSourceFormat').selectOption('compact');
    expect(await page.evaluate(() => (window as any).preferenceSaves)).toEqual([{ key: 'tableSourceFormat', value: 'compact' }]);
    await page.evaluate(() => (window as any).updatePreference({ key: 'tableSourceFormat', value: 'aligned', error: 'Synthetic save failure' }));
    await expect(page.locator('#tableSourceFormat')).toHaveValue('aligned');
    await expect(page.getByRole('alert')).toBeInViewport();
    await expect(page.getByRole('alert')).toHaveText('Synthetic save failure');
    await page.locator('#tableSourceFormat').selectOption('compact');
    await page.evaluate(() => (window as any).updatePreference({ key: 'tableSourceFormat', value: 'compact', error: '' }));
    await expect(page.getByRole('alert')).toBeHidden();
    await expect(page.locator('#editorMaxWidth')).toHaveValue('1234');
    await page.locator('#imageDefaultDir').locator('..').getByRole('button').click();
    await expect(page.locator('#imageDefaultDir')).toHaveValue('./selected-images');
});

for (const locale of ['en', 'fr', 'zh-cn']) for (const width of [820, 360, 180]) {
    test(`preferences fit ${width}px with ${locale} labels and keep every control reachable`, async ({ page }) => {
        const { webviewMessages } = require('../../out/locales/' + locale + '.js');
        await page.setViewportSize({ width, height: width === 180 ? 200 : 680 });
        await page.setContent(renderPreferences({}, webviewMessages));
        for (const id of ['editor', 'writing', 'images', 'advanced']) {
            const link = page.locator(`nav a[href="#settings-${id}"]`);
            await link.focus();
            await link.press('Enter');
            await expect(page.locator('#settings-' + id)).toBeFocused();
        }
        for (const control of await page.locator('input, select').all()) {
            await control.focus();
            await expect(control).toBeInViewport();
        }
        expect(await page.evaluate(() => [...document.querySelectorAll('body, main, nav, .field')].every(node => node.scrollWidth <= node.clientWidth + 1))).toBe(true);
        expect(await page.evaluate(() => (window as any).preferenceSaves)).toEqual([]);
    });
}
