import { test, expect, Page } from '@playwright/test';

type ExportTestWindow = Window & {
    __testApi: { ready: boolean; setMarkdown(markdown: string): void; messages: Array<Record<string, any>> };
    __hostMessageHandler(message: Record<string, unknown>): void;
    __exportIdleCallbacks?: Array<() => void>;
};

async function sendHost(page: Page, message: Record<string, unknown>) {
    await page.evaluate(message => (window as unknown as ExportTestWindow).__hostMessageHandler(message), message);
}
async function messages(page: Page, type: string) {
    return page.evaluate(type => (window as unknown as ExportTestWindow).__testApi.messages.filter(message => message.type === type), type);
}
async function setMarkdown(page: Page, markdown: string) {
    await page.evaluate(markdown => (window as unknown as ExportTestWindow).__testApi.setMarkdown(markdown), markdown);
}
async function save(page: Page) {
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })));
}
async function sourceInput(page: Page, content: string) {
    // The legacy standalone fixture uses a div for sourceEditor. Its value/input
    // boundary still exercises the production source-mode handler; native tests
    // separately exercise the real textarea and VS Code save lifecycle.
    await page.evaluate(content => {
        const source = document.getElementById('sourceEditor') as HTMLTextAreaElement;
        source.value = content;
        source.dispatchEvent(new Event('input', { bubbles: true }));
    }, content);
}

test.describe('Export saved snapshot agreement', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/standalone-editor.html');
        await page.waitForFunction(() => (window as unknown as ExportTestWindow).__testApi?.ready);
    });

    test('captures untouched Markdown exactly without source, selection or undo mutation', async ({ page }) => {
        const original = '1. original numbering\n3. preserved numbering\n\n\n';
        await setMarkdown(page, original);
        const html = await page.locator('#editor').innerHTML();
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'untouched' });
        expect(await messages(page, 'exportSnapshot')).toEqual([{ type: 'exportSnapshot', requestId: 'untouched', content: original, pending: false }]);
        expect(await messages(page, 'edit')).toEqual([]);
        expect(await messages(page, 'save')).toEqual([]);
        expect(await page.locator('#editor').innerHTML()).toBe(html);
    });

    test('save in source mode sends latest textarea content and preserves it until acknowledged', async ({ page }) => {
        await setMarkdown(page, 'Old visual content\n');
        await sendHost(page, { type: 'toggleSourceMode' });
        await sourceInput(page, 'Latest source content\n');
        await save(page);
        const [request] = await messages(page, 'save');
        expect(request.content).toBe('Latest source content\n');
        expect(request.revision).toBeGreaterThan(0);
        expect(await messages(page, 'edit')).toEqual([]);
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'saving' });
        expect((await messages(page, 'exportSnapshot')).at(-1)).toMatchObject({ content: 'Latest source content\n', pending: true });
        await sendHost(page, { type: 'saveResult', revision: request.revision, success: true });
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'saved' });
        expect((await messages(page, 'exportSnapshot')).at(-1)).toMatchObject({ content: 'Latest source content\n', pending: false });
    });

    test('an older successful save cannot clear a newer edit', async ({ page }) => {
        await setMarkdown(page, 'Initial\n');
        await sendHost(page, { type: 'toggleSourceMode' });
        await sourceInput(page, 'First revision\n');
        await save(page);
        const [firstSave] = await messages(page, 'save');
        await sourceInput(page, 'Second revision\n');
        await sendHost(page, { type: 'saveResult', revision: firstSave.revision, success: true });
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'newer' });
        expect((await messages(page, 'exportSnapshot')).at(-1)).toMatchObject({ content: 'Second revision\n', pending: true });
        await save(page);
        expect((await messages(page, 'save')).at(-1)).toMatchObject({ content: 'Second revision\n' });
        expect((await messages(page, 'save')).at(-1)?.revision).toBeGreaterThan(firstSave.revision);
    });

    test('native documentSaved clears only the matching current source revision', async ({ page }) => {
        await setMarkdown(page, 'Initial\n');
        await sendHost(page, { type: 'toggleSourceMode' });
        await sourceInput(page, 'Saved natively\n');
        await sendHost(page, { type: 'documentSaved', content: 'Saved natively\r\n' });
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'native-saved' });
        expect((await messages(page, 'exportSnapshot')).at(-1)).toMatchObject({ content: 'Saved natively\n', pending: false });
        await sourceInput(page, 'Newer unsaved source\n');
        await sendHost(page, { type: 'documentSaved', content: 'Saved natively\n' });
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'native-stale' });
        expect((await messages(page, 'exportSnapshot')).at(-1)).toMatchObject({ content: 'Newer unsaved source\n', pending: true });
    });

    test('failed save retains the current edit for a retry', async ({ page }) => {
        await setMarkdown(page, 'Initial\n');
        await page.locator('#editor').fill('Unsaved visual text');
        await save(page);
        const [request] = await messages(page, 'save');
        await sendHost(page, { type: 'saveResult', revision: request.revision, success: false });
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'failed' });
        expect((await messages(page, 'exportSnapshot')).at(-1)?.content).toContain('Unsaved visual text');
        await save(page);
        expect((await messages(page, 'save')).at(-1)?.content).toBe(request.content);
    });

    test('save invalidates an already queued idle serialization callback', async ({ page }) => {
        await page.clock.install();
        await page.evaluate(() => {
            const testWindow = window as unknown as ExportTestWindow;
            testWindow.__exportIdleCallbacks = [];
            window.requestIdleCallback = callback => {
                testWindow.__exportIdleCallbacks!.push(() => callback({ didTimeout: false, timeRemaining: () => 20 }));
                return testWindow.__exportIdleCallbacks!.length;
            };
        });
        await setMarkdown(page, 'Initial\n');
        await page.locator('#editor').fill('Saved visual revision');
        await page.clock.runFor(1001);
        expect(await page.evaluate(() => (window as unknown as ExportTestWindow).__exportIdleCallbacks!.length)).toBeGreaterThan(0);
        await save(page);
        const [request] = await messages(page, 'save');
        await sendHost(page, { type: 'saveResult', revision: request.revision, success: true });
        const editCount = (await messages(page, 'edit')).length;
        await page.evaluate(() => (window as unknown as ExportTestWindow).__exportIdleCallbacks!.forEach(callback => callback()));
        expect((await messages(page, 'edit')).length).toBe(editCount);
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'after-idle' });
        expect((await messages(page, 'exportSnapshot')).at(-1)).toMatchObject({ content: request.content, pending: false });
    });
});

async function prepare(page: Page, markdown: string, requestId = 'render') {
    await sendHost(page, { type: 'prepareExport', requestId, markdown });
    await expect.poll(async () => (await messages(page, 'exportPrepared')).some(message => message.requestId === requestId)).toBe(true);
    return (await messages(page, 'exportPrepared')).find(message => message.requestId === requestId)!;
}

test.describe('Export document-only rendering', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/standalone-editor.html');
        await page.waitForFunction(() => (window as unknown as ExportTestWindow).__testApi?.ready);
        await page.addScriptTag({ url: '/vendor/katex.min.js' });
    });

    test('renders captured input in source mode without replacing the live document', async ({ page }) => {
        await setMarkdown(page, '# Live editor\n\nKeep this document unchanged.\n');
        const beforeHtml = await page.locator('#editor').innerHTML();
        await sendHost(page, { type: 'toggleSourceMode' });
        await sourceInput(page, '# Continued source edit\n');
        const rendered = await prepare(page, '# Captured revision\n\n| First | Last |\n| --- | --- |\n| complete | content |\n\n```javascript\nconst value = 3;\n```\n');
        expect(rendered.html).toContain('Captured revision');
        expect(rendered.html).toContain('<table>');
        expect(rendered.html).toContain('hljs-');
        expect(rendered.html).not.toContain('Continued source edit');
        expect(rendered.html).not.toMatch(/contenteditable|code-copy-btn|code-block-header|<script/i);
        expect(await page.locator('#editor').innerHTML()).toBe(beforeHtml);
        expect(await page.locator('#editor').isVisible()).toBe(false);
        await sendHost(page, { type: 'captureExportSnapshot', requestId: 'after-render' });
        expect((await messages(page, 'exportSnapshot')).at(-1)?.content).toBe('# Continued source edit\n');
        expect(await page.locator('.export-preparation').count()).toBe(0);
    });

    test('waits for real math and Mermaid SVG and returns diagram source', async ({ page }) => {
        const source = 'graph TD\n  A[First] --> B[Last]';
        const rendered = await prepare(page, '# Before diagram\n\n```math\nx^2 + y^2 = z^2\n```\n\n```mermaid\n' + source + '\n```\n\nAfter diagram\n');
        expect(rendered.html).toContain('Before diagram');
        expect(rendered.html).toContain('After diagram');
        expect(rendered.html).toContain('katex');
        expect(rendered.html).toContain('<svg');
        expect(rendered.html).not.toContain('foreignObject');
        expect(rendered.diagrams).toHaveLength(1);
        expect(rendered.diagrams[0].source).toBe(source);
        expect(rendered.diagrams[0].svg).toContain('<svg');
        expect(rendered.warnings).toEqual([]);
        expect(await page.locator('.export-preparation').count()).toBe(0);
    });

    test('document diagram directives cannot enable active HTML labels', async ({ page }) => {
        const source = '%%{init: {"flowchart": {"htmlLabels": true}, "securityLevel": "loose"}}%%\ngraph TD\n A[First] --> B[Last]';
        const rendered = await prepare(page, '```mermaid\n' + source + '\n```\n');
        expect(rendered.diagrams).toHaveLength(1);
        expect(rendered.diagrams[0].svg).not.toContain('foreignObject');
    });

    test('provides visible source fallbacks and warnings for failed math and diagrams', async ({ page }) => {
        const rendered = await prepare(page, '```math\n\\notAnExistingMathCommand{x}\n```\n\n```mermaid\nnot a mermaid diagram\n```\n');
        expect(rendered.html).toContain('expression could not be rendered');
        expect(rendered.html).toContain('notAnExistingMathCommand');
        expect(rendered.html).toContain('diagram could not be rendered');
        expect(rendered.html).toContain('not a mermaid diagram');
        expect(rendered.warnings.map((warning: { code: string }) => warning.code)).toEqual(expect.arrayContaining(['math-fallback', 'diagram-fallback']));
        expect(await page.locator('.export-preparation').count()).toBe(0);
        expect(await page.locator('[id^="dbinary-export-diagram-"]').count()).toBe(0);
    });

    test('sanitizes attribute injection and unsafe links before attachment', async ({ page }) => {
        const unsafe = '[bad link](javascript:alert%281%29)\n\n![image](missing.png" onerror="window.exportInjected=true" data-extra=")\n';
        const rendered = await prepare(page, unsafe);
        expect(rendered.html).not.toMatch(/\sonerror=|href="javascript:/i);
        expect(rendered.html).toContain('Unsafe resource or link disabled');
        expect(rendered.warnings.map((warning: { code: string }) => warning.code)).toEqual(expect.arrayContaining(['active-content', 'unsafe-reference']));
        expect(await page.evaluate(() => (window as Window & { exportInjected?: boolean }).exportInjected)).toBeUndefined();
    });

    test('preserves original image references without fetching them during preparation', async ({ page }) => {
        const requests: string[] = [];
        await page.route('https://example.invalid/**', route => { requests.push(route.request().url()); return route.abort(); });
        const rendered = await prepare(page, '![local asset](assets/图片 original.png)\n\n![remote asset](https://example.invalid/original.png)\n');
        expect(rendered.html).toContain('data-markdown-path="assets/图片 original.png"');
        expect(rendered.html).toContain('src="https://example.invalid/original.png"');
        expect(requests).toEqual([]);
    });

    test('excludes metadata without stripping directive-looking fenced content', async ({ page }) => {
        const rendered = await prepare(page, '---\ntitle: Metadata title\n---\n# Visible title\n\n```text\n---\nIMAGE_DIR: example inside code\n```\n\n---\nIMAGE_DIR: ./images\nFORCE_RELATIVE_PATH: true\n');
        expect(rendered.html).not.toContain('Metadata title');
        expect(rendered.html).toContain('Visible title');
        expect(rendered.html).toContain('example inside code');
        expect(rendered.html).not.toContain('./images');
        const unclosed = await prepare(page, '```text\nexample\n---\nIMAGE_DIR: still code', 'unclosed');
        expect(unclosed.html).toContain('still code');
    });

    test('cancellation removes the owned rendering container and ignores late diagram completion', async ({ page }) => {
        await page.evaluate(() => {
            const current = window as Window & { mermaid: { render: () => Promise<unknown> }; finishExportDiagram?: () => void };
            current.mermaid.render = () => new Promise(resolve => {
                current.finishExportDiagram = () => resolve({ svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>Late</text></svg>' });
            });
        });
        await sendHost(page, { type: 'prepareExport', requestId: 'cancelled', markdown: '```mermaid\ngraph TD\nA --> B\n```\n' });
        await expect(page.locator('.export-preparation')).toHaveCount(1);
        await sendHost(page, { type: 'cancelExportPreparation', requestId: 'cancelled' });
        await expect.poll(async () => (await messages(page, 'exportError')).some(message => message.requestId === 'cancelled')).toBe(true);
        await expect(page.locator('.export-preparation')).toHaveCount(0);
        await page.evaluate(() => (window as Window & { finishExportDiagram?: () => void }).finishExportDiagram?.());
        expect((await messages(page, 'exportPrepared')).filter(message => message.requestId === 'cancelled')).toEqual([]);
    });
});


test('export image validation rejects malformed bytes and external references', async ({ page }) => {
    await page.goto('/standalone-editor.html');
    await page.waitForFunction(() => (window as unknown as ExportTestWindow).__testApi?.ready);
    const validPng = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 2; canvas.height = 2;
        canvas.getContext('2d')!.fillRect(0, 0, 2, 2);
        return canvas.toDataURL('image/png');
    });
    await sendHost(page, { type: 'validateExportImage', requestId: 'valid', dataUri: validPng });
    await sendHost(page, { type: 'validateExportImage', requestId: 'truncated', dataUri: validPng.slice(0, 45) });
    await sendHost(page, { type: 'validateExportImage', requestId: 'external', dataUri: 'https://example.invalid/image.png' });
    await expect.poll(async () => (await messages(page, 'exportImageValidated')).length).toBe(3);
    const replies = await messages(page, 'exportImageValidated');
    expect(replies.find(reply => reply.requestId === 'valid')?.valid).toBe(true);
    expect(replies.find(reply => reply.requestId === 'truncated')?.valid).toBe(false);
    expect(replies.find(reply => reply.requestId === 'external')?.valid).toBe(false);
});
