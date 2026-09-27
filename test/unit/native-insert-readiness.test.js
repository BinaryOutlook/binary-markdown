const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { openInsert, selectQuickInputItem } = require('../native/insert-menu.cjs');
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

function quickInputFixture(t) {
    const dom = new JSDOM('<div class="quick-input-widget"><input><div id="parent" class="monaco-list-row" aria-label=".."></div><div id="other" class="monaco-list-row" aria-label="other.png"></div><div id="target" class="monaco-list-row" aria-label="Field sample 图像.png"></div></div>', { runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const { document, HTMLElement, KeyboardEvent } = dom.window;
    let frames = 0;
    dom.window.requestAnimationFrame = () => { frames++; return frames; };
    HTMLElement.prototype.getClientRects = () => [{ width: 100, height: 20 }];
    const rows = [...document.querySelectorAll('.monaco-list-row')];
    let index = -1;
    let accepted;
    document.querySelector('input').addEventListener('keydown', event => {
        if (event.key === 'ArrowDown') {
            rows.forEach(row => row.classList.remove('focused'));
            index = (index + 1) % rows.length;
            rows[index].classList.add('focused');
        }
        if (event.key === 'Enter') accepted = rows[index]?.getAttribute('aria-label');
    });
    const page = {
        evaluate: fn => Promise.resolve(vm.runInContext('(' + fn.toString() + ')()', dom.getInternalVMContext())),
        locator: () => ({ first: () => ({ focus: async () => document.querySelector('input').focus() }) }),
        keyboard: { press: async key => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })) }
    };
    const until = async (callback, label) => {
        for (let attempt = 0; attempt < 3; attempt++) { const value = await callback(); if (value) return value; }
        throw new Error('Bounded picker timeout: ' + label);
    };
    return { page, until, accepted: () => accepted, frames: () => frames };
}

test('native image picker uses observed keyboard focus without animation frames', async t => {
    const h = quickInputFixture(t);
    await selectQuickInputItem(h.page, 'Field sample 图像.png', h.until);
    assert.equal(h.accepted(), 'Field sample 图像.png');
    assert.equal(h.frames(), 0);
});

test('missing native image picker row reports bounded observed options without accepting another file', async t => {
    const h = quickInputFixture(t);
    await assert.rejects(selectQuickInputItem(h.page, 'missing.png', h.until), error => {
        assert.match(error.message, /Quick Input selection failed: Bounded picker timeout/);
        assert.match(error.message, /Field sample 图像.png/);
        return true;
    });
    assert.equal(h.accepted(), undefined);
});
