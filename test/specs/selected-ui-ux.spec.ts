import { openInsertWorkspace, openActionPalette } from '../utils/command-menu';
import { test, expect, Page } from '@playwright/test';

const authored = '---\ntitle: "Review" # retained\n---\n\n# One\n\nBefore **target** after.\n\n## Two\n\nOther text.\n';
async function setup(page: Page, content = authored) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/production-editor.html');
    await page.waitForFunction(() => (window as any).__testApi?.ready);
    await page.evaluate(content => (window as any).__testApi.setMarkdown(content), content);
}
async function snapshot(page: Page) {
    return page.evaluate(() => {
        (window as any).__hostMessageHandler({ type: 'captureExportSnapshot', requestId: 'ux-check' });
        return (window as any).__testApi.messages.filter((m: any) => m.requestId === 'ux-check').at(-1);
    });
}

test('views, outline tabs and contextual toggle preserve authored source and clean state', async ({ page }) => {
    await setup(page);
    await page.locator('#documentTab').click();
    await expect(page.locator('#documentInfo')).toBeVisible();
    await page.locator('#outlineTab').click();
    const toggle = page.locator('#contextToolbarToggle');
    const indicator = toggle.locator('span[aria-hidden="true"]');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(indicator).toHaveText('<<');
    await expect(page.locator('#toolbarInner')).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(indicator).toHaveText('>>');
    await expect(page.locator('#toolbarInner')).toBeHidden();
    for (const mode of ['source', 'split', 'visual']) await page.locator(`button[data-editor-mode="${mode}"]`).click();
    await expect(indicator).toHaveText('>>');
    await toggle.focus();
    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(indicator).toHaveText('<<');
    await expect(page.locator('#toolbarInner')).toBeVisible();
    expect(await snapshot(page)).toMatchObject({ content: authored, pending: false });
    await expect(page.locator('[data-action="undo"]')).toBeDisabled();
});

test('permanent command search is keyboard reachable and preserves selection in contextual and narrow toolbars', async ({ page }) => {
    await setup(page);
    await page.locator('#contextToolbarToggle').click();
    await page.locator('#editor strong').evaluate(node => {
        const range = document.createRange(); range.selectNodeContents(node);
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    });
    const actions = page.locator('#toolbarMore');
    for (const width of [1440, 320]) {
        await page.setViewportSize({ width, height: 600 });
        await actions.focus(); await actions.press('Enter');
        await expect(page.locator('#toolbarCommandSearch')).toBeFocused();
        await expect(actions).toHaveAttribute('aria-expanded', 'true');
        await page.locator('#toolbarCommandSearch').press('Escape');
        await expect(actions).toHaveAttribute('aria-expanded', 'false');
        expect(await page.evaluate(() => getSelection()?.toString())).toBe('target');
    }
    expect(await snapshot(page)).toMatchObject({ content: authored, pending: false });
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('closing All actions before its deferred listener runs does not close the next opening', async ({ page }) => {
    await setup(page);
    await page.locator('#contextToolbarToggle').click();
    await page.locator('#editor strong').evaluate(node => {
        const range = document.createRange(); range.selectNodeContents(node);
        getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    });
    const actions = page.locator('.context-format-toolbar button[aria-label="All actions"]');
    const dialog = page.getByRole('dialog', { name: 'All actions', exact: true });
    const clockStart = new Date('2026-01-01T00:00:00Z');
    await page.clock.install({ time: clockStart });
    await page.clock.pauseAt(new Date(clockStart.getTime() + 1000));
    // Keep the deferred outside-click registration pending until after Escape.
    await actions.dispatchEvent('click');
    await expect(dialog).toBeVisible();
    await page.locator('.command-palette-input').dispatchEvent('keydown', { key: 'Escape' });
    await expect(dialog).toBeHidden();
    await page.clock.runFor(1);
    await page.clock.resume();

    await page.setViewportSize({ width: 320, height: 600 });
    // Drain the resize event before opening a palette that deliberately closes on resize.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await actions.dispatchEvent('click');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#toolbarOverflow')).toBeHidden();
    await page.clock.runFor(1);
    await page.locator('#editor').dispatchEvent('click');
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => getSelection()?.toString())).toBe('target');
    expect(await snapshot(page)).toMatchObject({ content: authored, pending: false });
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('Split source edits share Undo with Visual and the preview is read only', async ({ page }) => {
    await setup(page);
    await page.locator('button[data-editor-mode="split"]').click();
    await expect(page.locator('#sourceEditor')).toHaveValue(authored);
    await expect(page.locator('#editor')).toHaveAttribute('contenteditable', 'false');
    await expect(page.locator('#sourcePaneHeading')).toHaveText('Source (Markdown)');
    await expect(page.locator('#previewPaneHeading')).toHaveText('Preview (Read only)');
    await expect(page.locator('#editor [contenteditable="true"]')).toHaveCount(0);
    await page.locator('#sourceEditor').press('ControlOrMeta+a');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.insertText('Added.');
    await expect(page.locator('#editor')).toContainText('Added.');
    await page.locator('#sourceEditor').press('ControlOrMeta+z');
    await expect(page.locator('#sourceEditor')).toHaveValue(authored);
    await page.locator('#sourceEditor').press('ControlOrMeta+Shift+z');
    await expect(page.locator('#sourceEditor')).toHaveValue(authored + 'Added.');
    await page.locator('button[data-editor-mode="visual"]').click();
    await page.locator('[data-action="undo"]').click();
    expect((await snapshot(page)).content).toBe(authored);
});

test('Split hides code editing chrome while retaining a read-only preview and the source history', async ({ page }) => {
    const content = '# Review\n\n```javascript\nconst count = 24;\n```\n';
    await setup(page, content);
    await expect(page.locator('.code-delete-btn')).toBeVisible();
    await page.locator('button[data-editor-mode="split"]').click();
    await expect(page.locator('.code-block-header')).toBeHidden();
    await expect(page.locator('#editor pre code')).toContainText('const count = 24;');
    await expect(page.locator('.code-delete-btn')).toBeDisabled();
    await page.locator('#sourceEditor').press('ControlOrMeta+a');
    await page.keyboard.insertText(content.replace('24', '25'));
    await expect(page.locator('#editor pre code')).toContainText('const count = 25;');
    await expect(page.locator('.code-block-header')).toBeHidden();
    await page.locator('#sourceEditor').press('ControlOrMeta+z');
    await expect(page.locator('#sourceEditor')).toHaveValue(content);
    await page.locator('button[data-editor-mode="visual"]').click();
    await expect(page.locator('.code-block-header')).toBeVisible();
    await expect(page.locator('.code-delete-btn')).toBeEnabled();
    expect((await snapshot(page)).content).toBe(content);
});

test('a narrow pane conceals the rail without changing its stored state and can open an overlay', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#sidebar')).toBeVisible();
    const before = await page.evaluate(() => ({
        hidden: document.getElementById('sidebar')!.classList.contains('hidden'),
        reports: (window as any).__testApi.messages.filter((m: any) => m.type === 'outlineStateChanged').length,
    }));
    await page.setViewportSize({ width: 600, height: 800 });
    await expect(page.locator('#sidebar')).toBeHidden();
    expect(await page.evaluate(() => ({
        hidden: document.getElementById('sidebar')!.classList.contains('hidden'),
        reports: (window as any).__testApi.messages.filter((m: any) => m.type === 'outlineStateChanged').length,
    }))).toEqual(before);
    await page.getByRole('button', { name: 'Open Outline', exact: true }).click();
    await expect(page.locator('#sidebar')).toBeVisible();
    await expect(page.locator('#sidebar')).toHaveAttribute('data-overlay-open', 'true');
    await page.locator('#closeSidebar').click();
    await expect(page.locator('#sidebar')).toBeHidden();
    expect(await snapshot(page)).toMatchObject({ content: authored, pending: false });
    await expect(page.locator('[data-action="undo"]')).toBeDisabled();
});

test('Outline navigates to the corresponding source heading in Split', async ({ page }) => {
    await setup(page);
    await page.locator('button[data-editor-mode="split"]').click();
    await page.locator('#outline button').filter({ hasText: 'Two' }).click();
    expect(await page.locator('#sourceEditor').evaluate((node: HTMLTextAreaElement) => node.selectionStart)).toBe(authored.indexOf('## Two'));
    await expect(page.locator('#editor h2')).toHaveClass(/source-correspondence/);
    expect((await snapshot(page)).pending).toBe(false);
});

test('Split marks the corresponding source heading without moving its caret or changing source', async ({ page }) => {
    const content = '# One\n\nBefore target after.\n\n## Two\n\nOther text.\n';
    await setup(page, content);
    await page.locator('button[data-editor-mode="split"]').click();
    const source = page.locator('#sourceEditor');
    const offset = content.indexOf('Other text');
    await source.evaluate((node: HTMLTextAreaElement, at) => { node.setSelectionRange(at, at); node.dispatchEvent(new Event('select')); }, offset);
    await expect(page.locator('.source-heading-cue')).toBeVisible();
    await expect(page.locator('#editor h2')).toHaveClass(/source-correspondence/);
    expect(await source.evaluate((node: HTMLTextAreaElement) => [node.selectionStart, node.selectionEnd])).toEqual([offset, offset]);
    const before = await page.locator('.source-heading-cue').boundingBox();
    await page.setViewportSize({ width: 480, height: 800 });
    await expect.poll(async () => Math.abs((await page.locator('.source-heading-cue').boundingBox())!.x - (await source.boundingBox())!.x)).toBeLessThan(1);
    await expect(page.locator('.source-heading-cue')).toBeVisible();
    const cue = await page.locator('.source-heading-cue').boundingBox(), pane = await source.boundingBox();
    expect(cue!.x).toBeGreaterThanOrEqual(pane!.x);
    expect(cue!.y).toBeGreaterThan(pane!.y);
    expect(cue!.y + cue!.height).toBeLessThanOrEqual(pane!.y + pane!.height);
    expect(cue!.x).not.toBe(before!.x);
    await page.locator('button[data-editor-mode="visual"]').click();
    await expect(page.locator('.source-heading-cue')).toBeHidden();
    expect(await snapshot(page)).toMatchObject({ content, pending: false });
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('long equations expose source and preview scrolling without editing or overriding wrap preferences', async ({ page }) => {
    const tex = Array(18).fill('\\frac{a+b}{c}').join(' + ');
    const content = '# Equation\n\n$$\n' + tex + '\n$$\n\nContinue here.\n';
    await setup(page, content);
    await page.locator('.math-display').click();
    for (const part of ['source', 'preview']) {
        const controls = page.locator('.block-preview-scroll[data-scroll-part="' + part + '"]');
        await expect(controls).toBeVisible();
        await expect(controls.locator('button').first()).toBeDisabled();
        await controls.locator('button').last().click();
        const target = page.locator(part === 'source' ? '.math-wrapper pre[data-lang="math"]' : '.math-display');
        await expect.poll(() => target.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
        await controls.locator('button').first().click();
        await expect.poll(() => target.evaluate(node => node.scrollLeft)).toBe(0);
    }
    await page.evaluate(() => (window as any).__hostMessageHandler({ type: 'mathSourceWrap', value: true }));
    await page.setViewportSize({ width: 480, height: 800 });
    await expect(page.locator('.block-preview-scroll[data-scroll-part="source"]')).toBeHidden();
    await expect(page.locator('.block-preview-scroll[data-scroll-part="preview"]')).toBeVisible();
    expect(await snapshot(page)).toMatchObject({ content, pending: false });
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('Mermaid shows a concise parser diagnostic before details and keeps it out of authored source', async ({ page }) => {
    const content = '# Process\n\n```mermaid\ngraph LR\n A[Draft -->\n B[Review]\n```\n';
    await setup(page, content);
    await page.locator('[data-block-mode="edit"]').click();
    await expect(page.locator('.block-error-summary')).toContainText('Expected a closing delimiter');
    await expect(page.locator('.block-error-summary')).not.toContainText('on line');
    await expect(page.locator('.block-diagnostic-text')).not.toContainText('on line');
    await expect(page.locator('.mermaid-wrapper')).toHaveAttribute('data-render-error', /Parse error on line/);
    await expect(page.locator('.block-diagnostic')).not.toHaveAttribute('open');
    await expect(page.locator('.block-error-line')).toBeVisible();
    expect(await snapshot(page)).toMatchObject({ content, pending: false });
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('expanded diagnostics expose the parser explanation and support keyboard scrolling without edits', async ({ page }) => {
    const content = '# Process\n\n```mermaid\ngraph LR\n A[Draft -->\n B[Review]\n```\n';
    await setup(page, content);
    await page.locator('[data-block-mode="edit"]').click();
    await page.locator('.block-diagnostic summary').click();
    const detail = page.getByRole('region', { name: 'Diagnostic details', exact: true });
    await expect(detail).toContainText('Expecting');
    expect(await detail.evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true);
    expect((await detail.boundingBox())!.height).toBeLessThan(300);
    await page.locator('.mermaid-wrapper').evaluate((node: HTMLElement) => {
        node.dataset.renderError += '\nAdditional parser context remains available for keyboard reading.'.repeat(30);
    });
    await page.setViewportSize({ width: 480, height: 800 });
    await expect.poll(() => detail.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
    await detail.focus();
    const documentScroll = await page.locator('#editorWrapper').evaluate(node => node.scrollTop);
    const editingNotifications = await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => message.type === 'editingStateChanged' && message.editing).length);
    for (let cycle = 0; cycle < 3; cycle++) {
        await detail.press('End');
        await expect.poll(() => detail.evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop)).toBe(0);
        await detail.press('Home');
        await expect.poll(() => detail.evaluate(node => node.scrollTop)).toBe(0);
        await expect(detail).toBeFocused();
    }
    expect(await page.locator('#editorWrapper').evaluate(node => node.scrollTop)).toBe(documentScroll);
    expect(await page.evaluate(() => (window as any).__testApi.messages.filter((message: any) => message.type === 'editingStateChanged' && message.editing).length)).toBe(editingNotifications);
    expect(await snapshot(page)).toMatchObject({ content, pending: false });
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('Mermaid math labels use the patched renderer and preserve authored source', async ({ page }) => {
    const content = '```mermaid\nflowchart LR\n A["$$x^2 + 1$$"] --> B[Done]\n```\n';
    await setup(page, content);
    await expect(page.locator('.mermaid-diagram svg .katex')).toBeVisible();
    await expect(page.locator('.mermaid-wrapper')).toHaveAttribute('data-render-error', '');
    await expect(page.locator('.mermaid-diagram svg .katex-error')).toHaveCount(0);
    expect(await snapshot(page)).toMatchObject({ content, pending: false });
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('Outline uses one thin active marker and retains the configured accent', async ({ page }) => {
    const content = '# One\n\nBefore target after.\n';
    await setup(page, content);
    await page.evaluate(() => {
        (window as any).__testApi.updateOutline();
        document.documentElement.style.setProperty('--outline-active-color', '#087f5b');
    });
    const item = page.locator('#outline .is-active');
    await expect(item).toHaveCount(1);
    expect(await item.evaluate(node => ({ border: getComputedStyle(node).borderLeftWidth, shadow: getComputedStyle(node).boxShadow })))
        .toEqual({ border: '0px', shadow: 'rgb(8, 127, 91) 2px 0px 0px 0px inset' });
    expect(await snapshot(page)).toMatchObject({ content, pending: false });
});

test('source mode disables visual formatting and retains explicit mode labels', async ({ page }) => {
    await setup(page);
    await page.locator('button[data-editor-mode="source"]').click();
    await expect(page.locator('#formatButton')).toHaveCount(0);
    await page.locator('#toolbarMore').click();
    await page.locator('#toolbarCommandSearch').fill('bold');
    await expect(page.locator('[data-menu-command="bold"]')).toBeDisabled();
    await expect(page.locator('[data-action="bold"]')).toBeDisabled();
    await expect(page.locator('button[data-editor-mode="source"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#editor')).toBeHidden();
});

test('Find presents source contexts, selected replacement has one Undo and never renders input as HTML', async ({ page }) => {
    const content = '# Review\n\nalpha **alpha** alpha\n\n<img src=x onerror=alert(1)>\n';
    await setup(page, content);
    await page.locator('#editor').click();
    await page.keyboard.press('ControlOrMeta+h');
    await page.locator('#searchInput').fill('alpha');
    await expect(page.locator('.search-result')).toHaveCount(3);
    await page.locator('#replaceInput').fill('beta');
    await page.locator('.search-result input').nth(1).check();
    await page.locator('#replaceSelected').click();
    await expect(page.locator('.search-result')).toHaveCount(2);
    expect((await snapshot(page)).content).toBe(content.replace('**alpha**', '**beta**'));
    await page.locator('#closeSearch').click();
    await page.locator('[data-action="undo"]').click();
    expect((await snapshot(page)).content).toBe(content);
    await page.keyboard.press('ControlOrMeta+f');
    await page.locator('#searchInput').fill('<img');
    await expect(page.locator('.search-result')).toHaveCount(1);
    await expect(page.locator('#searchResults img')).toHaveCount(0);
});

test('Find handles invalid, empty and pathological regex without holding editing', async ({ page }) => {
    await setup(page, '# Review\n\n' + 'a'.repeat(40000) + '!\n');
    await page.locator('#editor').click();
    await page.keyboard.press('ControlOrMeta+f');
    await page.locator('#searchRegex').check();
    await page.locator('#searchInput').fill('[');
    await expect(page.locator('#searchFeedback')).toContainText('Invalid regular expression');
    await page.locator('#searchInput').fill('(?:)');
    await expect(page.locator('#searchFeedback')).toContainText('No matches');
    await page.locator('#searchInput').fill('(a+)+$');
    await expect(page.locator('#searchFeedback')).toContainText('too long');
    await page.locator('#searchInput').fill('Review');
    await expect(page.locator('.search-result')).toHaveCount(1);
    expect((await snapshot(page)).pending).toBe(false);
});

test('selected replacement scope retains labels, selection counts and literal replacement', async ({ page }) => {
    const content = '# Review\n\nalpha alpha alpha\n';
    await setup(page, content);
    await page.locator('#editor').click();
    await page.keyboard.press('ControlOrMeta+h');
    await page.locator('#searchInput').fill('alpha');
    await page.locator('#replaceInput').fill('$&');
    await expect(page.locator('label[for="searchInput"]')).toHaveText('Find');
    await expect(page.locator('label[for="replaceInput"]')).toHaveText('Replace with');
    await page.locator('#replaceScope').selectOption('selected');
    await expect(page.locator('#replaceAll')).toBeDisabled();
    await expect(page.locator('#replaceSelected')).toBeDisabled();
    await page.locator('.search-result input').nth(1).check();
    await expect(page.locator('#searchSelectedCount')).toHaveText('1 selected');
    await page.locator('#replaceSelected').click();
    expect((await snapshot(page)).content).toBe('# Review\n\nalpha $& alpha\n');
    await page.locator('#closeSearch').click();
    await page.locator('[data-action="undo"]').click();
    expect((await snapshot(page)).content).toBe(content);
});

test('Find Source replacement retains exact spelling and participates in shared Undo', async ({ page }) => {
    await setup(page);
    await page.locator('button[data-editor-mode="source"]').click();
    await page.keyboard.press('ControlOrMeta+h');
    await page.locator('#searchInput').fill('target');
    await expect(page.locator('.search-result')).toHaveCount(1);
    await page.locator('#replaceInput').fill('updated');
    await page.locator('#replaceAll').click();
    await expect(page.locator('#sourceEditor')).toHaveValue(authored.replace('target','updated'));
    await page.locator('#closeSearch').click();
    await page.locator('#sourceEditor').press('ControlOrMeta+z');
    await expect(page.locator('#sourceEditor')).toHaveValue(authored);
});

test('narrow Find keeps the selected document match visible above its scrollable submenu', async ({ page }) => {
    const content = '# Research notes\n\nA focused writing space supports the method.\n\n## Method\n\nRecord the method, observations, and assumptions.\n\n## Results\n\nThe method supports an independent review.\n';
    for (const height of [800, 1000]) {
        await setup(page, content);
        await page.setViewportSize({ width: 480, height });
        await page.locator('#editor').click();
        await page.keyboard.press('ControlOrMeta+h');
        await page.locator('#searchInput').fill('method');
        await page.locator('#replaceInput').fill('approach');
        await expect(page.locator('.search-result')).toHaveCount(4);
        await page.locator('.search-result input').nth(1).check();
        await page.locator('.search-result button').nth(1).click();
        const geometry = await page.evaluate(() => {
            const range = [...(CSS as any).highlights.get('document-search-current')][0] as Range;
            const menu = document.getElementById('searchReplaceBox')!.getBoundingClientRect();
            return { text: range.toString(), bottom: range.getBoundingClientRect().bottom, menuTop: menu.top, menuBottom: menu.bottom, paneTop: document.getElementById('editorWrapper')!.getBoundingClientRect().top };
        });
        expect(geometry.text).toBe('Method');
        expect(geometry.bottom).toBeGreaterThan(geometry.paneTop);
        expect(geometry.bottom).toBeLessThan(geometry.menuTop);
        expect(geometry.menuBottom).toBeLessThan(height);
        await expect(page.locator('#searchInput')).toHaveValue('method');
        await expect(page.locator('#replaceInput')).toHaveValue('approach');
        expect(await snapshot(page)).toMatchObject({ content, pending: false });
        await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
        await page.locator('button[data-editor-mode="source"]').click();
        await page.keyboard.press('ControlOrMeta+h');
        await expect(page.locator('.search-result')).toHaveCount(4);
        await page.locator('.search-result button').nth(1).click();
        expect(await page.locator('#sourceEditor').evaluate((node: HTMLTextAreaElement) => node.value.slice(node.selectionStart, node.selectionEnd))).toBe('Method');
        expect(await snapshot(page)).toMatchObject({ content, pending: false });
    }
});

test('Insert workspace filters categories, previews choices and recovers an empty search', async ({ page }) => {
    await setup(page);
    await openInsertWorkspace(page);
    await expect(page.locator('.insert-preview')).toHaveCount(8);
    await page.locator('[data-insert-category="equationsCategory"]').click();
    await expect(page.locator('#insertMenu [data-insert-action]:visible')).toHaveCount(2);
    await page.locator('.insert-search input').fill('unmatched-command');
    await expect(page.locator('.insert-empty')).toBeVisible();
    await page.locator('.insert-search button').click();
    await expect(page.locator('#insertMenu [data-insert-action]:visible')).toHaveCount(8);
    await page.keyboard.press('Escape');
    expect((await snapshot(page)).content).toBe(authored);
});

test('Action Palette uses shared descriptions and has a clear-search recovery action', async ({ page }) => {
    await setup(page);
    await openActionPalette(page);
    await page.locator('.command-palette-input').fill('unmatched-command');
    await expect(page.locator('.command-palette-empty')).toContainText('No matching actions');
    await page.locator('.command-palette-clear').click();
    await expect(page.locator('.command-palette-item small').first()).toBeVisible();
});

test('rendered Insert previews stay view-only and nested icon activation shares Undo', async ({ page }) => {
    await setup(page);
    await openInsertWorkspace(page);
    await expect(page.locator('.insert-table-preview span')).toHaveCount(6);
    await expect(page.locator('.insert-preview-inlineMath .katex')).toBeVisible();
    await expect(page.locator('[data-insert-action="table"] .insert-command-title')).toHaveText('Insert Table');
    await expect(page.locator('[data-insert-action="table"] .insert-shortcut')).toContainText('+T');
    expect(await snapshot(page)).toMatchObject({ content: authored, pending: false });
    await page.locator('[data-insert-action="codeblock"] .insert-command-icon svg').click();
    await expect(page.locator('#editor pre code')).toHaveCount(1);
    await page.locator('[data-action="undo"]').click();
    expect((await snapshot(page)).content).toBe(authored);
});

for (const offset of [0, -0.5]) test('narrow Insert exposes complete lower commands through visible view-only navigation' + (offset ? ' with subpixel row alignment' : ''), async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width: 480, height: 800 });
    if (offset) await page.addStyleTag({ content: `.insert-command { transform: translateY(${offset}px); }` });
    await openInsertWorkspace(page);
    const next = page.locator('.insert-scroll [data-direction="next"]');
    await expect(next).toBeVisible();
    for (let step = 0; step < 8 && await next.isEnabled(); step++) await next.click();
    await expect(page.locator('[data-insert-action="toc"]')).toBeVisible();
    await expect(page.locator('[data-insert-action="mermaid"]')).toBeVisible();
    await expect(page.locator('.insert-scroll output')).toContainText('/ 8');
    await expect(next).toBeDisabled();
    await expect(next).toHaveCSS('opacity', '0.45');
    expect(await page.locator('.insert-options').evaluate(list => {
        const first = list.querySelector('.insert-command:not([hidden]):not(.insert-command-clipped)')!;
        return first.getBoundingClientRect().top - list.getBoundingClientRect().top;
    })).toBeLessThanOrEqual(24);
    await page.locator('.insert-scroll [data-direction="previous"]').click();
    await expect(next).toBeEnabled();
    expect(await snapshot(page)).toMatchObject({ content: authored, pending: false });
});

test('mode switches preserve the selected inline text through Markdown source offsets', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => {
        const text = document.querySelector('#editor strong')!.firstChild!;
        const range = document.createRange(); range.setStart(text,0); range.setEnd(text,6);
        document.getElementById('editor')!.focus(); getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    });
    await page.locator('button[data-editor-mode="source"]').click();
    expect(await page.locator('#sourceEditor').evaluate((node: HTMLTextAreaElement) => node.value.slice(node.selectionStart,node.selectionEnd))).toBe('target');
    await page.locator('button[data-editor-mode="visual"]').click();
    expect(await page.evaluate(() => getSelection()!.toString())).toBe('target');
});

test('palette categories expose the complete command set and filtering is view only', async ({ page }) => {
    await setup(page);
    await openActionPalette(page);
    const all = await page.locator('.command-palette-item').count();
    await expect(page.locator('.command-palette-count')).toHaveText(`${all} actions`);
    await page.locator('[data-palette-category="insert"]').click();
    await expect(page.locator('[data-palette-category="insert"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.command-palette-item[data-action="table"]')).toBeVisible();
    await expect(page.locator('.command-palette-item[data-action="bold"]')).toHaveCount(0);
    await page.locator('[data-palette-category=""]').click();
    await expect(page.locator('.command-palette-item')).toHaveCount(all);
    await page.locator('.command-palette-input').fill('unmatched-command');
    await page.locator('.command-palette-clear').click();
    await expect(page.locator('.command-palette-item')).toHaveCount(all);
    await page.keyboard.press('Escape');
    expect(await snapshot(page)).toMatchObject({ content: authored, pending: false });
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('overflowing tables offer explicit scrolling without editing or leaking controls into export', async ({ page }) => {
    const source = '# Table\n\n| Experiment | Accuracy | Duration | Status | Further observation |\n| --- | --- | --- | --- | --- |\n| Baseline | 91% | 120 ms | Reviewed | Additional result |\n';
    await setup(page, source);
    await page.setViewportSize({ width: 480, height: 1000 });
    const hint = page.locator('.table-scroll-hint');
    await expect(hint).toBeVisible();
    await expect(hint.getByRole('button', { name: 'Scroll table left', exact: true })).toBeDisabled();
    await hint.getByRole('button', { name: 'Scroll table right', exact: true }).click();
    await expect.poll(() => page.locator('#editor table').evaluate(table => table.scrollLeft)).toBeGreaterThan(0);
    await hint.getByRole('button', { name: 'Scroll table left', exact: true }).click();
    await expect.poll(() => page.locator('#editor table').evaluate(table => table.scrollLeft)).toBe(0);
    expect(await snapshot(page)).toMatchObject({ content: source, pending: false });
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
    await expect(page.locator('#editor .table-scroll-hint')).toHaveCount(0);
    await page.locator('button[data-editor-mode="source"]').click();
    await expect(hint).toBeHidden();
    await expect(page.locator('#sourceEditor')).toHaveValue(source);
    await page.locator('button[data-editor-mode="visual"]').click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(hint).toBeHidden();
});

test('a small narrow table keeps complete cells readable without changing its source', async ({ page }) => {
    const source = '# Results\n\n| Experiment | Accuracy | Duration | Status |\n| --- | --- | --- | --- |\n| Baseline | 91% | 120 ms | Reviewed |\n| Optimized | 95% | 82 ms | Pending |\n';
    await setup(page, source);
    await page.setViewportSize({ width: 480, height: 1000 });
    await expect.poll(() => page.locator('#editor table').evaluate(table => {
        const bounds = table.getBoundingClientRect();
        return [...table.querySelectorAll('th, td')].every(cell => {
            const box = cell.getBoundingClientRect();
            return box.left >= bounds.left - 1 && box.right <= bounds.right + 1;
        });
    })).toBe(true);
    await expect(page.locator('.table-scroll-hint')).toBeHidden();
    expect(await snapshot(page)).toMatchObject({ content: source, pending: false });
    await expect(page.locator('#toolbar [data-action="undo"]')).toBeDisabled();
});

test('canvas guides disappear when reading outside the writing focus', async ({ page }) => {
    await setup(page);
    await page.locator('#editor p').first().click();
    expect(await page.locator('#editor').evaluate(node => getComputedStyle(node).backgroundImage)).not.toBe('none');
    await page.locator('#outlineTab').focus();
    expect(await page.locator('#editor').evaluate(node => getComputedStyle(node).backgroundImage)).toBe('none');
    expect(await page.locator('.editor-width-bounds').evaluate(node => getComputedStyle(node).opacity)).toBe('0');
    expect(await snapshot(page)).toMatchObject({ content: authored, pending: false });
});

test('contextual formatting uses the retained selection and shared Undo', async ({ page }) => {
    await setup(page);
    await page.locator('#contextToolbarToggle').click();
    await page.evaluate(() => {
        const node = document.querySelector('#editor p')!.firstChild!;
        const range = document.createRange(); range.setStart(node,0); range.setEnd(node,6);
        document.getElementById('editor')!.focus(); getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    });
    await expect(page.locator('.context-format-toolbar')).toBeVisible();
    await page.locator('.context-format-toolbar button').first().click();
    expect((await snapshot(page)).content).toContain('**Before**');
    await page.locator('[data-action="undo"]').click();
    expect((await snapshot(page)).content).toBe(authored);
});

test('contextual formatting finds a visible gap without covering headings or selected prose', async ({ page }) => {
    const content = '# Research notes\n\nA calm writing space makes ideas easier to follow. Our research explores the relationship between clear structure and readable controls.\n\n## Background\n\nThe first study considers focused work and useful feedback.\n';
    await setup(page, content);
    await page.locator('#contextToolbarToggle').click();
    await page.evaluate(() => {
        const text = document.querySelector('#editor p')!.firstChild!;
        const range = document.createRange(); range.setStart(text, 0); range.setEnd(text, 18);
        document.getElementById('editor')!.focus(); getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    });
    await expect(page.locator('.context-format-toolbar')).toBeVisible();
    const overlaps = await page.evaluate(() => {
        const toolbar = document.querySelector('.context-format-toolbar')!.getBoundingClientRect();
        return [...document.querySelector('#editor')!.children].filter(node => {
            const box = node.getBoundingClientRect();
            return box.width && box.height && toolbar.left < box.right && toolbar.right > box.left && toolbar.top < box.bottom && toolbar.bottom > box.top;
        }).length;
    });
    expect(overlaps).toBe(0);
    const distance = await page.evaluate(() => {
        const toolbar = document.querySelector('.context-format-toolbar')!.getBoundingClientRect();
        const selection = getSelection()!.getRangeAt(0).getBoundingClientRect();
        return Math.hypot(Math.max(selection.left - toolbar.right, toolbar.left - selection.right, 0), Math.max(selection.top - toolbar.bottom, toolbar.top - selection.bottom, 0));
    });
    expect(distance).toBeLessThanOrEqual(96);
    expect(await page.evaluate(() => getSelection()!.toString())).toBe('A calm writing spa');
    expect(await snapshot(page)).toMatchObject({ content, pending: false });
});

test('palette navigation and export actions are view-only', async ({ page }) => {
    await setup(page);
    await openActionPalette(page);
    await page.locator('.command-palette-input').fill('viewSplit');
    await page.keyboard.press('Enter');
    await expect(page.locator('#sourceEditor')).toBeVisible();
    await expect(page.locator('#editor')).toBeVisible();
    expect(await snapshot(page)).toMatchObject({ content: authored, pending: false });
});

test('table directions, boundary insertion and cell navigation retain one edit history', async ({ page }) => {
    const content = '| A | B |\n| --- | --- |\n| one | two |\n| three | four |\n';
    await setup(page, content);
    await page.locator('#editor td').first().click();
    const toolbar = page.locator('.table-toolbar:not(.table-toolbar-measure)');
    await expect(toolbar.locator('[data-action="add-row-above"]')).toBeVisible();
    const arrow = async (action: string) => toolbar.locator(`[data-action="${action}"]`).boundingBox();
    const up = await arrow('add-row-above'), left = await arrow('add-col-left'), right = await arrow('add-col-right'), down = await arrow('add-row-below');
    expect(up!.y).toBeLessThan(left!.y); expect(left!.y).toBe(right!.y); expect(left!.x).toBeLessThan(right!.x); expect(down!.y).toBeGreaterThan(right!.y);
    await toolbar.getByRole('combobox', { name: 'Rows', exact: true }).selectOption({ value: '2' });
    await toolbar.getByRole('combobox', { name: 'Columns', exact: true }).selectOption({ value: '1' });
    expect(await page.evaluate(() => { const node = getSelection()!.anchorNode!; return (node.nodeType === 3 ? node.parentElement : node as Element)?.closest('td')?.textContent; })).toBe('four');
    expect(await snapshot(page)).toMatchObject({ content, pending: false });
    await page.locator('.table-boundary-actions [data-action="add-row-below"]').click();
    await expect(page.locator('#editor tr')).toHaveCount(4);
    await page.locator('[data-action="undo"]').click();
    expect((await snapshot(page)).content).toBe(content);
});

test('equation and diagram diagnostics are readable without changing the source', async ({ page }) => {
    const content = '# Blocks\n\n$$\n\\unknownCommand{x}\n$$\n\n```mermaid\ngraph TD\n A --> B\n```\n';
    await setup(page, content);
    await expect(page.locator('.math-wrapper .block-status')).toContainText('Unknown command:');
    await expect(page.locator('.math-wrapper .block-chrome')).toContainText('Shift+Enter');
    await expect(page.locator('.mermaid-diagram svg')).toHaveCount(1);
    await page.locator('.mermaid-wrapper [data-block-mode="edit"]').click();
    await expect(page.locator('.mermaid-wrapper pre')).toBeVisible();
    await page.locator('.mermaid-wrapper [data-block-mode="display"]').click();
    expect(await snapshot(page)).toMatchObject({ content, pending: false });
    const invalid = '```mermaid\ngraph TD\n A --> [\n```\n';
    await setup(page, invalid);
    await expect(page.locator('.mermaid-wrapper .block-status')).toContainText('Needs attention');
    await page.locator('.block-diagnostic summary').click();
    await expect(page.locator('.block-diagnostic-text')).toContainText('Expecting');
    await expect(page.locator('.block-diagnostic-text')).not.toContainText('on line');
    expect(await snapshot(page)).toMatchObject({ content: invalid, pending: false });
});

test('table coordinates remain outside authored cells and boundary plus appends at the edge', async ({ page }) => {
    const content = '| A | B |\n| --- | --- |\n| one | two |\n| three | four |\n';
    await setup(page, content);
    await page.locator('#editor td').first().click();
    await expect(page.locator('.table-coordinate-gutters')).toContainText('A');
    await expect(page.locator('#editor .table-coordinate-gutters')).toHaveCount(0);
    expect(await snapshot(page)).toMatchObject({ content, pending: false });
    await page.locator('.table-boundary-actions [data-action="add-col-right"]').click();
    await expect(page.locator('#editor th')).toHaveCount(3);
    await expect(page.locator('#editor th').nth(0)).toHaveText('A');
    await expect(page.locator('#editor th').nth(1)).toHaveText('B');
    await expect(page.locator('#editor tr').nth(1).locator('td').nth(1)).toHaveText('two');
    await page.locator('[data-action="undo"]').click();
    expect((await snapshot(page)).content).toBe(content);
    await page.locator('#editor td').first().click();
    await page.locator('.table-boundary-actions [data-action="add-row-below"]').click();
    await expect(page.locator('#editor tr')).toHaveCount(4);
    await expect(page.locator('#editor tr').nth(2)).toContainText('three');
    await page.locator('[data-action="undo"]').click();
    expect((await snapshot(page)).content).toBe(content);
});

test('front matter disclosure and Contents help preserve YAML comments and key order', async ({ page }) => {
    const content = authored.replace('# One', '[TOC]\n\n# One');
    await setup(page, content);
    await expect(page.locator('.front-matter summary')).toContainText('Front matter');
    await page.locator('.front-matter summary').click();
    await expect(page.locator('.front-matter-source')).toContainText('# retained');
    await expect(page.locator('.toc-heading')).toContainText('Generated');
    await expect(page.locator('.toc-help')).toContainText('save');
    expect(await snapshot(page)).toMatchObject({ content, pending: false });
});

test('Find refresh after source typing does not move the caret', async ({ page }) => {
    await setup(page, '# Review\n\nalpha\n');
    await page.locator('button[data-editor-mode="source"]').click();
    await page.keyboard.press('ControlOrMeta+f');
    await page.locator('#searchInput').fill('alpha');
    await expect(page.locator('.search-result')).toHaveCount(1);
    await page.locator('#sourceEditor').press('ControlOrMeta+a');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.insertText(' alpha');
    await expect(page.locator('.search-result')).toHaveCount(2);
    expect(await page.locator('#sourceEditor').evaluate((node: HTMLTextAreaElement) => node.selectionStart)).toBe('# Review\n\nalpha\n alpha'.length);
});

for (const theme of ['github','sepia','night','dark','minimal','things','perplexity']) {
    test(`${theme} code tokens have readable contrast`, async ({ page }) => {
        await setup(page, '```javascript\n// review\nconst value = "ready";\nfunction check(x) { return x === 42 && true; }\n```\n');
        const pairs = await page.evaluate(theme => {
            document.documentElement.dataset.theme = theme;
            const code = document.querySelector('#editor pre')!;
            const rgb = (value: string) => (value.match(/[\d.]+/g) || []).slice(0,3).map(Number);
            const luminance = (value: string) => rgb(value).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum,v,i) => sum + v * [.2126,.7152,.0722][i],0);
            const background = luminance(getComputedStyle(code).backgroundColor);
            return [...code.querySelectorAll('[class^="hljs-"]')].map(node => {
                const color = luminance(getComputedStyle(node).color);
                return { token: node.className, contrast: (Math.max(color,background) + .05) / (Math.min(color,background) + .05) };
            });
        }, theme);
        expect(pairs.length).toBeGreaterThan(3);
        for (const pair of pairs) expect(pair.contrast, `${theme}/${pair.token}`).toBeGreaterThanOrEqual(4.5);
    });
}

test('Split preview cannot open an inline equation editor or modify a task checkbox', async ({ page }) => {
    const content = '# Preview\n\n$a^2$\n\n- [ ] Check\n';
    await setup(page, content);
    await page.locator('button[data-editor-mode="split"]').click();
    await page.locator('#editor .math-inline').click();
    await expect(page.locator('.math-inline-input')).toHaveCount(0);
    await expect(page.locator('#editor input[type="checkbox"]')).toBeDisabled();
    expect(await snapshot(page)).toMatchObject({ content, pending: false });
});

test('inline-code formatting escapes selected HTML text', async ({ page }) => {
    await setup(page, 'Literal <img src=x onerror=alert(1)>.\n');
    await expect(page.locator('#editor p')).toHaveText('Literal <img src=x onerror=alert(1)>.');
    await page.evaluate(() => {
        const node = document.querySelector('#editor p')!.firstChild!;
        const value = node.textContent!; const start = value.indexOf('<img');
        const range = document.createRange(); range.setStart(node,start); range.setEnd(node,value.indexOf('>',start)+1);
        document.getElementById('editor')!.focus(); getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    });
    await page.locator('#toolbar [data-action="code"]').click();
    await expect(page.locator('#editor img')).toHaveCount(0);
    await expect(page.locator('#editor code')).toHaveText('<img src=x onerror=alert(1)>');
});
