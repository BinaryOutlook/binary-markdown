const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { openInsert } = require('../native/insert-menu.cjs');
const { installedEditor } = require('../native/table-toolbar-overflow.cjs');

function fixture(t, overflow = false) {
    const dom = new JSDOM('<button id="insertButton">Insert</button><button id="toolbarMore">More</button><div id="insertMenu" hidden></div>', { runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const { document, HTMLElement } = dom.window;
    // No rendering callbacks arrive in this simulated suspended frame.
    let frames = 0;
    dom.window.requestAnimationFrame = () => { frames++; return frames; };
    HTMLElement.prototype.getClientRects = function () { return this.hidden ? [] : [{ width: 30, height: 20 }]; };
    HTMLElement.prototype.scrollIntoView = function () {};
    const button = document.getElementById('insertButton');
    button.hidden = overflow;
    document.getElementById('toolbarMore').onclick = () => { button.hidden = false; };
    button.onclick = () => { document.getElementById('insertMenu').hidden = false; };
    const connection = { evaluate: expression => Promise.resolve(vm.runInContext(expression, dom.getInternalVMContext())) };
    const harness = { until: async (callback, label) => {
        for (let attempt = 0; attempt < 3; attempt++) if (await callback()) return true;
        throw new Error('Bounded readiness timeout: ' + label);
    } };
    return { editor: installedEditor(connection, harness), document, frames: () => frames };
}

for (const overflow of [false, true]) {
    test('Insert opens without animation frames; overflow=' + overflow, { timeout: 2000 }, async t => {
        const { editor, document, frames } = fixture(t, overflow);
        await openInsert(editor);
        assert.equal(document.getElementById('insertMenu').hidden, false);
        assert.equal(frames(), 0);
    });
}

test('missing Insert controls produce bounded frame and focus diagnostics', async t => {
    const { editor, document } = fixture(t);
    document.getElementById('insertButton').remove();
    document.getElementById('toolbarMore').remove();
    await assert.rejects(openInsert(editor), error => {
        assert.match(error.message, /Insert-menu readiness failed: Bounded readiness timeout/);
        assert.match(error.message, /"readyState":/);
        assert.match(error.message, /"focused":/);
        assert.match(error.message, /"id":"insertButton","present":false/);
        return true;
    });
});
