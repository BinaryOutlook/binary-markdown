import { test, expect, Page } from '@playwright/test';

const source = '# Heading\n\nBefore target after.\n\nEnd paragraph.\n';

async function setup(page: Page, content = source) {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.addScriptTag({ url: '/vendor/katex.min.js' });
    await page.evaluate(content => (window as any).__testApi.setMarkdown(content), content);
}

async function select(page: Page, selector = '#editor > p', text = 'target') {
    await page.evaluate(({ selector, text }) => {
        const element = [...document.querySelectorAll(selector)].find(item => item.textContent!.includes(text))!;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode()!;
        while (node && !node.textContent!.includes(text)) node = walker.nextNode()!;
        if (!node) throw new Error('Selection target was not rendered');
        const at = node.textContent!.indexOf(text);
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + text.length);
        document.getElementById('editor')!.focus();
        getSelection()!.removeAllRanges();
        getSelection()!.addRange(range);
    }, { selector, text });
}

async function open(page: Page) {
    if (!(await page.locator('#insertButton').isVisible())) await page.locator('#toolbarMore').click();
    await page.locator('#insertButton').click();
    await expect(page.locator('#insertMenu')).toBeVisible();
}

for (const mode of ['full', 'simple']) {
    test(`${mode} Insert exposes eight items and cancels without editing`, async ({ page }) => {
        await setup(page);
        await page.evaluate(mode => (window as any).__hostMessageHandler({ type: 'toolbarMode', value: mode }), mode);
        await select(page);
        await open(page);
        await expect(page.locator('#insertMenu [role="menuitem"]')).toHaveCount(8);
        await expect(page.locator('#insertMenu [aria-disabled="true"]')).toHaveCount(0);
        await expect(page.locator('[data-insert-action="inlineMath"]')).toBeFocused();
        await page.keyboard.press('End');
        await expect(page.locator('[data-insert-action="toc"]')).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect(page.locator('[data-insert-action="inlineMath"]')).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(page.locator('#insertMenu')).toBeHidden();
        await expect(page.locator('#insertButton')).toBeFocused();
        expect(await page.evaluate(() => getSelection()!.toString())).toBe('target');
        await expect(page.locator('[data-action="undo"]')).toBeDisabled();
        await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'captureExportSnapshot', requestId: 'insert-view-only' }));
        expect(await page.evaluate(() => (window as any).__testApi.messages.find((m: any) => m.requestId === 'insert-view-only')))
            .toMatchObject({ content: source, pending: false });
    });
}

for (const [action, selector] of [
    ['inlineMath', '.math-inline'], ['math', '.math-wrapper'], ['codeblock', '#editor pre'],
    ['table', '#editor table'], ['mermaid', '.mermaid-wrapper'], ['toc', '.toc-block'],
]) {
    test(`${action} uses the retained location and undoes once`, async ({ page }) => {
        await setup(page);
        await select(page);
        const before = await page.evaluate(() => (window as any).htmlToMarkdown());
        await open(page);
        await page.locator(`[data-insert-action="${action}"]`).click();
        await expect(page.locator('#insertMenu')).toBeHidden();
        await expect(page.locator(selector)).toHaveCount(1);
        const after = await page.evaluate(() => (window as any).htmlToMarkdown());
        expect(after).not.toBe(before);
        await page.locator('[data-action="undo"]').click();
        expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
        await page.locator('[data-action="redo"]').click();
        expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(after);
    });
}

for (const [content, selector] of [
    ['- List target.\n', '#editor li'],
    ['| Name |\n| --- |\n| Cell target. |\n', '#editor td'],
]) {
    test(`block items explain unsupported ${selector} contexts without changing content`, async ({ page }) => {
        await setup(page, content);
        await select(page, selector);
        const before = await page.evaluate(() => (window as any).htmlToMarkdown());
        await open(page);
        for (const action of ['math', 'table', 'codeblock', 'mermaid', 'toc']) {
            await expect(page.locator(`[data-insert-action="${action}"]`)).toHaveAttribute('aria-disabled', 'true');
            await expect(page.locator(`[data-insert-action="${action}"] small`)).toHaveText(/outside lists, tables/);
        }
        await page.locator('[data-insert-action="table"]').focus();
        await page.keyboard.press('Enter');
        expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
        await expect(page.locator('[data-action="undo"]')).toBeDisabled();
        for (const action of ['inlineMath', 'link', 'image']) {
            await expect(page.locator(`[data-insert-action="${action}"]`)).toHaveAttribute('aria-disabled', 'false');
        }
    });
}

test('Source mode explains why insertion is unavailable', async ({ page }) => {
    await setup(page);
    await page.locator('[data-action="source"]').click();
    await open(page);
    await expect(page.locator('#insertMenu [aria-disabled="true"]')).toHaveCount(8);
    await expect(page.locator('#insertMenu small').first()).toHaveText(/visual editor/);
    await page.keyboard.press('Escape');
    expect(await page.locator('#sourceEditor').inputValue()).toBe(source);
});

test('Insert remains reachable in a narrow pane and its menu stays on screen', async ({ page }) => {
    await setup(page);
    await select(page);
    await page.setViewportSize({ width: 300, height: 480 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await open(page);
    const bounds = await page.locator('#insertMenu').boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(300);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(480);
    await page.keyboard.press('End');
    await expect(page.locator('[data-insert-action="toc"]')).toBeFocused();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => getSelection()!.toString())).toBe('target');
});

for (const action of ['link', 'image']) {
    for (const route of ['menu', 'toolbar']) {
        test(`${route} ${action} cancellation restores selection without an edit or undo entry`, async ({ page }) => {
            await setup(page);
            await select(page);
            if (route === 'menu') { await open(page); await page.locator(`[data-insert-action="${action}"]`).click(); }
            else await page.locator(`#toolbar [data-action="${action}"]`).click();
            const request = await page.evaluate(action => (window as any).__testApi.messages.findLast((m: any) => m.type === (action === 'link' ? 'insertLink' : 'insertImage')), action);
            expect(request.requestId).toMatch(/^insert-/);
            // Moving focus while the host dialog is open must not lose the bookmark.
            await page.locator('#insertButton').focus();
            await page.evaluate(requestId => (window as any).__hostMessageHandler({ type: 'insertCancelled', requestId }), request.requestId);
            expect(await page.evaluate(() => getSelection()!.toString())).toBe('target');
            await expect(page.locator('[data-action="undo"]')).toBeDisabled();
            await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'captureExportSnapshot', requestId: 'cancelled-insert' }));
            expect(await page.evaluate(() => (window as any).__testApi.messages.find((m: any) => m.requestId === 'cancelled-insert')))
                .toMatchObject({ content: source, pending: false });
        });
    }

    test(`${action} confirmation inserts at the bookmark and undoes in one step`, async ({ page }) => {
        await setup(page);
        await select(page);
        const before = await page.evaluate(() => (window as any).htmlToMarkdown());
        await open(page); await page.locator(`[data-insert-action="${action}"]`).click();
        const requestId = await page.evaluate(action => (window as any).__testApi.messages.findLast((m: any) => m.type === (action === 'link' ? 'insertLink' : 'insertImage')).requestId, action);
        // A later caret move must not redirect the asynchronous insertion.
        await select(page, '#editor > p', 'End');
        const response = action === 'link'
            ? { type: 'insertLinkHtml', url: 'https://example.com/reference', text: 'target', requestId }
            : { type: 'insertImageHtml', markdownPath: 'images/example.png', displayUri: '/missing-fixture.png', requestId };
        await page.evaluate(response => (window as any).__hostMessageHandler(response), response);
        const result = page.locator(action === 'link' ? '#editor a' : '#editor img');
        await expect(result).toHaveCount(1);
        await expect(result.locator('..')).toContainText('Before');
        const after = await page.evaluate(() => (window as any).htmlToMarkdown());
        expect(after).toContain('End paragraph.');
        // Repeated responses cannot create a second insertion.
        await page.evaluate(response => (window as any).__hostMessageHandler(response), response);
        await expect(result).toHaveCount(1);
        await page.locator('[data-action="undo"]').click();
        expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
        await page.locator('[data-action="redo"]').click();
        expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(after);
    });
}

test('a replaced document rejects the old dialog response', async ({ page }) => {
    await setup(page);
    await select(page);
    await open(page); await page.locator('[data-insert-action="link"]').click();
    const requestId = await page.evaluate(() => (window as any).__testApi.messages.findLast((m: any) => m.type === 'insertLink').requestId);
    const replacement = 'Replacement document.\n';
    await page.evaluate(content => (window as any).__testApi.setMarkdown(content), replacement);
    await page.evaluate(requestId => (window as any).__hostMessageHandler({ type: 'insertLinkHtml', url: 'https://example.com/', text: 'old selection', requestId }), requestId);
    await expect(page.locator('#editor a')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__testApi.getMarkdown())).toBe(replacement);
});

for (const action of ['codeblock', 'table', 'math', 'mermaid']) {
    test(`${action} supports undo and redo before the next animation frame`, async ({ page }) => {
        await setup(page); await select(page);
        const states = await page.evaluate(action => {
            const click = (selector: string) => (document.querySelector(selector) as HTMLButtonElement).click();
            const before = (window as any).htmlToMarkdown();
            click('#insertButton'); click(`[data-insert-action="${action}"]`);
            const inserted = (window as any).htmlToMarkdown();
            click('[data-action="undo"]');
            const undone = (window as any).htmlToMarkdown();
            click('[data-action="redo"]');
            return { before, inserted, undone, redone: (window as any).htmlToMarkdown() };
        }, action);
        expect(states.inserted).not.toBe(states.before);
        expect(states.undone).toBe(states.before);
        expect(states.redone).toBe(states.inserted);
    });
}

for (const context of ['empty', 'caret']) {
    for (const [action, selector] of [
        ['inlineMath', '.math-inline'], ['math', '.math-wrapper'], ['codeblock', '#editor pre'],
        ['table', '#editor table'], ['mermaid', '.mermaid-wrapper'], ['toc', '.toc-block'],
        ['link', '#editor a'], ['image', '#editor img'],
    ]) {
        test(`${action} survives source/save/reopen from an ${context} context`, async ({ page }) => {
            await setup(page, context === 'empty' ? '' : source);
            if (context === 'caret') { await select(page); await page.evaluate(() => getSelection()!.collapseToStart()); }
            else await page.evaluate(() => {
                const editor = document.getElementById('editor')!;
                editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false);
                getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
            });
            await open(page); await page.locator(`[data-insert-action="${action}"]`).click();
            if (action === 'link' || action === 'image') await page.evaluate(action => {
                const requestId = (window as any).__testApi.messages.findLast((m: any) => m.type === (action === 'link' ? 'insertLink' : 'insertImage')).requestId;
                (window as any).__hostMessageHandler(action === 'link'
                    ? { type: 'insertLinkHtml', url: 'https://example.com/reference', text: 'Reference', requestId }
                    : { type: 'insertImageHtml', markdownPath: 'images/example.png', displayUri: '/missing-fixture.png', requestId });
            }, action);
            await expect(page.locator(selector)).toHaveCount(1);
            await page.locator('[data-action="source"]').click();
            const saved = await page.locator('#sourceEditor').inputValue();
            expect(saved.trim()).not.toBe('');
            await page.keyboard.press('Control+s');
            await expect.poll(() => page.evaluate(() => (window as any).__testApi.messages.findLast((m: any) => m.type === 'save')?.content)).toBe(saved);
            await page.locator('[data-action="source"]').click();
            await page.evaluate(content => (window as any).__testApi.setMarkdown(content), saved);
            await expect(page.locator(selector)).toHaveCount(1);
            if (context === 'caret') {
                expect(saved).toContain('Before');
                expect(saved).toContain('target after.');
                expect(saved).toContain('End paragraph.');
            }
        });
    }
}

for (const action of ['inlineMath', 'link', 'image']) {
    for (const [content, selector] of [
        ['- List target.\n', '#editor li'],
        ['| Name |\n| --- |\n| Cell target. |\n', '#editor td'],
    ]) {
        test(`${action} inserts within ${selector} and preserves the container through undo`, async ({ page }) => {
            await setup(page, content); await select(page, selector);
            const before = await page.evaluate(() => (window as any).htmlToMarkdown());
            await open(page); await page.locator(`[data-insert-action="${action}"]`).click();
            if (action !== 'inlineMath') await page.evaluate(action => {
                const requestId = (window as any).__testApi.messages.findLast((m: any) => m.type === (action === 'link' ? 'insertLink' : 'insertImage')).requestId;
                (window as any).__hostMessageHandler(action === 'link'
                    ? { type: 'insertLinkHtml', url: 'https://example.com/reference', text: 'target', requestId }
                    : { type: 'insertImageHtml', markdownPath: 'images/example.png', displayUri: '/missing-fixture.png', requestId });
            }, action);
            await expect(page.locator(selector + ' ' + ({ inlineMath: '.math-inline', link: 'a', image: 'img' } as Record<string, string>)[action])).toHaveCount(1);
            await page.locator('[data-action="undo"]').click();
            expect(await page.evaluate(() => (window as any).htmlToMarkdown())).toBe(before);
        });
    }
}

test('a dialog opened in an empty editor cannot insert into a replacement document', async ({ page }) => {
    await setup(page, '');
    await page.locator('#editor').click();
    await open(page); await page.locator('[data-insert-action="link"]').click();
    const requestId = await page.evaluate(() => (window as any).__testApi.messages.findLast((m: any) => m.type === 'insertLink').requestId);
    await page.evaluate(() => (window as any).__testApi.setMarkdown('Replacement document.\n'));
    await page.evaluate(requestId => (window as any).__hostMessageHandler({ type: 'insertLinkHtml', url: 'https://example.com/', text: 'Old link', requestId }), requestId);
    await expect(page.locator('#editor a')).toHaveCount(0);
});
