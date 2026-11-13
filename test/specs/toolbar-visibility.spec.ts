import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

const source = '# Reading\n\nBefore target after.\n\n| Item | Status |\n| --- | --- |\n| One | Ready |\n';
const toggle = '#toolbarVisibilityToggle';
const root = path.resolve(__dirname, '../..');
const set = (page: Page, type: string, value: unknown) => page.evaluate(({ type, value }) =>
    (window as any).__hostMessageHandler({ type, value }), { type, value });
async function setup(page: Page, width = 1440) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(content => (window as any).__testApi.setMarkdown(content), source);
}
async function selectTarget(page: Page) {
    await page.locator('#editor > p').evaluate(node => {
        (node as HTMLElement).focus();
        const text = node.firstChild!;
        const start = text.textContent!.indexOf('target');
        const range = document.createRange(); range.setStart(text, start); range.setEnd(text, start + 6);
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
        (window as any).__retainedParagraph = node;
    });
}

for (const host of ['vscode', 'electron']) for (const icon of [undefined, 'chevrons']) {
    test(`${host} loads saved toggle preferences (${icon || 'default logo'})`, async ({ page }) => {
        const config = { toolbarToggleIcon: icon, toolbarToggleOnHover: true };
        const html = host === 'vscode'
            ? require('../utils/production-webview.cjs')(root, source, 7, config)
            : require('../utils/electron-webview.cjs')(root, source, config);
        await page.route('**/toolbar-preferences.html', route => route.fulfill({ contentType: 'text/html', body: html }));
        await page.goto('/toolbar-preferences.html');
        await page.waitForFunction(() => (window as any).__testApi?.ready);
        await expect(page.locator('html')).toHaveAttribute('data-toolbar-toggle-on-hover', 'true');
        await expect(page.locator(`${toggle} .toolbar-toggle-${icon === 'chevrons' ? 'arrows' : 'logo'}`)).toBeVisible();
        if (!icon) expect(await page.locator(`${toggle} img`).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
        await expect(page.locator(toggle)).toHaveAttribute('aria-expanded', 'true');
        await page.locator(toggle).click();
        await expect(page.locator(toggle)).toHaveAccessibleName('Show top bar');
        await page.locator(toggle).click();
        await expect(page.locator(toggle)).toHaveAccessibleName('Hide top bar');
    });
}

for (const width of [320, 768, 1440]) for (const mode of ['full', 'simple']) {
    test(`${mode} toolbar collapses completely and restores after resizing at ${width}px`, async ({ page }) => {
        await setup(page, width);
        await set(page, 'toolbarMode', mode);
        const before = await page.locator('#editorWrapper').boundingBox();
        const bar = await page.locator('#toolbar').boundingBox();
        await page.locator(toggle).click();
        await expect(page.locator(toggle)).toBeVisible();
        await expect(page.locator('#toolbarMore')).toBeHidden();
        expect((await page.locator('#toolbar').boundingBox())!.height).toBe(0);
        expect((await page.locator('#editorWrapper').boundingBox())!.y).toBeCloseTo(before!.y - bar!.height, 0);
        await page.setViewportSize({ width: width === 320 ? 1440 : 320, height: 600 });
        await page.locator(toggle).click();
        await expect(page.locator('#toolbarMore')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-toolbar-mode', mode);
        await page.locator('#toolbarMore').click();
        await expect(page.locator('#toolbarCommandSearch')).toBeFocused();
        await page.keyboard.press('Escape');
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
        expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => message.type === 'edit'))).toEqual([]);
    });
}

test('view toggles and live preferences retain selection, DOM, and one-step Undo/Redo', async ({ page }) => {
    await setup(page);
    await selectTarget(page);
    await page.locator(toggle).click();
    await set(page, 'toolbarToggleIcon', 'chevrons');
    await set(page, 'toolbarToggleOnHover', true);
    await expect(page.locator(`${toggle} .toolbar-toggle-arrows`)).toHaveCSS('transform', 'matrix(-1, 0, 0, -1, 0, 0)');
    await page.locator(toggle).click();
    expect(await page.evaluate(() => getSelection()!.toString())).toBe('target');
    expect(await page.evaluate(() => (window as any).__retainedParagraph === document.querySelector('#editor > p'))).toBe(true);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
    await page.locator('#toolbar [data-action="bold"]').click();
    const edited = await page.evaluate(() => (window as any).__testApi.getMarkdown());
    expect(edited).toContain('**target**');
    await page.locator(toggle).click();
    await page.locator(toggle).click();
    await page.locator('#toolbar [data-action="undo"]').click();
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
    await page.locator('#toolbar [data-action="redo"]').click();
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(edited);
});

for (const mode of ['source', 'split']) {
    test(`${mode} input and selection survive hiding and live settings`, async ({ page }) => {
        await setup(page);
        await page.locator(`[data-editor-mode="${mode}"]`).click();
        await page.locator('#sourceEditor').evaluate((node: HTMLTextAreaElement) => { node.focus(); node.setSelectionRange(20, 26); });
        await page.locator(toggle).click();
        await set(page, 'toolbarToggleIcon', 'chevrons');
        await set(page, 'toolbarMode', 'simple');
        await page.locator(toggle).click();
        await expect(page.locator('#sourceEditor')).toBeFocused();
        expect(await page.locator('#sourceEditor').evaluate((node: HTMLTextAreaElement) => [node.selectionStart, node.selectionEnd, node.value])).toEqual([20, 26, source]);
        await expect(page.locator('html')).toHaveAttribute('data-editor-mode', mode);
    });
}

test('hover-only recovery reveals on proximity and keyboard focus with reduced motion', async ({ page }) => {
    await setup(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await set(page, 'toolbarToggleOnHover', true);
    await page.locator(toggle).click();
    await page.mouse.move(800, 600);
    await expect(page.locator(toggle)).toHaveCSS('opacity', '0');
    const box = (await page.locator('.toolbar-visibility-control').boundingBox())!;
    await page.mouse.move(box.x + 1, box.y + 1);
    await expect(page.locator(toggle)).toHaveCSS('opacity', '1');
    await page.mouse.move(800, 600);
    await page.locator(toggle).focus();
    await expect(page.locator(toggle)).toHaveCSS('opacity', '1');
    await expect(page.locator(toggle)).toHaveCSS('transition-duration', '0s');
    await page.keyboard.press('Enter');
    await expect(page.locator(toggle)).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Space');
    await expect(page.locator(toggle)).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Tab');
    await expect(page.locator('#toolbarMore')).not.toBeFocused();
});

test('touch devices retain a visible restore button with hover-only enabled', async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await setup(page, 390);
    await set(page, 'toolbarToggleOnHover', true);
    await page.locator(toggle).tap();
    await expect(page.locator(toggle)).toHaveCSS('opacity', '1');
    await page.locator(toggle).tap();
    await expect(page.locator(toggle)).toHaveAttribute('aria-expanded', 'true');
    await context.close();
});

for (const mode of ['full', 'simple']) {
    test(`${mode} hides and restores docked table controls without leaving a row`, async ({ page }) => {
        await setup(page);
        await set(page, 'toolbarMode', mode);
        await set(page, 'tableToolbarPosition', 'top-bar');
        await page.locator('#editor td').first().click();
        const controls = page.locator('.table-toolbar:not(.table-toolbar-measure)');
        await expect(controls).toBeVisible();
        await page.locator(toggle).click();
        await expect(controls).toBeHidden();
        await expect(page.locator('.table-toolbar-row')).toBeHidden();
        expect((await page.locator('#toolbar').boundingBox())!.height).toBe(0);
        await page.locator(toggle).click();
        await expect(controls).toBeVisible();
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
    });
}

test('toggling after a closed Insert workspace keeps the current selection', async ({ page }) => {
    await setup(page);
    await selectTarget(page);
    await page.locator('#toolbarMore').click();
    await page.locator('#toolbarCommandSearch').fill('Insert');
    await page.locator('[data-menu-command="viewInsert"]').click();
    await expect(page.locator('#insertMenu')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('#editor > h1').evaluate(node => {
        const range = document.createRange(); range.selectNodeContents(node);
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    });
    await page.locator(toggle).click();
    await page.locator(toggle).click();
    expect(await page.evaluate(() => getSelection()!.toString())).toBe('Reading');
});

test('hiding keeps an active equation input cancellable and contextual preference intact', async ({ page }) => {
    await setup(page);
    const equation = 'Before $x^2$ after.\n';
    await page.evaluate(content => (window as any).__testApi.setMarkdown(content), equation);
    await page.locator('#contextToolbarToggle').click();
    await page.locator('.math-inline').click();
    const input = page.locator('.math-inline-input');
    await input.fill('x^2+1');
    await page.locator(toggle).click();
    await page.locator(toggle).click();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('x^2+1');
    await expect(page.locator('#contextToolbarToggle')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(input).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(equation);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

for (const theme of ['github', 'sepia', 'night', 'dark', 'minimal', 'perplexity', 'things']) {
    test(`${theme}: toggle has no background or shadow at rest, on hover, or with keyboard focus`, async ({ page }) => {
        await setup(page);
        await set(page, 'theme', theme);
        const button = page.locator(toggle);
        for (const icon of ['logo', 'chevrons']) {
            await set(page, 'toolbarToggleIcon', icon);
            for (const collapsed of [true, false]) {
                await button.click();
                await expect(button).toHaveAttribute('aria-expanded', String(!collapsed));
                await page.mouse.move(1000, 700);
                for (const hover of [false, true]) {
                    if (hover) await button.hover();
                    await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
                    await expect(button).toHaveCSS('box-shadow', 'none');
                }
                await page.keyboard.press('Tab');
                await button.focus();
                await expect(button).toHaveCSS('outline-style', 'solid');
                await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
            }
        }
    });
}

for (const mode of ['full', 'simple']) for (const navigation of [false, true]) {
    test(`${mode}: hiding from focused table ${navigation ? 'navigation' : 'controls'} retains reachable focus`, async ({ page }) => {
        await setup(page);
        await set(page, 'toolbarMode', mode);
        await set(page, 'tableToolbarPosition', 'top-bar');
        await page.locator('#editor td').first().click();
        const chip = page.locator('.table-toolbar:not(.table-toolbar-measure) .table-coordinate-chip');
        await expect(chip).toBeVisible();
        if (navigation) {
            await chip.click();
            await expect(page.locator('.table-navigation-menu select').first()).toBeFocused();
        } else await chip.focus();
        await page.locator(toggle).click();
        await expect(page.locator(toggle)).toBeFocused();
        await expect(page.locator('.table-navigation-menu')).toBeHidden();
        await expect(page.locator('.table-toolbar:not(.table-toolbar-measure)')).toBeHidden();
        await page.keyboard.press('Space');
        await expect(chip).toBeVisible();
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
    });
}

for (const activation of ['keyboard', 'pointer']) {
    test(`hiding with ${activation} closes Export and retains selection and keyboard recovery`, async ({ page }) => {
        await setup(page);
        await selectTarget(page);
        await page.locator('#exportButton').focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('#exportMenu')).toBeVisible();
        if (activation === 'keyboard') {
            await page.locator(toggle).focus();
            await page.keyboard.press('Space');
        } else await page.locator(toggle).click();
        await expect(page.locator('#exportMenu')).toBeHidden();
        await expect(page.locator('#exportButton')).toHaveAttribute('aria-expanded', 'false');
        await expect(page.locator(toggle)).toBeFocused();
        expect(await page.evaluate(() => getSelection()!.toString())).toBe('target');
        await page.keyboard.press('Space');
        await expect(page.locator('#exportButton')).toBeVisible();
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(source);
        await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
    });
}
