const test = require('node:test');
const assert = require('node:assert/strict');
const { createSearch } = require('../../src/webview/editor/ui/search');

function fixture() {
    let mutations = 0;
    const events = [];
    class Element {
        constructor() {
            this.style = { display: 'none' };
            this.dataset = {};
            this.children = [];
            this.listeners = [];
            this.value = '';
            this.checked = false;
            this.disabled = false;
            this.clientHeight = 400;
        }
        addEventListener(type, callback) { this.listeners.push({ type, callback }); }
        append(...children) { mutations++; this.children.push(...children); }
        appendChild(child) { this.append(child); }
        replaceChildren() { mutations++; this.children = []; }
        querySelector() { return null; }
        querySelectorAll() { return []; }
        setAttribute() {}
        focus() { events.push('focus'); }
        contains() { return false; }
        setSelectionRange(start, end) { events.push(['selection', start, end]); }
    }
    const elements = new Map();
    const document = new Element();
    document.getElementById = id => {
        if (!elements.has(id)) elements.set(id, new Element());
        return elements.get(id);
    };
    document.createElement = () => new Element();
    document.createTextNode = text => ({ textContent: text });
    const window = new Element();
    const workers = [];
    const timers = new Map();
    let timerSequence = 0;
    window.setTimeout = (callback, delay) => {
        const id = ++timerSequence;
        timers.set(id, { callback, delay });
        return id;
    };
    window.clearTimeout = id => timers.delete(id);
    window.getSelection = () => ({ rangeCount: 0, toString: () => '' });
    window.getComputedStyle = () => ({ lineHeight: '20' });
    window.innerWidth = 1024;
    window.CSS = { highlights: new Map() };
    window.Highlight = class {};
    window.Blob = class {};
    window.URL = { createObjectURL: () => 'blob:search-test', revokeObjectURL() {} };
    window.Worker = class {
        constructor() { this.terminated = false; workers.push(this); }
        postMessage(message) { this.message = message; }
        terminate() { this.terminated = true; }
    };
    const state = { source: 'alpha alpha', sourceMode: false, splitMode: false };
    const editor = new Element();
    const sourceEditor = new Element();
    sourceEditor.value = state.source;
    sourceEditor.selectionStart = 1;
    sourceEditor.selectionEnd = 4;
    const search = createSearch({
        document, window, editor, sourceEditor,
        i18n: { replaceSelected: 'Replace selected', searchTimeout: 'Search timed out' },
        searchWorkerProgram: 'search-test-worker',
        getSourceMode: () => state.sourceMode,
        getSplitMode: () => state.splitMode,
        readCommittedMarkdown: () => state.source,
        sourceDomPositions: () => [],
        editorRange: () => false,
        setEditorMode: mode => { state.sourceMode = mode === 'source'; },
        updateSourceCorrespondence: () => events.push('correspondence'),
        setMarkdown: source => { state.source = source; events.push(['source', source]); },
        saveSnapshot: () => events.push(['snapshot', state.source]),
        markAsEdited: () => events.push('edited'),
        cancelScheduledSync: () => events.push('cancel-sync'),
        scheduleSplitPreview: () => events.push('split-preview'),
        renderFromMarkdown: () => events.push('render'),
        setVisualSourceCurrent: value => events.push(['visual-current', value]),
        notifyChangeImmediate: () => events.push('notify'),
    });
    const reply = (worker, matches) => worker.onmessage({ data: {
        id: worker.message.id, matches, truncated: false,
    } });
    return { search, state, workers, timers, elements, editor, sourceEditor, document, window, events,
        reply, mutations: () => mutations };
}

test('search setup is deferred and repeat initialization does not duplicate listeners or controls', () => {
    const f = fixture();
    assert.equal(f.mutations(), 0);
    assert.equal(f.editor.listeners.length, 0);
    assert.equal(f.document.listeners.length, 0);
    f.search.initialize();
    const listenerCount = () => [...f.elements.values(), f.editor, f.sourceEditor, f.document, f.window]
        .reduce((count, element) => count + element.listeners.length, 0);
    const firstCount = listenerCount();
    const firstMutations = f.mutations();
    const selectedButton = f.search.replaceSelected;
    f.search.initialize();
    assert.equal(listenerCount(), firstCount);
    assert.equal(f.mutations(), firstMutations);
    assert.equal(f.search.replaceSelected, selectedButton);
    assert.ok(firstCount > 0);
});

test('stale search workers and changed source cannot install old results', () => {
    const f = fixture();
    f.search.initialize();
    f.search.searchInput.value = 'alpha';
    f.search.performSearch();
    const first = f.workers[0];
    f.search.performSearch();
    assert.equal(first.terminated, true);
    f.reply(first, [{ start: 0, end: 5, text: 'alpha' }]);
    assert.equal(f.search.searchCount.textContent, '0/0');
    const second = f.workers[1];
    f.state.source = 'changed alpha';
    f.reply(second, [{ start: 0, end: 5, text: 'alpha' }]);
    assert.equal(f.workers.length, 3);
    assert.equal(f.workers[2].message.source, 'changed alpha');
    assert.equal(f.search.searchCount.textContent, '0/0');
});

test('search uses live mode and replacement preserves snapshot and notification ordering', () => {
    const f = fixture();
    f.search.initialize();
    f.search.searchInput.value = 'alpha';
    f.search.performSearch();
    f.state.sourceMode = true;
    f.reply(f.workers[0], [{ start: 0, end: 5, text: 'alpha' }, { start: 6, end: 11, text: 'alpha' }]);
    assert.ok(f.events.some(event => Array.isArray(event) && event[0] === 'selection'));
    assert.equal(f.search.searchCount.textContent, '1/2');
    f.events.length = 0;
    f.search.replaceInput.value = 'beta';
    f.search.replaceCurrentMatch();
    assert.equal(f.state.source, 'beta alpha');
    assert.equal(f.sourceEditor.value, 'beta alpha');
    assert.deepEqual(f.events, [
        ['source', 'alpha alpha'], ['snapshot', 'alpha alpha'], 'edited',
        ['source', 'beta alpha'], 'cancel-sync', 'split-preview', ['visual-current', true], 'notify',
    ]);
});

test('a search worker reaches the existing deadline and is terminated', () => {
    const f = fixture();
    f.search.initialize();
    f.search.searchInput.value = 'alpha';
    f.search.performSearch();
    const deadline = [...f.timers.values()].find(timer => timer.delay === 500);
    assert.ok(deadline);
    deadline.callback();
    assert.equal(f.workers[0].terminated, true);
    assert.equal(f.search.searchFeedback.textContent, 'Search timed out');
});
