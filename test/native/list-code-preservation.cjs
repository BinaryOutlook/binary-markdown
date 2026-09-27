'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function listCodePreservationCase(h, owner, record) {
    const cases = [
        ...[0, 5, 10].map(start => ({
            name: 'ordered-start-' + start,
            source: `${start}. First\n${start + 1}. Second\n\nTail\n`,
            selector: '#editor > ol > li:nth-child(2)',
            expected: `${start}. First\n${start + 1}. Second!\n\nTail\n`, start
        })),
        { name: 'ordered-mixed-checklist', source: '3. [ ] Alpha\n4. [x] Beta\n5. Plain\n\nTail\n',
            selector: '#editor > ol > li:nth-child(2)',
            expected: '3. [ ] Alpha\n4. [x] Beta!\n5. Plain\n\nTail\n', start: 3 },
        { name: 'ordered-nested-checklist', source: '3. [ ] Parent\n\n   0. [x] Nested\n   1. Plain\n\n4. [x] Done\n',
            selector: '#editor > ol > li > ol > li:first-child',
            expected: '3. [ ] Parent\n\n   0. [x] Nested!\n   1. Plain\n\n4. [x] Done\n', start: 3 },
        ...[
            ['literal-br', '`<br>`', '`<br>`', '<br>'],
            ['padded-code', '`  Alpha  `', '`  Alpha  `', ' Alpha '],
            ['space-only-code', '`   `', '`   `', '   '],
            ['backtick-code', '`` `tick` ``', '``` `tick` ```', '`tick`']
        ].map(([name, before, after, code]) => ({ name, source: 'Code ' + before + ' tail\n',
            selector: '#editor > p', expected: 'Code ' + after + ' tail!\n', codes: [code] })),
        { name: 'table-inline-code', source: '| Code | Value |\n| --- | --- |\n| `<br>` | one |\n| `  Alpha  ` | two |\n| `   ` | three |\n',
            selector: '#editor table tbody tr:last-child td:last-child',
            expected: '| Code | Value |\n| --- | --- |\n| `<br>` | one |\n| `  Alpha  ` | two |\n| `   ` | three! |\n',
            compact: true, codes: ['<br>', ' Alpha ', '   '] }
    ];
    for (const fixture of cases) {
        const file = fixture.name + '.md', filePath = path.join(owner.workspace, file);
        await h.driver({ action: 'close' });
        const previousFormat = (await h.driver({ action: 'inspect' })).tableSourceFormatScopes;
        let connection;
        const state = async () => (await h.driver({ action: 'inspect' })).documents.find(item => path.relative(owner.workspace, item.path) === file);
        try {
            if (fixture.compact) await h.driver({ action: 'config', key: 'tableSourceFormat', scope: 'workspace', value: 'compact' });
            fs.writeFileSync(filePath, fixture.source);
            connection = await h.open(file);
            if (fixture.start !== undefined) assert.equal(await connection.evaluate('Number(document.querySelector("#editor > ol").getAttribute("start") || 1)'), fixture.start);
            if (fixture.codes) assert.deepEqual(await connection.evaluate('[...document.querySelectorAll("#editor code")].map(node => node.textContent)'), fixture.codes);
            assert.equal((await state()).dirty, false);
            const originalText = await connection.evaluate('document.getElementById("editor").textContent');
            await connection.evaluate(`(() => {
                document.getElementById('editor').focus();
                const node = document.querySelector(${JSON.stringify(fixture.selector)});
                if (!node) throw new Error('Expected editable fixture item');
                const range = document.createRange(); range.selectNodeContents(node); range.collapse(false);
                getSelection().removeAllRanges(); getSelection().addRange(range);
            })()`);
            await h.workbench(page => page.keyboard.insertText('!'));
            await h.until(async () => await connection.evaluate('window.htmlToMarkdown()') === fixture.expected, fixture.name + ' visual edit');
            await h.until(() => connection.evaluate('!document.querySelector("[data-action=undo]").disabled'), fixture.name + ' Undo enabled');
            await connection.evaluate('document.querySelector("[data-action=undo]").click()');
            assert.equal(await connection.evaluate('document.getElementById("editor").textContent'), originalText, 'Undo restores the edited tail or cell');
            if (fixture.codes) assert.deepEqual(await connection.evaluate('[...document.querySelectorAll("#editor code")].map(node => node.textContent)'), fixture.codes);
            else assert.equal(await connection.evaluate('window.htmlToMarkdown()'), fixture.source);
            await h.until(() => connection.evaluate('!document.querySelector("[data-action=redo]").disabled'), fixture.name + ' Redo enabled');
            await connection.evaluate('document.querySelector("[data-action=redo]").click()');
            await h.until(async () => await connection.evaluate('window.htmlToMarkdown()') === fixture.expected, fixture.name + ' Redo restores edit', () => connection.evaluate('({ markdown: window.htmlToMarkdown(), active: document.activeElement?.id })'));
            await h.until(async () => (await state())?.text === fixture.expected, fixture.name + ' reaches host', async () => ({ host: await state(), visual: await connection.evaluate('window.htmlToMarkdown()') }));
            await h.driver({ action: 'save' });
            assert.equal(fs.readFileSync(filePath, 'utf8'), fixture.expected);
            assert.equal((await state()).dirty, false);
            await h.sourceMode(connection);
            assert.equal(await connection.evaluate('document.getElementById("sourceEditor").value'), fixture.expected);
            connection.close(); connection = null;
            await h.driver({ action: 'close' }); connection = await h.open(file);
            assert.equal(await connection.evaluate('window.htmlToMarkdown()'), fixture.expected);
            if (fixture.start !== undefined) assert.equal(await connection.evaluate('Number(document.querySelector("#editor > ol").getAttribute("start") || 1)'), fixture.start);
            if (fixture.codes) assert.deepEqual(await connection.evaluate('[...document.querySelectorAll("#editor code")].map(node => node.textContent)'), fixture.codes);
            record(fixture.codes ? 'inline-code-preservation-native' : 'list-preservation-native', { case: fixture.name, realKeyboardEdit: true, undoRedo: true,
                sourceMode: true, exactSavedBytes: true, cleanAfterSave: true, reopened: true });
        } finally {
            try { connection?.close(); await h.driver({ action: 'close' }); }
            finally {
                if (fixture.compact) await h.driver({ action: 'config', key: 'tableSourceFormat', scope: 'workspace', value: previousFormat.workspace ?? null });
            }
        }
    }
}

module.exports = { listCodePreservationCase };
