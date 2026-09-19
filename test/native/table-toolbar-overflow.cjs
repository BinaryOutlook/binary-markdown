'use strict';

const assert = require('node:assert/strict');
const controls = '.table-toolbar:not(.table-toolbar-measure)';
const overflow = '.table-overflow-menu';

// Both hosts use their real configuration bridge. Electron resizes its window;
// VS Code constrains the installed editor frame because Electron does not expose
// Browser.setWindowBounds there. No fixture-only editor APIs are used here.
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
        await editor.locator(overflow).waitFor({ state: 'visible' });
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

// VS Code's inner webview is not consistently exposed as a Playwright Frame.
// Use the harness's ownership-checked CDP context and production DOM actions.
// Pointer hit testing is covered by the browser and Electron checks separately.
function installedEditor(connection, h) {
    const evaluate = (fn, argument) => connection.evaluate(`(${fn.toString()})(${JSON.stringify(argument) ?? 'undefined'})`);
    const locator = selector => {
        const visible = () => evaluate(selector => {
            const node = document.querySelector(selector);
            return Boolean(node?.getClientRects().length) && getComputedStyle(node).visibility !== 'hidden';
        }, selector);
        const reveal = () => evaluate(selector => document.querySelector(selector).scrollIntoView({ block: 'nearest', inline: 'nearest' }), selector);
        const result = {
            first: () => result, isVisible: visible,
            scrollIntoViewIfNeeded: reveal,
            getAttribute: name => evaluate(({ selector, name }) => document.querySelector(selector).getAttribute(name), { selector, name }),
            waitFor: ({ state }) => h.until(async () => (await visible()) === (state === 'visible'), selector + ' becomes ' + state),
            click: async () => {
                await h.until(visible, 'visible control: ' + selector);
                await reveal();
                await evaluate(selector => {
                    const node = document.querySelector(selector);
                    if (node.disabled) throw new Error('Cannot click a disabled control');
                    if (node.matches('td,th')) {
                        document.getElementById('editor').focus({ preventScroll: true });
                        const range = document.createRange(); range.selectNodeContents(node); range.collapse(true);
                        getSelection().removeAllRanges(); getSelection().addRange(range);
                    }
                    node.click();
                }, selector);
            },
        };
        return result;
    };
    return { evaluate, locator, waitForFunction: (fn, argument) => h.until(() => evaluate(fn, argument), 'installed overflow state') };
}

module.exports = { tableOverflowChecks, installedEditor };
