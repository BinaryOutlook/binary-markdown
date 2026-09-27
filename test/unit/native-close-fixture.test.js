const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { closeFixture } = require('../native/close-fixture.cjs');

function fixture(t) {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'native-close-fixture-'));
    t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
    const file = path.join(workspace, 'list.md');
    const uri = name => ({ scheme: 'file', fsPath: path.join(workspace, name) });
    class TabInputCustom {
        constructor(name, viewType = 'binary-markdown.editor') { this.uri = uri(name); this.viewType = viewType; }
    }
    const background = { input: new TabInputCustom('background.md'), isDirty: true };
    const list = { input: new TabInputCustom('list.md'), isDirty: false };
    const group = { tabs: [background, list], activeTab: list };
    const calls = [];
    const vscode = {
        TabInputCustom,
        workspace: { textDocuments: [{ uri: background.input.uri, isDirty: true }, { uri: list.input.uri, isDirty: false }] },
        window: { tabGroups: {
            all: [group],
            close: async (tabs, preserveFocus) => {
                calls.push({ tabs, preserveFocus });
                assert.ok(tabs.every(tab => !tab.isDirty), 'Closing a dirty tab would show a blocking save prompt');
                group.tabs = group.tabs.filter(tab => !tabs.includes(tab));
                if (tabs.includes(group.activeTab)) group.activeTab = group.tabs.at(-1);
                return true;
            }
        } }
    };
    return { vscode, file, background, list, group, calls, uri };
}

test('fixture cleanup keeps a seeded dirty background editor across consecutive closes', async t => {
    const h = fixture(t);
    assert.deepEqual(await closeFixture(h.vscode, h.file), { closed: true, reason: 'closed' });
    assert.equal(h.group.activeTab, h.background);
    // The old unscoped close at the next iteration would now close the dirty
    // background tab and wait indefinitely for a save-confirmation response.
    assert.deepEqual(await closeFixture(h.vscode, h.file), { closed: false, reason: 'not-open' });
    assert.deepEqual(h.group.tabs, [h.background]);
    assert.deepEqual(h.calls, [{ tabs: [h.list], preserveFocus: true }]);
});

test('fixture cleanup targets its background tab and leaves an unrelated active editor alone', async t => {
    const h = fixture(t);
    h.group.activeTab = h.background;
    assert.equal((await closeFixture(h.vscode, h.file)).closed, true);
    assert.equal(h.group.activeTab, h.background);
});

for (const dirtyState of ['tab', 'document']) {
    test('fixture cleanup preserves unsaved failure evidence when ' + dirtyState + ' is dirty', async t => {
        const h = fixture(t);
        if (dirtyState === 'tab') h.list.isDirty = true;
        else h.vscode.workspace.textDocuments[1].isDirty = true;
        assert.deepEqual(await closeFixture(h.vscode, h.file), { closed: false, reason: 'dirty' });
        assert.equal(h.calls.length, 0);
        assert.deepEqual(h.group.tabs, [h.background, h.list]);
    });
}

test('fixture cleanup excludes other editor types and non-file URIs', async t => {
    const h = fixture(t);
    h.group.tabs = [
        { input: { uri: h.uri('list.md') } },
        { input: new h.vscode.TabInputCustom('list.md', 'another.editor') },
        { input: Object.assign(new h.vscode.TabInputCustom('list.md'), { uri: { scheme: 'untitled', fsPath: h.file } }) }
    ];
    assert.deepEqual(await closeFixture(h.vscode, h.file), { closed: false, reason: 'not-open' });
    assert.equal(h.calls.length, 0);
});

test('fixture cleanup reports a declined close without closing another tab', async t => {
    const h = fixture(t);
    h.vscode.window.tabGroups.close = async (tabs, preserveFocus) => {
        assert.deepEqual(tabs, [h.list]);
        assert.equal(preserveFocus, true);
        return false;
    };
    assert.deepEqual(await closeFixture(h.vscode, h.file), { closed: false, reason: 'refused' });
    assert.equal(h.group.activeTab, h.list);
});
