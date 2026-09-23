'use strict';
const assert = require('node:assert/strict');
const source = '# Width boundaries\n\nPlain target.\n\n| Item | State |\n| --- | --- |\n| One | Ready |\n\nEnd marker.\n';
function markerGeometry() {
    const column = document.getElementById('editor').getBoundingClientRect();
    const bounds = document.getElementById('editorWidthBounds').getBoundingClientRect();
    const guide = document.getElementById('editorWidthGuide');
    const pane = document.getElementById('editorWrapper');
    return { column: { left: column.left, right: column.right, width: column.width },
        marks: { left: bounds.left, right: bounds.right }, pane: pane.clientWidth,
        capped: guide.dataset.capped === 'true', hidden: guide.hidden,
        clearOfEditor: guide.getBoundingClientRect().bottom <= pane.getBoundingClientRect().top };
}
async function indicatorChecks({ editor, set, until, record }) {
    await editor.evaluate(() => {
        document.getElementById('closeSidebar').click();
        window.__indicatorParagraph = [...document.querySelectorAll('#editor > p')].find(node => node.textContent === 'Plain target.');
        const range = document.createRange(); range.selectNodeContents(window.__indicatorParagraph);
        document.getElementById('editor').focus(); getSelection().removeAllRanges(); getSelection().addRange(range);
    });
    const before = await editor.evaluate(() => ({ text: window.htmlToMarkdown(), selected: getSelection().toString() }));
    await set('editorWidthMode', 'custom'); await set('editorMaxWidth', 400); await set('editorWidthIndicators', true);
    for (const alignment of ['left', 'center', 'right']) {
        await set('editorAlignment', alignment);
        await until(async () => editor.evaluate(value => document.documentElement.dataset.editorAlignment === value && document.getElementById('editorWidthGuide').dataset.capped === 'true', alignment), 'capped width guide');
        const box = await editor.evaluate(markerGeometry);
        assert.ok(!box.hidden && box.clearOfEditor && box.capped);
        assert.ok(Math.abs(box.column.left - box.marks.left) < 1 && Math.abs(box.column.right - box.marks.right) < 1, JSON.stringify(box));
        assert.deepEqual(await editor.evaluate(() => ({ text: window.htmlToMarkdown(), selected: getSelection().toString() })), before);
        record('width-boundaries', { alignment, box, sourceAndSelectionPreserved: true });
    }
    await editor.evaluate(() => document.querySelector('.editor-width-mark').focus());
    assert.equal(await editor.evaluate(() => document.getElementById('editorWidthExplanation').hidden), false);
    assert.match(await editor.evaluate(() => document.getElementById('editorWidthExplanation').textContent), /Maximum document width reached/);
    await set('editorWidthIndicators', false);
    await until(async () => editor.evaluate(() => document.getElementById('editorWidthGuide').hidden), 'hidden width guide');
    assert.equal(await editor.evaluate(() => document.activeElement.id), 'editor');
    await set('editorWidthIndicators', true); await set('editorWidthMode', 'full');
    await until(async () => editor.evaluate(() => document.getElementById('editorWidthGuide').dataset.capped === 'false'), 'full width has no boundary marks');
    assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), before.text);
    assert.ok(await editor.evaluate(() => window.__indicatorParagraph.isConnected));
    assert.equal(await editor.evaluate(() => document.querySelector('#editor .editor-width-guide')), null);
    record('width-boundary-preference', { focusExplanation: true, hiddenSettingAndFullWidth: true, outsideDocument: true });
    return before.text;
}
module.exports = { source, markerGeometry, indicatorChecks };
