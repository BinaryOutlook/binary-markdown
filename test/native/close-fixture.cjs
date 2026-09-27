'use strict';
const path = require('node:path');
const { sameDirectory } = require('./directory-identity.cjs');

// The caller validates that file belongs to the sentinel-owned workspace.
async function closeFixture(vscode, file) {
    const matches = uri => uri?.scheme === 'file' &&
        sameDirectory(path.dirname(uri.fsPath), path.dirname(file)) && path.basename(uri.fsPath) === path.basename(file);
    const tabs = vscode.window.tabGroups.all.flatMap(group => group.tabs).filter(tab =>
        tab.input instanceof vscode.TabInputCustom && tab.input.viewType === 'binary-markdown.editor' && matches(tab.input.uri));
    if (!tabs.length) return { closed: false, reason: 'not-open' };
    // Failed scenarios keep their unsaved evidence and must never open a
    // confirmation prompt that blocks the next driver request.
    if (tabs.some(tab => tab.isDirty) || vscode.workspace.textDocuments.some(document => matches(document.uri) && document.isDirty)) {
        return { closed: false, reason: 'dirty' };
    }
    const closed = await vscode.window.tabGroups.close(tabs, true);
    return { closed, reason: closed ? 'closed' : 'refused' };
}

module.exports = { closeFixture };
