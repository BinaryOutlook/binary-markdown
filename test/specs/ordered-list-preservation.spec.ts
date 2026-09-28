import { test, expect, Page } from '@playwright/test';

const message = (page: Page, payload: object) => page.evaluate(value => (window as any).__hostMessageHandler(value), payload);
const markdown = (page: Page): Promise<string> => page.evaluate(() => (window as any).__testApi.getMarkdown());

async function append(page: Page, selector: string, text = '!') {
    await page.locator(selector).evaluate(element => {
        (document.getElementById('editor') as HTMLElement).focus();
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        getSelection()!.removeAllRanges();
        getSelection()!.addRange(range);
    });
    await page.keyboard.type(text);
}

async function save(page: Page) {
    await page.keyboard.press('Control+s');
    const saved = await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'save').at(-1));
    expect(saved?.content).toBeDefined();
    await message(page, { type: 'documentSaved', content: saved.content });
    await message(page, { type: 'saveResult', revision: saved.revision, success: true });
    return saved.content as string;
}

async function reopen(page: Page, content: string) {
    await page.reload();
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await message(page, { type: 'update', content });
}

test.beforeEach(async ({ page }) => {
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
});

for (const start of [0, 5, 10]) {
    test(`ordered start ${start} survives view-only actions and an unrelated save`, async ({ page }) => {
        const source = `${start}. Alpha\n${start + 1}. Beta\n\nTail\n`;
        await message(page, { type: 'update', content: source });
        await expect(page.locator('#editor > ol')).toHaveAttribute('start', String(start));
        await message(page, { type: 'toggleSourceMode' });
        await expect(page.locator('#sourceEditor')).toHaveValue(source);
        await message(page, { type: 'toggleSourceMode' });
        expect(await markdown(page)).toBe(source);
        expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'edit'))).toEqual([]);
        await append(page, '#editor > p:last-child');
        expect(await save(page)).toBe(source.replace('Tail', 'Tail!'));
        await reopen(page, await markdown(page));
        await expect(page.locator('#editor > ol')).toHaveAttribute('start', String(start));
    });

    test(`ordered start ${start} survives a list edit, undo and redo`, async ({ page }) => {
        const source = `${start}. Alpha\n${start + 1}. Beta\n`;
        await message(page, { type: 'update', content: source });
        await append(page, '#editor > ol > li:last-child');
        const changed = source.replace('Beta', 'Beta!');
        expect(await save(page)).toBe(changed);
        await message(page, { type: 'performUndo' });
        expect(await markdown(page)).toBe(source);
        await message(page, { type: 'performRedo' });
        expect(await save(page)).toBe(changed);
        await reopen(page, changed);
        await expect(page.locator('#editor > ol')).toHaveAttribute('start', String(start));
        await expect(page.locator('#editor > ol > li')).toHaveText(['Alpha', 'Beta!']);
    });
}

test('ordered checklist text edits retain list kind, start and neighboring source', async ({ page }) => {
    const source = '3. [ ] Alpha\n4. [x] Beta\n\n* Unchanged\n';
    await message(page, { type: 'update', content: source });
    await append(page, '#editor > ol > li:last-child');
    const changed = source.replace('Beta', 'Beta!');
    expect(await save(page)).toBe(changed);
    await message(page, { type: 'toggleSourceMode' });
    await expect(page.locator('#sourceEditor')).toHaveValue(changed);
    await message(page, { type: 'toggleSourceMode' });
    await reopen(page, changed);
    await expect(page.locator('#editor > ol')).toHaveAttribute('start', '3');
    await expect(page.locator('#editor > ol input[type="checkbox"]')).toHaveCount(2);
    await expect(page.locator('#editor > ul > li')).toHaveText('Unchanged');
    expect(await save(page)).toBe(changed);
});

test('mixed ordered tasks retain their shared list through toggles, undo and redo', async ({ page }) => {
    const source = '0. [ ] Alpha\n1. Ordinary\n2. [x] Beta\n';
    await message(page, { type: 'update', content: source });
    await page.locator('#editor > ol input[type="checkbox"]').first().check();
    const changed = source.replace('[ ] Alpha', '[x] Alpha');
    expect(await save(page)).toBe(changed);
    await message(page, { type: 'performUndo' });
    expect(await markdown(page)).toBe(source);
    await message(page, { type: 'performRedo' });
    expect(await save(page)).toBe(changed);
    await reopen(page, changed);
    await expect(page.locator('#editor > ol')).toHaveAttribute('start', '0');
    await expect(page.locator('#editor > ol > li')).toHaveCount(3);
    await expect(page.locator('#editor > ul')).toHaveCount(0);
    await expect(page.locator('#editor > ol input[type="checkbox"]')).toHaveCount(2);
});

test('nested and loose ordered tasks retain continuation indentation and independent starts', async ({ page }) => {
    const source = '10. [ ] Parent\n\n    Continued\n\n    0. [x] Child\n    1. Ordinary child\n\n11. Plain sibling\n\nTail\n\n5. Separate\n6. Other\n';
    await message(page, { type: 'update', content: source });
    await page.locator('#editor > ol').first().locator('li > ol input[type="checkbox"]').uncheck();
    const changed = source.replace('[x] Child', '[ ] Child');
    expect(await save(page)).toBe(changed);
    await reopen(page, changed);
    await expect(page.locator('#editor > ol').first()).toHaveAttribute('start', '10');
    await expect(page.locator('#editor > ol').first().locator('li > ol')).toHaveAttribute('start', '0');
    await expect(page.locator('#editor > ol').last()).toHaveAttribute('start', '5');
    await expect(page.locator('#editor > ol').first().locator('li > p')).toHaveText('Continued');
    expect(await save(page)).toBe(changed);
});

test('ordinary unordered checklists retain their markers after editing and toggling', async ({ page }) => {
    const source = '- [ ] Alpha\n- [x] Beta\n';
    await message(page, { type: 'update', content: source });
    await append(page, '#editor > ul > li:last-child');
    await page.locator('#editor > ul input[type="checkbox"]').first().check();
    const changed = '- [x] Alpha\n- [x] Beta!\n';
    expect(await save(page)).toBe(changed);
    await reopen(page, changed);
    await expect(page.locator('#editor > ul > li')).toHaveCount(2);
    await expect(page.locator('#editor > ol')).toHaveCount(0);
});
