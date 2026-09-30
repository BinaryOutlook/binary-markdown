import { test, expect, Page } from '@playwright/test';

const authored = '---\ntitle: "Review" # retained\n---\n\n# One\n\nBefore **target** after.\n\n## Two\n\nOther text.\n';
async function setup(page: Page, content = authored) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(content => (window as any).__testApi.setMarkdown(content), content);
}
async function snapshot(page: Page) {
    return page.evaluate(() => {
        (window as any).__hostMessageHandler({ type: 'captureExportSnapshot', requestId: 'ux-check' });
        return (window as any).__testApi.messages.filter((m: any) => m.requestId === 'ux-check').at(-1);
    });
}

test('views, outline tabs and contextual toggle preserve authored source and clean state', async ({ page }) => {
    await setup(page);
    await page.locator('#documentTab').click();
    await expect(page.locator('#documentInfo')).toBeVisible();
    await page.locator('#outlineTab').click();
    await page.locator('#contextToolbarToggle').click();
    for (const mode of ['source', 'split', 'visual']) await page.locator(`button[data-editor-mode="${mode}"]`).click();
    expect(await snapshot(page)).toMatchObject({ content: authored, pending: false });
    await expect(page.locator('[data-action="undo"]')).toBeDisabled();
});

test('Split source edits share Undo with Visual and the preview is read only', async ({ page }) => {
    await setup(page);
    await page.locator('button[data-editor-mode="split"]').click();
    await expect(page.locator('#sourceEditor')).toHaveValue(authored);
    await expect(page.locator('#editor')).toHaveAttribute('contenteditable', 'false');
    await expect(page.locator('#editor [contenteditable="true"]')).toHaveCount(0);
    await page.locator('#sourceEditor').press('ControlOrMeta+a');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.insertText('Added.');
    await expect(page.locator('#editor')).toContainText('Added.');
    await page.locator('#sourceEditor').press('ControlOrMeta+z');
    await expect(page.locator('#sourceEditor')).toHaveValue(authored);
    await page.locator('#sourceEditor').press('ControlOrMeta+Shift+z');
    await expect(page.locator('#sourceEditor')).toHaveValue(authored + 'Added.');
    await page.locator('button[data-editor-mode="visual"]').click();
    await page.locator('[data-action="undo"]').click();
    expect((await snapshot(page)).content).toBe(authored);
});

test('Outline navigates to the corresponding source heading in Split', async ({ page }) => {
    await setup(page);
    await page.locator('button[data-editor-mode="split"]').click();
    await page.locator('#outline button').filter({ hasText: 'Two' }).click();
    expect(await page.locator('#sourceEditor').evaluate((node: HTMLTextAreaElement) => node.selectionStart)).toBe(authored.indexOf('## Two'));
    await expect(page.locator('#editor h2')).toHaveClass(/source-correspondence/);
    expect((await snapshot(page)).pending).toBe(false);
});

test('source mode disables visual formatting and retains explicit mode labels', async ({ page }) => {
    await setup(page);
    await page.locator('button[data-editor-mode="source"]').click();
    await expect(page.locator('#formatButton')).toBeDisabled();
    await expect(page.locator('[data-action="bold"]')).toBeDisabled();
    await expect(page.locator('button[data-editor-mode="source"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#editor')).toBeHidden();
});
