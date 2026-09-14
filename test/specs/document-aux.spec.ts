import { test, expect, Page } from '@playwright/test';

async function setMarkdown(page: Page, source: string) {
    await page.evaluate(source => (window as any).__testApi.setMarkdown(source), source);
}
async function markdown(page: Page): Promise<string> {
    return page.evaluate(() => (window as any).__testApi.getMarkdown());
}
async function host(page: Page, message: Record<string, unknown>) {
    await page.evaluate(message => (window as any).__hostMessageHandler(message), message);
}

test.beforeEach(async ({ page }) => {
    await page.goto('/standalone-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
});

test('metadata is preserved through body edits and source switching; disclosure is view-only', async ({ page }) => {
    const front = '---\ntitle: "Quoted: title"\ncustom: [a, b] # retain\n...\n';
    await setMarkdown(page, front + '\n# Body\n\nOriginal text\n');
    await expect(page.locator('.front-matter')).toHaveCount(1);
    await page.locator('.front-matter summary').click();
    await expect(page.locator('.front-matter-source')).toHaveValue(front);
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'edit'))).toEqual([]);
    await page.locator('#editor > p').filter({ hasText: 'Original text' }).fill('Edited text');
    expect(await markdown(page)).toContain(front);
    await host(page, { type: 'toggleSourceMode' });
    await host(page, { type: 'toggleSourceMode' });
    expect(await markdown(page)).toContain(front);
    await expect(page.locator('#outline')).not.toContainText('Quoted');
});

test('explicit metadata editing has document undo and survives a body edit', async ({ page }) => {
    const front = '---\ntitle: Before\n---\n';
    await setMarkdown(page, front + '\n# Body\n\nParagraph\n');
    await page.locator('.front-matter summary').click();
    await page.locator('.front-matter-source').fill(front.replace('Before', 'After'));
    expect(await markdown(page)).toContain('title: After');
    await host(page, { type: 'performUndo' });
    expect(await markdown(page)).toContain('title: Before');
    await host(page, { type: 'performRedo' });
    expect(await markdown(page)).toContain('title: After');
    await page.locator('#editor > p').filter({ hasText: 'Paragraph' }).fill('Changed body');
    expect(await markdown(page)).toContain('title: After');
});

test('metadata is excluded from export body, while ordinary rules remain visible', async ({ page }) => {
    const source = '---\ntitle: Hidden title\n---\n\n# Visible\n';
    await setMarkdown(page, source);
    await host(page, { type: 'prepareExport', requestId: 'metadata', markdown: source });
    await page.waitForFunction(() => (window as any).__testApi.messages.some((m: any) => m.type === 'exportPrepared'));
    const result = await page.evaluate(() => (window as any).__testApi.messages.find((m: any) => m.type === 'exportPrepared'));
    expect(result.html).not.toContain('Hidden title');
    expect(result.html).not.toContain('front-matter');
    expect(result.html).toContain('Visible');
    await setMarkdown(page, '---\nOrdinary introduction\n---\n');
    await expect(page.locator('.front-matter')).toHaveCount(0);
    await expect(page.locator('#editor > hr')).toHaveCount(2);
});
