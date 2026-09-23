'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

exports.tableSourceFormatCase = async function tableSourceFormatCase(h, owner, record) {
    const file = 'table-source-format.md', filePath = path.join(owner.workspace, file);
    const compact = '| Item | Value |\n| --- | --- |\n| Long item | 3 |\n';
    const aligned = '| Item      | Value |\n| --------- | ----- |\n| Long item | 3     |\n';
    const prefix = '# Table source format\n\nParagraph target.\n\n', source = prefix + compact;
    const previous = (await h.driver({ action: 'inspect' })).tableSourceFormatScopes;
    const set = (scope, value) => h.driver({ action: 'config', key: 'tableSourceFormat', ...(scope === 'workspace' ? { scope } : {}), value });
    const saved = () => fs.readFileSync(filePath, 'utf8');
    const documentState = async () => (await h.driver({ action: 'inspect' })).documents.find(document => path.basename(document.path) === file);
    let connection;
    try {
        await h.driver({ action: 'close' });
        fs.writeFileSync(filePath, source);
        for (const scope of ['workspace', 'global']) await set(scope, null);
        connection = await h.open(file);
        assert.equal(await connection.evaluate('document.documentElement.dataset.tableSourceFormat'), 'aligned');
        await h.driver({ action: 'save' });
        assert.equal(saved(), source, 'Opening and saving with the new default does not migrate the source');
        await connection.evaluate(`(() => {
            window.__tableFormatParagraph = [...document.querySelectorAll('#editor > p')].find(node => node.textContent.startsWith('Paragraph '));
            const node = window.__tableFormatParagraph.firstChild, range = document.createRange();
            range.setStart(node, 10); range.setEnd(node, 16); document.getElementById('editor').focus();
            getSelection().removeAllRanges(); getSelection().addRange(range);
        })()`);
        const cases = [['global', 'compact', 'compact'], ['global', 'aligned', 'aligned'],
            ['workspace', 'compact', 'compact'], ['global', null, 'compact'],
            ['workspace', 'aligned', 'aligned'], ['workspace', null, 'aligned']];
        for (const [scope, value, effective] of cases) {
            await set(scope, value);
            await h.until(() => connection.evaluate(`document.documentElement.dataset.tableSourceFormat === '${effective}'`));
            assert.equal(await connection.evaluate(`window.__tableFormatParagraph === [...document.querySelectorAll('#editor > p')].find(node => node.textContent.startsWith('Paragraph ')) && getSelection().toString() === 'target'`), true);
            assert.equal((await documentState()).dirty, false);
            await h.driver({ action: 'save' });
            assert.equal(saved(), source);
            record('table-source-format-setting', { scope, value, effective, editorAndSelectionRetained: true, cleanSource: true });
        }

        // Changing the preference must not replace the existing undo stack.
        await connection.send('Input.insertText', { text: 'replacement' });
        await h.until(async () => (await documentState()).text.includes('replacement'));
        await set('global', 'compact');
        await h.until(() => connection.evaluate("document.documentElement.dataset.tableSourceFormat === 'compact'"));
        await connection.evaluate('document.querySelector("#toolbar [data-action=undo]").click()');
        await h.until(async () => (await documentState()).text === source);
        await h.driver({ action: 'save' });
        assert.equal(saved(), source);
        record('table-source-format-undo', { preferenceChangePreservesUndo: true, exactOriginalRestored: true });

        let marks = '';
        for (const [value, effective, table] of [[null, 'aligned', aligned], ['compact', 'compact', compact]]) {
            await set('global', value);
            await h.until(() => connection.evaluate(`document.documentElement.dataset.tableSourceFormat === '${effective}'`));
            await connection.evaluate(`(() => {
                const paragraph = [...document.querySelectorAll('#editor > p')].find(node => node.textContent.startsWith('Paragraph ')), range = document.createRange();
                range.selectNodeContents(paragraph); range.collapse(false); document.getElementById('editor').focus();
                getSelection().removeAllRanges(); getSelection().addRange(range);
            })()`);
            marks += '!';
            await connection.send('Input.insertText', { text: '!' });
            const expected = prefix.replace('target.', 'target.' + marks) + table;
            await h.until(async () => (await documentState()).text === expected, 'visual edit uses the selected table format');
            await h.driver({ action: 'save' });
            assert.equal(saved(), expected);
            await h.driver({ action: 'save' });
            assert.equal(saved(), expected, 'A repeated save is byte-stable');
            connection.close(); connection = null;
            await h.driver({ action: 'close' });
            connection = await h.open(file);
            assert.equal(await connection.evaluate('document.documentElement.dataset.tableSourceFormat'), effective);
            await h.driver({ action: 'save' });
            assert.equal(saved(), expected, 'Reopening preserves the preference and saved bytes');
            record('table-source-format-save', { effective, exactSpacing: true, repeatedSaveStable: true, reopened: true });
        }
    } finally {
        connection?.close();
        for (const scope of ['workspace', 'global']) await set(scope, previous[scope] ?? null);
    }
};
