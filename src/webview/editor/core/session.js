'use strict';

// Named capabilities remain live; this factory installs no listeners.
function createSession(dependencies) {


    // Background reads must leave an in-progress equation edit cancellable.
    // Capturing export eligibility must never normalize an untouched document.
    function readCommittedMarkdown() {
        return dependencies.isSourceMode ? dependencies.sourceEditor.value : (dependencies.hasUserEdited && !dependencies.visualSourceCurrent ? dependencies.htmlToMarkdown() : dependencies.markdown);
    }


    function readCurrentMarkdown() {
        if (dependencies.finishInlineMathEdit) dependencies.finishInlineMathEdit(true, false);
        return readCommittedMarkdown();
    }


    function cancelScheduledSync() {
        dependencies.syncGeneration++;
        clearTimeout(dependencies.syncTimeout);
        dependencies.syncTimeout = null;
        clearTimeout(dependencies.saveTimeout);
        dependencies.saveTimeout = null;
        dependencies.pendingSync = false;
    }


    function saveCurrentDocument() {
        try { dependencies.refreshManagedTocs(false); } catch (error) { dependencies.showEditorToast(error.message); return; }
        const content = readCurrentMarkdown();
        cancelScheduledSync();
        dependencies.markdown = content;
        if (typeof dependencies.host.respondExport === 'function') {
            dependencies.pendingSave = { revision: dependencies.clientRevision, content: content };
            dependencies.host.save(content, dependencies.clientRevision);
        } else {
            // The Electron adapter keeps its existing save contract.
            if (dependencies.hasUserEdited) dependencies.host.syncContent(content);
            dependencies.host.save();
            dependencies.hasUserEdited = false;
        }
    }


    // Debounced sync for performance - uses requestIdleCallback to avoid blocking UI
    function debouncedSync() {
        if (dependencies.pendingSync) return; // Skip if already pending
        clearTimeout(dependencies.syncTimeout);
        dependencies.syncTimeout = null;
        const generation = dependencies.syncGeneration;
        dependencies.syncTimeout = setTimeout(() => {
            dependencies.syncTimeout = null;
            if (generation !== dependencies.syncGeneration) return;
            dependencies.pendingSync = true;
            // Use requestIdleCallback to process during idle time, not blocking UI
            const doSync = () => {
                if (generation !== dependencies.syncGeneration) return;
                dependencies.markdown = readCommittedMarkdown();
                notifyChangeImmediate();
                dependencies.pendingSync = false;
            };
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(doSync, { timeout: 500 });
            } else {
                setTimeout(doSync, 0);
            }
        }, 1000); // Increased to 1000ms for better typing performance
    }


    // Immediate sync for critical operations (Enter key, table operations, etc.)
    function syncMarkdownDeferred() {
        markAsEdited(); // Any sync implies user edit
        clearTimeout(dependencies.syncTimeout);
        dependencies.syncTimeout = null;
        dependencies.pendingSync = true;
        const generation = dependencies.syncGeneration;
        // Defer to next frame to not block current operation
        requestAnimationFrame(() => {
            if (generation !== dependencies.syncGeneration) return;
            dependencies.markdown = readCommittedMarkdown();
            notifyChangeImmediate();
            dependencies.pendingSync = false;
        });
    }


    // ========== HTML TO MARKDOWN ==========

    // Use requestAnimationFrame for non-blocking sync
    function syncMarkdown() {
        markAsEdited(); // Any sync implies user edit
        // Cancel any pending sync from debouncedSync
        clearTimeout(dependencies.syncTimeout);
        dependencies.syncTimeout = null;
        dependencies.pendingSync = true;
        const generation = dependencies.syncGeneration;
        requestAnimationFrame(() => {
            if (generation !== dependencies.syncGeneration) return;
            dependencies.markdown = readCommittedMarkdown();
            notifyChange();
            dependencies.pendingSync = false;
            dependencies.updatePlaceholder();
        });
    }


    // Synchronous version for cases where we need immediate result
    function syncMarkdownSync() {
        markAsEdited(); // Any sync implies user edit
        dependencies.markdown = dependencies.htmlToMarkdown();
        notifyChange();
        dependencies.updatePlaceholder();
    }


    // Immediate notification - called after debounce in debouncedSync
    function notifyChangeImmediate() {
        // Only save if user has made edits (prevents saving on initial load)
        if (!dependencies.hasUserEdited) return;
        dependencies.host.syncContent(dependencies.markdown);
        dependencies.updateOutline();
        dependencies.updateWordCount();
        dependencies.updateStatus();
    }


    // Debounced notification - for syncMarkdown() calls
    function notifyChange() {
        // Only save if user has made edits (prevents saving on initial load)
        if (!dependencies.hasUserEdited) return;
        clearTimeout(dependencies.saveTimeout);
        const generation = dependencies.syncGeneration;
        dependencies.saveTimeout = setTimeout(() => {
            dependencies.saveTimeout = null;
            if (generation !== dependencies.syncGeneration) return;
            dependencies.host.syncContent(dependencies.markdown);
            dependencies.updateOutline();
            dependencies.updateWordCount();
            dependencies.updateStatus();
        }, 300);
    }


    // Mark document as edited by user
    function markAsEdited() {
        dependencies.visualSourceCurrent = false;
        dependencies.clientRevision++;
        if (!dependencies.hasUserEdited) {
            dependencies.hasUserEdited = true;
            dependencies.logger.log('Document marked as edited by user');
        }
    }


    /**
     * Mark the user as actively editing. Resets the idle timer.
     * While actively editing, external changes are queued instead of applied.
     */
    function markActivelyEditing() {
        const wasIdle = !dependencies.isActivelyEditing;
        dependencies.isActivelyEditing = true;

        if (wasIdle) {
            dependencies.host.reportEditingState(true);
        }

        clearTimeout(dependencies.editingIdleTimer);
        dependencies.editingIdleTimer = setTimeout(function() {
            // Flush any pending sync before going idle
            if (dependencies.pendingSync) {
                clearTimeout(dependencies.syncTimeout);
                dependencies.syncTimeout = null;
                dependencies.markdown = dependencies.htmlToMarkdown();
                notifyChangeImmediate();
                dependencies.pendingSync = false;
            }

            dependencies.isActivelyEditing = false;
            dependencies.host.reportEditingState(false);

            // Apply queued external changes now that we're idle
            applyQueuedExternalChange();
        }, dependencies.EDITING_IDLE_TIMEOUT);
    }


    /**
     * Apply queued external change with cursor preservation.
     */
    function applyQueuedExternalChange() {
        if (dependencies.queuedExternalContent === null) return;

        dependencies.logger.log('[Binary Markdown] applying queued external change');
        dependencies.markdown = dependencies.queuedExternalContent;
        dependencies.queuedExternalContent = null;
        dependencies.currentImageDir = dependencies.extractImageDirFromMarkdown(dependencies.markdown);
        dependencies.currentForceRelativePath = dependencies.extractForceRelativePathFromMarkdown(dependencies.markdown);
        if (dependencies.isSourceMode) {
            dependencies.sourceEditor.value = dependencies.markdown;
        } else {
            dependencies.updateFromMarkdown();
        }
        dependencies.updateOutline();
        dependencies.updateWordCount();
        dependencies.updateStatus();
    }

    return { readCommittedMarkdown, readCurrentMarkdown, cancelScheduledSync, saveCurrentDocument, debouncedSync, syncMarkdownDeferred, syncMarkdown, syncMarkdownSync, notifyChangeImmediate, notifyChange, markAsEdited, markActivelyEditing, applyQueuedExternalChange };
}

module.exports = { createSession };
