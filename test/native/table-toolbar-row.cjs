'use strict';
const assert = require('node:assert/strict');

const source = '# Contextual controls\n\n| Item | State |\n| --- | --- |\n| One | Ready |\n| Two | Draft |\n\nAfter.\n';

function rowGeometry() {
    const header = document.getElementById('toolbar').getBoundingClientRect();
    const row = document.querySelector('.table-toolbar-row');
    const bounds = row.hidden ? header : row.getBoundingClientRect();
    const dock = document.querySelector('.table-toolbar-dock');
    const controls = document.querySelector('.table-toolbar:not(.table-toolbar-measure)');
    const docked = controls.dataset.placement === 'top-bar';
    const shouldShow = docked && document.documentElement.dataset.toolbarMode === 'full';
    const visible = [...dock.querySelectorAll('button')].filter(button => button.getClientRects().length);
    return {
        mode: document.documentElement.dataset.toolbarMode, placement: controls.dataset.placement, width: innerWidth,
        correctRow: row.hidden !== shouldShow && (!docked || dock.parentElement === (shouldShow ? row : document.getElementById('toolbar'))),
        viewportBelow: Math.abs(document.getElementById('editorWrapper').getBoundingClientRect().top - bounds.bottom) <= 1,
        wholeButtons: !docked || visible.every(button => { const rect = button.getBoundingClientRect(); return rect.left >= bounds.left && rect.right <= bounds.right + 1 && rect.top >= bounds.top && rect.bottom <= bounds.bottom + 1; }),
    };
}

async function tableRowChecks({ editor, keyboard, resize, setMode, setPosition, record, capture = async () => {} }) {
    const before = await editor.evaluate(() => window.htmlToMarkdown());
    await editor.evaluate(() => document.getElementById('closeSidebar').click());
    await editor.waitForFunction(() => document.getElementById('sidebar').getBoundingClientRect().width <= 1);
    for (const mode of ['simple', 'full']) {
        await setMode(mode);
        await editor.waitForFunction(value => document.documentElement.dataset.toolbarMode === value, mode);
        for (const position of ['top-bar', 'left', 'auto']) {
            await setPosition(position);
            await editor.waitForFunction(value => document.documentElement.dataset.tableToolbarPosition === value, position);
            for (const width of [900, 500]) {
                await resize(width, 800);
                await editor.locator('#editor td').first().click();
                await editor.waitForFunction(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))));
                await editor.waitForFunction(code => {
                    const state = (0, eval)('(' + code + ')')();
                    return state.placement && state.correctRow && state.viewportBelow && state.wholeButtons;
                }, rowGeometry.toString());
                const state = await editor.evaluate(rowGeometry);
                if (position !== 'auto') assert.equal(state.placement, position);
                await keyboard.press('Alt+F10');
                assert.equal(await editor.evaluate(() => Boolean(document.activeElement.closest('.table-toolbar, .table-toolbar-dock'))), true);
                await keyboard.press('Escape');
                assert.equal(await editor.evaluate(() => document.querySelector('#editor td').contains(getSelection().anchorNode)), true);
                assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), before);
                record('contextual-row', state);
                if (position === 'top-bar') await capture(mode + '-' + width);
            }
        }
    }
    await setPosition('top-bar');
    await editor.locator('#editor td').first().click();
    await editor.waitForFunction(() => !document.querySelector('.table-toolbar-row').hidden);
    await keyboard.press('Alt+F10');
    await keyboard.press('ArrowRight');
    await keyboard.press('Enter');
    await editor.waitForFunction(() => document.querySelectorAll('#editor th').length === 3);
    await setMode('simple');
    await editor.waitForFunction(() => document.documentElement.dataset.toolbarMode === 'simple');
    await editor.locator('#toolbar [data-action="undo"]').click();
    await editor.waitForFunction(() => document.querySelectorAll('#editor th').length === 2);
    assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), before);
    await editor.evaluate(() => {
        const range = document.createRange(); range.selectNodeContents([...document.querySelectorAll('#editor p')].find(node => node.textContent === 'After.')); range.collapse(false);
        document.getElementById('editor').focus(); getSelection().removeAllRanges(); getSelection().addRange(range);
    });
    await editor.waitForFunction(() => document.querySelector('.table-toolbar-row').hidden && document.querySelector('.table-toolbar-dock').hidden);
    record('contextual-row-action', { selectionRetained: true, sourcePreserved: true, undoAfterModeChange: true, rowRemovedWithContext: true });
}

module.exports = { source, rowGeometry, tableRowChecks };
