'use strict';
const assert = require('node:assert/strict');
const { geometry } = require('./editor-width.cjs');
const source = '# Alignment\n\nPlain target.\n\n$$\nx^2 + y^2\n$$\n\n```js\nconst value = 42;\n```\n\n| Center | Right |\n| :---: | ---: |\n| One | Two |\n\nEnd marker.\n';

async function alignmentChecks({ editor, set, until, record }) {
    await editor.evaluate(() => document.getElementById('closeSidebar').click());
    await set('editorMaxWidth', 400); await set('editorWidthMode', 'custom');
    await editor.evaluate(() => {
        window.__alignmentParagraph = [...document.querySelectorAll('#editor > p')].find(node => node.textContent === 'Plain target.');
        const range = document.createRange(); range.setStart(window.__alignmentParagraph.firstChild, 6); range.setEnd(window.__alignmentParagraph.firstChild, 12);
        document.getElementById('editor').focus(); getSelection().removeAllRanges(); getSelection().addRange(range);
    });
    const before = await editor.evaluate(() => ({ text: window.htmlToMarkdown(), selected: getSelection().toString(),
        alignments: [...document.querySelectorAll('#editor p, #editor td')].map(node => getComputedStyle(node).textAlign) }));
    for (const alignment of ['left', 'center', 'right']) {
        await set('editorAlignment', alignment);
        await until(async () => editor.evaluate(value => document.documentElement.dataset.editorAlignment === value, alignment), 'live column alignment');
        const box = await editor.evaluate(geometry);
        const unused = box.pane - box.width, expected = alignment === 'left' ? 0 : alignment === 'right' ? unused : unused / 2;
        assert.ok(Math.abs(box.left - expected) < 1, JSON.stringify({ alignment, box }));
        assert.deepEqual(await editor.evaluate(() => ({ text: window.htmlToMarkdown(), selected: getSelection().toString(),
            alignments: [...document.querySelectorAll('#editor p, #editor td')].map(node => getComputedStyle(node).textAlign) })), before);
        assert.ok(await editor.evaluate(() => window.__alignmentParagraph.isConnected));
        record('editor-alignment', { alignment, box, selectionAndSourcePreserved: true, textAlignmentUnchanged: true });
    }
    await editor.locator('.math-display').click();
    const math = await editor.evaluate(() => {
        window.__alignmentMath = document.querySelector('.math-wrapper code');
        const range = document.createRange(); range.selectNodeContents(window.__alignmentMath);
        getSelection().removeAllRanges(); getSelection().addRange(range);
        return { text: window.__alignmentMath.textContent, selection: getSelection().toString() };
    });
    for (const alignment of ['left', 'right', 'center']) {
        await set('editorAlignment', alignment);
        await until(async () => editor.evaluate(value => document.documentElement.dataset.editorAlignment === value, alignment), 'equation column alignment');
        assert.deepEqual(await editor.evaluate(() => ({ text: document.querySelector('.math-wrapper code').textContent, selection: getSelection().toString() })), math);
        const state = await editor.evaluate(() => ({ retained: window.__alignmentMath === document.querySelector('.math-wrapper code'), mode: document.querySelector('.math-wrapper').dataset.mode, active: document.activeElement.outerHTML.slice(0, 180) }));
        assert.ok(state.retained && state.mode === 'edit', JSON.stringify(state));
    }
    assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), before.text);
    record('editor-alignment-equation', { retainedInputAndSelection: true, sourceUnchanged: true });
    await editor.locator('#editor td').first().click();
    await until(async () => editor.evaluate(() => {
        const controls = document.querySelector('.table-toolbar:not(.table-toolbar-measure)');
        return controls && controls.getClientRects().length > 0;
    }), 'visible table controls');
    for (const alignment of ['left', 'center', 'right']) {
        await set('editorAlignment', alignment);
        await until(async () => editor.evaluate(value => {
            if (document.documentElement.dataset.editorAlignment !== value) return false;
            const table = document.querySelector('#editor table').getBoundingClientRect();
            const controls = document.querySelector('.table-toolbar:not(.table-toolbar-measure)').getBoundingClientRect();
            const pane = document.getElementById('editorWrapper').getBoundingClientRect();
            return controls.width > 0 && controls.left >= pane.left && controls.right <= pane.right + 1 && table.left >= pane.left;
        }, alignment), 'table controls follow aligned column');
    }
    assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), before.text);
    record('editor-alignment-table', { controlsWithinPane: true, sourceUnchanged: true });
    return before.text;
}

module.exports = { source, alignmentChecks };
