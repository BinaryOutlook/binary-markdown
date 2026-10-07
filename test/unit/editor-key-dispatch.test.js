const test = require('node:test');
const assert = require('node:assert/strict');
const { createDispatch } = require('../../src/webview/editor/input/dispatch');

const handlerNames = [
    'handleEarlyListBackspace', 'handlePlainShiftEnter', 'handleInlineShiftEnter',
    'handleTableEnter', 'handleCodeEnter', 'handleQuoteEnter', 'handleListEnter',
    'handleProseEnter', 'handleSpacePatterns', 'handleTableTab', 'handleCodeQuoteTab',
    'handleMultiListTab', 'handleSingleListTab', 'handleGeneralTab',
    'handleTableArrows', 'handleBlockArrows', 'handleBackspaceOnList',
    'handleFallbackEmptyList', 'handleParagraphInsideListDelete', 'handleParagraphDelete',
    'handleCodeSpecialDelete', 'handleHeadingQuoteDelete', 'handleRemainingListDelete',
];

function fixture(t) {
    const calls = [];
    const registrations = [];
    const outcomes = new Map();
    const state = { sourceMode: false };
    const editor = { addEventListener: (...args) => registrations.push(['editor', ...args]) };
    const paragraph = { nodeType: 1, tagName: 'P', closest: () => null, parentNode: editor };
    const range = { collapsed: true, startOffset: 1 };
    const selection = { rangeCount: 1, anchorNode: paragraph, getRangeAt: () => range };
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {
        configurable: true, writable: true,
        value: {
            getSelection: () => selection,
            addEventListener: (...args) => registrations.push(['window', ...args]),
        },
    });
    t.after(() => {
        if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
        else delete globalThis.window;
    });

    const dependencies = {
        editor,
        logger: { log() {} },
        get isSourceMode() { return state.sourceMode; },
        mathBackslashDelimiters: true,
        getCurrentLine: () => { calls.push('current-line'); return null; },
        undoManager: { saveSnapshot: () => calls.push('snapshot') },
        markActivelyEditing: () => calls.push('active'),
    };
    for (const name of handlerNames) {
        dependencies[name] = (...args) => {
            calls.push(name);
            const outcome = outcomes.get(name);
            return typeof outcome === 'function' ? outcome(...args) : outcome === true;
        };
    }
    const dispatch = createDispatch(dependencies);
    return { calls, registrations, outcomes, state, selection, dependencies, dispatch };
}

function keyEvent(key, overrides = {}) {
    return {
        key, target: { closest: () => null },
        shiftKey: false, ctrlKey: false, metaKey: false, isComposing: false, keyCode: 0,
        defaultPrevented: false, propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; },
        ...overrides,
    };
}

test('constructing dispatch repeatedly registers no listeners or editing work', t => {
    const f = fixture(t);
    const second = createDispatch(f.dependencies);
    assert.equal(typeof second.handleKeydown, 'function');
    assert.notEqual(second.handleKeydown, f.dispatch.handleKeydown);
    assert.deepEqual(f.registrations, []);
    assert.deepEqual(f.calls, []);
});

test('front matter and live Source mode bypass keyboard editing handlers', t => {
    const f = fixture(t);
    const frontMatter = keyEvent('Enter', { target: { closest: () => ({}) } });
    f.dispatch.handleKeydown(frontMatter);
    assert.deepEqual(f.calls, []);
    assert.equal(frontMatter.defaultPrevented, false);

    f.state.sourceMode = true;
    const source = keyEvent('Backspace');
    f.dispatch.handleKeydown(source);
    assert.deepEqual(f.calls, []);
    assert.equal(source.defaultPrevented, false);
});

for (const composing of [{ isComposing: true }, { keyCode: 229 }]) {
    test(`composing Enter skips editing handlers (${Object.keys(composing)[0]})`, t => {
        const f = fixture(t);
        const event = keyEvent('Enter', composing);
        f.dispatch.handleKeydown(event);
        // Keep the established snapshot timing, including the keyCode fallback.
        assert.deepEqual(f.calls, composing.isComposing
            ? ['active', 'snapshot'] : ['current-line', 'active', 'snapshot']);
        assert.equal(event.defaultPrevented, false);
    });
}

test('a true table arrow result stops dispatch without preventing browser default', t => {
    const f = fixture(t);
    f.outcomes.set('handleTableArrows', true);
    const event = keyEvent('ArrowDown');
    f.dispatch.handleKeydown(event);
    assert.deepEqual(f.calls, ['handleSpacePatterns', 'handleTableArrows']);
    assert.equal(event.defaultPrevented, false);
});

test('block arrow handling follows table handling only when the table declines', t => {
    const f = fixture(t);
    f.outcomes.set('handleBlockArrows', true);
    const event = keyEvent('ArrowUp');
    f.dispatch.handleKeydown(event);
    assert.deepEqual(f.calls, ['handleSpacePatterns', 'handleTableArrows', 'handleBlockArrows']);
    assert.equal(event.defaultPrevented, false);
});

test('table Tab navigation stops before taking an editing snapshot', t => {
    const f = fixture(t);
    f.outcomes.set('handleTableTab', (event, selection) => {
        assert.equal(selection, f.selection);
        assert.equal(event.defaultPrevented, true);
        return true;
    });
    const event = keyEvent('Tab');
    f.dispatch.handleKeydown(event);
    assert.deepEqual(f.calls, ['handleSpacePatterns', 'handleTableTab']);
    assert.equal(event.defaultPrevented, true);
});

test('Tab snapshots only after table navigation declines and stops at a handled code block', t => {
    const f = fixture(t);
    f.outcomes.set('handleCodeQuoteTab', true);
    const event = keyEvent('Tab');
    f.dispatch.handleKeydown(event);
    assert.deepEqual(f.calls, ['handleSpacePatterns', 'handleTableTab', 'snapshot', 'handleCodeQuoteTab']);
    assert.equal(event.defaultPrevented, true);
});

for (const modifier of ['ctrlKey', 'metaKey']) {
    test(`ordinary ${modifier} Select All stops dispatch while allowing browser selection`, t => {
        const f = fixture(t);
        const event = keyEvent('a', { [modifier]: true });
        assert.equal(f.dispatch.handleContextSelectAll(event), true);
        assert.equal(event.defaultPrevented, false);
        f.dispatch.handleKeydown(event);
        assert.deepEqual(f.calls, ['active']);
        assert.equal(event.defaultPrevented, false);
        assert.equal(event.propagationStopped, false);
    });
}
