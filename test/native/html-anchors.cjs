'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = '# Anchors\n\n[Legacy section](#legacy-section)\n\n[Old section](#old-section)\n\n<a id="legacy-section"></a>\n\n<a name=\'old-section\'></a>\n\n## Renamed section\n\nEditable body\n';

async function htmlAnchorsCase(h, owner, record) {
    const file = 'html-anchors.md', filePath = path.join(owner.workspace, file);
    fs.writeFileSync(filePath, source);
    const state = async () => (await h.driver({ action: 'inspect' })).documents.find(item => path.relative(owner.workspace, item.path) === file);
    let connection = await h.open(file);
    let complete = false;
    try {
        const layout = await connection.evaluate(`(() => {
            const editor = document.getElementById('editor');
            const anchors = [...editor.querySelectorAll(':scope > .markdown-anchor')];
            return { anchors: anchors.map(node => ({ text: node.textContent, height: node.getBoundingClientRect().height,
                editable: node.getAttribute('contenteditable'), hidden: node.getAttribute('aria-hidden'),
                source: decodeURIComponent(node.dataset.anchorSource) })), visible: editor.innerText };
        })()`);
        assert.equal(layout.anchors.length, 2);
        assert.deepEqual(layout.anchors.map(node => node.source), ['<a id="legacy-section"></a>', "<a name='old-section'></a>"]);
        assert.ok(layout.anchors.every(node => !node.text && node.height === 0 && node.editable === 'false' && node.hidden === 'true'));
        assert.ok(!layout.visible.includes('<a '));
        assert.equal(await connection.evaluate('window.htmlToMarkdown()'), source);
        assert.equal((await state()).dirty, false);
        assert.equal(fs.readFileSync(filePath, 'utf8'), source);
        record('html-anchor-native-layout', { invisibleMetadata: true, exactSource: true, cleanOnOpen: true });

        for (const target of ['legacy-section', 'old-section']) {
            await connection.evaluate(`(() => {
                document.querySelector('#editor > h2').style.backgroundColor = '';
                document.querySelector(${JSON.stringify('#editor a[href="#' + target + '"]')}).click();
            })()`);
            await h.until(() => connection.evaluate('document.querySelector("#editor > h2").style.backgroundColor === "var(--selection-bg)"'), target + ' native fragment navigation');
            assert.equal(await connection.evaluate('window.htmlToMarkdown()'), source);
            assert.equal(await connection.evaluate('document.querySelector("[data-action=undo]").disabled'), true);
            assert.equal((await state()).dirty, false);
        }
        record('html-anchor-native-navigation', { idAndNameTargets: true, renamedHeadingReached: true, sourceAndUndoUnchanged: true });

        await connection.evaluate(`(() => {
            document.getElementById('editor').focus();
            const range = document.createRange(); range.selectNodeContents(document.querySelector('#editor > p:last-child')); range.collapse(false);
            getSelection().removeAllRanges(); getSelection().addRange(range);
        })()`);
        await h.workbench(page => page.keyboard.insertText('!'));
        const changed = source.replace('Editable body\n', 'Editable body!\n');
        await h.until(async () => (await state())?.text === changed, 'anchor body edit reaches host');
        await h.until(() => connection.evaluate('!document.querySelector("[data-action=undo]").disabled'), 'anchor Undo enabled');
        await connection.evaluate('document.querySelector("[data-action=undo]").click()');
        await h.until(async () => await connection.evaluate('window.htmlToMarkdown()') === source, 'anchor Undo preserves exact source');
        await h.until(() => connection.evaluate('!document.querySelector("[data-action=redo]").disabled'), 'anchor Redo enabled');
        await connection.evaluate('document.querySelector("[data-action=redo]").click()');
        await h.until(async () => (await state())?.text === changed, 'anchor Redo reaches host');
        await h.driver({ action: 'save' });
        assert.equal(fs.readFileSync(filePath, 'utf8'), changed);
        assert.equal((await state()).dirty, false);
        await h.sourceMode(connection);
        assert.equal(await connection.evaluate('document.getElementById("sourceEditor").value'), changed);
        await connection.evaluate('document.querySelector("[data-editor-mode=visual]").click()');
        assert.equal(await connection.evaluate('window.htmlToMarkdown()'), changed);
        connection.close(); connection = null;
        assert.equal((await h.driver({ action: 'closeFixture', file })).fixtureClose.closed, true);
        connection = await h.open(file);
        assert.equal(await connection.evaluate('window.htmlToMarkdown()'), changed);
        assert.equal(await connection.evaluate('document.querySelectorAll("#editor > .markdown-anchor").length'), 2);
        assert.equal((await state()).dirty, false);
        record('html-anchor-native-save-reopen', { realKeyboardEdit: true, undoRedo: true, sourceModeRoundTrip: true, exactSavedBytes: true, cleanAfterReopen: true });

        const output = await h.exportFile(connection, file, 'html');
        const html = fs.readFileSync(output.outputPath, 'utf8');
        const anchors = await connection.evaluate(`(() => {
            const exported = new DOMParser().parseFromString(${JSON.stringify(html)}, 'text/html');
            return [...exported.querySelectorAll('a[id="legacy-section"], a[name="old-section"]')].map(node => ({
                id: node.getAttribute('id'), name: node.getAttribute('name'), text: node.textContent,
                attributes: [...node.attributes].map(attribute => attribute.name) }));
        })()`);
        assert.deepEqual(anchors, [
            { id: 'legacy-section', name: null, text: '', attributes: ['id'] },
            { id: null, name: 'old-section', text: '', attributes: ['name'] }
        ]);
        assert.ok(!html.includes('data-anchor-source') && !html.includes('data-anchor-targets'));
        assert.ok(html.includes('Editable body!'));
        assert.equal(fs.readFileSync(filePath, 'utf8'), changed);
        record('html-anchor-installed-export', { format: 'html', inertIdAndNameAnchors: true, editorMetadataRemoved: true, sourceUnchanged: true });
        await h.workbench(page => page.screenshot({ path: path.join(owner.base, 'evidence', 'html-anchors.png') }));
        complete = true;
    } finally {
        connection?.close();
        const result = await h.driver({ action: 'closeFixture', file });
        if (complete) assert.equal(result.fixtureClose.closed, true, 'Close only the saved anchor fixture');
    }
}

module.exports = { source, htmlAnchorsCase };
