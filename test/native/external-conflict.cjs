'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { replaceFile } = require('./replace-file.cjs');

// Issue #81: another program's write must not discard unsaved visual edits.
// Every document is synthetic. Notification buttons are activated through the
// owned workbench through their DOM handlers, as the other installed checks do;
// the typing race uses controlled delivery of real editor messages.
const samePath = (a, b) => process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : a === b;
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
// VS Code builds toasts and diff lines on animation frames, which a covered or
// background window does not run. A one-pixel capture forces a frame first.
const painted = async page => {
    await page.bringToFront();
    await page.screenshot({ clip: { x: 0, y: 0, width: 1, height: 1 }, timeout: 10000 });
    return page;
};

function scenario(h, owner, file) {
    const filePath = path.join(owner.workspace, file);
    const notice = `'${file}' was changed on disk while you have unsaved edits. Your edits are kept.`;
    const state = async () => (await h.driver({ action: 'inspect' })).documents.find(document => samePath(document.path, filePath));
    const disk = () => fs.readFileSync(filePath, 'utf8');
    // Another program replaces the file atomically, as editors and tools do.
    const writeExternally = content => {
        const temporary = path.join(owner.workspace, '.external-writer.tmp');
        fs.writeFileSync(temporary, content);
        replaceFile(temporary, filePath);
    };
    const toasts = page => page.locator('.notifications-toasts .notification-list-item');
    const conflictNotices = () => h.workbench(async page => toasts(await painted(page)).filter({ hasText: notice }).count());
    const waitForNotice = () => h.until(async () => await conflictNotices() > 0 || undefined, 'conflict notification for ' + file);
    const choose = label => h.workbench(async page => toasts(await painted(page)).filter({ hasText: notice }).first().getByRole('button', { name: label }).dispatchEvent('click'));
    const focusEnd = connection => connection.evaluate(`(() => {
        const editor = document.getElementById('editor'); editor.focus();
        const range = document.createRange(); range.selectNodeContents(editor.lastElementChild || editor); range.collapse(false);
        getSelection().removeAllRanges(); getSelection().addRange(range);
    })()`);
    const shown = connection => connection.evaluate(`getComputedStyle(document.getElementById('sourceEditor')).display === 'none'
        ? document.getElementById('editor').innerText : document.getElementById('sourceEditor').value`);
    const diffTabs = page => page.locator('.tabs-container .tab', { hasText: file + ' (on disk)' });
    const waitForDiff = () => h.until(() => h.workbench(async page => diffTabs(await painted(page)).count()) || undefined, 'Compare opens a diff tab for ' + file);
    const compared = () => h.workbench(async page => (await painted(page)).locator('.monaco-diff-editor .editor.original .view-lines').first().innerText());
    // Leave no diff tab or notice behind for the next scenario.
    const cleanUp = async () => {
        await h.driver({ action: 'closeDiff', file });
        await h.workbench(async page => {
            for (const item of await toasts(await painted(page)).filter({ hasText: notice }).all()) {
                await item.getByRole('button', { name: /clear notification/i }).dispatchEvent('click');
            }
        });
    };
    return { filePath, notice, state, disk, writeExternally, conflictNotices, waitForNotice, choose, focusEnd, shown, waitForDiff, compared, cleanUp };
}

async function externalConflictCase(h, owner, record) {
    await h.driver({ action: 'autoSave', value: 'off' });
    // VS Code can keep a closed file's buffer and reload it later. New names
    // keep a repeated run from racing that reload.
    const run = Date.now().toString(36);
    await idleConflictCase(h, owner, record, `external-conflict-${run}.md`);
    await saveDuringConflictCase(h, owner, record, `external-conflict-save-${run}.md`);
    await typingRaceCase(h, owner, record, `external-conflict-race-${run}.md`);
}

// The issue's reproduction, then Compare, Load Disk Version and Undo.
async function idleConflictCase(h, owner, record, file) {
    const s = scenario(h, owner, file);
    const base = '# External conflict\n\nBASE-MARKER\n';
    const external = '# External conflict\n\nEXTERNAL-MARKER\n';
    fs.writeFileSync(s.filePath, base);
    let connection;
    try {
        connection = await h.open(file);
        await h.workbench(page => page.bringToFront());
        await s.focusEnd(connection);
        await connection.send('Input.insertText', { text: ' LOCAL-UNSAVED-MARKER' });
        await h.until(async () => { const value = await s.state(); return value?.dirty && value.text.includes('LOCAL-UNSAVED-MARKER') || undefined; },
            'typed text reaches the dirty host document');
        assert.equal(s.disk(), base);
        await pause(2500); // Past the editor's 1.5 s typing window: the issue's idle case.

        s.writeExternally(external);
        await s.waitForNotice();
        await pause(1000); // Allow any further watcher work to run.
        const kept = await s.state();
        assert.equal(kept.dirty, true, 'The document keeps its unsaved state');
        assert.ok(kept.text.includes('LOCAL-UNSAVED-MARKER') && !kept.text.includes('EXTERNAL-MARKER'), 'The buffer keeps the local edit');
        assert.ok((await s.shown(connection)).includes('LOCAL-UNSAVED-MARKER'), 'The visual editor keeps the local edit');
        assert.equal(s.disk(), external, 'The external revision stays on disk');
        assert.equal(await s.conflictNotices(), 1);
        record('external-conflict-idle', { unsavedEditKept: true, documentDirty: true, externalRevisionOnDisk: true, oneNotification: true });

        s.writeExternally(external.replace('EXTERNAL-MARKER', 'EXTERNAL-SECOND'));
        await pause(1500);
        assert.equal(await s.conflictNotices(), 1, 'Later writes during one conflict do not repeat the notification');
        assert.ok((await s.state()).text.includes('LOCAL-UNSAVED-MARKER'));

        await s.choose('Compare');
        await s.waitForDiff();
        assert.ok((await s.compared()).includes('EXTERNAL-SECOND'), 'Compare shows the latest external revision');
        await s.waitForNotice();
        record('external-conflict-compare', { diffOpened: true, latestExternalRevisionShown: true, choicesOfferedAgain: true });

        await s.choose('Load Disk Version');
        const loaded = await h.until(async () => { const value = await s.state(); return value && !value.dirty && value.text.includes('EXTERNAL-SECOND') ? value : undefined; },
            'Load Disk Version leaves the external revision clean');
        assert.ok(!loaded.text.includes('LOCAL-UNSAVED-MARKER'));
        assert.equal(s.disk(), loaded.text);
        await h.until(async () => (await s.shown(connection)).includes('EXTERNAL-SECOND') || undefined, 'the visual editor shows the loaded revision');

        await connection.evaluate(`document.querySelector('[data-action="undo"]').click()`);
        await h.until(async () => { const value = await s.state(); return value?.dirty && value.text.includes('LOCAL-UNSAVED-MARKER') || undefined; },
            'Undo restores the discarded edit');
        assert.ok(s.disk().includes('EXTERNAL-SECOND'), 'Undo does not write to disk');
        record('external-conflict-load', { explicitLoadClean: true, editorShowsLoadedRevision: true, undoRestoresDiscardedEdit: true });

        // Leave the fixture clean: saving now writes the restored local text.
        await h.driver({ action: 'save' });
        await h.until(async () => { const value = await s.state(); return value && !value.dirty || undefined; }, 'restored text saved');
        assert.ok(s.disk().includes('LOCAL-UNSAVED-MARKER'));
    } finally {
        connection?.close();
        await s.cleanUp();
        await h.driver({ action: 'closeFixture', file });
    }
}

// Saving while a conflict is unresolved: record VS Code's own behavior.
async function saveDuringConflictCase(h, owner, record, file) {
    const s = scenario(h, owner, file);
    fs.writeFileSync(s.filePath, '# Save during conflict\n\nBASE\n');
    let connection;
    try {
        connection = await h.open(file);
        await h.workbench(page => page.bringToFront());
        await s.focusEnd(connection);
        await connection.send('Input.insertText', { text: ' LOCAL' });
        await h.until(async () => { const value = await s.state(); return value?.dirty && value.text.includes('LOCAL') || undefined; }, 'local edit reaches the host');
        await pause(2500);
        s.writeExternally('# Save during conflict\n\nA LONGER EXTERNAL REVISION\n');
        await s.waitForNotice();

        await h.driver({ action: 'save' });
        await pause(1500);
        const after = await s.state();
        const newer = page => page.locator('.notifications-toasts .notification-list-item', { hasText: /content of the file is newer/i });
        const prompt = await h.workbench(async page => newer(await painted(page)).count());
        const observation = { savedOverExternal: s.disk().includes('LOCAL'), stillDirty: after.dirty, vscodeConflictPrompt: prompt > 0 };
        if (observation.vscodeConflictPrompt) {
            await h.workbench(async page => newer(await painted(page)).first().getByRole('button', { name: 'Overwrite' }).dispatchEvent('click'));
            await h.until(async () => { const value = await s.state(); return value && !value.dirty || undefined; }, 'Overwrite keeps the local edit');
        }
        assert.ok(s.disk().includes('LOCAL'), 'The kept local edit is saved after the user confirms');
        assert.equal((await s.state()).dirty, false);
        record('external-conflict-save', observation);
    } finally {
        connection?.close();
        await s.cleanUp();
        await h.driver({ action: 'closeFixture', file });
    }
}

// Unsent typing when a clean document is reloaded from disk. The editor's
// synchronization is held until the reload reaches it, then released.
async function typingRaceCase(h, owner, record, file) {
    const s = scenario(h, owner, file);
    fs.writeFileSync(s.filePath, '# Typing race\n\nBASE\n');
    let connection;
    try {
        connection = await h.open(file);
        await h.workbench(page => page.bringToFront());
        await connection.evaluate(`(() => {
            const bridge = window.hostBridge, original = bridge.syncContent, control = { held: [] };
            bridge.syncContent = (content, base) => { control.held.push([content, base]); };
            control.release = () => { bridge.syncContent = original; control.held.splice(0).forEach(([content, base]) => original.call(bridge, content, base)); };
            window.__raceControl = control;
            window.__raceUpdates = [];
            window.addEventListener('message', event => { if (event.data?.type === 'update') window.__raceUpdates.push(event.data.revision); });
        })()`);
        await s.focusEnd(connection);
        await connection.send('Input.insertText', { text: ' TYPED-BEFORE-RELOAD' });
        await h.until(() => connection.evaluate('window.__raceControl.held.length > 0') || undefined, 'typed text is held in the editor');
        assert.equal((await s.state()).dirty, false, 'The host has not received the typing');

        s.writeExternally('# Typing race\n\nEXTERNAL-RELOAD\n');
        await h.until(() => connection.evaluate('window.__raceUpdates.length > 0') || undefined, 'the reload reaches the editor');
        assert.ok((await s.shown(connection)).includes('TYPED-BEFORE-RELOAD'), 'The editor does not apply the reload over unsent typing');
        await connection.evaluate('window.__raceControl.release()');

        await s.waitForNotice();
        const kept = await h.until(async () => { const value = await s.state(); return value?.dirty && value.text.includes('TYPED-BEFORE-RELOAD') ? value : undefined; },
            'the typed text replaces the reload in the buffer');
        assert.ok(!kept.text.includes('EXTERNAL-RELOAD'));
        assert.equal(s.disk(), '# Typing race\n\nEXTERNAL-RELOAD\n');
        await s.choose('Compare');
        await s.waitForDiff();
        assert.ok((await s.compared()).includes('EXTERNAL-RELOAD'), 'Compare shows the reloaded disk revision');
        record('external-conflict-typing-race', { typingKept: true, reloadNotAppliedOverTyping: true, conflictReported: true, diskRevisionComparable: true });

        await s.waitForNotice();
        await s.choose('Load Disk Version');
        await h.until(async () => { const value = await s.state(); return value && !value.dirty && value.text.includes('EXTERNAL-RELOAD') || undefined; }, 'fixture left clean');
    } finally {
        try { if (connection) await connection.evaluate('window.__raceControl?.release()'); } catch { /* the panel may be closed */ }
        connection?.close();
        await s.cleanUp();
        await h.driver({ action: 'closeFixture', file });
    }
}

module.exports = { externalConflictCase };
