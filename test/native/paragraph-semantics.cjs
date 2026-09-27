'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = '# Paragraphs\n\nAlpha\nBeta\n\nFirst  \nSecond\n\n```text\nline 1\n\nline 3\n```\n\nEnd\n';

async function paragraphSemanticsCase(h, owner, record) {
    const file = 'paragraph-semantics.md', filePath = path.join(owner.workspace, file);
    fs.writeFileSync(filePath, source);
    const state = async () => (await h.driver({ action: 'inspect' })).documents.find(document => path.relative(owner.workspace, document.path) === file);
    let connection = await h.open(file);
    try {
        const layout = await connection.evaluate(`(() => {
            const editor = document.getElementById('editor');
            const paragraphs = [...editor.querySelectorAll(':scope > p')];
            return { blocks: editor.children.length, paragraphs: paragraphs.length,
                empty: paragraphs.filter(p => !p.textContent.trim()).length,
                lines: paragraphs.slice(0, 2).map(p => p.getBoundingClientRect().height / parseFloat(getComputedStyle(p).lineHeight)) };
        })()`);
        assert.equal(layout.blocks, 5); assert.equal(layout.paragraphs, 3); assert.equal(layout.empty, 0);
        assert.ok(Math.abs(layout.lines[0] - 1) < .1 && Math.abs(layout.lines[1] - 2) < .1, JSON.stringify(layout));
        assert.equal((await state()).dirty, false);
        assert.equal(fs.readFileSync(filePath, 'utf8'), source);
        record('paragraph-source-layout', { ...layout, unchangedSource: true, cleanOnOpen: true });
        await connection.evaluate(`(() => {
            document.getElementById('editor').focus();
            const range = document.createRange(); range.selectNodeContents(document.querySelector('#editor > p:last-child')); range.collapse(false);
            getSelection().removeAllRanges(); getSelection().addRange(range);
        })()`);
        await h.workbench(async page => {
            await page.keyboard.insertText('!');
            await page.keyboard.press('Enter');
            await page.keyboard.insertText('New paragraph');
            await page.keyboard.press('Shift+Enter');
            await page.keyboard.insertText('New line');
        });
        const changed = source.replace('End\n', 'End!\n\nNew paragraph  \nNew line\n');
        await h.until(async () => (await state())?.text === changed, 'paragraph edit reaches host');
        await h.driver({ action: 'save' });
        assert.equal(fs.readFileSync(filePath, 'utf8'), changed);
        assert.equal((await state()).dirty, false);
        await h.sourceMode(connection);
        assert.equal(await connection.evaluate('document.getElementById("sourceEditor").value'), changed);
        connection.close(); connection = null;
        await h.driver({ action: 'close' });
        connection = await h.open(file);
        assert.equal(await connection.evaluate('window.htmlToMarkdown()'), changed);
        assert.equal(await connection.evaluate('document.querySelectorAll("#editor > p").length'), 4);
        assert.equal(await connection.evaluate('document.querySelectorAll("#editor > p:last-child br").length'), 1);
        record('paragraph-native-save-reopen', { enterParagraph: true, shiftEnterHardBreak: true, exactFileBytes: true, sourceMode: true, cleanAfterSave: true });
        const output = await h.exportFile(connection, file, 'html');
        const html = fs.readFileSync(output.outputPath, 'utf8');
        assert.ok(!html.includes('<p><br></p>') && !html.includes('data-md-source'));
        assert.ok(html.includes('New paragraph') && html.includes('New line'));
        assert.equal(fs.readFileSync(filePath, 'utf8'), changed);
        record('paragraph-installed-export', { format: 'html', noSeparatorParagraphs: true, sourceUnchanged: true });
        await h.workbench(page => page.screenshot({ path: path.join(owner.base, 'evidence', 'paragraph-semantics.png') }));
    } finally {
        connection?.close(); await h.driver({ action: 'close' });
    }
}

module.exports = { source, paragraphSemanticsCase };
