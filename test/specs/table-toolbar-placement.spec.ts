import { test, expect, Page } from '@playwright/test';

const documentText = '# Table\n\n| Item | State | Owner |\n| --- | --- | --- |\n| One | Ready | A |\n| Two | Draft | B |\n\nAfter table.\n';
const controls = '.table-toolbar:not(.table-toolbar-measure)';
async function setup(page: Page, preference = 'auto', toolbarMode = 'simple') {
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(({ documentText, preference, toolbarMode }) => {
        document.documentElement.dataset.toolbarMode = toolbarMode;
        (window as any).__testApi.setMarkdown(documentText);
        (window as any).__hostMessageHandler({ type: 'tableToolbarPosition', value: preference });
    }, { documentText, preference, toolbarMode });
    await page.locator('#editor td').first().click();
    await expect(page.locator(controls)).toHaveAttribute('data-placement', /.+/);
}

for (const position of ['auto', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right', 'top-bar']) {
    test(`${position}: add row keeps target, selection and undo in agreement`, async ({ page }) => {
        await setup(page, position);
        await expect(page.locator(controls)).toBeVisible();
        await page.locator(controls + ' [data-action="add-row-below"]').click();
        await expect(page.locator('#editor tr')).toHaveCount(4);
        await expect.poll(() => page.evaluate(() => {
            const node = getSelection()?.anchorNode;
            const cell = (node?.nodeType === 3 ? node.parentElement : node as Element)?.closest('td,th');
            return [(cell?.parentElement as HTMLTableRowElement)?.rowIndex, (window as any).activeTableCell?.parentElement.rowIndex];
        })).toEqual([2, 2]);
        await page.locator('#toolbar [data-action="undo"]').click();
        await expect(page.locator('#editor tr')).toHaveCount(3);
        await page.locator('#toolbar [data-action="redo"]').click();
        await expect(page.locator('#editor tr')).toHaveCount(4);
    });
}

test('compact dock exposes column insertion in a narrow editor', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await setup(page, 'top-bar', 'full');
    const toggle = page.locator('.table-toolbar-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator(controls)).toBeVisible();
    await page.locator(controls + ' [data-action="add-col-right"]').click();
    await expect(page.locator('#editor th')).toHaveCount(4);
});

test('source mode and selection outside a table invalidate controls', async ({ page }) => {
    await setup(page, 'top-bar');
    await expect(page.locator(controls)).toBeVisible();
    await page.locator('#toolbar [data-action="source"]').click();
    await expect(page.locator(controls)).not.toBeVisible();
    await expect(page.locator('.table-toolbar-dock')).not.toBeVisible();
    await page.locator('#toolbar [data-action="source"]').click();
    await page.locator('#editor td').first().click();
    await expect(page.locator(controls)).toBeVisible();
    await page.locator('#editor p').last().click();
    await expect(page.locator(controls)).not.toBeVisible();
});

test('live placement updates preserve document, cell selection and clean state', async ({ page }) => {
    await setup(page);
    const before = await page.locator('#editor').innerHTML();
    for (const position of ['left', 'top-bar', 'auto', 'top-left']) {
        await page.evaluate(value => (window as any).__hostMessageHandler({ type: 'tableToolbarPosition', value }), position);
        await expect(page.locator(controls)).toBeVisible();
        await expect(page.locator('#editor')).toHaveJSProperty('innerHTML', before);
    }
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => ['edit', 'save'].includes(message.type)))).toEqual([]);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('a failed placement save reports the failure without moving or editing the table', async ({ page }) => {
    await setup(page, 'top-left');
    const before = await page.locator('#editor').innerHTML();
    await page.evaluate(() => {
        (window as any).hostBridge.setTableToolbarPosition = () => {
            setTimeout(() => (window as any).__hostMessageHandler({ type: 'tableToolbarPositionError' }), 0);
        };
    });
    await page.locator(`${controls} [data-action="placement"]`).click();
    await page.locator('.table-placement-menu [data-position="top-bar"]').click();
    await expect(page.getByRole('status')).toContainText('Could not save the table toolbar position');
    await expect(page.locator('html')).toHaveAttribute('data-table-toolbar-position', 'top-left');
    await expect(page.locator(controls)).toHaveAttribute('data-placement', 'top-left');
    await expect(page.locator('#editor')).toHaveJSProperty('innerHTML', before);
    expect(await page.evaluate(() => document.querySelector('#editor td')?.contains(getSelection()?.anchorNode || null))).toBe(true);
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => ['edit', 'save'].includes(message.type)))).toEqual([]);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('toolbar keyboard navigation and Escape return to the retained table cell', async ({ page }) => {
    await setup(page, 'left');
    await expect(page.locator(controls)).toBeVisible();
    await page.keyboard.press('Alt+F10');
    await expect(page.locator(controls + ' [data-action="add-col-left"]')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator(controls + ' [data-action="add-col-right"]')).toBeFocused();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => !!document.querySelector('#editor td')?.contains(getSelection()?.anchorNode || null))).toBe(true);
});

for (const variant of ['floating', 'docked', 'compact']) {
    test(`${variant}: every table action edits the selected row or column exactly once`, async ({ page }) => {
        if (variant === 'compact') await page.setViewportSize({ width: 600, height: 800 });
        await setup(page, variant === 'floating' ? 'right' : 'top-bar', variant === 'compact' ? 'full' : 'simple');
        for (const action of ['add-col-left', 'add-col-right', 'del-col', 'add-row-above', 'add-row-below', 'del-row', 'align-left', 'align-center', 'align-right']) {
            await page.evaluate(text => (window as any).__testApi.setMarkdown(text), documentText);
            await page.locator('#editor tr').nth(1).locator('td').nth(1).click();
            if (variant === 'compact') await page.locator('.table-toolbar-toggle').click();
            await page.locator(`${controls} [data-action="${action}"]`).click();
            await expect(page.locator('#editor tr')).toHaveCount(action.startsWith('add-row') ? 4 : action === 'del-row' ? 2 : 3);
            await expect(page.locator('#editor th')).toHaveCount(action.startsWith('add-col') ? 4 : action === 'del-col' ? 2 : 3);
            if (action.startsWith('align-')) {
                const alignment = action.slice(6);
                for (const cell of await page.locator('#editor tr > td:nth-child(2)').all()) await expect(cell).toHaveCSS('text-align', alignment);
            }
            expect(await page.evaluate(() => {
                const node = getSelection()?.anchorNode;
                const selected = (node?.nodeType === 3 ? node.parentElement : node as Element)?.closest('td,th');
                return selected === (window as any).activeTableCell;
            })).toBe(true);
            await page.locator('#toolbar [data-action="undo"]').click();
            await expect(page.locator('#editor tr')).toHaveCount(3);
            await expect(page.locator('#editor th')).toHaveCount(3);
            await expect(page.locator('#editor tr').nth(1)).toContainText('OneReadyA');
        }
    });
}

test('chooser has three initial choices, persists a fixed choice, and closes on focus leaving', async ({ page }) => {
    await setup(page, 'top-bar');
    await page.locator(`${controls} [data-action="placement"]`).click();
    const picker = page.locator('.table-placement-menu');
    await expect(picker.locator('button')).toHaveCount(3);
    await picker.locator('[data-position="fixed"]').click();
    await expect(picker.locator('button')).toHaveCount(6);
    await picker.locator('[data-position="bottom-right"]').click();
    await page.mouse.move(1, 1);
    await expect(page.locator('html')).toHaveAttribute('data-table-toolbar-position', 'bottom-right');
    await expect(page.locator(controls)).toHaveAttribute('data-placement', 'bottom-right');
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => message.type === 'setTableToolbarPosition')))
        .toEqual([{ type: 'setTableToolbarPosition', value: 'bottom-right' }]);
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
    await page.locator(`${controls} [data-action="placement"]`).click();
    await page.locator('#toolbar [data-action="source"]').focus();
    await expect(picker).not.toBeVisible();
});

test('header and last-column restrictions do not create undo entries', async ({ page }) => {
    await setup(page, 'top-bar');
    await page.evaluate(() => (window as any).__testApi.setMarkdown('| Only |\n| --- |\n| Value |\n'));
    await page.locator('#editor th').click();
    for (const action of ['add-row-above', 'del-row', 'del-col']) {
        await expect(page.locator(`${controls} [data-action="${action}"]`)).toBeDisabled();
    }
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('Automatic docks around occupied content and returns after space becomes available', async ({ page }) => {
    await setup(page);
    // Deterministic document geometry, retaining the production toolbar and scroll container.
    await page.addStyleTag({ content: '#editor{max-width:none;padding:8px} #editor table{width:100%;margin:0} #editor h1,#editor p{margin:0} #editorWrapper{scrollbar-gutter:stable}' });
    await page.mouse.move(1, 1);
    await expect(page.locator(controls)).toHaveAttribute('data-placement', 'top-bar');
    await page.addStyleTag({ content: '#editor table{width:300px;margin:100px auto}' });
    await expect(page.locator(controls)).not.toHaveAttribute('data-placement', 'top-bar');
    const selected = await page.locator(controls).getAttribute('data-placement');
    await page.setViewportSize({ width: 1250, height: 790 });
    await expect(page.locator(controls)).toHaveAttribute('data-placement', selected!);
    await page.setViewportSize({ width: 480, height: 500 });
    await expect(page.locator(controls)).toHaveAttribute('data-placement', 'top-bar');
    await expect(page.locator('.table-toolbar-toggle')).toBeVisible();
});

test('scrolling offscreen keeps Automatic reachable, while a fixed toolbar hides', async ({ page }) => {
    await setup(page, 'auto');
    await page.evaluate(text => (window as any).__testApi.setMarkdown(text + '\n\n' + Array.from({ length: 50 }, (_, i) => `Paragraph ${i}.`).join('\n\n')), documentText);
    await page.locator('#editor td').first().click();
    await page.mouse.move(1, 1);
    await page.locator('#editorWrapper').evaluate(node => { node.scrollTop = node.scrollHeight; });
    await expect(page.locator(controls)).toHaveAttribute('data-placement', 'top-bar');
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'tableToolbarPosition', value: 'top-left' }));
    await expect(page.locator(controls)).not.toBeVisible();
    await page.locator('#editor td').first().click();
    await expect(page.locator(controls)).toBeVisible();
    await page.evaluate(() => document.querySelector('#editor table')?.remove());
    await expect(page.locator(controls)).not.toBeVisible();
});

for (const width of [420, 900, 1280]) {
    test(`full formatting bar and table controls remain reachable at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await setup(page, 'top-bar', 'full');
        await page.mouse.move(1, 1);
        const source = page.locator('#toolbar [data-action="source"]');
        if (!await source.isVisible()) await page.locator('#toolbarMore').click();
        await expect(source).toBeVisible();
        await page.keyboard.press('Escape');
        const toggle = page.locator('.table-toolbar-toggle');
        if (await toggle.isVisible()) await toggle.click();
        await expect(page.locator(`${controls} [data-action="add-col-right"]`)).toBeVisible();
        await page.locator(`${controls} [data-action="add-col-right"]`).click();
        await expect(page.locator('#editor th')).toHaveCount(4);
    });
}

test('a focused placement menu stays usable when its pane shrinks', async ({ page }) => {
    await setup(page, 'top-bar');
    await page.locator(`${controls} [data-action="placement"]`).click();
    await page.locator('[data-position="fixed"]').click();
    await page.setViewportSize({ width: 430, height: 450 });
    await page.locator('[data-position="right"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-table-toolbar-position', 'right');
});

test('Automatic avoids neighboring content inside a quotation', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => {
        // Exercise nested editor geometry independently of Markdown import support.
        const table = document.querySelector('#editor table')!;
        const quote = document.createElement('blockquote');
        table.before(quote);
        quote.innerHTML = '<p>Before.</p><p>After.</p>';
        quote.firstElementChild!.after(table);
    });
    await page.addStyleTag({ content: '#editor{max-width:none;padding:8px} #editor blockquote{margin:0;padding:0;border:0} #editor table{width:100%;margin:0} #editor p{margin:0}' });
    await page.locator('#editor td').first().click();
    await page.mouse.move(1, 1);
    await expect(page.locator(controls)).toHaveAttribute('data-placement', 'top-bar');
});

test('switching tables updates the action target before the next click', async ({ page }) => {
    await setup(page, 'top-bar');
    await page.evaluate(text => (window as any).__testApi.setMarkdown(text + '\n' + text.replace('# Table', '# Second')), documentText);
    await page.locator('#editor table').nth(0).locator('td').first().click();
    await page.locator('#editor table').nth(1).locator('td').first().click();
    await page.locator(`${controls} [data-action="add-row-below"]`).click();
    await expect(page.locator('#editor table').nth(0).locator('tr')).toHaveCount(3);
    await expect(page.locator('#editor table').nth(1).locator('tr')).toHaveCount(4);
});

test('placement and resizing preserve an uncommitted inline equation input', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => (window as any).__testApi.setMarkdown('| Formula |\n| --- |\n| $a^2$ |\n'));
    await page.locator('#editor .math-inline').click();
    const input = page.locator('.math-inline-input');
    await input.fill('b^3');
    const before = await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => message.type === 'edit').length);
    for (const value of ['left', 'top-bar', 'auto']) {
        await page.evaluate(value => (window as any).__hostMessageHandler({ type: 'tableToolbarPosition', value }), value);
        await page.setViewportSize({ width: value === 'left' ? 850 : 1000, height: 750 });
        await expect(input).toBeFocused();
        await expect(input).toHaveValue('b^3');
    }
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => message.type === 'edit').length)).toBe(before);
});
