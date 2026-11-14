import { test, expect, Page } from '@playwright/test';
import { openInsertWorkspace } from '../utils/command-menu';

const message = (page: Page, payload: object) => page.evaluate(value => (window as any).__hostMessageHandler(value), payload);
const markdown = (page: Page): Promise<string> => page.evaluate(() => (window as any).__testApi.getMarkdown());
async function save(page: Page) {
    await page.keyboard.press('Control+s');
    const saved = await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'save').at(-1));
    expect(saved?.content).toBeDefined();
    await message(page, { type: 'documentSaved', content: saved.content });
    await message(page, { type: 'saveResult', revision: saved.revision, success: true });
    return saved.content as string;
}
async function caret(page: Page, selector: string) {
    await page.locator(selector).evaluate(element => {
        document.getElementById('editor')!.focus();
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        getSelection()!.removeAllRanges();
        getSelection()!.addRange(range);
    });
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

test('reference forms, shared titles and images survive editing, history and save/reopen', async ({ page }) => {
    const source = 'Read [first][guide], [guide][] and [guide].\n\n![Icon][image]\n\nEnd\n\n[guide]: <https://example.com/a(b)?x=1&y=2> \'Project guide\'\n[image]: data:image/png;base64,iVBORw0KGgo= "Icon title"\n';
    await message(page, { type: 'update', content: source });
    await expect(page.locator('#editor p:first-child a')).toHaveCount(3);
    await expect(page.locator('#editor p:first-child a').first()).toHaveAttribute('title', 'Project guide');
    await expect(page.locator('#editor img')).toHaveAttribute('title', 'Icon title');
    expect(await markdown(page)).toBe(source);
    await caret(page, '#editor > p:nth-child(3)');
    await page.keyboard.type('!');
    expect(await save(page)).toBe(source.replace('End', 'End!'));
    await caret(page, '#editor p:first-child a:nth-child(2)');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.type(' changed');
    const changed = await save(page);
    expect(changed).toContain('[guid changede][guide]');
    expect(changed).toContain("[guide]: <https://example.com/a(b)?x=1&y=2> 'Project guide'");
    expect(changed).toContain('[first][guide]');
    await message(page, { type: 'performUndo' });
    expect(await markdown(page)).not.toContain(' changed');
    await message(page, { type: 'performRedo' });
    expect(await markdown(page)).toBe(changed);
    await reopen(page, changed);
    expect(await save(page)).toBe(changed);
    await message(page, { type: 'toggleSourceMode' });
    await expect(page.locator('#sourceEditor')).toHaveValue(changed);
    await message(page, { type: 'toggleSourceMode' });
    expect(await markdown(page)).toBe(changed);
});

test('repeated footnotes support keyboard navigation and definition editing without losing source', async ({ page }) => {
    const source = 'First.[^method] Again.[^method] Missing.[^unknown]\n\n[^method]: A **strong** note.\n\n    Second paragraph.\n\nTail\n';
    await message(page, { type: 'update', content: source });
    await expect(page.locator('#editor .footnote-ref')).toHaveCount(2);
    await expect(page.locator('#editor .footnote-body strong')).toHaveText('strong');
    await expect(page.locator('#editor .reference-unresolved')).toHaveText('[^unknown]');
    expect(await markdown(page)).toBe(source);
    const first = page.locator('#editor .footnote-ref a').first();
    await first.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#editor .footnote-definition')).toBeFocused();
    await page.locator('#editor .footnote-backlink').nth(1).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#editor .footnote-ref a').nth(1)).toBeFocused();
    expect(await markdown(page)).toBe(source);
    await page.locator('#editor .footnote-definition summary').click();
    const input = page.locator('#editor .reference-source');
    await input.fill('[^method]: Revised **note**.\n\n    Second paragraph.');
    const saved = await save(page);
    expect(saved).toBe(source.replace('A **strong** note.', 'Revised **note**.'));
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#editor .footnote-body strong')).toHaveText('note');
    await reopen(page, saved);
    expect(await save(page)).toBe(saved);
});

test('footnote insertion avoids identifiers already present and remains undoable', async ({ page }) => {
    const source = 'Text.[^NOTE-1] Missing.[^note-2]\n\n[^NOTE-1]: Existing note.\n';
    await message(page, { type: 'update', content: source });
    await caret(page, '#editor > p:first-child');
    await openInsertWorkspace(page);
    await page.locator('#insertMenu [data-insert-action="footnote"]').click();
    const input = page.locator('#editor .reference-source').last();
    await expect(input).toBeFocused();
    expect(await markdown(page)).toContain('[^note-3]: Write the note here.');
    await input.fill('[^note-3]: New note.');
    expect(await save(page)).toContain('[^note-3]: New note.');
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#editor .footnote-body').last()).toHaveText('New note.');
    await message(page, { type: 'performUndo' });
    await message(page, { type: 'performUndo' });
    expect(await markdown(page)).toBe(source);
});

test('detached export resolves references and notes without touching live state', async ({ page }) => {
    const source = '[Guide][g] and note.[^n] Repeated.[^n]\n\n[g]: https://example.com "Title"\n[^n]: Note **body**.\n';
    await message(page, { type: 'update', content: source });
    const before = await page.locator('#editor').innerHTML();
    await message(page, { type: 'prepareExport', requestId: 'notes', markdown: source, theme: 'github', fontSize: 16 });
    await page.waitForFunction(() => (window as any).__testApi.messages.some((m: any) => m.type === 'exportPrepared' && m.requestId === 'notes'));
    const output = await page.evaluate(() => {
        const result = (window as any).__testApi.messages.findLast((m: any) => m.type === 'exportPrepared');
        const doc = new DOMParser().parseFromString(result.html, 'text/html');
        return { warnings: result.warnings, controls: doc.querySelectorAll('textarea,details,button').length,
            href: doc.querySelector('a[href="https://example.com"]')?.getAttribute('href'), notes: doc.querySelectorAll('.footnote-definition').length,
            destinations: Array.from(doc.querySelectorAll('a[href^="#bm-note-"]')).every(link => doc.getElementById(link.getAttribute('href')!.slice(1))) };
    });
    expect(output).toEqual({ warnings: [], controls: 0, href: 'https://example.com', notes: 1, destinations: true });
    expect(await page.locator('#editor').innerHTML()).toBe(before);
    expect(await markdown(page)).toBe(source);
});

test('reference-like text in code and escaped syntax stays literal after neighboring edits', async ({ page }) => {
    const source = '`[a] [^n]` and \\[a].\n\n```md\n[a] [^n]\n```\n\nTail\n\n[a]: /target\n[^n]: Note.\n';
    await message(page, { type: 'update', content: source });
    await expect(page.locator('#editor > p:first-child a, #editor code a')).toHaveCount(0);
    await caret(page, '#editor > p:nth-child(3)');
    await page.keyboard.type('!');
    expect(await save(page)).toBe(source.replace('Tail', 'Tail!'));
});

test('editing a shared link definition updates all references and preserves its position', async ({ page }) => {
    const source = '[ref]: /first "Old"\n\nRead [first][ref] and [ref][] and [ref].\n\nTail\n';
    await message(page, { type: 'update', content: source });
    await page.locator('#editor .reference-definition summary').click();
    await page.locator('#editor .reference-source').fill('[ref]: /second "New title"');
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#editor p a[href="/second"]')).toHaveCount(3);
    await expect(page.locator('#editor p a').first()).toHaveAttribute('title', 'New title');
    expect(await save(page)).toBe(source.replace('/first "Old"', '/second "New title"'));
    await message(page, { type: 'performUndo' });
    expect(await markdown(page)).toBe(source);
});

test('notes in lists and tables preserve identifiers when surrounding content changes', async ({ page }) => {
    const source = '- Read [guide] and note.[^n]\n\n| Value | Note |\n| --- | --- |\n| Text | [^n] and [guide] |\n\n[guide]: /guide\n[^n]: Body.\n';
    await message(page, { type: 'update', content: source });
    await expect(page.locator('#editor .footnote-ref')).toHaveCount(2);
    await expect(page.locator('#editor a[data-reference]')).toHaveCount(2);
    await caret(page, '#editor > ul > li');
    await page.keyboard.type('!');
    await page.locator('#editor td').first().fill('Changed');
    const saved = await save(page);
    expect(saved).toContain('- Read [guide] and note.[^n]!');
    expect(saved).toContain('[^n] and [guide]');
    expect(saved).toContain('[guide]: /guide\n[^n]: Body.');
    await reopen(page, saved);
    expect(await save(page)).toBe(saved);
});

test('duplicate notes and unresolved links retain source and explain resolution', async ({ page }) => {
    const source = 'A[^ONE]. B[^one]. [text][absent]\n\n[^one]: First.\n[^ONE]: Second.\n';
    await message(page, { type: 'update', content: source });
    await expect(page.locator('#editor .footnote-ref a')).toHaveText(['1', '1']);
    await expect(page.locator('#editor .reference-diagnostic')).toContainText('first definition');
    await expect(page.locator('#editor .reference-unresolved')).toHaveAttribute('title', /No matching definition/);
    expect(await markdown(page)).toBe(source);
    await page.locator('#editor .footnote-ref a').last().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#editor .footnote-definition').first()).toBeFocused();
    await message(page, { type: 'toggleSourceMode' });
    await page.locator('#sourceEditor').fill(source + '\n[absent]: /resolved\n');
    await message(page, { type: 'toggleSourceMode' });
    await expect(page.locator('#editor a[href="/resolved"]')).toHaveText('text');
});

test('complex footnote previews do not expose editing controls or change the definition', async ({ page }) => {
    const source = 'Note.[^n]\n\n[^n]: Equation $x^2$.\n\n    - [ ] Task\n\n    | A | B |\n    | --- | --- |\n    | One | Two |\n\n    ```js\n    const n = 1;\n    ```\n';
    await message(page, { type: 'update', content: source });
    await expect(page.locator('#editor .footnote-body [contenteditable="true"]')).toHaveCount(0);
    await expect(page.locator('#editor .footnote-body input[type="checkbox"]')).toBeDisabled();
    await expect(page.locator('#editor .footnote-body .code-block-toolbar')).toHaveCount(0);
    expect(await markdown(page)).toBe(source);
});

test('linked reference images and nested labels survive editing and reopening', async ({ page }) => {
    const source = '[![alt][image]][guide] and ![alt [guide]](image.png).\n\n' +
        '[image]: data:image/png;base64,iVBORw0KGgo= "Picture"\n[guide]: /guide\n';
    await message(page, { type: 'update', content: source });
    await expect(page.locator('#editor a[data-reference] > img[data-reference]')).toHaveCount(1);
    await expect(page.locator('#editor > p')).toHaveCount(1);
    expect(await markdown(page)).toBe(source);
    await caret(page, '#editor > p');
    await page.keyboard.type('!');
    const saved = await save(page);
    expect(saved).toContain('[![alt][image]][guide]');
    expect(saved).not.toContain('undefined');
    await reopen(page, saved);
    expect(await save(page)).toBe(saved);
});

test('literal brackets typed into a reference label stay visible without breaking the target', async ({ page }) => {
    const source = '[Guide][g] and \\[literal].\n\n[g]: /guide\n';
    await message(page, { type: 'update', content: source });
    await caret(page, '#editor a[data-reference]');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.type(']');
    const saved = await save(page);
    expect(saved).toContain('[Guid\\]e][g]');
    await reopen(page, saved);
    await expect(page.locator('#editor a[data-reference]')).toHaveText('Guid]e');
    await expect(page.locator('#editor a[data-reference]')).toHaveAttribute('href', '/guide');
    expect(await save(page)).toBe(saved);
});

test('reference-like syntax inside math stays equation source', async ({ page }) => {
    const source = 'Math $[x] + [^n]$ and [x].\n\n[x]: /x\n[^n]: Note.\n';
    await message(page, { type: 'update', content: source });
    await expect(page.locator('#editor .footnote-ref')).toHaveCount(0);
    await expect(page.locator('#editor a[data-reference]')).toHaveCount(1);
    await expect(page.locator('#editor .math-inline')).toHaveAttribute('data-math-tex', encodeURIComponent('[x] + [^n]'));
    await caret(page, '#editor > p');
    await page.keyboard.type('!');
    expect(await save(page)).toBe(source.replace('and [x].', 'and [x].!'));
});

test('unused notes cannot consume exported backlink destinations', async ({ page }) => {
    const source = '[^unused]: An unused note mentioning [^n].\n\nText.[^n]\n\n[^n]: Kept.\n[^N]: Duplicate.\n';
    await message(page, { type: 'prepareExport', requestId: 'unused', markdown: source, theme: 'github', fontSize: 16 });
    await page.waitForFunction(() => (window as any).__testApi.messages.some((m: any) => m.type === 'exportPrepared' && m.requestId === 'unused'));
    const result = await page.evaluate(() => {
        const prepared = (window as any).__testApi.messages.findLast((m: any) => m.type === 'exportPrepared');
        const doc = new DOMParser().parseFromString(prepared.html, 'text/html');
        return { text: doc.body.textContent, missing: Array.from(doc.querySelectorAll('a[href^="#"]')).filter(a => !doc.getElementById(a.getAttribute('href')!.slice(1))).length };
    });
    expect(result.text).not.toContain('unused');
    expect(result.text).not.toContain('Duplicate');
    expect(result.missing).toBe(0);
});

test('escaped markers stay literal and malformed definitions stay editable with an explanation', async ({ page }) => {
    const source = 'Escaped \\[^n] and \\[guide].\n\n[guide]: javascript:alert(1)\n\n[^n]: Unused.\n';
    await message(page, { type: 'update', content: source });
    await expect(page.locator('#editor > p').first()).toHaveText('Escaped [^n] and [guide].');
    await expect(page.locator('#editor > p.reference-unresolved')).toHaveText('[guide]: javascript:alert(1)');
    await caret(page, '#editor > p:first-child');
    await page.keyboard.type('!');
    const saved = await save(page);
    expect(saved).toContain('Escaped \\[^n] and \\[guide].!');
    await message(page, { type: 'prepareExport', requestId: 'escaped', markdown: saved, theme: 'github', fontSize: 16 });
    await page.waitForFunction(() => (window as any).__testApi.messages.some((m: any) => m.type === 'exportPrepared' && m.requestId === 'escaped'));
    const result = await page.evaluate(() => (window as any).__testApi.messages.findLast((m: any) => m.type === 'exportPrepared'));
    expect(result.warnings).toEqual([]);
    expect(result.html).not.toContain('footnote-definition');
});

test('unused and duplicate note previews cannot take return links from the main text', async ({ page }) => {
    const source = '[^unused]: Preview with [^n].\n\nText.[^n] Again.[^n]\n\n[^n]: Kept.\n[^N]: Duplicate with [^n].\n';
    await message(page, { type: 'update', content: source });
    const references = page.locator('#editor > p .footnote-ref a');
    const backlinks = page.locator('#editor .footnote-backlink');
    await expect(references).toHaveCount(2);
    await expect(backlinks).toHaveCount(2);
    for (let index = 0; index < 2; index++) {
        await expect(backlinks.nth(index)).toHaveAttribute('href', '#' + await references.nth(index).getAttribute('id'));
        await backlinks.nth(index).focus();
        await page.keyboard.press('Enter');
        await expect(references.nth(index)).toBeFocused();
    }
    expect(await markdown(page)).toBe(source);
});

test('Split keeps reference definitions read only while source edits share history and saved content', async ({ page }) => {
    const source = 'Read [guide]. Note.[^説明]\n\n[guide]: /first\n[^説明]: Original note.\n';
    const changed = source.replace('/first', '/second').replace('Original note.', 'Revised note.');
    await message(page, { type: 'update', content: source });
    await page.locator('button[data-editor-mode="split"]').click();
    await expect(page.locator('#sourceEditor')).toHaveValue(source);
    await expect(page.locator('#editor .reference-source').first()).toBeDisabled();
    await expect(page.locator('#editor .reference-source').last()).toBeDisabled();
    await page.locator('#sourceEditor').fill(changed);
    await expect(page.locator('#editor a[data-reference]')).toHaveAttribute('href', '/second');
    await expect(page.locator('#editor .footnote-body')).toHaveText('Revised note.');
    expect(await save(page)).toBe(changed);
    await page.locator('button[data-editor-mode="visual"]').click();
    await expect(page.locator('#editor .reference-source').last()).toBeEnabled();
    await message(page, { type: 'performUndo' });
    expect(await markdown(page)).toBe(source);
    await message(page, { type: 'performRedo' });
    expect(await markdown(page)).toBe(changed);
    await reopen(page, changed);
    expect(await save(page)).toBe(changed);
});
