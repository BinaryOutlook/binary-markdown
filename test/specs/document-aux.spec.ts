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

async function save(page: Page) {
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })));
}
async function messages(page: Page, type: string): Promise<any[]> {
    return page.evaluate(type => (window as any).__testApi.messages.filter((m: any) => m.type === type), type);
}

test('TOC snapshot refreshes on request and save, not while changing headings', async ({ page }) => {
    await setMarkdown(page, '# Introduction\n\n## Scope\n\n# Results\n');
    await host(page, { type: 'insertToc' });
    await expect(page.locator('.toc-block a')).toHaveText(['Introduction', 'Scope', 'Results']);
    const before = await markdown(page);
    expect(before).toContain('<!-- binary-markdown:toc:start -->');
    expect(before).not.toContain('↻');
    await page.locator('#editor > h1').last().fill('Evaluation');
    await expect(page.locator('.toc-block')).toContainText('Results');
    await page.locator('.toc-refresh').click();
    await expect(page.locator('.toc-block')).toContainText('Evaluation');
    await expect(page.locator('.toc-block')).not.toContainText('Results');
    await page.locator('#editor > h1').last().fill('Conclusions');
    await save(page);
    const request = (await messages(page, 'save')).at(-1);
    expect(request.content).toContain('[Conclusions](#conclusions)');
    await host(page, { type: 'saveResult', revision: request.revision, success: true });
    await save(page);
    expect((await messages(page, 'save')).at(-1).content).toBe(request.content);
});

test('TOC refresh is undoable and readonly snapshot capture does not refresh it', async ({ page }) => {
    await setMarkdown(page, '[TOC]\n\n# Before\n');
    await page.locator('.toc-refresh').click();
    await page.locator('#editor > h1').fill('After');
    await host(page, { type: 'captureExportSnapshot', requestId: 'read-only' });
    expect((await messages(page, 'exportSnapshot')).at(-1).content).toContain('[Before](#before)');
    await page.locator('.toc-refresh').click();
    expect(await markdown(page)).toContain('[After](#after)');
    await host(page, { type: 'performUndo' });
    expect(await markdown(page)).toContain('[Before](#before)');
    await expect(page.locator('#editor > h1')).toHaveText('After');
    await host(page, { type: 'performRedo' });
    expect(await markdown(page)).toContain('[After](#after)');
});

test('native save capture and source-mode save refresh exact source without normalizing the body', async ({ page }) => {
    const source = '---\ntitle: "Keep me" # comment\n---\n\n[TOC]\n\n# Body\n\n1. First\n5. Preserve numbering\n\n\n';
    await setMarkdown(page, source);
    await host(page, { type: 'captureExportSnapshot', requestId: 'native', refreshToc: true });
    const snapshot = (await messages(page, 'exportSnapshot')).at(-1);
    expect(snapshot.content).toContain('[Body](#body)');
    expect(snapshot.content).toContain('1. First\n5. Preserve numbering\n\n\n');
    expect(snapshot.content).toContain('title: "Keep me" # comment');
    await host(page, { type: 'documentSaved', content: snapshot.content });
    await host(page, { type: 'captureExportSnapshot', requestId: 'after-save' });
    expect((await messages(page, 'exportSnapshot')).at(-1).content).toBe(snapshot.content);
    await host(page, { type: 'toggleSourceMode' });
    await page.evaluate(() => {
        const input = document.getElementById('sourceEditor') as HTMLTextAreaElement;
        input.value = input.value.replace('# Body', '# Renamed');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await save(page);
    expect((await messages(page, 'save')).at(-1).content).toContain('[Renamed](#renamed)');
});

test('HTML export has unique matching targets and omits refresh controls and metadata', async ({ page }) => {
    await setMarkdown(page, '---\ntitle: Metadata\n---\n\n[TOC]\n\n# Results\n# Results\n# 中文\n');
    await save(page);
    const source = (await messages(page, 'save')).at(-1).content;
    await host(page, { type: 'prepareExport', requestId: 'toc', markdown: source });
    await page.waitForFunction(() => (window as any).__testApi.messages.some((m: any) => m.type === 'exportPrepared'));
    const prepared = (await messages(page, 'exportPrepared')).at(-1);
    expect(prepared.html).not.toContain('toc-refresh');
    expect(prepared.html).not.toContain('binary-markdown:toc');
    expect(prepared.html).not.toContain('Metadata');
    expect(prepared.warnings).not.toContainEqual(expect.objectContaining({ code: 'active-content' }));
    const links = await page.evaluate(html => {
        const root = new DOMParser().parseFromString(html, 'text/html');
        return [...root.querySelectorAll('.toc-block a')].map(a => {
            const id = decodeURIComponent(a.getAttribute('href')!.slice(1));
            return { id, found: !!root.getElementById(id) };
        });
    }, prepared.html);
    expect(links).toEqual([{ id: 'results', found: true }, { id: 'results-1', found: true }, { id: '中文', found: true }]);
});
