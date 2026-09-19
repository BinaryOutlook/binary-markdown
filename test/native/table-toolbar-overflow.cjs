'use strict';

const assert = require('node:assert/strict');
const controls = '.table-toolbar:not(.table-toolbar-measure)';
const overflow = '.table-overflow-menu';

// Both installed VS Code and Electron supply actual window resizing and their
// real configuration bridge. No fixture-only editor APIs are used here.
async function tableOverflowChecks({ editor, keyboard, resize, setPosition, record }) {
    const source = await editor.evaluate(() => window.htmlToMarkdown());
    for (const position of ['top-left', 'left']) {
        await resize(1400, 1000);
        await setPosition(position);
        await editor.waitForFunction(value => document.documentElement.dataset.tableToolbarPosition === value, position);
        await editor.locator('#editor td').first().click();
        await editor.waitForFunction(({ controls, position }) => document.querySelector(controls).dataset.placement === position, { controls, position });
        await resize(520, 360);
        await editor.locator('#editor td').first().scrollIntoViewIfNeeded();
        const more = editor.locator(`${controls} [data-action="more"]`);
        await more.waitFor({ state: 'visible' });
        await editor.waitForFunction(controls => {
            const bar = document.querySelector(controls), bounds = bar.getBoundingClientRect();
            return [...bar.querySelectorAll('button')].filter(button => button.getClientRects().length).every(button => {
                const rect = button.getBoundingClientRect();
                return rect.left >= bounds.left && rect.right <= bounds.right + .5 && rect.top >= bounds.top && rect.bottom <= bounds.bottom + .5;
            });
        }, controls);
        await more.click();
        const actions = await editor.evaluate(({ controls, overflow }) => [controls, overflow].flatMap(selector =>
            [...document.querySelectorAll(`${selector} button:not([data-action="more"])`)].filter(button => button.getClientRects().length).map(button => button.dataset.action)), { controls, overflow });
        assert.deepEqual(actions, ['add-col-left', 'add-col-right', 'del-col', 'add-row-above', 'add-row-below', 'del-row', 'align-left', 'align-center', 'align-right', 'placement']);
        await keyboard.press('End');
        assert.equal(await editor.evaluate(() => document.activeElement.dataset.action), 'placement');
        await keyboard.press('Enter');
        await editor.locator('.table-placement-menu').waitFor({ state: 'visible' });
        await resize(490, 330);
        await editor.waitForFunction(() => {
            const rect = document.querySelector('.table-placement-menu').getBoundingClientRect();
            return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth + .5 && rect.bottom <= innerHeight + .5;
        });
        await keyboard.press('Escape');
        assert.equal(await editor.evaluate(() => document.querySelector('#editor td').contains(getSelection().anchorNode)), true);
        assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), source);
        const smallestViewport = await editor.evaluate(() => ({ width: innerWidth, height: innerHeight }));
        await resize(1400, 1000);
        await more.waitFor({ state: 'hidden' });
        assert.equal(await editor.locator('html').getAttribute('data-table-toolbar-position'), position);
        record('table-overflow', { position, wholeButtons: true, allActionsReachable: true, openPickerResized: true, sourceUnchanged: true,
            smallestViewport });
    }
    await resize(520, 360);
    await editor.locator('#editor td').first().scrollIntoViewIfNeeded();
    const action = editor.locator(`${controls} [data-action="add-row-below"]`);
    if (await action.isVisible()) await action.click();
    else {
        await editor.locator(`${controls} [data-action="more"]`).click();
        await editor.locator(`${overflow} [data-action="add-row-below"]`).click();
    }
    await editor.waitForFunction(() => document.querySelectorAll('#editor tr').length === 4);
    await editor.locator('#toolbar [data-action="undo"]').click();
    await editor.waitForFunction(() => document.querySelectorAll('#editor tr').length === 3);
    assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), source);
    record('table-overflow-action', { retainedCell: true, singleUndo: true });
    await resize(1400, 1000);
}

module.exports = { tableOverflowChecks };
