import { test, expect } from '@playwright/test';

for (const locale of ['en', 'es', 'fr', 'ja', 'ko', 'zh-cn', 'zh-tw']) {
    test(`${locale}: the picker renders and searches its actual webview translations`, async ({ page }, testInfo) => {
        const messages = require('../../out/locales/' + locale + '.js').webviewMessages;
        // Use the compiled dictionary at the same script injection point as host HTML generation.
        await page.route('**/production-editor.html', async route => {
            const response = await route.fetch();
            const original = await response.text();
            const body = original.replace(/const i18n = \{[^\n]*\};/, () => 'const i18n = ' + JSON.stringify(messages) + ';');
            expect(body).toContain(JSON.stringify(messages.languagePickerLabel));
            await route.fulfill({ response, body });
        });
        await page.goto('/production-editor.html'); await page.waitForFunction(() => (window as any).__testApi?.ready);
        const source = '```custom-lang\n  value\n\n```\n';
        await page.evaluate(source => (window as any).__testApi.setMarkdown(source), source);
        await page.locator('.code-lang-tag').click();
        const input = page.getByRole('combobox', { name: messages.languagePickerLabel, exact: true });
        await expect(input).toBeFocused(); await expect(input).toHaveAttribute('placeholder', messages.languagePickerPlaceholder);
        await expect(page.locator('.lang-selector-current')).toHaveText(messages.languagePickerCurrent + ': custom-lang');
        await expect(page.locator('[data-language="math"] span')).toHaveText(messages.languagePickerMath);
        await expect(page.locator('[data-language="mermaid"] span')).toHaveText(messages.languagePickerMermaid);
        await input.fill('JS'); await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveAttribute('data-language', 'javascript');
        await input.fill('no-such-language'); await expect(page.locator('.lang-selector-empty')).toHaveText(messages.languagePickerNoResults);
        await input.fill(messages.languagePickerPlainText);
        await expect(page.getByRole('option')).toHaveCount(1);
        await expect(page.getByRole('option')).toHaveAttribute('data-language', 'plaintext');
        if (locale === 'zh-cn') await page.screenshot({ path: testInfo.outputPath('localized-language-picker.png') });
        await page.keyboard.press('Enter');
        expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(source.replace('custom-lang', 'plaintext'));
    });
}
