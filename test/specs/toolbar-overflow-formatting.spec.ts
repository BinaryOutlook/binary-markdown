import { test, expect, Page } from '@playwright/test';

const contexts = [
    { name: 'paragraph', source: 'target paragraph.\n', selector: '#editor > p:first-child' },
    { name: 'bullet', source: '- target item\n', selector: '#editor li' },
    { name: 'table header', source: '| target header |\n| --- |\n| Cell text |\n', selector: '#editor th' },
    { name: 'table cell', source: '| Header |\n| --- |\n| target cell |\n', selector: '#editor td' },
];

async function setup(page: Page, source: string) {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.locator('#closeSidebar').click();
    await page.evaluate(source => (window as any).__testApi.setMarkdown(source), source);
}

async function selectWordWithMouse(page: Page, selector: string) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    const point = await page.locator(selector).evaluate(element => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node && !node.textContent?.includes('target')) node = walker.nextNode();
        if (!node) throw new Error('Missing target word');
        const start = node.textContent!.indexOf('target');
        // Read text geometry only; selection and focus come from real mouse events.
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + 'target'.length);
        const rect = range.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    await page.mouse.dblclick(point.x, point.y);
    expect(await page.evaluate(() => getSelection()!.toString())).toBe('target');
}

async function markdown(page: Page) {
    return page.evaluate(() => (window as any).htmlToMarkdown());
}

async function clickToolbarAction(page: Page, action: string) {
    const button = page.locator(`#toolbar [data-action="${action}"]`);
    if (!await button.isVisible()) await page.locator('#toolbarMore').click();
    await button.click();
}

async function checkPreservation(page: Page, before: string, selector: string, tag: string) {
    const after = await markdown(page);
    expect(after).not.toBe(before);
    await expect(page.locator(`${selector} ${tag}`)).toHaveText('target');
    expect(await page.evaluate(() => getSelection()!.toString())).toBe('target');
    await page.keyboard.press('Control+z');
    expect(await markdown(page)).toBe(before);
    await page.keyboard.press('Control+Shift+z');
    expect(await markdown(page)).toBe(after);
    await page.keyboard.press('Control+s');
    await expect.poll(() => page.evaluate(() => (window as any).__testApi.messages.findLast((message: any) => message.type === 'save')?.content)).toBe(after);
    await clickToolbarAction(page, 'source');
    await expect(page.locator('#sourceEditor')).toHaveValue(after);
    await clickToolbarAction(page, 'source');
    await page.evaluate(saved => (window as any).__testApi.setMarkdown(saved), after);
    expect(await markdown(page)).toBe(after);
    await expect(page.locator(`${selector} ${tag}`)).toHaveText('target');
}

for (const context of contexts) {
    for (const [action, tag] of [['underline', 'u'], ['bold', ':is(strong,b)']]) {
        // Header text is already bold through table styling; underline exercises
        // the header context without conflating visual and semantic boldness.
        if (context.name === 'table header' && action === 'bold') continue;
        test(`mouse ${action} from overflow preserves ${context.name} selection and save/undo`, async ({ page }) => {
            await setup(page, context.source);
            await selectWordWithMouse(page, context.selector);
            const before = await markdown(page);
            const button = page.locator(`#toolbarOverflow [data-action="${action}"]`);
            await expect(button).toHaveCount(1);
            await expect(button).toBeHidden();
            await page.locator('#toolbarMore').click();
            await expect(button).toBeVisible();
            // Opening the menu focuses its first entry. If that is the action
            // under test, move once so this also exercises switching from a
            // keyboard-focused menu item to a different item with the mouse.
            if (await button.evaluate(element => element === document.activeElement)) await page.keyboard.press('ArrowDown');
            await button.click();
            await checkPreservation(page, before, context.selector, tag);
        });
    }
}

for (const context of contexts.filter(context => context.name !== 'paragraph')) {
    for (const modifier of ['Meta', 'Control']) {
        test(`${modifier}+U underlines a mouse-selected word in a ${context.name}`, async ({ page }) => {
            await setup(page, context.source);
            await selectWordWithMouse(page, context.selector);
            const before = await markdown(page);
            await page.keyboard.press(`${modifier}+u`);
            await checkPreservation(page, before, context.selector, 'u');
        });
    }
}

for (const context of contexts.filter(context => ['bullet', 'table cell'].includes(context.name))) {
    test(`keyboard overflow navigation and activation preserve ${context.name} selection`, async ({ page }) => {
        await setup(page, context.source);
        await selectWordWithMouse(page, context.selector);
        const before = await markdown(page);
        const trigger = page.locator('#toolbarMore');
        await trigger.focus();
        await page.keyboard.press('ArrowDown');
        const index = await page.locator('#toolbarOverflow').evaluate(menu =>
            [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].findIndex(button => button.dataset.action === 'underline'));
        expect(index).toBeGreaterThanOrEqual(0);
        for (let step = 0; step < index; step++) await page.keyboard.press('ArrowDown');
        await expect(page.locator('#toolbarOverflow [data-action="underline"]')).toBeFocused();
        await page.keyboard.press('Enter');
        await checkPreservation(page, before, context.selector, 'u');
    });
}
