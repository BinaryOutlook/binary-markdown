'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const samePath = (a, b) => process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : a === b;

// Deterministic message delivery, not a measurement of the natural race rate.
// All document text comes from actual editor input and the production snapshot.
async function saveCorrectnessCase(h, owner, record) {
    const file = 'save-correctness.md';
    const filePath = path.join(owner.workspace, file);
    const source = 'Before\n';
    const documentState = response => response.documents.find(document => samePath(document.path, filePath));
    let connection;
    let started = false;
    await h.driver({ action: 'autoSave', value: 'off' });
    fs.writeFileSync(filePath, source);
    try {
        connection = await h.open(file);
        await h.workbench(page => page.bringToFront());
        await connection.evaluate(`(() => {
            const editor = document.getElementById('editor'); editor.focus();
            const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false);
            getSelection().removeAllRanges(); getSelection().addRange(range);
        })()`);
        await connection.send('Input.insertText', { text: ' DIRTY-BASELINE' });
        const dirty = await h.until(async () => {
            const state = documentState(await h.driver({ action: 'inspect' }));
            return state?.dirty && state.text.includes('DIRTY-BASELINE') ? state : undefined;
        }, 'typed baseline reaches the dirty host document');
        assert.equal(fs.readFileSync(filePath, 'utf8'), source);

        await connection.evaluate(`(() => {
            if (window.__nativeSaveControl) throw new Error('A save delivery control is already installed');
            const bridge = window.hostBridge;
            const originalSync = bridge.syncContent;
            const originalReply = bridge.respondExport;
            const control = { syncs: [], snapshot: null, released: false };
            bridge.syncContent = content => { control.syncs.push(content); };
            bridge.respondExport = payload => {
                if (payload.type !== 'exportSnapshot') return originalReply.call(bridge, payload);
                if (control.snapshot) throw new Error('Unexpected second snapshot while delivery is controlled');
                control.snapshot = payload;
            };
            control.releaseEarlierEdit = () => {
                const content = control.syncs.find(value => value.includes('INTERMEDIATE') && !value.includes('LATEST'));
                if (typeof content !== 'string') throw new Error('No actual intermediate editor sync was captured');
                originalSync.call(bridge, content);
                return content;
            };
            control.releaseSnapshot = () => {
                if (!control.snapshot) throw new Error('The native save did not capture a snapshot');
                if (!control.released) { control.released = true; originalReply.call(bridge, control.snapshot); }
            };
            control.restore = () => {
                bridge.syncContent = originalSync;
                bridge.respondExport = originalReply;
                if (control.snapshot && !control.released) control.releaseSnapshot();
                // Preserve actual current editor text even if the assertion path
                // exits before the save completes. Never replay an older sync.
                const sourceEditor = document.getElementById('sourceEditor');
                const current = getComputedStyle(sourceEditor).display === 'none' ? window.htmlToMarkdown() : sourceEditor.value;
                originalSync.call(bridge, current);
                delete window.__nativeSaveControl;
            };
            window.__nativeSaveControl = control;
        })()`);
        await connection.send('Input.insertText', { text: ' INTERMEDIATE' });
        await h.until(() => connection.evaluate(`window.__nativeSaveControl.syncs.some(value => value.includes('INTERMEDIATE') && !value.includes('LATEST'))`),
            'real visual edit captured before controlled delivery');
        await h.sourceMode(connection);
        await connection.send('Input.insertText', { text: 'LATEST' });
        const expected = await connection.evaluate(`document.getElementById('sourceEditor').value`);
        assert.ok(expected.includes('INTERMEDIATE') && expected.includes('LATEST'));
        const beforeSave = documentState(await h.driver({ action: 'inspect' }));
        assert.equal(beforeSave.text, dirty.text);
        assert.equal(beforeSave.dirty, true);

        const start = await h.driver({ action: 'startNativeSave', file });
        started = true;
        assert.equal(start.nativeSave.state, 'running');
        const captured = await h.until(async () => {
            const value = await connection.evaluate(`window.__nativeSaveControl.snapshot?.content`);
            if (typeof value === 'string') return { content: value };
            const state = await h.driver({ action: 'inspect' });
            assert.equal(state.nativeSave?.state, 'running', 'Native Save must still wait for its real capture reply');
        }, 'native Save captures current source');
        assert.equal(captured.content, expected, 'Use the actual unmodified production snapshot');
        const intermediate = await connection.evaluate(`window.__nativeSaveControl.releaseEarlierEdit()`);
        const overlapping = await h.until(async () => {
            const response = await h.driver({ action: 'inspect' });
            assert.equal(response.nativeSave?.state, 'running', 'Observe the overlap before the native save participant finishes');
            const state = documentState(response);
            return state?.text === intermediate ? state : undefined;
        }, 'earlier host mutation completes during native save preparation');
        assert.ok(overlapping.version > beforeSave.version);
        assert.ok(!overlapping.text.includes('LATEST'));
        await connection.evaluate(`window.__nativeSaveControl.releaseSnapshot()`);
        const result = await h.driver({ action: 'finishNativeSave', file });
        started = false;
        const saved = documentState(result);
        assert.equal(fs.readFileSync(filePath, 'utf8'), expected, 'First native Save writes the newest captured text');
        assert.equal(saved.text, expected);
        assert.equal(saved.dirty, false);
        await connection.evaluate(`window.__nativeSaveControl.restore()`);
        record('native-save-queued-edit-overlap', {
            delivery: 'controlled delivery of actual visual-edit sync and unmodified source snapshot',
            nativeCommand: 'workbench.action.files.save', versionChangedDuringPreparation: true,
            capturedLatestText: true, firstSavePersistedSnapshot: true, bufferMatchesDisk: true, clean: true
        });

        connection.close(); connection = null;
        await h.driver({ action: 'close' });
        connection = await h.open(file);
        await h.sourceMode(connection);
        assert.equal(await connection.evaluate(`document.getElementById('sourceEditor').value`), expected);
        assert.equal(fs.readFileSync(filePath, 'utf8'), expected);
        assert.equal(documentState(await h.driver({ action: 'inspect' })).dirty, false);
        record('native-save-queued-edit-reopened', { newestTextRetained: true, sourceAndDiskMatch: true, clean: true });
    } finally {
        try {
            if (connection) await connection.evaluate(`window.__nativeSaveControl?.restore()`);
        } finally {
            try {
                if (started) {
                    const state = await h.driver({ action: 'inspect' });
                    if (state.nativeSave?.file === file) await h.driver({ action: 'finishNativeSave', file });
                }
            } finally { connection?.close(); }
        }
    }
}

module.exports = { saveCorrectnessCase };
