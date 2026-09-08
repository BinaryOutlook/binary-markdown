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
