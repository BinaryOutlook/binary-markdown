'use strict';
const assert = require('node:assert/strict');
const tex = '  ' + 'x^2+'.repeat(70) + 'y^2  \n\n\tz^2  \n';
const source = 'Before.\n\n$$\n' + tex + '\n$$\n\nAfter.\n';

async function equationWrapChecks({ editor, keyboard, setWrap, setPosition, save, record, capture = async () => {} }) {
    await editor.evaluate(() => document.getElementById('closeSidebar').click());
    await editor.locator('.math-display').click();
    await editor.evaluate(() => {
        const code = document.querySelector('.math-wrapper code'); window.__wrapCode = code;
        const range = document.createRange(); range.setStart(code.firstChild, 3); range.setEnd(code.firstChild, 9);
        getSelection().removeAllRanges(); getSelection().addRange(range);
    });
    const selected = await editor.evaluate(() => getSelection().toString());
    for (const position of ['above', 'below']) {
        await setPosition(position);
        await editor.waitForFunction(position => document.documentElement.dataset.mathSourcePosition === position, position);
        for (const wrap of [true, false, true]) {
            await setWrap(wrap);
            await editor.waitForFunction(wrap => document.documentElement.dataset.mathSourceWrap === String(wrap), wrap);
            const state = await editor.evaluate(() => {
                const pre = document.querySelector('.math-wrapper pre');
                return { width: pre.clientWidth, scroll: pre.scrollWidth, same: window.__wrapCode === pre.querySelector('code'),
                    mode: pre.parentElement.dataset.mode, selected: getSelection().toString(), source: window.htmlToMarkdown(),
                    undo: document.querySelector('[data-action="undo"]').disabled };
            });
            assert.ok(state.same && state.mode === 'edit' && state.undo, JSON.stringify(state));
            assert.equal(state.selected, selected); assert.equal(state.source, source);
            assert.ok(wrap ? state.scroll <= state.width + 1 : state.scroll > state.width, JSON.stringify(state));
            if (wrap) await capture(position);
        }
    }
    await editor.evaluate(() => {
        const code = document.querySelector('.math-wrapper code'); code.parentElement.focus();
        const range = document.createRange(); range.setStart(code.firstChild, 140); range.collapse(true);
        getSelection().removeAllRanges(); getSelection().addRange(range);
    });
    const middleY = await editor.evaluate(() => getSelection().getRangeAt(0).getBoundingClientRect().y);
    await keyboard.press('ArrowUp');
    assert.equal(await editor.evaluate(() => document.querySelector('.math-wrapper').dataset.mode), 'edit');
    assert.ok(await editor.evaluate(() => getSelection().getRangeAt(0).getBoundingClientRect().y) < middleY);
    await keyboard.press('ArrowDown');
    assert.equal(await editor.evaluate(() => document.querySelector('.math-wrapper').dataset.mode), 'edit');
    assert.ok(Math.abs(await editor.evaluate(() => getSelection().getRangeAt(0).getBoundingClientRect().y) - middleY) < 2);
    record('equation-source-wrap', { bothPositions: true, visualArrowNavigation: true, wrappingAndScrolling: true, sourceSelectionDOMAndUndoPreserved: true, activeEditRetained: true });
    await editor.evaluate(() => {
        const code = document.querySelector('.math-wrapper code'); code.parentElement.focus();
        const range = document.createRange(); range.selectNodeContents(code); range.collapse(false);
        getSelection().removeAllRanges(); getSelection().addRange(range);
    });
    await keyboard.insertText('+1');
    const changed = 'Before.\n\n$$\n' + tex + '+1\n$$\n\nAfter.\n';
    assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), changed);
    await setWrap(false); await setWrap(true);
    await editor.waitForFunction(() => document.querySelector('.math-display .katex')?.textContent.includes('1'));
    await save(changed);
    await editor.locator('[data-action="undo"]').click(); assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), source);
    await editor.locator('[data-action="redo"]').click(); assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), changed);
    await save(changed);
    record('equation-source-wrap-input', { pendingPreviewPreserved: true, exactWhitespaceAndNativeSave: true, synchronizedUndoRedo: true });
    return changed;
}
module.exports = { source, tex, equationWrapChecks };
