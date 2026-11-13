import { test, expect, Page } from '@playwright/test';

// Issue #81: host updates must never discard editor text the host has not
// received. Edits name the host revision they were typed on, so the host can
// report a disk revision they replace. The clock makes every timer explicit.
type Message = Record<string, any>;

const host = (page: Page, payload: object) => page.evaluate(value => (window as any).__hostMessageHandler(value), payload);
const markdown = (page: Page): Promise<string> => page.evaluate(() => (window as any).__testApi.getMarkdown());
const sent = (page: Page, type: string): Promise<Message[]> =>
    page.evaluate(value => (window as any).__testApi.messages.filter((message: Message) => message.type === value), type);

async function typeAtEnd(page: Page, text: string) {
    await page.locator('#editor > p').last().evaluate(paragraph => {
        (document.getElementById('editor') as HTMLElement).focus();
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        range.collapse(false);
        getSelection()!.removeAllRanges();
        getSelection()!.addRange(range);
    });
    await page.keyboard.type(text);
}

test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
    // Run idle-time synchronization on the controlled clock.
    await page.evaluate(() => {
        window.requestIdleCallback = (callback => setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0)) as any;
    });
    await host(page, { type: 'update', content: 'Alpha\n', revision: 1 });
    await page.evaluate(() => { (window as any).__testApi.messages.length = 0; });
});

test('an update arriving during unsent typing never replaces that typing', async ({ page }) => {
    await typeAtEnd(page, ' typed');
    await host(page, { type: 'update', content: 'External\n', revision: 2 });
    expect(await markdown(page)).toBe('Alpha typed\n');

    // Debounce, idle timeout and blur all pass without applying the update.
    await page.clock.runFor(5000);
    await page.evaluate(() => (document.getElementById('editor') as HTMLElement).blur());
    await page.clock.runFor(2000);
    expect(await markdown(page)).toBe('Alpha typed\n');
    const edits = await sent(page, 'edit');
    expect(edits.length).toBeGreaterThan(0);
    for (const edit of edits) {
        expect(edit.content).toBe('Alpha typed\n');
        expect(edit.base).toBe(1);
    }
});

test('an update queued during typing applies once nothing is unsent', async ({ page }) => {
    await typeAtEnd(page, ' x');
    await page.clock.runFor(1200);
    expect((await sent(page, 'edit')).at(-1)).toMatchObject({ content: 'Alpha x\n', base: 1 });
    // Still within the typing idle window: the update waits.
    await host(page, { type: 'update', content: 'Alpha x\n\nFrom the side editor\n', revision: 2 });
    expect(await markdown(page)).toBe('Alpha x\n');
    await page.clock.runFor(1000);
    expect(await markdown(page)).toBe('Alpha x\n\nFrom the side editor\n');

    await typeAtEnd(page, ' y');
    await page.clock.runFor(3000);
    expect((await sent(page, 'edit')).at(-1)).toMatchObject({ content: 'Alpha x\n\nFrom the side editor y\n', base: 2 });
});

test('a requested replacement applies at once and Undo restores the discarded text', async ({ page }) => {
    await typeAtEnd(page, ' local');
    await host(page, { type: 'update', content: 'Disk version\n', revision: 2, replace: true });
    expect(await markdown(page)).toBe('Disk version\n');
    await page.clock.runFor(5000);
    expect(await sent(page, 'edit')).toEqual([]);

    await page.evaluate(() => (document.querySelector('[data-action="undo"]') as HTMLButtonElement).click());
    expect(await markdown(page)).toBe('Alpha local\n');
    await page.clock.runFor(1000);
    expect((await sent(page, 'edit')).at(-1)).toMatchObject({ content: 'Alpha local\n', base: 2 });
});

test('saving with a queued update and no newer typing saves the newer text', async ({ page }) => {
    await typeAtEnd(page, ' x');
    await page.clock.runFor(1200);
    await host(page, { type: 'update', content: 'Alpha x\n\nNewer\n', revision: 2 });
    await page.keyboard.press('Control+s');
    const save = (await sent(page, 'save')).at(-1)!;
    expect(save).toMatchObject({ content: 'Alpha x\n\nNewer\n', base: 2 });
    expect(await markdown(page)).toBe('Alpha x\n\nNewer\n');
});

test('saving with a queued update after newer typing keeps the typing and its base', async ({ page }) => {
    await typeAtEnd(page, ' x');
    await host(page, { type: 'update', content: 'External\n', revision: 2 });
    await page.keyboard.press('Control+s');
    const save = (await sent(page, 'save')).at(-1)!;
    expect(save).toMatchObject({ content: 'Alpha x\n', base: 1 });
    await page.clock.runFor(5000);
    expect(await markdown(page)).toBe('Alpha x\n');
});

test('Source mode typing is kept when an update arrives', async ({ page }) => {
    await host(page, { type: 'toggleSourceMode' });
    await page.locator('#sourceEditor').evaluate(element => {
        const source = element as HTMLTextAreaElement;
        source.focus();
        source.setSelectionRange(source.value.length, source.value.length);
    });
    await page.keyboard.type('More\n');
    await host(page, { type: 'update', content: 'External\n', revision: 2 });
    await page.clock.runFor(5000);
    expect(await page.locator('#sourceEditor').inputValue()).toBe('Alpha\nMore\n');
    expect((await sent(page, 'edit')).at(-1)).toMatchObject({ content: 'Alpha\nMore\n', base: 1 });
});

test('the save snapshot names the host revision of its text', async ({ page }) => {
    await host(page, { type: 'update', content: 'Applied\n', revision: 7 });
    await host(page, { type: 'captureExportSnapshot', requestId: 'snapshot-base' });
    const snapshot = (await sent(page, 'exportSnapshot')).find(message => message.requestId === 'snapshot-base');
    expect(snapshot).toMatchObject({ content: 'Applied\n', base: 7 });
});
