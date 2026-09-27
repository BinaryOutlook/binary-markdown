import { test, expect, Page } from '@playwright/test';

const message = (page: Page, payload: object) => page.evaluate(value => (window as any).__hostMessageHandler(value), payload);
const markdown = (page: Page): Promise<string> => page.evaluate(() => (window as any).__testApi.getMarkdown());

async function append(page: Page, selector: string) {
    await page.locator(selector).evaluate(element => {
        (document.getElementById('editor') as HTMLElement).focus();
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        getSelection()!.removeAllRanges();
        getSelection()!.addRange(range);
    });
    await page.keyboard.type('!');
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

const fixtures = [
    { name: 'literal break tag', source: '`<br>`', payload: '<br>' },
    { name: 'HTML and emphasis text', source: '`<span title="x">*value*</span>`', payload: '<span title="x">*value*</span>' },
    { name: 'meaningful edge spaces', source: '`  Alpha  `', payload: ' Alpha ' },
    { name: 'all-space payload', source: '`   `', payload: '   ' },
    { name: 'one space', source: '` `', payload: ' ' },
    { name: 'leading space only', source: '` Alpha`', payload: ' Alpha' },
    { name: 'trailing space only', source: '`Alpha `', payload: 'Alpha ' },
    { name: 'backticks at the edges', source: '`` `tick` ``', payload: '`tick`' },
    { name: 'embedded backtick runs', source: '``` a``b`c ```', payload: 'a``b`c' },
    { name: 'normalized source newline', source: '`Alpha\nBeta`', payload: 'Alpha Beta' },
    { name: 'replacement-like dollar text', source: '`$& $$ $\'`', payload: '$& $$ $\'' },
];

for (const fixture of fixtures) {
    test(`${fixture.name} stays literal through neighboring edits and repeated save/reopen`, async ({ page }) => {
        const fence = '\n\n```text\n<br>  literal  \n\n```\n';
        const source = 'Code ' + fixture.source + ' tail\n\nEnd' + fence;
        await message(page, { type: 'update', content: source });
        expect(await page.locator('#editor > p code').textContent()).toBe(fixture.payload);
        await expect(page.locator('#editor > p code > *')).toHaveCount(0);
        expect(await markdown(page)).toBe(source);
        await append(page, '#editor > p:nth-child(2)');
        expect(await save(page)).toBe(source.replace('End', 'End!'));
        for (let round = 0; round < 3; round++) {
            await append(page, '#editor > p:first-child');
            const saved = await save(page);
            expect(saved).toContain(fence);
            expect(await save(page)).toBe(saved);
            await reopen(page, saved);
            expect(await page.locator('#editor > p code').textContent()).toBe(fixture.payload);
            await expect(page.locator('#editor > p code > *')).toHaveCount(0);
            expect(await save(page)).toBe(saved);
        }
    });
}

test('editing padded code preserves its payload through undo, redo and Source mode', async ({ page }) => {
    const source = 'Code `  Alpha  ` tail\n';
    await message(page, { type: 'update', content: source });
    await page.locator('#editor code').evaluate(code => {
        (document.getElementById('editor') as HTMLElement).focus();
        const range = document.createRange();
        range.setStart(code.firstChild!, code.textContent!.length - 1);
        range.collapse(true);
        getSelection()!.removeAllRanges();
        getSelection()!.addRange(range);
    });
    await page.keyboard.type('!');
    const changed = 'Code `  Alpha!  ` tail\n';
    expect(await save(page)).toBe(changed);
    await message(page, { type: 'performUndo' });
    expect(await markdown(page)).toBe(source);
    await message(page, { type: 'performRedo' });
    expect(await save(page)).toBe(changed);
    await message(page, { type: 'toggleSourceMode' });
    await expect(page.locator('#sourceEditor')).toHaveValue(changed);
    await page.locator('#sourceEditor').fill(changed.replace('Alpha!', 'Beta'));
    await message(page, { type: 'toggleSourceMode' });
    expect(await page.locator('#editor code').textContent()).toBe(' Beta ');
    const saved = await save(page);
    await reopen(page, saved);
    expect(await page.locator('#editor code').textContent()).toBe(' Beta ');
});

test('literal and padded code survives a neighboring table cell edit', async ({ page }) => {
    const source = '| Code | Value |\n| --- | --- |\n| `<br>` | one |\n| `  Alpha  ` | two |\n| `   ` | three |\n';
    await message(page, { type: 'update', content: source });
    await page.locator('#editor tr:last-child td:last-child').fill('changed');
    const saved = await save(page);
    expect(saved).toContain('`<br>`');
    expect(saved).toContain('`  Alpha  `');
    expect(saved).toContain('`   `');
    await reopen(page, saved);
    expect(await page.locator('#editor td code').allTextContents()).toEqual(['<br>', ' Alpha ', '   ']);
    await expect(page.locator('#editor td code > *')).toHaveCount(0);
    expect(await save(page)).toBe(saved);
});

test('prose breaks remain breaks while exported inline code retains literal text', async ({ page }) => {
    const source = 'Code `<br>` and `  Alpha  ` tail<br>next\n';
    await message(page, { type: 'update', content: source });
    await expect(page.locator('#editor > p > br')).toHaveCount(1);
    await expect(page.locator('#editor code br')).toHaveCount(0);
    await append(page, '#editor > p');
    const saved = await save(page);
    await message(page, { type: 'prepareExport', requestId: 'literal-inline-code', markdown: saved, theme: 'github', fontSize: 16 });
    await page.waitForFunction(() => (window as any).__testApi.messages.some((m: any) => m.type === 'exportPrepared' && m.requestId === 'literal-inline-code'));
    const rendered = await page.evaluate(() => {
        const prepared = (window as any).__testApi.messages.findLast((m: any) => m.type === 'exportPrepared');
        const document = new DOMParser().parseFromString(prepared.html, 'text/html');
        return { payloads: Array.from(document.querySelectorAll('code')).map(code => code.textContent), codeBreaks: document.querySelectorAll('code br').length };
    });
    expect(rendered).toEqual({ payloads: ['<br>', ' Alpha '], codeBreaks: 0 });
    expect(await save(page)).toBe(saved);
});
