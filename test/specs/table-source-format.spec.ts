import { test, expect, Page } from '@playwright/test';

const table = '| Item | Value |\n|---|---|\n| Long item | 3 |\n';
const documentText = '# Probe\n\n' + table + '\nAfter\n';
const aligned = '| Item      | Value |\n| --------- | ----- |\n| Long item | 3     |\n';
const compact = '| Item | Value |\n| --- | --- |\n| Long item | 3 |\n';

async function message(page: Page, payload: object) {
    await page.evaluate(payload => (window as any).__hostMessageHandler(payload), payload);
}

async function save(page: Page) {
    await page.keyboard.press('Control+s');
    const saved = await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'save').at(-1));
    expect(saved?.content).toBeDefined();
    await message(page, { type: 'documentSaved', content: saved.content });
    await message(page, { type: 'saveResult', revision: saved.revision, success: true });
    return saved.content as string;
}

async function editProse(page: Page) {
    const paragraph = page.locator('#editor > p').filter({ hasText: 'After' });
    await paragraph.click();
    await paragraph.evaluate(element => {
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        const selection = getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
    });
    await page.keyboard.type('!');
}

test.beforeEach(async ({ page }) => {
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await message(page, { type: 'update', content: documentText });
});

test('opening, changing format, and saving without an edit retain original bytes and selection', async ({ page }) => {
    const cell = page.locator('#editor td').first();
    await cell.click();
    const before = await page.locator('#editor').innerHTML();
    for (const value of ['compact', 'aligned']) {
        await message(page, { type: 'tableSourceFormat', value });
        await expect(page.locator('#editor')).toHaveJSProperty('innerHTML', before);
        expect(await page.evaluate(() => document.querySelector('#editor td')?.contains(getSelection()?.anchorNode || null))).toBe(true);
        await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
        expect(await save(page)).toBe(documentText);
    }
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'edit'))).toEqual([]);
});

for (const [mode, expected] of [['aligned', aligned], ['compact', compact]]) {
    test(`${mode}: a visual edit uses the selected format and stays stable through save and reopen`, async ({ page }) => {
        await message(page, { type: 'tableSourceFormat', value: mode });
        await editProse(page);
        const first = await save(page);
        expect(first).toContain(expected);
        expect(first).toContain('After!');
        expect(await save(page)).toBe(first);
        await page.reload();
        await page.waitForFunction(() => (window as any).__testApi?.ready);
        await message(page, { type: 'tableSourceFormat', value: mode });
        await message(page, { type: 'update', content: first });
        expect(await save(page)).toBe(first);
        await editProse(page);
        expect(await save(page)).toBe(first.replace('After!', 'After!!'));
    });

    test(`${mode}: empty cells remain empty and authored line breaks survive repeated conversion`, async ({ page }) => {
        await message(page, { type: 'tableSourceFormat', value: mode });
        const source = '| Name | Blank | Break |\n| --- | --- | --- |\n| **Ready** | | <br> |\n';
        await message(page, { type: 'update', content: source });
        const first = await page.evaluate(() => (window as any).__testApi.getMarkdown());
        expect(first.match(/<br>/g)).toHaveLength(1);
        expect(first).toContain('**Ready**');
        expect(first).not.toContain('data-table-placeholder');
        await page.evaluate(md => (window as any).__testApi.setMarkdown(md), first);
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(first);
        await expect(page.locator('#editor td').nth(1)).toHaveText('');
        await expect(page.locator('#editor td').nth(2).locator('br')).toHaveCount(1);
    });
}

test('default is aligned; switching to legacy changes later output without erasing undo', async ({ page }) => {
    await editProse(page);
    expect(await save(page)).toContain(aligned);
    const before = await page.locator('#editor').innerHTML();
    await message(page, { type: 'tableSourceFormat', value: 'compact' });
    await expect(page.locator('#editor')).toHaveJSProperty('innerHTML', before);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeEnabled();
    await message(page, { type: 'performUndo' });
    expect(await save(page)).toBe(documentText);
    await message(page, { type: 'performRedo' });
    expect(await save(page)).toContain('After!');
    await editProse(page);
    expect(await save(page)).toContain(compact);
});

test('Source mode saves literal table text regardless of the selected format', async ({ page }) => {
    await message(page, { type: 'toggleSourceMode' });
    await page.locator('#sourceEditor').fill(documentText.replace('3', '30'));
    await message(page, { type: 'tableSourceFormat', value: 'aligned' });
    expect(await save(page)).toBe(documentText.replace('3', '30'));
});

test('both modes preserve header-only alignment and cell markup after a round trip', async ({ page }) => {
    for (const mode of ['aligned', 'compact']) {
        await message(page, { type: 'tableSourceFormat', value: mode });
        const source = '| **Left** | `Right` | [Center](https://example.org) |\n| :--- | ---: | :---: |\n';
        await page.evaluate(md => (window as any).__testApi.setMarkdown(md), source);
        const first = await page.evaluate(() => (window as any).__testApi.getMarkdown());
        expect(first.split('\n')[1]).toMatch(/\| -+ \| -+: \| :-+: \|/);
        await page.evaluate(md => (window as any).__testApi.setMarkdown(md), first);
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(first);
        await expect(page.locator('#editor th strong')).toHaveText('Left');
        await expect(page.locator('#editor th code')).toHaveText('Right');
        await expect(page.locator('#editor th a')).toHaveAttribute('href', 'https://example.org');
    }
});

test('external content and export snapshot reads keep the last loaded source unchanged', async ({ page }) => {
    const external = documentText.replace('Long item', 'External value');
    await message(page, { type: 'update', content: external });
    await message(page, { type: 'tableSourceFormat', value: 'compact' });
    await message(page, { type: 'captureExportSnapshot', requestId: 'table-source-read' });
    const snapshot = await page.evaluate(() => (window as any).__testApi.messages.find((m: any) => m.requestId === 'table-source-read'));
    expect(snapshot.content).toBe(external);
    expect(await save(page)).toBe(external);
});
