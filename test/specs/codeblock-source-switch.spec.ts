import { test, expect, Page } from '@playwright/test';

const original = '```javascript\nconst value = 1;\n```\n';
const toggle = (page: Page) => page.evaluate(() => (window as any).__hostMessageHandler({ type: 'toggleSourceMode' }));
const source = (page: Page) => page.locator('#sourceEditor').evaluate((element: HTMLTextAreaElement) => element.value);

async function editCode(page: Page) {
    await page.evaluate(md => (window as any).__testApi.setMarkdown(md), original);
    await page.locator('#editor pre code').click();
    await page.locator('#editor pre code').evaluate(code => {
        const range = document.createRange();
        range.selectNodeContents(code);
        range.collapse(false);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
    });
    await page.keyboard.type(' // updated');
}

test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.goto('/standalone-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.addScriptTag({ url: '/vendor/katex.min.js' });
    await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
});

for (const pending of ['debounce', 'idle callback']) {
    test(`host source switch preserves edits during pending ${pending}`, async ({ page }) => {
        await page.evaluate(() => {
            (window as any).heldIdleCallbacks = [];
            window.requestIdleCallback = callback => (window as any).heldIdleCallbacks.push(callback);
        });
        await editCode(page);
        if (pending === 'idle callback') {
            await page.clock.runFor(1000);
            expect(await page.evaluate(() => (window as any).heldIdleCallbacks.length)).toBeGreaterThan(0);
        }
        await toggle(page);
        expect(await source(page)).toContain('const value = 1; // updated');
        // Edit source immediately, before the previous visual callback can run.
        const latest = '```javascript\nconst newest = 2;\n```\n';
        await page.evaluate(md => {
            const input = document.getElementById('sourceEditor') as HTMLTextAreaElement;
            input.value = md;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            (window as any).heldIdleCallbacks.splice(0).forEach((callback: () => void) => callback());
        }, latest);
        await toggle(page);
        await page.clock.runFor(2000);
        await expect(page.locator('#editor pre code')).toHaveText('const newest = 2;');
        await page.keyboard.press('Control+s');
        expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'save').at(-1).content)).toBe(latest);
    });
}

test('switching modes keeps the latest edit undoable and redoable', async ({ page }) => {
    await editCode(page);
    await toggle(page);
    await toggle(page);
    await page.keyboard.press('Control+z');
    await expect(page.locator('#editor pre code')).toHaveText('const value = 1;');
    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator('#editor pre code')).toHaveText('const value = 1; // updated');
});

test('untouched source switches preserve exact Markdown without sending edits', async ({ page }) => {
    const md = '1. First\n3. Third\n\n\n';
    await page.evaluate(md => (window as any).__testApi.setMarkdown(md), md);
    await toggle(page);
    expect(await source(page)).toBe(md);
    await toggle(page);
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((m: any) => m.type === 'edit'))).toEqual([]);
});

for (const cancel of [false, true]) {
    test(`source switch ${cancel ? 'preserves cancelled' : 'commits active'} inline equation edits`, async ({ page }) => {
        await page.evaluate(() => (window as any).__testApi.setMarkdown('Before $x$ after\n'));
        await page.locator('.math-inline').click();
        await page.locator('.math-inline-input').fill('y^2');
        if (cancel) await page.keyboard.press('Escape');
        await toggle(page);
        expect(await source(page)).toContain(cancel ? '$x$' : '$y^2$');
        await page.clock.runFor(2000);
        expect(await source(page)).toContain(cancel ? '$x$' : '$y^2$');
    });
}
