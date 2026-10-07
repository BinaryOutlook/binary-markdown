const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const editorRoot = path.resolve(__dirname, '../../src/webview');

function replaceGlobal(t, name, descriptor) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
    t.after(() => {
        if (previous) Object.defineProperty(globalThis, name, previous);
        else delete globalThis[name];
    });
}

test('every bootstrap service constructs without dependency reads, DOM access or listener registration', t => {
    // Follow the actual bootstrap inventory, including method factories wrapped
    // by controllers; unused legacy exports do not define bootstrap ordering.
    const bootstrap = fs.readFileSync(path.join(editorRoot, 'editor.js'), 'utf8');
    const factories = [...bootstrap.matchAll(/require\('\.\/editor\/([^']+)'\)\.(\w+)\(/g)];
    assert.ok(factories.length > 0, 'Discover the bootstrap service factories');
    for (const name of ['window', 'document']) {
        replaceGlobal(t, name, { get() { throw new Error(`Premature ${name} access`); } });
    }
    for (const [, moduleName, factoryName] of factories) {
        const label = `${moduleName}.${factoryName}`;
        const deny = operation => () => { throw new Error(`${label}: premature dependency ${operation}`); };
        const dependencies = new Proxy({}, {
            get: deny('read'), set: deny('write'), has: deny('probe'),
            ownKeys: deny('enumeration'), getOwnPropertyDescriptor: deny('descriptor read'),
        });
        const factory = require(path.join(editorRoot, 'editor', moduleName))[factoryName];
        assert.equal(typeof factory, 'function', label);
        let service;
        assert.doesNotThrow(() => { service = factory(dependencies); }, label);
        assert.ok(service && typeof service === 'object', `${label} returns a service`);
    }
});

test('repeating session initialization preserves an input edit, revision and pending notification', t => {
    const { createSession } = require('../../src/webview/editor/core/session');
    const listeners = new Map();
    const sourceEditor = {
        value: 'Original source\n',
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
    };
    let snapshots = 0;
    let previews = 0;
    const session = createSession({
        isSourceMode: true, sourceEditor,
        logger: { log() {} }, host: { syncContent() {} },
        scheduleSplitPreview: () => previews++, updateOutline() {},
    });
    session.initializeMarkdown();
    session.markdown = sourceEditor.value;
    session.initializeSaveTimeout1();
    session.initializeEditingIdleTimer2();
    const history = { saveSnapshotDebounced: () => snapshots++ };
    session.undoManager = history;
    session.initializeSourceEvents4();

    sourceEditor.value = 'Edited source\n';
    listeners.get('input')[0]();
    const notification = session.saveTimeout;
    t.after(() => clearTimeout(notification));
    assert.equal(session.markdown, sourceEditor.value);
    assert.equal(session.clientRevision, 1);
    assert.equal(snapshots, 1);
    assert.equal(previews, 1);

    session.initializeMarkdown();
    session.initializeSaveTimeout1();
    session.initializeEditingIdleTimer2();
    session.initializeSourceEvents4();
    assert.equal(session.markdown, 'Edited source\n');
    assert.equal(session.clientRevision, 1);
    assert.equal(session.hasUserEdited, true);
    assert.equal(session.visualSourceCurrent, false);
    assert.equal(session.saveTimeout, notification);
    assert.equal(session.undoManager, history);
    assert.equal(listeners.get('beforeinput').length, 1);
    assert.equal(listeners.get('input').length, 1);
    assert.equal(snapshots, 1);
    assert.equal(previews, 1);
});

test('repeating table initialization retains the focused cell and creates controls and listeners once', t => {
    const { createTables } = require('../../src/webview/editor/blocks/tables');
    const listeners = new Map();
    const shown = [];
    let scans = 0;
    let creations = 0;
    let controllerOptions;
    const table = {};
    const cell = { closest: selector => selector === 'table' ? table : selector === 'th, td' ? cell : null };
    const editor = {
        contains: node => node === table || node === cell,
        querySelectorAll: () => { scans++; return []; },
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
    };
    const controls = { show: (...context) => shown.push(context), clear() {} };
    replaceGlobal(t, 'window', { value: {
        BinaryTableToolbar: { create(options) {
            creations++;
            controllerOptions = options;
            return controls;
        } },
    } });
    const tables = createTables({
        editor, toolbar: {}, i18n: {}, LUCIDE_ICONS: {},
        isSourceMode: false, logger: { log() {} }, scheduleToolbarLayout() {}, host: {},
    });
    tables.initializeActiveTableCell();
    assert.equal(controllerOptions.editor, editor);
    listeners.get('focusin')[0]({ target: cell });
    assert.equal(tables.activeTableCell, cell);
    assert.equal(tables.activeTable, table);
    assert.deepEqual(shown, [[table, cell]]);

    tables.initializeActiveTableCell();
    assert.equal(tables.activeTableCell, cell);
    assert.equal(tables.activeTable, table);
    assert.equal(tables.tableControls, controls);
    assert.equal(creations, 1);
    assert.equal(scans, 1);
    assert.equal(listeners.get('mousedown').length, 1);
    assert.equal(listeners.get('focusin').length, 1);
    assert.equal(listeners.get('click').length, 1);
    assert.deepEqual(shown, [[table, cell]]);
});
