'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { replaceFile } = require('./replace-file.cjs');

// Issue #81: another program's write must not discard unsaved visual edits.
// Every document is synthetic. Warning, status bar and Overwrite controls are
// activated through their DOM handlers in the owned workbench, as the other
// installed checks do; the typing race uses controlled delivery of real
// editor messages. Waits follow observable events rather than fixed delays.
const samePath = (a, b) => process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : a === b;
const saveModifiers = () => process.platform === 'darwin' ? 4 : 2; // Meta+S or Ctrl+S
// VS Code builds toasts, status items and diff lines on animation frames, which
// a covered or background window does not run. A one-pixel capture forces one.
const painted = async page => {
    await page.bringToFront();
    await page.screenshot({ clip: { x: 0, y: 0, width: 1, height: 1 }, timeout: 10000 });
    return page;
};

function scenario(h, owner, file) {
    const filePath = path.join(owner.workspace, file);
    const notice = `'${file}' was changed on disk while you have unsaved edits. Your edits are kept.`;
    const state = async () => (await h.driver({ action: 'inspect' })).documents.find(document => samePath(document.path, filePath));
    const until = (predicate, label) => h.until(async () => (await predicate()) || undefined, label + ' for ' + file);
    const disk = () => fs.readFileSync(filePath, 'utf8');
    // Another program replaces the file atomically, as editors and tools do.
    const writeExternally = content => {
        const temporary = path.join(owner.workspace, '.external-writer.tmp');
        fs.writeFileSync(temporary, content);
        replaceFile(temporary, filePath);
    };
    const toasts = page => page.locator('.notifications-toasts .notification-list-item').filter({ hasText: notice });
    const conflictNotices = () => h.workbench(async page => toasts(await painted(page)).count());
    const waitForNotice = () => until(async () => await conflictNotices() > 0, 'conflict notification');
    const choose = label => h.workbench(async page => toasts(await painted(page)).first().getByRole('button', { name: label }).dispatchEvent('click'));
    const dismissNotices = () => h.workbench(async page => {
        for (const item of await toasts(await painted(page)).all()) {
            await item.getByRole('button', { name: /clear notification/i }).dispatchEvent('click');
        }
    });
    const statusItem = page => page.locator('.statusbar-item', { hasText: 'Changed on disk' });
    const statusShown = () => h.workbench(async page => statusItem(await painted(page)).count());
    const clickStatus = () => h.workbench(async page => statusItem(await painted(page)).first().locator('a').first().dispatchEvent('click'));
    const diffTabs = page => page.locator('.tabs-container .tab', { hasText: file + ' (on disk)' });
    const waitForDiff = () => until(() => h.workbench(async page => diffTabs(await painted(page)).count()), 'Compare diff tab');
    const compared = () => h.workbench(async page => (await painted(page)).locator('.monaco-diff-editor .editor.original .view-lines').first().innerText());
    // Record the editor's typing state, save results and host updates.
    const observe = connection => connection.evaluate(`(() => {
        const bridge = window.hostBridge, report = bridge.reportEditingState;
        window.__conflictProbe = { editing: null, saveResults: [], updates: [] };
        bridge.reportEditingState = editing => { window.__conflictProbe.editing = editing; report.call(bridge, editing); };
        window.addEventListener('message', event => {
            if (event.data?.type === 'saveResult') window.__conflictProbe.saveResults.push(event.data.success);
            if (event.data?.type === 'update') window.__conflictProbe.updates.push(event.data.revision);
        });
    })()`);
    // The editor reports idle 1.5 s after typing stops: the issue's idle case.
    const waitIdle = connection => until(() => connection.evaluate('window.__conflictProbe.editing === false'), 'editor idle report');
    const focusEnd = connection => connection.evaluate(`(() => {
        const editor = document.getElementById('editor'); editor.focus();
        const range = document.createRange(); range.selectNodeContents(editor.lastElementChild || editor); range.collapse(false);
        getSelection().removeAllRanges(); getSelection().addRange(range);
    })()`);
    const keyboardSave = async connection => {
        for (const type of ['keyDown', 'keyUp']) await connection.send('Input.dispatchKeyEvent', { type, key: 's', code: 'KeyS', modifiers: saveModifiers() });
    };
    const shown = connection => connection.evaluate(`getComputedStyle(document.getElementById('sourceEditor')).display === 'none'
        ? document.getElementById('editor').innerText : document.getElementById('sourceEditor').value`);
    const typed = (connection, marker) => until(async () => { const value = await state(); return value?.dirty && value.text.includes(marker); },
        'typed text reaches the dirty host document');
    const clean = predicate => until(async () => { const value = await state(); return value && !value.dirty && predicate(value.text) ? value : undefined; },
        'clean document');
    // Leave no diff tab, warning or dirty fixture behind for the next scenario.
    const cleanUp = async () => {
        await h.driver({ action: 'closeDiff', file });
        await dismissNotices();
        await h.driver({ action: 'closeFixture', file });
    };
    return {
        filePath, state, until, disk, writeExternally, conflictNotices, waitForNotice, choose, dismissNotices, statusShown, clickStatus,
        waitForDiff, compared, observe, waitIdle, focusEnd, keyboardSave, shown, typed, clean, cleanUp
    };
}

async function externalConflictCase(h, owner, record) {
    await h.driver({ action: 'autoSave', value: 'off' });
    // VS Code can keep a closed file's buffer and reload it later. New names
    // keep a repeated run from racing that reload.
    const run = Date.now().toString(36);
    await idleConflictCase(h, owner, record, `external-conflict-${run}.md`);
    await saveDuringConflictCase(h, owner, record, `external-conflict-native-${run}.md`, 'visual', 'native');
    await saveDuringConflictCase(h, owner, record, `external-conflict-keyboard-${run}.md`, 'source', 'keyboard');
    await ownSaveEchoCase(h, owner, record, `external-conflict-echo-${run}.md`);
    await typingRaceCase(h, owner, record, `external-conflict-race-${run}.md`);
}

// The issue's reproduction, then the status bar route, Compare, Load Disk
// Version and Undo.
async function idleConflictCase(h, owner, record, file) {
    const s = scenario(h, owner, file);
    const base = '# External conflict\n\nBASE-MARKER\n';
    fs.writeFileSync(s.filePath, base);
    let connection;
    try {
        connection = await h.open(file);
        await h.workbench(page => page.bringToFront());
        await s.observe(connection);
        await s.focusEnd(connection);
        await connection.send('Input.insertText', { text: ' LOCAL-UNSAVED-MARKER' });
        await s.typed(connection, 'LOCAL-UNSAVED-MARKER');
        assert.equal(s.disk(), base);
        await s.waitIdle(connection);

        s.writeExternally('# External conflict\n\nEXTERNAL-MARKER\n');
        await s.waitForNotice();
        const kept = await s.state();
        assert.equal(kept.dirty, true, 'The document keeps its unsaved state');
        assert.ok(kept.text.includes('LOCAL-UNSAVED-MARKER') && !kept.text.includes('EXTERNAL-MARKER'), 'The buffer keeps the local edit');
        assert.ok((await s.shown(connection)).includes('LOCAL-UNSAVED-MARKER'), 'The visual editor keeps the local edit');
        assert.ok(s.disk().includes('EXTERNAL-MARKER'), 'The external revision stays on disk');
        assert.equal(await s.conflictNotices(), 1);
        record('external-conflict-idle', { unsavedEditKept: true, documentDirty: true, externalRevisionOnDisk: true, oneNotification: true });

        // A closed warning stays reachable from the status bar.
        assert.ok(await s.statusShown() > 0, 'The status bar shows the unresolved conflict');
        await s.dismissNotices();
        await s.until(async () => await s.conflictNotices() === 0, 'closed warning');
        assert.ok(await s.statusShown() > 0, 'Closing the warning keeps the conflict');
        await s.clickStatus();
        await s.waitForNotice();
        record('external-conflict-status', { statusShown: true, keptAfterClosingWarning: true, statusReopensChoices: true });

        // Later writes update the retained revision without another warning.
        s.writeExternally('# External conflict\n\nEXTERNAL-SECOND\n');
        // Compare reads the file again, so it shows the write immediately.
        await s.choose('Compare');
        await s.waitForDiff();
        await s.until(async () => (await s.compared()).includes('EXTERNAL-SECOND'), 'Compare shows the latest external revision');
        await s.waitForNotice();
        assert.equal(await s.conflictNotices(), 1, 'One warning per conflict');
        assert.ok((await s.state()).text.includes('LOCAL-UNSAVED-MARKER'));
        record('external-conflict-compare', { diffOpened: true, latestExternalRevisionShown: true, choicesOfferedAgain: true, laterWriteNotRepeated: true });

        await s.choose('Load Disk Version');
        const loaded = await s.clean(text => text.includes('EXTERNAL-SECOND'));
        assert.ok(!loaded.text.includes('LOCAL-UNSAVED-MARKER'));
        assert.equal(s.disk(), loaded.text);
        await s.until(async () => (await s.shown(connection)).includes('EXTERNAL-SECOND'), 'the editor shows the loaded revision');
        await s.until(async () => await s.statusShown() === 0, 'status cleared after loading');

        await connection.evaluate(`document.querySelector('[data-action="undo"]').click()`);
        await s.typed(connection, 'LOCAL-UNSAVED-MARKER');
        assert.ok(s.disk().includes('EXTERNAL-SECOND'), 'Undo does not write to disk');
        record('external-conflict-load', { explicitLoadClean: true, editorShowsLoadedRevision: true, statusCleared: true, undoRestoresDiscardedEdit: true });

        await h.driver({ action: 'save' }); // Leave the fixture clean.
        await s.clean(text => text.includes('LOCAL-UNSAVED-MARKER'));
    } finally {
        connection?.close();
        await s.cleanUp();
    }
}

// Saving while a conflict is open, through VS Code's Save or the editor's own
// keyboard shortcut, in visual or Source mode. VS Code compares the file's
// size, so the external revision here is longer than the original.
async function saveDuringConflictCase(h, owner, record, file, mode, save) {
    const s = scenario(h, owner, file);
    fs.writeFileSync(s.filePath, '# Save during conflict\n\nBASE\n');
    let connection;
    try {
        connection = await h.open(file);
        await h.workbench(page => page.bringToFront());
        await s.observe(connection);
        if (mode === 'source') await h.sourceMode(connection);
        else await s.focusEnd(connection);
        await connection.send('Input.insertText', { text: ' LOCAL' });
        await s.typed(connection, 'LOCAL');
        if (mode === 'visual') await s.waitIdle(connection);

        s.writeExternally('# Save during conflict\n\nA LONGER EXTERNAL REVISION\n');
        await s.waitForNotice();
        assert.ok((await s.shown(connection)).includes('LOCAL'), `The ${mode} editor keeps the local edit`);
        assert.equal((await s.state()).dirty, true);

        if (save === 'native') await h.driver({ action: 'save' });
        else await s.keyboardSave(connection);
        const newer = page => page.locator('.notifications-toasts .notification-list-item', { hasText: /content of the file is newer/i });
        const prompt = await s.until(async () => {
            if (await h.workbench(async page => newer(await painted(page)).count())) return 'prompt';
            if (s.disk().includes('LOCAL')) return 'saved';
        }, 'VS Code prompt or completed save');
        const observation = { mode, save, vscodeConflictPrompt: prompt === 'prompt', savedWithoutPrompt: prompt === 'saved' };
        if (prompt === 'prompt') {
            assert.ok(!s.disk().includes('LOCAL'), 'Nothing is written before the user confirms');
            await h.workbench(async page => newer(await painted(page)).first().getByRole('button', { name: 'Overwrite' }).dispatchEvent('click'));
        }
        await s.clean(text => text.includes('LOCAL'));
        assert.ok(s.disk().includes('LOCAL'), 'The kept local edit is saved after the user confirms');
        record('external-conflict-save', observation);
    } finally {
        connection?.close();
        await s.cleanUp();
    }
}

// A delayed file notification for our own save must not replace text typed
// after that save, and a later real external write is still reported.
async function ownSaveEchoCase(h, owner, record, file) {
    const s = scenario(h, owner, file);
    fs.writeFileSync(s.filePath, '# Own save echo\n\nBASE\n');
    let connection;
    try {
        connection = await h.open(file);
        await h.workbench(page => page.bringToFront());
        await s.observe(connection);
        await s.focusEnd(connection);
        await connection.send('Input.insertText', { text: ' SAVED-TEXT' });
        await s.typed(connection, 'SAVED-TEXT');
        await h.driver({ action: 'save' });
        const saved = (await s.clean(text => text.includes('SAVED-TEXT'))).text;
        await s.focusEnd(connection);
        await connection.send('Input.insertText', { text: ' AFTER-SAVE' });
        await s.typed(connection, 'AFTER-SAVE');

        // A write identical to our save reads like a late notification of it.
        // The watcher may merge it with the next write; either way the later
        // typing must survive and the real change must be reported.
        s.writeExternally(saved);
        s.writeExternally('# Own save echo\n\nREAL-EXTERNAL\n');
        await s.waitForNotice();
        const kept = await s.state();
        assert.ok(kept.dirty && kept.text.includes('AFTER-SAVE'), 'Text typed after our save survives its notification');
        await s.choose('Compare');
        await s.waitForDiff();
        await s.until(async () => (await s.compared()).includes('REAL-EXTERNAL'), 'Compare shows the real external revision');
        record('external-conflict-own-save-echo', { laterTypingKeptAcrossOwnSaveNotifications: true, laterExternalWriteReported: true });

        await s.waitForNotice();
        await s.choose('Load Disk Version');
        await s.clean(text => text.includes('REAL-EXTERNAL'));
    } finally {
        connection?.close();
        await s.cleanUp();
    }
}

// Typed text is in flight to the host while a clean document is reloaded from
// disk. The editor's synchronization is held until the reload reaches it.
async function typingRaceCase(h, owner, record, file) {
    const s = scenario(h, owner, file);
    fs.writeFileSync(s.filePath, '# Typing race\n\nBASE\n');
    let connection;
    try {
        connection = await h.open(file);
        await h.workbench(page => page.bringToFront());
        await s.observe(connection);
        await connection.evaluate(`(() => {
            const bridge = window.hostBridge, original = bridge.syncContent, control = { held: [] };
            bridge.syncContent = (content, base) => { control.held.push([content, base]); };
            control.release = () => { bridge.syncContent = original; control.held.splice(0).forEach(([content, base]) => original.call(bridge, content, base)); };
            window.__raceControl = control;
        })()`);
        await s.focusEnd(connection);
        await connection.send('Input.insertText', { text: ' TYPED-BEFORE-RELOAD' });
        await s.until(() => connection.evaluate('window.__raceControl.held.length > 0'), 'typed text held in the editor');
        assert.equal((await s.state()).dirty, false, 'The host has not received the typing');

        s.writeExternally('# Typing race\n\nEXTERNAL-RELOAD\n');
        await s.until(() => connection.evaluate('window.__conflictProbe.updates.length > 0'), 'the reload reaches the editor');
        await connection.evaluate('window.__raceControl.release()');

        await s.waitForNotice();
        await s.typed(connection, 'TYPED-BEFORE-RELOAD');
        assert.ok(!(await s.state()).text.includes('EXTERNAL-RELOAD'), 'The typed text replaces the reload in the buffer');
        assert.equal(s.disk(), '# Typing race\n\nEXTERNAL-RELOAD\n');
        // The host sends the buffer back, so the editor agrees with it.
        await s.until(() => connection.evaluate('window.__conflictProbe.updates.length > 1'), 'the buffer is sent back to the editor');
        await s.until(async () => (await s.shown(connection)).includes('TYPED-BEFORE-RELOAD'), 'the editor shows the kept text');

        // VS Code's newer-file check cannot see this case, so the editor's
        // first save is held until the warning is answered.
        await s.keyboardSave(connection);
        await s.until(() => connection.evaluate('window.__conflictProbe.saveResults.length > 0'), 'save result');
        assert.equal(await connection.evaluate('window.__conflictProbe.saveResults.at(-1)'), false);
        assert.equal(s.disk(), '# Typing race\n\nEXTERNAL-RELOAD\n', 'The held save leaves the reload on disk');
        assert.ok((await s.state()).dirty);

        await s.choose('Compare');
        await s.waitForDiff();
        await s.until(async () => (await s.compared()).includes('EXTERNAL-RELOAD'), 'Compare shows the reloaded revision');
        record('external-conflict-typing-race', { typingKept: true, editorConverged: true, conflictReported: true, firstKeyboardSaveHeld: true, diskRevisionComparable: true });

        await s.waitForNotice();
        await s.choose('Load Disk Version');
        await s.clean(text => text.includes('EXTERNAL-RELOAD'));
    } finally {
        try { if (connection) await connection.evaluate('window.__raceControl?.release()'); } catch { /* the panel may be closed */ }
        connection?.close();
        await s.cleanUp();
    }
}

module.exports = { externalConflictCase };
