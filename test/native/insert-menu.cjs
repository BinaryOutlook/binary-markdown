'use strict';
const assert = require('node:assert/strict');

const source = '# Insertion checks\n\nBefore target after.\n\n- List target.\n\n| Name |\n| --- |\n| Cell target. |\n\nEnd paragraph.\n';

async function selectTarget(editor, selector = '#editor > p') {
    await editor.evaluate(selector => {
        const element = [...document.querySelectorAll(selector)].find(node => node.textContent.includes('target'));
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node && !node.textContent.includes('target')) node = walker.nextNode();
        const start = node.textContent.indexOf('target');
        const range = document.createRange(); range.setStart(node, start); range.setEnd(node, start + 6);
        document.getElementById('editor').focus(); getSelection().removeAllRanges(); getSelection().addRange(range);
    }, selector);
}

async function openInsert(editor) {
    try {
        // The installed webview can stop delivering animation frames while CDP
        // still evaluates DOM state. Poll an actionable control instead of
        // awaiting a frame promise that prevents the watchdog from polling.
        await editor.waitForFunction(() => {
            const node = document.getElementById('toolbarMore');
            return Boolean(document.getElementById('insertMenu') && node && !node.disabled &&
                node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
        });
        if (!await editor.locator('#toolbarOverflow').isVisible()) await editor.locator('#toolbarMore').click();
        await editor.evaluate(() => {
            const search = document.getElementById('toolbarCommandSearch');
            search.focus(); search.value = 'viewInsert'; search.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await editor.locator('[data-menu-command="viewInsert"]').click();
        await editor.waitForFunction(() => {
            const menu = document.getElementById('insertMenu');
            return Boolean(menu && !menu.hidden && menu.getClientRects().length);
        });
    } catch (error) {
        let state;
        try {
            state = await editor.evaluate(() => ({
                readyState: document.readyState, visibility: document.visibilityState,
                focused: document.hasFocus(), activeElement: document.activeElement?.id,
                mode: document.documentElement.dataset.toolbarMode,
                controls: ['toolbarMore', 'toolbarCommandSearch', 'insertMenu'].map(id => {
                    const node = document.getElementById(id);
                    return { id, present: Boolean(node), visible: Boolean(node?.getClientRects().length),
                        disabled: node?.disabled, hidden: node?.hidden };
                })
            }));
        } catch (inspectionError) { state = { inspectionError: inspectionError.message }; }
        throw new Error('Insert-menu readiness failed: ' + error.message + '. Frame state: ' + JSON.stringify(state), { cause: error });
    }
}

async function chooseInsertAction(editor, keyboard, action) {
    const actions = await editor.evaluate(() => [...document.querySelectorAll('#insertMenu [data-insert-action]:not([hidden])')].map(node => node.dataset.insertAction));
    assert.ok(actions.includes(action), 'The requested Insert action exists in the current category');
    // A narrow workspace deliberately conceals partial cards. Reach the whole
    // card through production keyboard navigation before activating it; waiting
    // for a hidden off-screen card before scrolling cannot establish reachability.
    for (let step = 0; step <= actions.length; step++) {
        if (await editor.evaluate(() => document.activeElement.dataset.insertAction) === action) {
            await editor.locator('[data-insert-action="' + action + '"]').click();
            return;
        }
        await keyboard.press('ArrowDown');
    }
    throw new Error('Insert keyboard navigation did not reach the requested action: ' + action);
}

// Native Quick Input can remain interactive while pointer stability waits
// receive no animation frames. Select an observed exact row through its normal
// keyboard handler, with a bounded number of navigation actions.
async function selectQuickInputItem(page, label, until) {
    const inspect = () => page.evaluate(() => {
        const widget = [...document.querySelectorAll('.quick-input-widget')].find(node => node.getClientRects().length);
        if (!widget) return { visible: false, rows: [], focusedId: null };
        const rows = [...widget.querySelectorAll('.monaco-list-row')].filter(node => node.getClientRects().length);
        const activeIds = [...widget.querySelectorAll('[aria-activedescendant]')].map(node => node.getAttribute('aria-activedescendant'));
        const focused = rows.find(node => node.classList.contains('focused') || activeIds.includes(node.id));
        return { visible: true, rows: rows.map(node => ({ id: node.id, label: node.getAttribute('aria-label') })), focusedId: focused?.id || null };
    });
    try {
        let state = await until(async () => {
            const value = await inspect();
            return value.rows.some(row => row.label === label) ? value : undefined;
        }, 'exact Quick Input row: ' + label, inspect);
        await page.locator('.quick-input-widget:visible input:not([type="checkbox"]):visible').first().focus();
        const navigationLimit = state.rows.length + 1;
        for (let step = 0; step < navigationLimit; step++) {
            const target = state.rows.find(row => row.label === label);
            if (!target) throw new Error('The requested Quick Input row disappeared');
            if (state.focusedId === target.id) { await page.keyboard.press('Enter'); return; }
            const previous = state.focusedId;
            await page.keyboard.press('ArrowDown');
            state = await until(async () => {
                const value = await inspect();
                return value.focusedId && value.focusedId !== previous ? value : undefined;
            }, 'Quick Input keyboard focus advances', inspect);
        }
        throw new Error('Quick Input navigation did not reach the requested row');
    } catch (error) {
        let state;
        try { state = await inspect(); } catch (inspectionError) { state = { inspectionError: inspectionError.message }; }
        throw new Error('Quick Input selection failed: ' + error.message + '. Picker state: ' + JSON.stringify(state), { cause: error });
    }
}

async function insertMenuChecks({ editor, keyboard, setMode, dialog, save, record, capture = async () => {} }) {
    const before = await editor.evaluate(() => window.htmlToMarkdown());
    await editor.evaluate(() => {
        document.getElementById('closeSidebar').click();
        window.__nativeInsertEvents = [];
        window.hostBridge.onMessage(message => { if (['insertCancelled', 'insertLinkHtml', 'insertImageHtml'].includes(message.type)) window.__nativeInsertEvents.push(message); });
    });
    for (const mode of ['simple', 'full']) {
        await setMode(mode);
        await editor.waitForFunction(mode => document.documentElement.dataset.toolbarMode === mode, mode);
        await selectTarget(editor); await openInsert(editor);
        assert.equal(await editor.evaluate(() => document.querySelectorAll('#insertMenu button[data-insert-action]').length), 8);
        await keyboard.press('ArrowDown');
        await keyboard.press('End');
        assert.equal(await editor.evaluate(() => document.activeElement.dataset.insertAction), 'toc');
        await capture(mode + '-insert');
        await keyboard.press('Escape');
        assert.equal(await editor.evaluate(() => getSelection().toString()), 'target');
        assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), before);
        record('insert-menu-navigation', { mode, selectionPreserved: true, eightItems: true, escapePreservedContent: true });
    }
    for (const [action, selector] of [['inlineMath', '.math-inline'], ['math', '.math-wrapper'], ['codeblock', '#editor pre'], ['table', '#editor table'], ['mermaid', '.mermaid-wrapper'], ['toc', '.toc-block']]) {
        const count = await editor.evaluate(selector => document.querySelectorAll(selector).length, selector);
        await selectTarget(editor); await openInsert(editor);
        await chooseInsertAction(editor, keyboard, action);
        await editor.waitForFunction(({ selector, count }) => document.querySelectorAll(selector).length === count + 1, { selector, count });
        const after = await editor.evaluate(() => window.htmlToMarkdown());
        assert.notEqual(after, before);
        await save(after);
        await editor.locator('[data-action="undo"]').click();
        assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), before);
        await editor.locator('[data-action="redo"]').click();
        assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), after);
        await editor.locator('[data-action="undo"]').click();
        record('insert-command', { action, singleUndo: true, redo: true, savedContentVerified: true });
    }
    for (const selector of ['#editor li', '#editor td']) {
        await selectTarget(editor, selector); await openInsert(editor);
        assert.equal(await editor.evaluate(() => document.querySelectorAll('#insertMenu [aria-disabled="true"]').length), 5);
        await keyboard.press('Escape');
        assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), before);
        await selectTarget(editor, selector); await openInsert(editor);
        await chooseInsertAction(editor, keyboard, 'inlineMath');
        await editor.waitForFunction(selector => Boolean(document.querySelector(selector + ' .math-inline')), selector);
        await save(await editor.evaluate(() => window.htmlToMarkdown()));
        await editor.locator('[data-action="undo"]').click();
        assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), before);
        record('insert-context', { selector, blockCommandsDisabled: true, inlineEquationSaved: true, singleUndo: true });
    }
    for (const action of ['link', 'image']) {
        for (const accepted of [false, true]) {
            await editor.evaluate(() => { window.__nativeInsertEvents = []; });
            await selectTarget(editor); await openInsert(editor);
            await chooseInsertAction(editor, keyboard, action);
            await dialog(action, accepted);
            const responseType = accepted ? (action === 'link' ? 'insertLinkHtml' : 'insertImageHtml') : 'insertCancelled';
            await editor.waitForFunction(type => window.__nativeInsertEvents.some(message => message.type === type), responseType);
            if (accepted) {
                const after = await editor.evaluate(() => window.htmlToMarkdown());
                assert.notEqual(after, before);
                await save(after);
                await editor.locator('[data-action="undo"]').click();
                assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), before);
                await editor.locator('[data-action="redo"]').click();
                assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), after);
                await editor.locator('[data-action="undo"]').click();
            } else {
                assert.equal(await editor.evaluate(() => getSelection().toString()), 'target');
                assert.equal(await editor.evaluate(() => document.querySelector('[data-action="undo"]').disabled), true);
                assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), before);
            }
            record('insert-dialog', { action, accepted, bookmarkPreserved: true, singleUndo: accepted, cancelledWithoutEdit: !accepted });
        }
    }
    return before;
}

module.exports = { source, selectTarget, openInsert, chooseInsertAction, selectQuickInputItem, insertMenuChecks };
