import { test, expect, Page } from '@playwright/test';

const message = (page: Page, payload: object) => page.evaluate(value => (window as any).__hostMessageHandler(value), payload);
const markdown = (page: Page): Promise<string> => page.evaluate(() => (window as any).__testApi.getMarkdown());
const history = (page: Page, action: 'undo' | 'redo') => page.evaluate(value => {
    (document.querySelector(`[data-action="${value}"]`) as HTMLButtonElement).click();
}, action);

async function append(page: Page, selector: string) {
    await page.locator(selector).evaluate(element => {
        (document.getElementById('editor') as HTMLElement).focus();
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        getSelection()!.removeAllRanges();
        getSelection()!.addRange(range);
    });
    await page.keyboard.insertText('!');
}

test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
});

for (const pending of ['debounce', 'idle callback']) {
    test(`immediate list Undo and Redo retain the newest input during pending ${pending}`, async ({ page }) => {
        const source = '0. [ ] Code `<br>` tail\n1. Plain\n';
        const changed = source.replace('tail', 'tail!');
        await message(page, { type: 'update', content: source });
        await page.evaluate(() => {
            (window as any).heldIdleCallbacks = [];
            window.requestIdleCallback = callback => (window as any).heldIdleCallbacks.push(callback);
        });
        await append(page, '#editor > ol > li:first-child');
        if (pending === 'idle callback') {
            await page.clock.runFor(1000);
            expect(await page.evaluate(() => (window as any).heldIdleCallbacks.length)).toBeGreaterThan(0);
        }
        expect(await markdown(page)).toBe(changed);
        expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'edit'))).toEqual([]);
        // No save or source switch may flush the live DOM before history capture.
        await history(page, 'undo');
        expect(await markdown(page)).toBe(source);
        await history(page, 'redo');
        expect(await markdown(page)).toBe(changed);
        await page.evaluate(() => (window as any).heldIdleCallbacks.splice(0).forEach((callback: () => void) => callback()));
        expect(await markdown(page)).toBe(changed);
        await history(page, 'undo');
        expect(await markdown(page)).toBe(source);
        await history(page, 'redo');
        expect(await markdown(page)).toBe(changed);
        await page.keyboard.press('Control+s');
        const saved = await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'save').at(-1).content);
        expect(saved).toBe(changed);
    });
}

for (const fixture of [
    { name: 'padded inline code paragraph', source: 'Code `  Alpha  ` tail\n', selector: '#editor > p', changed: 'Code `  Alpha  ` tail!\n' },
    { name: 'table cell', source: '| Code | Value |\n| --- | --- |\n| `<br>` | tail |\n', selector: '#editor td:last-child', changed: '| Code | Value |\n| --- | --- |\n| `<br>` | tail! |\n' }
]) {
    test(`immediate Undo and Redo preserve pre-input and current ${fixture.name}`, async ({ page }) => {
        await message(page, { type: 'tableSourceFormat', value: 'compact' });
        await message(page, { type: 'update', content: fixture.source });
        await append(page, fixture.selector);
        expect(await markdown(page)).toBe(fixture.changed);
        await history(page, 'undo');
        expect(await markdown(page)).toBe(fixture.source);
        await history(page, 'redo');
        expect(await markdown(page)).toBe(fixture.changed);
        await message(page, { type: 'toggleSourceMode' });
        await expect(page.locator('#sourceEditor')).toHaveValue(fixture.changed);
        await message(page, { type: 'toggleSourceMode' });
        expect(await markdown(page)).toBe(fixture.changed);
    });
}
