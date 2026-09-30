'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const text = '  const value = "' + 'abcdefghij'.repeat(80) + '";  \n\tconsole.log(value);\n\n';
const source = 'Before.\n\n```javascript\n' + text + '\n```\n\nAfter.\n';

async function codeBlockControlsCase(h, owner, record) {
    const file = 'code-block-controls.md', filePath = path.join(owner.workspace, file);
    fs.writeFileSync(filePath, source);
    const document = async () => (await h.driver({ action: 'inspect' })).documents.find(document => path.relative(owner.workspace, document.path) === file);
    let connection = await h.open(file);
    try {
        const scrolling = await connection.evaluate(`(() => {
            document.getElementById('closeSidebar').click();
            const pre = document.querySelector('#editor pre'), code = pre.querySelector('code'), header = pre.querySelector('.code-block-header');
            const before = header.getBoundingClientRect().x;
            code.scrollLeft = code.scrollWidth;
            return { before, after: header.getBoundingClientRect().x, scroll: code.scrollLeft,
                copyLabel: pre.querySelector('.code-copy-btn').getAttribute('aria-label'), icon: Boolean(pre.querySelector('.code-copy-btn svg')),
                wrap: pre.querySelector('.code-wrap-btn').getAttribute('aria-pressed'), notice: pre.querySelector('.code-wrap-notice').hidden };
        })()`);
        assert.ok(scrolling.scroll > 0); assert.equal(scrolling.before, scrolling.after);
        assert.equal(scrolling.copyLabel, 'Copy code'); assert.ok(scrolling.icon);
        assert.equal(scrolling.wrap, 'false'); assert.equal(scrolling.notice, true);
        record('code-controls-scrolling', { anchoredToolbar: true, codeAreaScrolls: true, iconCopy: true, wrapDefaultOff: true });

        await connection.evaluate('document.querySelector(".code-wrap-btn").click()');
        const wrapped = await connection.evaluate(`(() => {
            const pre = document.querySelector('#editor pre'), code = pre.querySelector('code');
            return { width: code.clientWidth, scroll: code.scrollWidth, pressed: pre.querySelector('.code-wrap-btn').getAttribute('aria-pressed'),
                notice: pre.querySelector('.code-wrap-notice').hidden, source: window.htmlToMarkdown(), undo: document.querySelector('[data-action="undo"]').disabled };
        })()`);
        assert.ok(wrapped.scroll <= wrapped.width + 1); assert.equal(wrapped.pressed, 'true'); assert.equal(wrapped.notice, false);
        assert.equal(wrapped.source, source); assert.equal(wrapped.undo, true); assert.equal((await document()).dirty, false);
        await h.driver({ action: 'save' }); assert.equal(fs.readFileSync(filePath, 'utf8'), source);
        await h.sourceMode(connection);
        assert.equal(await connection.evaluate('document.getElementById("sourceEditor").value'), source);
        await connection.evaluate('document.querySelector("[data-editor-mode=visual]").click()');
        assert.equal(await connection.evaluate('document.querySelector(".code-wrap-btn").getAttribute("aria-pressed")'), 'true');
        record('code-controls-wrap', { persistentNotice: true, sourceAndUndoUnchanged: true, nativeSaveAndSourceRoundTrip: true, clean: true });

        await connection.evaluate(`(() => {
            const code = document.querySelector('#editor pre code'); code.click();
            const range = document.createRange(); range.setStart(code.firstChild, 4); range.setEnd(code.firstChild, 9);
            getSelection().removeAllRanges(); getSelection().addRange(range);
            window.__codeControlsNode = code;
            window.__codeControlsSelection = getSelection().toString();
            document.querySelector('.code-wrap-btn').click(); document.querySelector('.code-wrap-btn').click();
        })()`);
        assert.equal(await connection.evaluate('document.querySelector("#editor pre").dataset.mode'), 'edit');
        assert.equal(await connection.evaluate('window.__codeControlsNode === document.querySelector("#editor pre code")'), true);
        assert.equal(await connection.evaluate('getSelection().toString() === window.__codeControlsSelection'), true);
        assert.equal(await connection.evaluate('window.htmlToMarkdown()'), source);
        record('code-controls-edit', { selectionAndCodeNodeRetained: true, activeEditRetained: true, sourceUnchanged: true });

        connection.close(); connection = null; await h.driver({ action: 'close' }); connection = await h.open(file);
        assert.equal(await connection.evaluate('document.querySelector(".code-wrap-btn").getAttribute("aria-pressed")'), 'false');
        assert.equal(fs.readFileSync(filePath, 'utf8'), source); assert.equal((await document()).dirty, false);
        record('code-controls-reopen', { wrapReset: true, exactFileBytes: true, clean: true });
    } finally {
        connection?.close(); await h.driver({ action: 'close' });
    }
}

module.exports = { codeBlockControlsCase };
