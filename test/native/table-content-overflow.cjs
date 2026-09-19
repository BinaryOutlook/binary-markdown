'use strict';

const assert = require('node:assert/strict');

const headers = Array.from({ length: 8 }, (_, index) => `Column ${index + 1}`);
const values = headers.map((_, index) => `VALUE_${index + 1}_${'x'.repeat(28)}`);
const source = '# Wide table\n\nBefore.\n\n' +
    `| ${headers.join(' | ')} |\n| :--- | :---: | ---: | --- | --- | --- | --- | --- |\n` +
    `| ${values.join(' | ')} |\n| **Bold** | *Emphasis* | \`code\` | [Link](https://example.invalid) | Five | Six | Seven | Eight |\n\nAfter.\n`;

function tableCells() {
    return [...document.querySelectorAll('#editor th, #editor td')].map(cell => ({ tag: cell.tagName, text: cell.textContent, align: cell.style.textAlign }));
}

async function tableContentChecks({ editor, keyboard, resize, record }) {
    const before = await editor.evaluate(() => window.htmlToMarkdown());
    const cells = await editor.evaluate(tableCells);
    assert.equal(cells.length, 24);
    await resize(620, 560);
    const geometry = await editor.evaluate(() => {
        const table = document.querySelector('#editor table'), wrapper = document.getElementById('editorWrapper');
        return { width: table.clientWidth, contentWidth: table.scrollWidth, localOverflow: getComputedStyle(table).overflowX,
            wrapperWidth: wrapper.clientWidth, wrapperContentWidth: wrapper.scrollWidth };
    });
    assert.ok(geometry.contentWidth > geometry.width);
    assert.equal(geometry.localOverflow, 'auto');
    assert.ok(geometry.wrapperContentWidth <= geometry.wrapperWidth + 1);
    await editor.locator('#editor th').first().click();
    const selected = () => editor.evaluate(() => {
        const node = getSelection().anchorNode;
        const cell = (node.nodeType === 3 ? node.parentElement : node).closest('td,th');
        const table = cell.closest('table'), bounds = table.getBoundingClientRect();
        const wrapper = document.getElementById('editorWrapper').getBoundingClientRect();
        const caret = getSelection().getRangeAt(0).getBoundingClientRect();
        return { index: cell.parentElement.rowIndex * 8 + cell.cellIndex, visible: caret.height > 0 &&
            caret.left >= Math.max(bounds.left, wrapper.left, 0) - 1 && caret.right <= Math.min(bounds.right, wrapper.right, innerWidth) + 1 };
    });
    for (let index = 1; index < 24; index++) {
        await keyboard.press('Tab');
        assert.deepEqual(await selected(), { index, visible: true }, 'Tab reveals the selected source cell');
    }
    for (let index = 22; index >= 0; index--) {
        await keyboard.press('Shift+Tab');
        assert.deepEqual(await selected(), { index, visible: true }, 'Shift+Tab reveals the selected source cell');
    }
    await resize(500, 450);
    for (let index = 1; index < 16; index++) {
        await keyboard.press('Tab');
        assert.deepEqual(await selected(), { index, visible: true });
    }
    await keyboard.press('ArrowDown');
    assert.deepEqual(await selected(), { index: 23, visible: true });
    await keyboard.press('ArrowUp');
    assert.deepEqual(await selected(), { index: 15, visible: true });
    await keyboard.press('Alt+F10');
    assert.equal(await editor.evaluate(() => Boolean(document.activeElement?.closest('.table-toolbar, .table-toolbar-dock'))), true);
    if (await editor.evaluate(() => document.activeElement === document.querySelector('.table-toolbar-toggle'))) await keyboard.press('Enter');
    const sidebarWidth = await editor.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        const width = sidebar.style.width;
        sidebar.style.width = '300px';
        return width;
    });
    await keyboard.press('Escape');
    assert.deepEqual(await selected(), { index: 15, visible: true });
    await editor.evaluate(width => { document.querySelector('.sidebar').style.width = width; }, sidebarWidth);
    assert.deepEqual(await editor.evaluate(tableCells), cells);
    assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), before);
    assert.equal(await editor.evaluate(() => document.querySelector('#toolbar [data-action="undo"]').disabled), true);
    record('table-content', { geometry, forwardAndBackwardCells: 24, narrowPane: true, arrowNavigation: true,
        keyboardToolbarEntryAndEscape: true, formattingAndAlignmentPreserved: true, noUndoStep: true });
    await resize(1400, 1000);
    return cells;
}

module.exports = { source, tableCells, tableContentChecks };
