'use strict';
const assert = require('node:assert/strict');
const source = '# Equations\n\nBefore.\n\n$$\nx^2 + y^2\n$$\n\nAfter.\n';

async function equationPositionChecks({ editor, keyboard, set, save, record, capture = async () => {} }) {
    await editor.evaluate(() => document.getElementById('closeSidebar').click());
    await editor.locator('.math-display').click();
    await editor.evaluate(() => {
        const code = document.querySelector('.math-wrapper code'); window.__positionCode = code;
        const range = document.createRange(); range.setStart(code.firstChild, 0); range.setEnd(code.firstChild, 3);
        getSelection().removeAllRanges(); getSelection().addRange(range);
    });
    for (const mode of ['below', 'above', 'below']) {
        await set(mode);
        await editor.waitForFunction(mode => document.documentElement.dataset.mathSourcePosition === mode, mode);
        const state = await editor.evaluate(() => {
            const wrapper = document.querySelector('.math-wrapper');
            const pre = wrapper.querySelector('pre').getBoundingClientRect(), preview = wrapper.querySelector('.math-display').getBoundingClientRect();
            return { same: window.__positionCode === wrapper.querySelector('code'), mode: wrapper.dataset.mode,
                selected: getSelection().toString(), source: window.htmlToMarkdown(), undo: document.querySelector('[data-action="undo"]').disabled,
                before: pre.bottom <= preview.top + 1, after: preview.bottom <= pre.top + 1 };
        });
        assert.ok(state.same && state.mode === 'edit' && state.undo, JSON.stringify(state));
        assert.equal(state.selected, 'x^2'); assert.equal(state.source, source);
        assert.ok(mode === 'above' ? state.before : state.after);
        await capture(mode);
    }
    record('equation-source-placement', { aboveAndBelow: true, sourceSelectionDOMAndUndoPreserved: true, activeEditRetained: true });
    await editor.evaluate(() => {
        const code = document.querySelector('.math-wrapper code'); code.parentElement.focus();
        const range = document.createRange(); range.selectNodeContents(code); range.collapse(false);
        getSelection().removeAllRanges(); getSelection().addRange(range);
    });
    await keyboard.insertText('+z');
    const changed = await editor.evaluate(() => window.htmlToMarkdown()); assert.ok(changed.includes('y^2+z'));
    await set('above'); await editor.waitForFunction(() => document.querySelector('.math-display .katex')?.textContent.includes('z'));
    assert.equal(await editor.evaluate(() => document.querySelector('.math-wrapper').dataset.mode), 'edit');
    await save(changed);
    await editor.locator('[data-action="undo"]').click(); assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), source);
    await editor.locator('[data-action="redo"]').click(); assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), changed);
    await set('below'); await save(changed);
    record('equation-source-input', { pendingPreviewPreserved: true, nativeSave: true, synchronizedUndoRedo: true });
    return changed;
}
module.exports = { source, equationPositionChecks };
