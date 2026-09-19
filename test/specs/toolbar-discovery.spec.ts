import { test, expect, Page } from '@playwright/test';

const markdown = 'Paragraph target.\n\n- List target.\n\n| Column | Other |\n| --- | --- |\n| Cell target. | Value |\n\n**Nested target.**\n';

async function setup(page: Page) {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.addScriptTag({ url: '/vendor/katex.min.js' });
    await page.evaluate(text => (window as any).__testApi.setMarkdown(text), markdown);
}

async function selectTarget(page: Page, selector: string) {
    await page.evaluate(selector => {
        const node = document.querySelector(selector)!.firstChild!;
        const start = node.textContent!.indexOf('target');
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + 'target'.length);
        document.getElementById('editor')!.focus();
        getSelection()!.removeAllRanges();
        getSelection()!.addRange(range);
        (window as any).__retainedToolbarNode = node;
    }, selector);
}

for (const [name, selector] of [
    ['paragraph', '#editor > p:first-child'],
    ['list', '#editor li'],
    ['table', '#editor td'],
    ['nested', '#editor > p strong'],
]) {
    test(`toolbar mode changes preserve the ${name} selection and clean source`, async ({ page }) => {
        await setup(page);
        await selectTarget(page, selector);
        for (const mode of ['simple', 'full', 'simple', 'full']) {
            await page.evaluate(mode => (window as any).__hostMessageHandler({ type: 'toolbarMode', value: mode }), mode);
            await expect(page.locator('html')).toHaveAttribute('data-toolbar-mode', mode);
            expect(await page.evaluate(() => ({
                text: getSelection()!.toString(),
                sameNode: getSelection()!.anchorNode === (window as any).__retainedToolbarNode,
                editorFocused: document.activeElement === document.getElementById('editor'),
            }))).toEqual({ text: 'target', sameNode: true, editorFocused: true });
            await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
        }
        await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'captureExportSnapshot', requestId: 'toolbar-view-only' }));
        expect(await page.evaluate(() => (window as any).__testApi.messages.find((m: any) => m.requestId === 'toolbar-view-only')))
            .toMatchObject({ content: markdown, pending: false });
    });

    for (const [action, tag] of [['bold', ':is(strong, b)'], ['italic', ':is(em, i)'], ['strikethrough', 'del'], ['code', 'code']]) {
        test(`${action} retains the ${name} selection and undoes once`, async ({ page }) => {
            await setup(page);
            // Begin with an unformatted target for each action, including the
            // nested case where an existing outer emphasis must remain intact.
            await selectTarget(page, selector);
            const before = await page.evaluate(() => (window as any).htmlToMarkdown());
            await page.locator(`#toolbar button[data-action="${action}"]`).click();
            if (name !== 'nested' || action !== 'bold') {
                await expect(page.locator(`#editor ${tag}`).filter({ hasText: /^target$/ })).toHaveCount(1);
            } else {
                // Bold toggles only the selected part of the existing strong run.
                expect(await page.locator('#editor > p:has(strong)').textContent()).toBe('Nested target.');
                expect(await page.locator('#editor > p strong').allTextContents()).not.toContain('Nested target.');
            }
            await page.locator('#toolbar button[data-action="undo"]').click();
            expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
        });
    }
}

test('toolbar mode changes preserve an active equation input and pending source', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => (window as any).__testApi.setMarkdown('Before $x + 1$ after.\n'));
    await page.locator('.math-inline').click();
    const input = page.locator('.math-inline-input');
    await input.fill('x + 2');
    await page.evaluate(() => { (window as any).__retainedMathInput = document.activeElement; });
    for (const mode of ['simple', 'full']) {
        await page.evaluate(mode => (window as any).__hostMessageHandler({ type: 'toolbarMode', value: mode }), mode);
        await expect(input).toHaveValue('x + 2');
        expect(await page.evaluate(() => document.activeElement === (window as any).__retainedMathInput)).toBe(true);
    }
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'captureExportSnapshot', requestId: 'toolbar-pending-math' }));
    expect(await page.evaluate(() => (window as any).__testApi.messages.find((m: any) => m.requestId === 'toolbar-pending-math').content))
        .toContain('$x + 2$');
});

const { toolbarGeometry } = require('../native/text-toolbar.cjs');

for (const mode of ['full', 'simple']) {
    test(`${mode} exposes whole actions during repeated shrinking and expansion`, async ({ page }) => {
        await setup(page);
        await page.evaluate(mode => (window as any).__hostMessageHandler({ type: 'toolbarMode', value: mode }), mode);
        await selectTarget(page, '#editor > p:first-child');
        const actions = await page.locator('#toolbar button[data-action]').evaluateAll(buttons => buttons.filter(button => !button.closest('.table-toolbar')).map(button => (button as HTMLElement).dataset.action));
        for (const width of [1000, 620, 400, 320, 1600]) {
            await page.setViewportSize({ width, height: 600 });
            await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
            await expect.poll(async () => (await page.evaluate(toolbarGeometry) as any).clipped).toEqual([]);
            const geometry: any = await page.evaluate(toolbarGeometry);
            expect(geometry.overlaps).toEqual([]);
            const available = geometry.visible.filter((action: string) => action !== 'toolbarMore').concat(geometry.overflow);
            const expected = actions.filter(action => action !== 'openOutline' && (mode === 'full' || ['undo', 'redo', 'openInTextEditor', 'export', 'source'].includes(action!)));
            expect(available.sort()).toEqual(expected.sort());
            if (geometry.overflow.length) {
                await page.locator('#toolbarMore').click();
                const items = page.locator('#toolbarOverflow button:not(:disabled)');
                await expect(items.first()).toBeFocused();
                await page.keyboard.press('End');
                await expect(items.last()).toBeFocused();
                expect(await items.last().evaluate(button => {
                    const rect = button.getBoundingClientRect();
                    return rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth;
                })).toBe(true);
                await page.keyboard.press('Escape');
                await expect(page.locator('#toolbarMore')).toBeFocused();
                await expect(page.locator('#toolbarOverflow')).toBeHidden();
            }
        }
        await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'captureExportSnapshot', requestId: 'overflow-view-only' }));
        expect(await page.evaluate(() => (window as any).__testApi.messages.find((m: any) => m.requestId === 'overflow-view-only'))).toMatchObject({ content: markdown, pending: false });
    });
}

test('a formatting action remains focused across overflow and applies to the retained selection', async ({ page }) => {
    await setup(page);
    await selectTarget(page, '#editor > p:first-child');
    const italic = page.locator('#toolbar [data-action="italic"]');
    await italic.focus();
    await page.setViewportSize({ width: 320, height: 600 });
    await expect(page.locator('#toolbarOverflow [data-action="italic"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#editor :is(em, i)').filter({ hasText: /^target$/ })).toHaveCount(1);
    await expect(page.locator('#toolbarOverflow')).toBeHidden();
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.locator('#toolbar [data-action="undo"]').click();
    expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(markdown);
});
