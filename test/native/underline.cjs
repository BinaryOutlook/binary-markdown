'use strict';
const assert = require('node:assert/strict');
const { selectTarget } = require('./insert-menu.cjs');

const source = '# Underline checks\n\nPlain target.\n\n**Bold target.**\n\nAlready <u>marked</u>.\n\n- List target.\n\n| Name |\n| --- |\n| Cell target. |\n\nLiteral `<u>code</u>`.\n\n```text\ncode target\n\n```\n\n> Quote target.\n';

async function underlineChecks({ editor, keyboard, modifier, save, record, capture = async () => {} }) {
    await editor.evaluate(() => document.getElementById('closeSidebar').click());
    const toolbarAction = async action => {
        const button = editor.locator('#toolbar [data-action="' + action + '"]');
        if (!await button.isVisible()) await editor.locator('#toolbarMore').click();
        await button.click();
    };
    const before = await editor.evaluate(() => window.htmlToMarkdown());
    assert.equal(await editor.evaluate(() => document.querySelectorAll('#editor u').length), 1);
    for (const selector of ['#editor > p', '#editor > p strong', '#editor li', '#editor td', '#editor blockquote']) {
        await selectTarget(editor, selector);
        await toolbarAction('underline');
        const after = await editor.evaluate(() => window.htmlToMarkdown());
        assert.notEqual(after, before);
        assert.equal(await editor.evaluate(() => document.querySelectorAll('#editor u').length), 2);
        assert.ok(after.includes('```text\ncode target\n\n```'));
        await save(after);
        await toolbarAction('undo');
        assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), before);
        await toolbarAction('redo');
        assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), after);
        await capture(selector.replace(/[^a-z]+/gi, '-'));
        await toolbarAction('undo');
        record('underline-context', { selector, nativeSave: true, undo: true, redo: true, codePreserved: true });
    }
    await selectTarget(editor, '#editor > p');
    await keyboard.press(modifier + '+u');
    const keyboardResult = await editor.evaluate(() => window.htmlToMarkdown());
    assert.ok(keyboardResult.includes('Plain <u>target</u>.'));
    await save(keyboardResult);
    await toolbarAction('undo');
    await selectTarget(editor, '#editor pre code');
    await toolbarAction('underline');
    assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), before);
    await save(before);
    record('underline-keyboard-and-literal', { keyboard: modifier + '+u', codeRejected: true, originalRestored: true });
    return before;
}

module.exports = { source, underlineChecks };
