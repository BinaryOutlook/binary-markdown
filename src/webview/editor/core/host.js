'use strict';
// Construction defines capabilities; bootstrap controls the original initialization order.
function createHost(dependencies) {
    let initializeControlsDone = false;
    function initializeControls() {
        if (initializeControlsDone)
            return;
        initializeControlsDone = true;
        dependencies.host.onMessage(function (message) {
            if (message.type === 'mathSourceWrap') {
                dependencies.applyMathSourcePreference('mathSourceWrap', String(message.value === true));
                return;
            }
            if (message.type === 'mathSourcePosition') {
                dependencies.applyMathSourcePreference('mathSourcePosition', message.value === 'below' ? 'below' : 'above');
                return;
            }
            if (message.type === 'codeLanguageOrder') {
                document.documentElement.dataset.codeLanguageOrder = ['a-z', 'z-a'].includes(message.value) ? message.value : 'default';
                document.querySelector('.lang-selector')?.refreshOrder?.();
                return;
            }
            if (message.type === 'editorWidthIndicators') {
                document.documentElement.dataset.editorWidthIndicators = String(message.value !== false);
                dependencies.updateWidthIndicators();
                return;
            }
            if (message.type === 'editorWidth') {
                if (typeof message.indicators === 'boolean')
                    document.documentElement.dataset.editorWidthIndicators = String(message.indicators);
                dependencies.applyEditorWidth(message.mode, message.maxWidth, message.alignment);
                dependencies.positionLanguageSelector();
                return;
            }
            if (message.type === 'tableToolbarPositionError') {
                dependencies.showEditorToast(dependencies.i18n.tablePositionSaveFailed || 'Could not save the table toolbar position. The previous setting remains active.');
                return;
            }
            if (message.type === 'theme') {
                if (!['github', 'sepia', 'night', 'dark', 'minimal', 'perplexity', 'things'].includes(message.value))
                    return;
                if (document.documentElement.dataset.theme === message.value)
                    return;
                // A presentation change must not rebuild editable DOM or reset undo.
                document.documentElement.dataset.theme = message.value;
                dependencies.mermaidInitialized = false;
                dependencies.editor.querySelectorAll('.mermaid-wrapper').forEach(wrapper => dependencies.renderMermaidDiagram(wrapper));
                return;
            }
            if (message.type === 'tableSourceFormat') {
                // Change future serialization only; retain the DOM, selection and undo.
                document.documentElement.dataset.tableSourceFormat = dependencies.tableFormat.normalize(message.value);
                return;
            }
            if (message.type === 'tableToolbarPosition') {
                dependencies.tableControls.setPreference(message.value);
                return;
            }
            if (message.type === 'toolbarMode') {
                if (!['full', 'simple'].includes(message.value))
                    return;
                document.documentElement.dataset.toolbarMode = message.value;
                dependencies.scheduleToolbarLayout();
                dependencies.tableControls.schedule();
                return;
            }
            if (message.type === 'validateExportImage') {
                if (typeof dependencies.host.respondExport !== 'function')
                    return;
                const image = new Image();
                const dataUri = message.dataUri;
                if (typeof dataUri !== 'string' || !/^data:image\/(?:png|jpeg|gif|webp|svg\+xml)(?:;[a-z0-9=.+-]+)*,/i.test(dataUri)) {
                    dependencies.host.respondExport({ type: 'exportImageValidated', requestId: message.requestId, valid: false });
                    return;
                }
                image.src = dataUri;
                image.decode().then(() => {
                    dependencies.host.respondExport({ type: 'exportImageValidated', requestId: message.requestId, valid: image.naturalWidth > 0 && image.naturalHeight > 0 });
                }, () => {
                    dependencies.host.respondExport({ type: 'exportImageValidated', requestId: message.requestId, valid: false });
                }).finally(() => image.removeAttribute('src'));
                return;
            }
            if (message.type === 'documentSaved') {
                const normalizeSaved = value => value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
                if (typeof message.content === 'string' && normalizeSaved(dependencies.readCurrentMarkdown()) === normalizeSaved(message.content)) {
                    dependencies.markdown = normalizeSaved(message.content);
                    dependencies.hasUserEdited = false;
                    dependencies.pendingSave = null;
                    dependencies.cancelScheduledSync();
                }
                return;
            }
            if (message.type === 'saveResult') {
                if (dependencies.pendingSave && message.revision === dependencies.pendingSave.revision) {
                    if (message.success && message.revision === dependencies.clientRevision) {
                        dependencies.markdown = dependencies.pendingSave.content;
                        dependencies.hasUserEdited = false;
                        dependencies.cancelScheduledSync();
                    }
                    dependencies.pendingSave = null;
                }
                return;
            }
            if (message.type === 'cancelExportPreparation') {
                const controller = dependencies.exportRenderRequests.get(message.requestId);
                if (controller)
                    controller.abort();
                return;
            }
            if (message.type === 'prepareExport') {
                if (typeof dependencies.host.respondExport !== 'function')
                    return;
                // Capture before queuing so later editor settings cannot change an
                // in-flight export. Optional fields support older host fixtures.
                const appearance = {
                    theme: message.theme || document.documentElement.dataset.theme || 'github',
                    fontSize: message.fontSize || parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size')) || 16
                };
                const controller = new AbortController();
                dependencies.exportRenderRequests.set(message.requestId, controller);
                dependencies.exportRenderQueue = dependencies.exportRenderQueue.catch(() => { }).then(async () => {
                    try {
                        const prepared = await dependencies.prepareExportDocument(message.markdown, appearance, controller.signal);
                        dependencies.host.respondExport(Object.assign({ type: 'exportPrepared', requestId: message.requestId }, prepared));
                    }
                    catch (error) {
                        dependencies.host.respondExport({ type: 'exportError', requestId: message.requestId, error: error.message || String(error) });
                    }
                    finally {
                        dependencies.exportRenderRequests.delete(message.requestId);
                    }
                });
                return;
            }
            if (message.type === 'captureExportSnapshot') {
                if (typeof dependencies.host.respondExport === 'function') {
                    if (message.refreshToc) {
                        try {
                            dependencies.refreshManagedTocs(false);
                        }
                        catch (error) {
                            dependencies.host.respondExport({ type: 'exportError', requestId: message.requestId, error: error.message });
                            return;
                        }
                    }
                    dependencies.host.respondExport({
                        type: 'exportSnapshot', requestId: message.requestId,
                        content: dependencies.readCurrentMarkdown(),
                        pending: Boolean(dependencies.syncTimeout || dependencies.saveTimeout || dependencies.pendingSync || dependencies.pendingSave || dependencies.queuedExternalContent !== null)
                    });
                }
                return;
            }
            if (message.type === 'performUndo') {
                dependencies.undoManager.undo();
                return;
            }
            if (message.type === 'performRedo') {
                dependencies.undoManager.redo();
                return;
            }
            if (message.type === 'insertToc') {
                dependencies.insertManagedToc();
                return;
            }
            if (message.type === 'toggleSourceMode') {
                dependencies.toggleSourceMode();
                return;
            }
            if (message.type === 'update') {
                dependencies.logger.log('[Binary Markdown] update message received, content length:', message.content?.length);
                // Normalize incoming content: strip BOM, normalize line endings
                let incomingContent = message.content || '';
                if (incomingContent.charCodeAt(0) === 0xFEFF) {
                    incomingContent = incomingContent.slice(1);
                }
                incomingContent = incomingContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                // Active editing guard: queue external changes while user is typing
                if (dependencies.isActivelyEditing) {
                    dependencies.queuedExternalContent = incomingContent;
                    dependencies.logger.log('[Binary Markdown] update queued: user is actively editing');
                    return;
                }
                // Idle state — apply external change immediately with cursor preservation
                dependencies.markdown = incomingContent;
                dependencies.currentImageDir = dependencies.extractImageDirFromMarkdown(dependencies.markdown);
                dependencies.currentForceRelativePath = dependencies.extractForceRelativePathFromMarkdown(dependencies.markdown);
                if (dependencies.isSourceMode) {
                    dependencies.sourceEditor.value = dependencies.markdown;
                }
                else {
                    dependencies.updateFromMarkdown();
                }
                dependencies.updateOutline();
                dependencies.updateWordCount();
                dependencies.updateStatus();
                dependencies.undoManager.clear();
            }
            else if (message.type === 'setImageDir') {
                // Update currentImageDir and currentForceRelativePath from extension
                dependencies.currentImageDir = message.dirPath;
                // Set forceRelativePath with true or false; clear it with null.
                if (message.forceRelativePath === null) {
                    dependencies.currentForceRelativePath = null;
                }
                else if (message.forceRelativePath !== undefined) {
                    dependencies.currentForceRelativePath = message.forceRelativePath;
                }
                dependencies.updateStatus(); // Update status bar to show IMAGE_DIR and FORCE_RELATIVE_PATH
                dependencies.syncMarkdown(); // Re-sync to include the new directives
            }
            else if (message.type === 'imageDirStatus') {
                dependencies.imageDirDisplayPath = message.displayPath;
                dependencies.imageDirSource = message.source;
                dependencies.updateStatus();
            }
            else if (message.type === 'insertCancelled') {
                dependencies.finishHostInsertion(message, false);
            }
            else if (message.type === 'insertImageHtml') {
                if (!dependencies.finishHostInsertion(message, true))
                    return;
                dependencies.logger.log('insertImageHtml received:', message);
                // Insert image at cursor position
                const img = document.createElement('img');
                img.src = message.displayUri;
                img.alt = message.markdownPath || '';
                img.dataset.markdownPath = message.markdownPath;
                img.style.maxWidth = '100%';
                img.onerror = function () {
                    dependencies.logger.error('Image failed to load:', message.displayUri);
                };
                img.onload = function () {
                    dependencies.logger.log('Image loaded successfully');
                };
                dependencies.editor.focus();
                const sel = window.getSelection();
                if (sel && sel.rangeCount) {
                    const range = sel.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(img);
                    range.setStartAfter(img);
                    range.setEndAfter(img);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                else {
                    dependencies.editor.appendChild(img);
                }
                dependencies.syncMarkdownSync();
                dependencies.logger.log('Image element inserted');
            }
            else if (message.type === 'insertLinkHtml') {
                if (!dependencies.finishHostInsertion(message, true))
                    return;
                // Insert link at cursor position
                const a = document.createElement('a');
                a.href = message.url;
                a.textContent = message.text;
                dependencies.setupLink(a);
                const sel = window.getSelection();
                if (sel && sel.rangeCount) {
                    const range = sel.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(a);
                    range.setStartAfter(a);
                    range.setEndAfter(a);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                else {
                    dependencies.editor.appendChild(a);
                }
                dependencies.syncMarkdownSync();
                dependencies.editor.focus();
            }
            else if (message.type === 'externalChangeDetected') {
                // Show toast notification for external change
                dependencies.showEditorToast(message.message);
            }
            else if (message.type === 'scrollToAnchor') {
                // Scroll to anchor (heading) in the document
                const anchor = message.anchor;
                if (anchor) {
                    // Find heading by id or by text content
                    const headings = dependencies.editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
                    for (const heading of headings) {
                        // Generate slug from heading text (same as GitHub-style anchor)
                        const headingText = heading.textContent || '';
                        const slug = headingText
                            .toLowerCase()
                            .trim()
                            .replace(/[^\w\s\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\uac00-\ud7af-]/g, '') // Keep alphanumeric, Japanese, Chinese, Korean, hyphen
                            .replace(/\s+/g, '-'); // Replace spaces with hyphens
                        if (slug === anchor || heading.id === anchor) {
                            const wrapper = dependencies.editor.closest('.editor-wrapper');
                            if (wrapper) {
                                const wrapperRect = wrapper.getBoundingClientRect();
                                const headingRect = heading.getBoundingClientRect();
                                wrapper.scrollTo({ top: wrapper.scrollTop + headingRect.top - wrapperRect.top, behavior: 'smooth' });
                            }
                            else {
                                heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                            // Briefly highlight the heading
                            heading.style.transition = 'background-color 0.3s';
                            heading.style.backgroundColor = 'var(--selection-bg)';
                            setTimeout(() => {
                                heading.style.backgroundColor = '';
                            }, 1500);
                            break;
                        }
                    }
                }
            }
        });
    }
    return {
        initializeControls
    };
}
module.exports = { createHost };
