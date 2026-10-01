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
    await page.locator('#contextToolbarToggle').click();
    for (const mode of ['source', 'split', 'visual']) await page.locator(`button[data-editor-mode="${mode}"]`).click();
    expect(await snapshot(page)).toMatchObject({ content: authored, pending: false });
    await expect(page.locator('[data-action="undo"]')).toBeDisabled();
});

test('Split source edits share Undo with Visual and the preview is read only', async ({ page }) => {
    await setup(page);
    await page.locator('button[data-editor-mode="split"]').click();
    await expect(page.locator('#sourceEditor')).toHaveValue(authored);
    await expect(page.locator('#editor')).toHaveAttribute('contenteditable', 'false');
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

test('source mode disables visual formatting and retains explicit mode labels', async ({ page }) => {
    await setup(page);
    await page.locator('button[data-editor-mode="source"]').click();
    await expect(page.locator('#formatButton')).toBeDisabled();
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

test('Insert workspace filters categories, previews choices and recovers an empty search', async ({ page }) => {
    await setup(page);
    await page.locator('#insertButton').click();
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
    await page.locator('#formatButton').click();
    await page.locator('.command-palette-input').fill('unmatched-command');
    await expect(page.locator('.command-palette-empty')).toContainText('No matching actions');
    await page.locator('.command-palette-clear').click();
    await expect(page.locator('.command-palette-item small').first()).toBeVisible();
});

test('rendered Insert previews stay view-only and nested icon activation shares Undo', async ({ page }) => {
    await setup(page);
    await page.locator('#insertButton').click();
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

test('narrow Insert exposes complete lower commands through visible view-only navigation', async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width: 480, height: 800 });
    await page.locator('#insertButton').click();
    const next = page.locator('.insert-scroll [data-direction="next"]');
    await expect(next).toBeVisible();
    for (let step = 0; step < 8 && await next.isEnabled(); step++) await next.click();
    await expect(page.locator('[data-insert-action="toc"]')).toBeVisible();
    await expect(page.locator('[data-insert-action="mermaid"]')).toBeVisible();
    await expect(page.locator('.insert-scroll output')).toContainText('/ 8');
    await expect(next).toBeDisabled();
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

test('palette navigation and export actions are view-only', async ({ page }) => {
    await setup(page);
    await page.locator('#formatButton').click();
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
    await expect(page.locator('.math-wrapper .block-status')).toContainText('Unsupported');
    await expect(page.locator('.math-wrapper .block-chrome')).toContainText('Shift+Enter');
    await expect(page.locator('.mermaid-diagram svg')).toHaveCount(1);
    await page.locator('.mermaid-wrapper [data-block-mode="edit"]').click();
    await expect(page.locator('.mermaid-wrapper pre')).toBeVisible();
    await page.locator('.mermaid-wrapper [data-block-mode="display"]').click();
    expect(await snapshot(page)).toMatchObject({ content, pending: false });
    await setup(page, '```mermaid\ngraph TD\n A --> [\n```\n');
    await expect(page.locator('.mermaid-wrapper .block-status')).toContainText('Needs attention');
    await page.locator('.block-diagnostic summary').click();
    await expect(page.locator('.block-diagnostic-text')).toContainText('line');
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
