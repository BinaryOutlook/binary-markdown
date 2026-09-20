'use strict';
const assert = require('node:assert/strict');

const source = '# Width checks\n\nPlain target.\n\n' + ('A paragraph that wraps as the editor width changes. '.repeat(20)) + '\n\n```js\nconst value = 42;\n```\n\n$$\nx^2 + y^2\n$$\n\n| First | Second | Third |\n| --- | --- | --- |\n| One | Two | Three |\n\nEnd marker.\n';

function geometry() {
    const editor = document.getElementById('editor'), wrapper = document.getElementById('editorWrapper');
    const bounds = editor.getBoundingClientRect(), pane = wrapper.getBoundingClientRect(), style = getComputedStyle(editor);
    return { width: bounds.width, pane: wrapper.clientWidth, left: bounds.left - pane.left,
        padding: parseFloat(style.paddingLeft), maximum: style.maxWidth, boxSizing: style.boxSizing };
}

async function widthChecks({ editor, set, until, record, capture = async () => {} }) {
    await editor.evaluate(() => {
        document.getElementById('closeSidebar').click();
        window.__widthParagraph = [...document.querySelectorAll('#editor > p')].find(node => node.textContent === 'Plain target.');
        const range = document.createRange(), node = window.__widthParagraph.firstChild;
        range.setStart(node, 6); range.setEnd(node, 12);
        document.getElementById('editor').focus(); getSelection().removeAllRanges(); getSelection().addRange(range);
    });
    const before = await editor.evaluate(() => ({ text: window.htmlToMarkdown(), selected: getSelection().toString() }));
    for (const [mode, maximum] of [['default', 860], ['custom', 320], ['custom', 1200], ['full', 1200], ['default', 1200]]) {
        await set('editorMaxWidth', maximum);
        await set('editorWidthMode', mode);
        await until(async () => editor.evaluate(({ mode, maximum }) => document.documentElement.dataset.editorWidthMode === mode &&
            document.documentElement.dataset.editorMaxWidth === String(maximum), { mode, maximum }), 'live editor width preference');
        const box = await editor.evaluate(geometry);
        const wanted = mode === 'full' ? box.pane : Math.min(box.pane, mode === 'default' ? 860 : maximum);
        assert.ok(Math.abs(box.width - wanted) < 1, JSON.stringify({ mode, maximum, box }));
        assert.ok(Math.abs(box.left - (box.pane - box.width) / 2) < 1, 'column stays centered');
        assert.equal(box.boxSizing, 'border-box');
        assert.ok(box.padding >= 12 && box.padding <= 60);
        assert.deepEqual(await editor.evaluate(() => ({ text: window.htmlToMarkdown(), selected: getSelection().toString() })), before);
        assert.ok(await editor.evaluate(() => window.__widthParagraph.isConnected));
        await capture(mode + '-' + maximum);
        record('editor-width', { mode, maximum, box, sourceAndSelectionPreserved: true, retainedDom: true });
    }
    return before.text;
}

module.exports = { source, geometry, widthChecks };
