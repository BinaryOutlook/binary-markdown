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

async function editCell(page: Page, text: string, tableIndex = 0, cellIndex = 1) {
    const cell = page.locator('#editor table').nth(tableIndex).locator('td').nth(cellIndex);
    await cell.click();
    await cell.evaluate(element => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
    });
    await page.keyboard.insertText(text);
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

for (const [mode, expected] of [
    ['aligned', aligned.replace('3     ', '30    ')],
    ['compact', compact.replace('3 |', '30 |')]
]) {
    test(`${mode}: a table edit uses the selected format and stays stable through save and reopen`, async ({ page }) => {
        await message(page, { type: 'tableSourceFormat', value: mode });
        await editCell(page, '30');
        const first = await save(page);
        expect(first).toContain(expected);
        expect(first).toContain('After');
        expect(await save(page)).toBe(first);
        await page.reload();
        await page.waitForFunction(() => (window as any).__testApi?.ready);
        await message(page, { type: 'tableSourceFormat', value: mode });
        await message(page, { type: 'update', content: first });
        expect(await save(page)).toBe(first);
        await editProse(page);
        expect(await save(page)).toBe(first.replace('After', 'After!'));
    });

    test(`${mode}: empty cells remain empty and authored line breaks survive repeated conversion`, async ({ page }) => {
        await message(page, { type: 'tableSourceFormat', value: mode });
        const source = '| Name | Blank | Break |\n| --- | --- | --- |\n| **Ready** | | <br> |\n';
        await message(page, { type: 'update', content: source });
        await page.locator('#editor td strong').evaluate(element => { element.textContent = 'Running'; });
        const first = await page.evaluate(() => (window as any).__testApi.getMarkdown());
        expect(first.match(/<br>/g)).toHaveLength(1);
        expect(first).toContain('**Running**');
        expect(first).not.toContain('data-table-placeholder');
        await page.evaluate(md => (window as any).__testApi.setMarkdown(md), first);
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(first);
        await expect(page.locator('#editor td').nth(1)).toHaveText('');
        await expect(page.locator('#editor td').nth(2).locator('br')).toHaveCount(1);
    });
}

test('default is aligned; switching to legacy changes later output without erasing undo', async ({ page }) => {
    await editCell(page, '30');
    expect(await save(page)).toContain(aligned.replace('3     ', '30    '));
    const before = await page.locator('#editor').innerHTML();
    await message(page, { type: 'tableSourceFormat', value: 'compact' });
    await expect(page.locator('#editor')).toHaveJSProperty('innerHTML', before);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeEnabled();
    await message(page, { type: 'performUndo' });
    expect(await save(page)).toBe(documentText);
    await message(page, { type: 'performRedo' });
    expect(await save(page)).toContain('30');
    await editCell(page, '31');
    expect(await save(page)).toContain(compact.replace('3 |', '31 |'));
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
        await page.locator('#editor th strong').evaluate(element => { element.textContent = 'Left!'; });
        const first = await page.evaluate(() => (window as any).__testApi.getMarkdown());
        expect(first.split('\n')[1]).toMatch(/\| -+ \| -+: \| :-+: \|/);
        await page.evaluate(md => (window as any).__testApi.setMarkdown(md), first);
        expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(first);
        await expect(page.locator('#editor th strong')).toHaveText('Left!');
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

const otherTable = '| Other | __Style__ |\n|:------|---------:|\n|a \\| b|  untouched |\n';
const mixedDocument = documentText + '\n' + otherTable;

test('a paragraph edit leaves every table source unchanged', async ({ page }) => {
    await message(page, { type: 'update', content: mixedDocument });
    await editProse(page);
    expect(await save(page)).toBe(mixedDocument.replace('After', 'After!'));
});

test('editing one table preserves its neighbor and later paragraph edits preserve both', async ({ page }) => {
    await message(page, { type: 'update', content: mixedDocument });
    await editCell(page, '30');
    const expected = mixedDocument.replace(table, aligned.replace('3     ', '30    '));
    expect(await save(page)).toBe(expected);
    await message(page, { type: 'tableSourceFormat', value: 'compact' });
    await editProse(page);
    expect(await save(page)).toBe(expected.replace('After', 'After!'));
});

test('an external formatting-only change replaces the retained table source', async ({ page }) => {
    await message(page, { type: 'update', content: mixedDocument });
    const external = mixedDocument.replace(table, aligned);
    await message(page, { type: 'update', content: external });
    await message(page, { type: 'tableSourceFormat', value: 'compact' });
    await editProse(page);
    expect(await save(page)).toBe(external.replace('After', 'After!'));
});

test('editing the second table and undo/redo retain the first table verbatim', async ({ page }) => {
    await message(page, { type: 'update', content: mixedDocument });
    await editCell(page, 'changed', 1);
    const edited = await save(page);
    expect(edited).toContain(table);
    expect(edited).not.toContain(otherTable);
    expect(edited).toContain('changed');
    await message(page, { type: 'performUndo' });
    expect(await save(page)).toBe(mixedDocument);
    await message(page, { type: 'performRedo' });
    expect(await save(page)).toBe(edited);
    await editProse(page);
    expect(await save(page)).toBe(edited.replace('After', 'After!'));
});

test('row operations and alignment changes only serialize the affected table', async ({ page }) => {
    await message(page, { type: 'update', content: mixedDocument });
    await page.locator('#editor table').first().locator('td').last().click();
    await page.locator('.table-toolbar:not(.table-toolbar-measure) [data-action="add-row-below"]')
        .evaluate((button: HTMLElement) => button.click());
    await expect(page.locator('#editor table').first().locator('tr')).toHaveCount(3);
    const added = await save(page);
    expect(added).toContain(otherTable);
    expect(added).toContain('|           |       |');
    await message(page, { type: 'performUndo' });
    expect(await save(page)).toBe(mixedDocument);
    await page.locator('#editor table').first().locator('td').last().click();
    await page.locator('.table-toolbar:not(.table-toolbar-measure) [data-action="align-center"]')
        .evaluate((button: HTMLElement) => button.click());
    const centered = await save(page);
    expect(centered).toContain('| --------- | :---: |');
    expect(centered).toContain(otherTable);
    expect(centered).not.toContain('data-table-');
});

test('Source edits become the retained source for subsequent visual edits', async ({ page }) => {
    await message(page, { type: 'update', content: mixedDocument });
    await message(page, { type: 'toggleSourceMode' });
    const sourceEdited = mixedDocument.replace('|---|---|', '| ------- | ------- |').replace('untouched', 'source change');
    await page.locator('#sourceEditor').fill(sourceEdited);
    await message(page, { type: 'toggleSourceMode' });
    await editProse(page);
    expect(await save(page)).toBe(sourceEdited.replace('After', 'After!'));
});

test('deleting or cloning identical tables does not mix up their source formatting', async ({ page }) => {
    const source = table + '\n' + aligned;
    await message(page, { type: 'update', content: source });
    const result = await page.evaluate(() => {
        const tables = document.querySelectorAll('#editor table');
        tables[1].before(tables[0].cloneNode(true));
        tables[0].remove();
        return (window as any).__testApi.getMarkdown();
    });
    expect(result).toContain(table);
    expect(result).toContain(aligned);
    const remaining = await page.evaluate(() => {
        document.querySelector('#editor table')!.remove();
        return (window as any).__testApi.getMarkdown();
    });
    expect(remaining.trim()).toBe(aligned.trim());
});

test('view details and export preparation do not invalidate retained tables or expose their metadata', async ({ page }) => {
    await page.addScriptTag({ url: '/vendor/katex.min.js' });
    await page.addStyleTag({ url: '/vendor/katex.min.css' });
    const source = mixedDocument.replace('untouched', '$x^2$');
    await message(page, { type: 'update', content: source });
    await expect(page.locator('#editor .math-inline .katex')).toBeVisible();
    await page.locator('#editor th').first().evaluate(element => { element.style.width = '250px'; });
    await message(page, { type: 'tableToolbarPosition', value: 'top-bar' });
    await editProse(page);
    const saved = await save(page);
    expect(saved).toBe(source.replace('After', 'After!'));
    await message(page, { type: 'prepareExport', requestId: 'table-metadata', markdown: saved });
    await page.waitForFunction(() => (window as any).__testApi.messages.some((m: any) => m.type === 'exportPrepared'));
    const prepared = await page.evaluate(() => (window as any).__testApi.messages.find((m: any) => m.type === 'exportPrepared'));
    expect(prepared.html).toContain('<table');
    expect(prepared.html).not.toMatch(/data-table-(source|state)/);
    expect(await save(page)).toBe(saved);
});
