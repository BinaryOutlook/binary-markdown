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
    await editor.waitForFunction(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))));
    if (!await editor.locator('#insertButton').isVisible()) await editor.locator('#toolbarMore').click();
    await editor.locator('#insertButton').click();
    await editor.waitForFunction(() => !document.getElementById('insertMenu').hidden);
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
        assert.equal(await editor.evaluate(() => document.querySelectorAll('#insertMenu button').length), 8);
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
        await editor.locator('[data-insert-action="' + action + '"]').click();
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
        await editor.locator('[data-insert-action="inlineMath"]').click();
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
            await editor.locator('[data-insert-action="' + action + '"]').click();
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

module.exports = { source, selectTarget, openInsert, insertMenuChecks };
