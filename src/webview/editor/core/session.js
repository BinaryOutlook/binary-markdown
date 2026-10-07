'use strict';
// Construction defines capabilities; bootstrap controls the original initialization order.
function createSession(dependencies) {
    let markdown, saveTimeout, syncTimeout, pendingSync, visualSourceCurrent, hasUserEdited, clientRevision, syncGeneration, pendingSave, currentImageDir, currentForceRelativePath, imageDirDisplayPath, imageDirSource, isActivelyEditing, editingIdleTimer, queuedExternalContent, EDITING_IDLE_TIMEOUT, undoManager;
    // Background reads must leave an in-progress equation edit cancellable.
    // Capturing export eligibility must never normalize an untouched document.
    function readCommittedMarkdown() {
        return dependencies.isSourceMode ? dependencies.sourceEditor.value : (hasUserEdited && !visualSourceCurrent ? dependencies.htmlToMarkdown() : markdown);
    }
    function readCurrentMarkdown() {
        if (dependencies.finishInlineMathEdit)
            dependencies.finishInlineMathEdit(true, false);
        return readCommittedMarkdown();
    }
    function cancelScheduledSync() {
        syncGeneration++;
        clearTimeout(syncTimeout);
        syncTimeout = null;
        clearTimeout(saveTimeout);
        saveTimeout = null;
        pendingSync = false;
    }
    function saveCurrentDocument() {
        try {
            dependencies.refreshManagedTocs(false);
        }
        catch (error) {
            dependencies.showEditorToast(error.message);
            return;
        }
        const content = readCurrentMarkdown();
        cancelScheduledSync();
        markdown = content;
        if (typeof dependencies.host.respondExport === 'function') {
            pendingSave = { revision: clientRevision, content: content };
            dependencies.host.save(content, clientRevision);
        }
        else {
            // The Electron adapter keeps its existing save contract.
            if (hasUserEdited)
                dependencies.host.syncContent(content);
            dependencies.host.save();
            hasUserEdited = false;
        }
    }
    // Debounced sync for performance - uses requestIdleCallback to avoid blocking UI
    function debouncedSync() {
        if (pendingSync)
            return; // Skip if already pending
        clearTimeout(syncTimeout);
        syncTimeout = null;
        const generation = syncGeneration;
        syncTimeout = setTimeout(() => {
            syncTimeout = null;
            if (generation !== syncGeneration)
                return;
            pendingSync = true;
            // Use requestIdleCallback to process during idle time, not blocking UI
            const doSync = () => {
                if (generation !== syncGeneration)
                    return;
                markdown = readCommittedMarkdown();
                notifyChangeImmediate();
                pendingSync = false;
            };
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(doSync, { timeout: 500 });
            }
            else {
                setTimeout(doSync, 0);
            }
        }, 1000); // Increased to 1000ms for better typing performance
    }
    // Immediate sync for critical operations (Enter key, table operations, etc.)
    function syncMarkdownDeferred() {
        markAsEdited(); // Any sync implies user edit
        clearTimeout(syncTimeout);
        syncTimeout = null;
        pendingSync = true;
        const generation = syncGeneration;
        // Defer to next frame to not block current operation
        requestAnimationFrame(() => {
            if (generation !== syncGeneration)
                return;
            markdown = readCommittedMarkdown();
            notifyChangeImmediate();
            pendingSync = false;
        });
    }
    // ========== HTML TO MARKDOWN ==========
    // Use requestAnimationFrame for non-blocking sync
    function syncMarkdown() {
        markAsEdited(); // Any sync implies user edit
        // Cancel any pending sync from debouncedSync
        clearTimeout(syncTimeout);
        syncTimeout = null;
        pendingSync = true;
        const generation = syncGeneration;
        requestAnimationFrame(() => {
            if (generation !== syncGeneration)
                return;
            markdown = readCommittedMarkdown();
            notifyChange();
            pendingSync = false;
            dependencies.updatePlaceholder();
        });
    }
    // Synchronous version for cases where we need immediate result
    function syncMarkdownSync() {
        markAsEdited(); // Any sync implies user edit
        markdown = dependencies.htmlToMarkdown();
        notifyChange();
        dependencies.updatePlaceholder();
    }
    // Immediate notification - called after debounce in debouncedSync
    function notifyChangeImmediate() {
        // Only save if user has made edits (prevents saving on initial load)
        if (!hasUserEdited)
            return;
        dependencies.host.syncContent(markdown);
        dependencies.updateOutline();
        dependencies.updateWordCount();
        dependencies.updateStatus();
    }
    // Debounced notification - for syncMarkdown() calls
    function notifyChange() {
        // Only save if user has made edits (prevents saving on initial load)
        if (!hasUserEdited)
            return;
        clearTimeout(saveTimeout);
        const generation = syncGeneration;
        saveTimeout = setTimeout(() => {
            saveTimeout = null;
            if (generation !== syncGeneration)
                return;
            dependencies.host.syncContent(markdown);
            dependencies.updateOutline();
            dependencies.updateWordCount();
            dependencies.updateStatus();
        }, 300);
    }
    // Mark document as edited by user
    function markAsEdited() {
        visualSourceCurrent = false;
        clientRevision++;
        if (!hasUserEdited) {
            hasUserEdited = true;
            dependencies.logger.log('Document marked as edited by user');
        }
    }
    /**
     * Mark the user as actively editing. Resets the idle timer.
     * While actively editing, external changes are queued instead of applied.
     */
    function markActivelyEditing() {
        const wasIdle = !isActivelyEditing;
        isActivelyEditing = true;
        if (wasIdle) {
            dependencies.host.reportEditingState(true);
        }
        clearTimeout(editingIdleTimer);
        editingIdleTimer = setTimeout(function () {
            // Flush any pending sync before going idle
            if (pendingSync) {
                clearTimeout(syncTimeout);
                syncTimeout = null;
                markdown = dependencies.htmlToMarkdown();
                notifyChangeImmediate();
                pendingSync = false;
            }
            isActivelyEditing = false;
            dependencies.host.reportEditingState(false);
            // Apply queued external changes now that we're idle
            applyQueuedExternalChange();
        }, EDITING_IDLE_TIMEOUT);
    }
    /**
     * Apply queued external change with cursor preservation.
     */
    function applyQueuedExternalChange() {
        if (queuedExternalContent === null)
            return;
        dependencies.logger.log('[Binary Markdown] applying queued external change');
        markdown = queuedExternalContent;
        queuedExternalContent = null;
        currentImageDir = extractImageDirFromMarkdown(markdown);
        currentForceRelativePath = extractForceRelativePathFromMarkdown(markdown);
        if (dependencies.isSourceMode) {
            dependencies.sourceEditor.value = markdown;
        }
        else {
            dependencies.updateFromMarkdown();
        }
        dependencies.updateOutline();
        dependencies.updateWordCount();
        dependencies.updateStatus();
    }
    function extractImageDirFromMarkdown(md) {
        // Pattern: matches IMAGE_DIR in a directive block (may have other directives before/after)
        const pattern = /\n---\n(?:[\s\S]*?\n)?IMAGE_DIR:\s*([^\n]+)/;
        const match = md.match(pattern);
        return match ? match[1].trim() : null;
    }
    function extractForceRelativePathFromMarkdown(md) {
        const pattern = /\n---\n(?:[\s\S]*?\n)?FORCE_RELATIVE_PATH:\s*(true|false)/i;
        const match = md.match(pattern);
        return match ? match[1].toLowerCase() === 'true' : null;
    }
    let initializeMarkdownDone = false;
    function initializeMarkdown() {
        if (initializeMarkdownDone)
            return;
        initializeMarkdownDone = true;
        (markdown = '');
    }
    let initializeSaveTimeout1Done = false;
    function initializeSaveTimeout1() {
        if (initializeSaveTimeout1Done)
            return;
        initializeSaveTimeout1Done = true;
        (saveTimeout = null);
        (syncTimeout = null);
        (pendingSync = false);
        (visualSourceCurrent = true);
        (hasUserEdited = false);
        (clientRevision = 0);
        (syncGeneration = 0);
        (pendingSave = null);
        (currentImageDir = null);
        (currentForceRelativePath = null);
        (imageDirDisplayPath = null);
        (imageDirSource = null);
        (isActivelyEditing = false);
    }
    let initializeEditingIdleTimer2Done = false;
    function initializeEditingIdleTimer2() {
        if (initializeEditingIdleTimer2Done)
            return;
        initializeEditingIdleTimer2Done = true;
        (editingIdleTimer = null);
        (queuedExternalContent = null);
        (EDITING_IDLE_TIMEOUT = 1500);
    }
    let initializeUndoManager3Done = false;
    function initializeUndoManager3() {
        if (initializeUndoManager3Done)
            return;
        initializeUndoManager3Done = true;
        (undoManager = (function () {
            var MAX_STACK = 200;
            var undoStack = [];
            var redoStack = [];
            var typingTimer = null;
            var TYPING_DEBOUNCE = 500;
            var _isUndoRedo = false;
            function capture(current = false) {
                // Input snapshots need the previous Markdown; undo/redo must retain
                // the latest committed DOM even before its delayed sync runs.
                return { markdown: current ? readCommittedMarkdown() : markdown, cursor: dependencies.saveCursorState(), sourceCursor: dependencies.isSourceMode ? { start: dependencies.sourceEditor.selectionStart, end: dependencies.sourceEditor.selectionEnd } : null, codeViews: dependencies.captureCodeViews() };
            }
            function saveSnapshot() {
                if (_isUndoRedo)
                    return;
                var state = capture();
                if (undoStack.length > 0 && undoStack[undoStack.length - 1].markdown === state.markdown)
                    return;
                undoStack.push(state);
                if (undoStack.length > MAX_STACK)
                    undoStack.shift();
                redoStack.length = 0;
                updateButtons();
            }
            function saveSnapshotDebounced() {
                if (_isUndoRedo)
                    return;
                if (typingTimer)
                    return;
                saveSnapshot();
                typingTimer = setTimeout(function () { typingTimer = null; }, TYPING_DEBOUNCE);
            }
            function undo() {
                if (!undoStack.length)
                    return;
                _isUndoRedo = true;
                try {
                    clearTimeout(syncTimeout);
                    syncTimeout = null;
                    pendingSync = false;
                    redoStack.push(capture(true));
                    var state = undoStack.pop();
                    markdown = state.markdown;
                    dependencies.renderFromMarkdown(state.codeViews);
                    if (dependencies.isSourceMode && state.sourceCursor)
                        dependencies.sourceEditor.setSelectionRange(state.sourceCursor.start, state.sourceCursor.end);
                    else if (!dependencies.isSourceMode && state.cursor)
                        dependencies.restoreCursorState(state.cursor);
                    hasUserEdited = true;
                    clientRevision++;
                    notifyChangeImmediate();
                }
                finally {
                    _isUndoRedo = false;
                }
                updateButtons();
            }
            function redo() {
                if (!redoStack.length)
                    return;
                _isUndoRedo = true;
                try {
                    clearTimeout(syncTimeout);
                    syncTimeout = null;
                    pendingSync = false;
                    undoStack.push(capture(true));
                    var state = redoStack.pop();
                    markdown = state.markdown;
                    dependencies.renderFromMarkdown(state.codeViews);
                    if (dependencies.isSourceMode && state.sourceCursor)
                        dependencies.sourceEditor.setSelectionRange(state.sourceCursor.start, state.sourceCursor.end);
                    else if (!dependencies.isSourceMode && state.cursor)
                        dependencies.restoreCursorState(state.cursor);
                    hasUserEdited = true;
                    clientRevision++;
                    notifyChangeImmediate();
                }
                finally {
                    _isUndoRedo = false;
                }
                updateButtons();
            }
            function updateButtons() {
                var u = document.querySelector('[data-action="undo"]');
                var r = document.querySelector('[data-action="redo"]');
                if (u) {
                    u.disabled = !undoStack.length;
                    u.style.opacity = undoStack.length ? '1' : '0.3';
                }
                if (r) {
                    r.disabled = !redoStack.length;
                    r.style.opacity = redoStack.length ? '1' : '0.3';
                }
            }
            function clear() {
                undoStack.length = 0;
                redoStack.length = 0;
                updateButtons();
            }
            return {
                saveSnapshot: saveSnapshot,
                saveSnapshotDebounced: saveSnapshotDebounced,
                undo: undo,
                redo: redo,
                updateButtons: updateButtons,
                clear: clear,
                get canUndo() { return undoStack.length > 0; },
                get canRedo() { return redoStack.length > 0; },
                get isUndoRedo() { return _isUndoRedo; }
            };
        })());
        undoManager.updateButtons();
    }
    let initializeSourceEvents4Done = false;
    function initializeSourceEvents4() {
        if (initializeSourceEvents4Done)
            return;
        initializeSourceEvents4Done = true;
        dependencies.sourceEditor.addEventListener('beforeinput', () => {
            if (dependencies.isSourceMode)
                undoManager.saveSnapshotDebounced();
        });
        dependencies.sourceEditor.addEventListener('input', function () {
            if (dependencies.isSourceMode) {
                undoManager.saveSnapshotDebounced();
                markAsEdited(); // User has made an edit
                markdown = dependencies.sourceEditor.value;
                notifyChange();
                dependencies.scheduleSplitPreview();
                dependencies.updateOutline();
            }
        });
    }
    let initializeEditorEvents5Done = false;
    function initializeEditorEvents5() {
        if (initializeEditorEvents5Done)
            return;
        initializeEditorEvents5Done = true;
        dependencies.editor.addEventListener('focus', function () {
            dependencies.host.reportFocus();
        });
        dependencies.editor.addEventListener('blur', function () {
            // Flush pending edits immediately on blur
            if (!dependencies.isSourceMode && hasUserEdited) {
                clearTimeout(syncTimeout);
                syncTimeout = null;
                markdown = dependencies.htmlToMarkdown();
                dependencies.host.syncContent(markdown);
            }
            // Force idle state on blur
            clearTimeout(editingIdleTimer);
            isActivelyEditing = false;
            dependencies.host.reportEditingState(false);
            dependencies.host.reportBlur();
            // Apply queued external changes now that we're definitely idle
            applyQueuedExternalChange();
        });
        dependencies.sourceEditor.addEventListener('focus', function () {
            dependencies.host.reportFocus();
        });
        dependencies.sourceEditor.addEventListener('blur', function () {
            if (dependencies.isSourceMode && hasUserEdited) {
                markdown = dependencies.sourceEditor.value;
                dependencies.host.syncContent(markdown);
            }
            clearTimeout(editingIdleTimer);
            isActivelyEditing = false;
            dependencies.host.reportEditingState(false);
            dependencies.host.reportBlur();
            applyQueuedExternalChange();
        });
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden' && hasUserEdited) {
                if (dependencies.isSourceMode) {
                    markdown = dependencies.sourceEditor.value;
                }
                else {
                    clearTimeout(syncTimeout);
                    syncTimeout = null;
                    markdown = dependencies.htmlToMarkdown();
                }
                dependencies.host.syncContent(markdown);
            }
        });
    }
    return {
        readCommittedMarkdown,
        readCurrentMarkdown,
        cancelScheduledSync,
        saveCurrentDocument,
        debouncedSync,
        syncMarkdownDeferred,
        syncMarkdown,
        syncMarkdownSync,
        notifyChangeImmediate,
        notifyChange,
        markAsEdited,
        markActivelyEditing,
        applyQueuedExternalChange,
        extractImageDirFromMarkdown,
        extractForceRelativePathFromMarkdown,
        get markdown() { return markdown; }, set markdown(value) { markdown = value; },
        get saveTimeout() { return saveTimeout; }, set saveTimeout(value) { saveTimeout = value; },
        get syncTimeout() { return syncTimeout; }, set syncTimeout(value) { syncTimeout = value; },
        get pendingSync() { return pendingSync; }, set pendingSync(value) { pendingSync = value; },
        get visualSourceCurrent() { return visualSourceCurrent; }, set visualSourceCurrent(value) { visualSourceCurrent = value; },
        get hasUserEdited() { return hasUserEdited; }, set hasUserEdited(value) { hasUserEdited = value; },
        get clientRevision() { return clientRevision; }, set clientRevision(value) { clientRevision = value; },
        get syncGeneration() { return syncGeneration; }, set syncGeneration(value) { syncGeneration = value; },
        get pendingSave() { return pendingSave; }, set pendingSave(value) { pendingSave = value; },
        get currentImageDir() { return currentImageDir; }, set currentImageDir(value) { currentImageDir = value; },
        get currentForceRelativePath() { return currentForceRelativePath; }, set currentForceRelativePath(value) { currentForceRelativePath = value; },
        get imageDirDisplayPath() { return imageDirDisplayPath; }, set imageDirDisplayPath(value) { imageDirDisplayPath = value; },
        get imageDirSource() { return imageDirSource; }, set imageDirSource(value) { imageDirSource = value; },
        get isActivelyEditing() { return isActivelyEditing; }, set isActivelyEditing(value) { isActivelyEditing = value; },
        get editingIdleTimer() { return editingIdleTimer; }, set editingIdleTimer(value) { editingIdleTimer = value; },
        get queuedExternalContent() { return queuedExternalContent; }, set queuedExternalContent(value) { queuedExternalContent = value; },
        get EDITING_IDLE_TIMEOUT() { return EDITING_IDLE_TIMEOUT; }, set EDITING_IDLE_TIMEOUT(value) { EDITING_IDLE_TIMEOUT = value; },
        get undoManager() { return undoManager; }, set undoManager(value) { undoManager = value; },
        initializeMarkdown,
        initializeSaveTimeout1,
        initializeEditingIdleTimer2,
        initializeUndoManager3,
        initializeSourceEvents4,
        initializeEditorEvents5
    };
}
module.exports = { createSession };
