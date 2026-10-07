// Preserve the existing browser helper APIs while bundling CommonJS modules.
require('./workspace-ui');
window.BinaryTableFormat = require('../shared/table-format');
window.BinaryEditorLayout = require('../shared/editor-layout');
window.BinaryTablePlacement = require('../shared/table-placement');
require('./table-toolbar');
window.BinaryMath = require('../shared/math-syntax');

(function() {
    // Debug logging configuration
    const DEBUG_MODE = __DEBUG_MODE__;
    const logger = {
        log: DEBUG_MODE ? (...args) => console.log('[DEBUG]', ...args) : () => {},
        warn: DEBUG_MODE ? (...args) => console.warn('[DEBUG]', ...args) : () => {},
        error: DEBUG_MODE ? (...args) => console.error('[DEBUG]', ...args) : () => {}
    };

    const host = window.hostBridge;
    const mathSyntax = window.BinaryMath;
    const tableFormat = window.BinaryTableFormat;
    const emptyTableCell = '<br data-table-placeholder="true">';
    const mathBackslashDelimiters = __MATH_BACKSLASH__;
    var finishInlineMathEdit = null;
    const documentAux = window.documentAux;
    let frontMatterOpen = false;
    const i18n = __I18N__;
    logger.log('[Binary Markdown] i18n loaded:', i18n.livePreviewMode ? 'OK' : 'EMPTY', '- Sample:', i18n.bold || '(none)');
    const editor = document.getElementById('editor');
    const sourceEditor = document.getElementById('sourceEditor');
    const outline = document.getElementById('outline');
    const wordCount = document.getElementById('wordCount');
    const statusImageDir = document.getElementById('statusImageDir');
    const sidebar = document.getElementById('sidebar');
    const toolbar = document.getElementById('toolbar');
    const editorWrapper = document.getElementById('editorWrapper');

    const { changeParentListType, areListsCompatible, mergeAdjacentLists, indentListItem, outdentListItem, convertListItemToParagraph, convertToList, convertToTaskList, convertLiToType, convertListToType } = require('./editor/editing/lists').createLists({
        get editor() { return editor; },
        get getSelectedListItems() { return getSelectedListItems; },
        get logger() { return logger; },
        get setCursorToEnd() { return setCursorToEnd; },
        get setupInteractiveElements() { return setupInteractiveElements; },
        get syncMarkdown() { return syncMarkdown; }
    });

    const { checkTablePattern, convertToTable, checkAllPatterns, checkBlockPatterns } = require('./editor/editing/block-patterns').createBlockPatterns({
        get addTableResizeHandles() { return addTableResizeHandles; },
        get changeParentListType() { return changeParentListType; },
        get checkInlinePatterns() { return checkInlinePatterns; },
        get editor() { return editor; },
        get emptyTableCell() { return emptyTableCell; },
        get logger() { return logger; },
        get renderMathBlock() { return renderMathBlock; },
        get renderMermaidDiagram() { return renderMermaidDiagram; },
        get setCursorToEnd() { return setCursorToEnd; },
        get setupCodeBlockUI() { return setupCodeBlockUI; },
        get syncMarkdown() { return syncMarkdown; }
    });

    const { checkInlinePatterns, replaceInlinePatternAnywhere, checkInlineEscape, toggleStrikethrough, isRangeInsideStrikethroughTag, checkStrikethroughStatus, unwrapStrikethroughInRange, wrapRangeWithTag, toggleUnderline, applyInlineFormat } = require('./editor/editing/inline-format').createInlineFormat({
        get editor() { return editor; },
        get editorRange() { return editorRange; },
        get i18n() { return i18n; },
        get inlineMathHtml() { return inlineMathHtml; },
        get isSourceMode() { return isSourceMode; },
        get logger() { return logger; },
        get markdown() { return markdown; }, set markdown(value) { markdown = value; },
        get mathBackslashDelimiters() { return mathBackslashDelimiters; },
        get mathSyntax() { return mathSyntax; },
        get readCurrentMarkdown() { return readCurrentMarkdown; },
        get setupInlineMath() { return setupInlineMath; },
        get showEditorToast() { return showEditorToast; },
        get syncMarkdown() { return syncMarkdown; },
        get syncMarkdownSync() { return syncMarkdownSync; },
        get undoManager() { return undoManager; }
    });

    const { renderFromMarkdown, normalizeBlockHtml, blocksAreEqual, isProtectedBlock, updateFromMarkdown, renderFrontMatter, renderTocBlock, assignHeadingAnchors, refreshManagedTocs, insertManagedToc, setupDocumentAux, setupLink, setupInteractiveElements, setupAllCodeBlocks } = require('./editor/blocks/render').createRender({
        get addTableResizeHandles() { return addTableResizeHandles; },
        get applyPreviewReadOnly() { return applyPreviewReadOnly; },
        get cancelScheduledSync() { return cancelScheduledSync; },
        get captureCodeViews() { return captureCodeViews; },
        get closeInsertMenu() { return closeInsertMenu; },
        get closeLanguageSelector() { return closeLanguageSelector; },
        get documentAux() { return documentAux; },
        get editor() { return editor; },
        get editorRenderRevision() { return editorRenderRevision; }, set editorRenderRevision(value) { editorRenderRevision = value; },
        get escapeHtml() { return escapeHtml; },
        get frontMatterOpen() { return frontMatterOpen; }, set frontMatterOpen(value) { frontMatterOpen = value; },
        get getCurrentLine() { return getCurrentLine; },
        get host() { return host; },
        get i18n() { return i18n; },
        get initializedLinks() { return initializedLinks; },
        get isSourceMode() { return isSourceMode; },
        get logger() { return logger; },
        get markActivelyEditing() { return markActivelyEditing; },
        get markAsEdited() { return markAsEdited; },
        get markdown() { return markdown; }, set markdown(value) { markdown = value; },
        get markdownToHtmlFragment() { return markdownToHtmlFragment; },
        get notifyChangeImmediate() { return notifyChangeImmediate; },
        get readCurrentMarkdown() { return readCurrentMarkdown; },
        get removeDirectivesFromMarkdown() { return removeDirectivesFromMarkdown; },
        get restoreCodeViews() { return restoreCodeViews; },
        get restoreCursorState() { return restoreCursorState; },
        get saveCurrentDocument() { return saveCurrentDocument; },
        get saveCursorState() { return saveCursorState; },
        get setupCodeBlockUI() { return setupCodeBlockUI; },
        get setupInlineMath() { return setupInlineMath; },
        get setupMathBlocks() { return setupMathBlocks; },
        get setupMermaidDiagrams() { return setupMermaidDiagrams; },
        get showEditorToast() { return showEditorToast; },
        get sourceEditor() { return sourceEditor; },
        get syncMarkdown() { return syncMarkdown; },
        get syncMarkdownSync() { return syncMarkdownSync; },
        get tableControls() { return tableControls; },
        get undoManager() { return undoManager; },
        get updateOutline() { return updateOutline; },
        get updatePlaceholder() { return updatePlaceholder; },
        get updateWordCount() { return updateWordCount; },
        get visualSourceCurrent() { return visualSourceCurrent; }, set visualSourceCurrent(value) { visualSourceCurrent = value; },
        get workspaceUi() { return workspaceUi; }
    });

    const { checkExportCancellation, awaitExportReady, exportWarning, stripExportMetadata, hasUnsafeExportStyle, sanitizeExportTree, createExportFallback, prepareExportDocument } = require('./editor/blocks/export').createExport({
        get applyHighlighting() { return applyHighlighting; },
        get assignHeadingAnchors() { return assignHeadingAnchors; },
        get documentAux() { return documentAux; },
        get exportRenderSequence() { return exportRenderSequence; }, set exportRenderSequence(value) { exportRenderSequence = value; },
        get getCodePlainText() { return getCodePlainText; },
        get initMermaid() { return initMermaid; },
        get inlineMathMarkdown() { return inlineMathMarkdown; },
        get markdownToHtmlFragment() { return markdownToHtmlFragment; },
        get renderInlineMath() { return renderInlineMath; },
        get renderMathBlock() { return renderMathBlock; }
    });

    const { isSpecialWrapper, enterSpecialWrapperEditMode, stripSentinelAndRebuildCode, exitSpecialWrapperDisplayMode, waitForMermaid, initMermaid, setBlockDiagnostic, renderMermaidDiagram, setupMermaidDiagrams, inlineMathHtml, inlineMathMarkdown, renderInlineMath, setupInlineMath, editInlineMath, mathBlockHtml, mathBlockMarkdown, waitForKatex, renderMathBlock, setupMathBlocks } = require('./editor/blocks/special').createSpecial({
        get codeBlocksWithSentinel() { return codeBlocksWithSentinel; },
        get editor() { return editor; },
        get escapeHtml() { return escapeHtml; },
        get finishInlineMathEdit() { return finishInlineMathEdit; }, set finishInlineMathEdit(value) { finishInlineMathEdit = value; },
        get getCodePlainText() { return getCodePlainText; },
        get i18n() { return i18n; },
        get isSourceMode() { return isSourceMode; },
        get logger() { return logger; },
        get markdown() { return markdown; }, set markdown(value) { markdown = value; },
        get mermaidInitialized() { return mermaidInitialized; }, set mermaidInitialized(value) { mermaidInitialized = value; },
        get mermaidReady() { return mermaidReady; }, set mermaidReady(value) { mermaidReady = value; },
        get mermaidRenderVersions() { return mermaidRenderVersions; },
        get readCurrentMarkdown() { return readCurrentMarkdown; },
        get saveCurrentDocument() { return saveCurrentDocument; },
        get setCursorToEnd() { return setCursorToEnd; },
        get setCursorToFirstTextNode() { return setCursorToFirstTextNode; },
        get setCursorToLastLineStartByDOM() { return setCursorToLastLineStartByDOM; },
        get stripTrailingNewlines() { return stripTrailingNewlines; },
        get syncMarkdown() { return syncMarkdown; },
        get syncMarkdownSync() { return syncMarkdownSync; },
        get undoManager() { return undoManager; },
        get workspaceUi() { return workspaceUi; }
    });

    const { revealTableCaret, scrollTableToCaret, showTableToolbar, hideTableToolbar, deleteTableColumn, deleteTableRow, insertTableRowBelow, insertTableRowAbove, insertTableColumnRight, insertTableColumnLeft, setColumnAlignment, addTableResizeHandles, initializeTableColumnWidths, updateColumnWidth, handleResizeStart, handleResizeMove, handleResizeEnd, initializeAllTableResizeHandles } = require('./editor/blocks/tables').createTables({
        get activeTable() { return activeTable; }, set activeTable(value) { activeTable = value; },
        get activeTableCell() { return activeTableCell; }, set activeTableCell(value) { activeTableCell = value; },
        get editor() { return editor; },
        get emptyTableCell() { return emptyTableCell; },
        get isTableColResizing() { return isTableColResizing; }, set isTableColResizing(value) { isTableColResizing = value; },
        get logger() { return logger; },
        get resizeStartWidth() { return resizeStartWidth; }, set resizeStartWidth(value) { resizeStartWidth = value; },
        get resizeStartX() { return resizeStartX; }, set resizeStartX(value) { resizeStartX = value; },
        get resizingCell() { return resizingCell; }, set resizingCell(value) { resizingCell = value; },
        get resizingTable() { return resizingTable; }, set resizingTable(value) { resizingTable = value; },
        get setCursorToEnd() { return setCursorToEnd; },
        get syncMarkdown() { return syncMarkdown; },
        get tableControls() { return tableControls; }
    });

    const { ordinaryCodeBlocks, codeViewId, captureCodeViews, restoreCodeViews, applyCodeWrap, toggleCodeWrap, setupCodeBlockUI, deleteCodeBlock, closeLanguageSelector, positionLanguageSelector, showLanguageSelector, setCodeCopyState, copyCodeBlock } = require('./editor/blocks/code-controls').createCodeControls({
        get applyHighlighting() { return applyHighlighting; },
        get codeLanguageName() { return codeLanguageName; },
        get codeViewIds() { return codeViewIds; },
        get codeViewSequence() { return codeViewSequence; }, set codeViewSequence(value) { codeViewSequence = value; },
        get codeViewStates() { return codeViewStates; },
        get convertToSpecialBlock() { return convertToSpecialBlock; },
        get editor() { return editor; },
        get editorWrapper() { return editorWrapper; },
        get enterDisplayMode() { return enterDisplayMode; },
        get enterEditMode() { return enterEditMode; },
        get getCodePlainText() { return getCodePlainText; },
        get host() { return host; },
        get htmlToMarkdown() { return htmlToMarkdown; },
        get i18n() { return i18n; },
        get isNavigatingIntoBlock() { return isNavigatingIntoBlock; },
        get isSourceMode() { return isSourceMode; },
        get LANGUAGE_ALIASES() { return LANGUAGE_ALIASES; },
        get logger() { return logger; },
        get LUCIDE_ICONS() { return LUCIDE_ICONS; },
        get markdown() { return markdown; }, set markdown(value) { markdown = value; },
        get mdProcessNode() { return mdProcessNode; },
        get orderedCodeLanguages() { return orderedCodeLanguages; },
        get setCursorToEnd() { return setCursorToEnd; },
        get setCursorToFirstTextNode() { return setCursorToFirstTextNode; },
        get stripTrailingNewlines() { return stripTrailingNewlines; },
        get syncMarkdownSync() { return syncMarkdownSync; },
        get undoManager() { return undoManager; },
        get updateOutline() { return updateOutline; },
        get updateWordCount() { return updateWordCount; }
    });

    const { updateWidthIndicators, applyEditorWidth, applyMathSourcePreference, initToolbarIcons, closeToolbarOverflow, positionToolbarOverflow, toolbarMenuChoices, renderToolbarCommandSearch, openToolbarOverflow, scheduleToolbarLayout, layoutToolbarActions, requestHostInsertion, finishHostInsertion, captureToolbarSelection, setSidebarOpen, openSidebar, closeSidebar, applyPreviewReadOnly, scheduleSplitPreview, sourceHeadings, sourceOffset, updateSourceCorrespondence, sourceDomPositions, sourceSelectionFromVisual, restoreVisualFromSource, setEditorMode, toggleSourceMode, updateOutline, setActiveOutlineItem, updateActiveOutlineItem, scheduleActiveOutlineUpdate, updateWordCount, updateStatus } = require('./editor/ui/chrome').createChrome({
        get activeOutlineIndex() { return activeOutlineIndex; }, set activeOutlineIndex(value) { activeOutlineIndex = value; },
        get assignHeadingAnchors() { return assignHeadingAnchors; },
        get cancelScheduledSync() { return cancelScheduledSync; },
        get closeInsertMenu() { return closeInsertMenu; },
        get closeLanguageSelector() { return closeLanguageSelector; },
        get closeSearchBox() { return closeSearchBox; },
        get createCommandItem() { return createCommandItem; },
        get documentAux() { return documentAux; },
        get editor() { return editor; },
        get editorRange() { return editorRange; },
        get editorRenderRevision() { return editorRenderRevision; },
        get editorWrapper() { return editorWrapper; },
        get escapeHtml() { return escapeHtml; },
        get hideTableToolbar() { return hideTableToolbar; },
        get host() { return host; },
        get hostInsertSequence() { return hostInsertSequence; }, set hostInsertSequence(value) { hostInsertSequence = value; },
        get i18n() { return i18n; },
        get imageDirDisplayPath() { return imageDirDisplayPath; },
        get imageDirSource() { return imageDirSource; },
        get inlineMathMarkdown() { return inlineMathMarkdown; },
        get insertActions() { return insertActions; },
        get insertUnavailable() { return insertUnavailable; },
        get isSourceMode() { return isSourceMode; }, set isSourceMode(value) { isSourceMode = value; },
        get isSplitMode() { return isSplitMode; }, set isSplitMode(value) { isSplitMode = value; },
        get LUCIDE_ICONS() { return LUCIDE_ICONS; },
        get markdown() { return markdown; }, set markdown(value) { markdown = value; },
        get markdownToHtmlFragment() { return markdownToHtmlFragment; },
        get matchingCommandItems() { return matchingCommandItems; },
        get mathBackslashDelimiters() { return mathBackslashDelimiters; },
        get mdProcessNode() { return mdProcessNode; },
        get notifyChangeImmediate() { return notifyChangeImmediate; },
        get openSidebarBtn() { return openSidebarBtn; },
        get outline() { return outline; },
        get outlineHeadings() { return outlineHeadings; }, set outlineHeadings(value) { outlineHeadings = value; },
        get outlineScrollFrame() { return outlineScrollFrame; }, set outlineScrollFrame(value) { outlineScrollFrame = value; },
        get pendingHostInsert() { return pendingHostInsert; }, set pendingHostInsert(value) { pendingHostInsert = value; },
        get readCommittedMarkdown() { return readCommittedMarkdown; },
        get readCurrentMarkdown() { return readCurrentMarkdown; },
        get renderFromMarkdown() { return renderFromMarkdown; },
        get restoreCursorState() { return restoreCursorState; },
        get saveCursorState() { return saveCursorState; },
        get savedToolbarRange() { return savedToolbarRange; }, set savedToolbarRange(value) { savedToolbarRange = value; },
        get searchReplaceBox() { return searchReplaceBox; },
        get showEditorToast() { return showEditorToast; },
        get sidebar() { return sidebar; },
        get sourceEditor() { return sourceEditor; },
        get sourceModeSelection() { return sourceModeSelection; }, set sourceModeSelection(value) { sourceModeSelection = value; },
        get splitRenderTimer() { return splitRenderTimer; }, set splitRenderTimer(value) { splitRenderTimer = value; },
        get statusImageDir() { return statusImageDir; },
        get tableControls() { return tableControls; },
        get toolbar() { return toolbar; },
        get toolbarActions() { return toolbarActions; },
        get toolbarCommandResults() { return toolbarCommandResults; },
        get toolbarCommandSearch() { return toolbarCommandSearch; },
        get toolbarInner() { return toolbarInner; },
        get toolbarLayoutFrame() { return toolbarLayoutFrame; }, set toolbarLayoutFrame(value) { toolbarLayoutFrame = value; },
        get toolbarMenuRange() { return toolbarMenuRange; }, set toolbarMenuRange(value) { toolbarMenuRange = value; },
        get toolbarMenuRevision() { return toolbarMenuRevision; }, set toolbarMenuRevision(value) { toolbarMenuRevision = value; },
        get toolbarMenuSourceSelection() { return toolbarMenuSourceSelection; }, set toolbarMenuSourceSelection(value) { toolbarMenuSourceSelection = value; },
        get toolbarMore() { return toolbarMore; },
        get toolbarOverflow() { return toolbarOverflow; },
        get toolbarOverflowItems() { return toolbarOverflowItems; },
        get undoManager() { return undoManager; },
        get visualModeCursor() { return visualModeCursor; }, set visualModeCursor(value) { visualModeCursor = value; },
        get widthBounds() { return widthBounds; },
        get widthExplanation() { return widthExplanation; },
        get widthGuide() { return widthGuide; },
        get wordCount() { return wordCount; },
        get workspaceUi() { return workspaceUi; }
    });

    const { dispatchToolbarAction, executeCommandPaletteAction, executeEditorCommand, convertToHeading, convertToParagraph, convertToBlockquote, convertToCodeBlock, insertHorizontalRule, wrapWithInlineCode, insertLink } = require('./editor/ui/commands').createCommands({
        get applyInlineFormat() { return applyInlineFormat; },
        get commandPalette() { return commandPalette; },
        get commandPaletteRepositionHandler() { return commandPaletteRepositionHandler; },
        get commandPaletteSavedRange() { return commandPaletteSavedRange; }, set commandPaletteSavedRange(value) { commandPaletteSavedRange = value; },
        get commandPaletteVisible() { return commandPaletteVisible; }, set commandPaletteVisible(value) { commandPaletteVisible = value; },
        get convertListToType() { return convertListToType; },
        get convertToList() { return convertToList; },
        get convertToSpecialBlock() { return convertToSpecialBlock; },
        get convertToTaskList() { return convertToTaskList; },
        get editInlineMath() { return editInlineMath; },
        get editor() { return editor; },
        get editorRange() { return editorRange; },
        get enterEditMode() { return enterEditMode; },
        get enterSpecialWrapperEditMode() { return enterSpecialWrapperEditMode; },
        get escapeHtml() { return escapeHtml; },
        get getCurrentLine() { return getCurrentLine; },
        get inlineMathHtml() { return inlineMathHtml; },
        get insertActions() { return insertActions; },
        get insertManagedToc() { return insertManagedToc; },
        get isSpecialWrapper() { return isSpecialWrapper; },
        get markAsEdited() { return markAsEdited; },
        get openInsertMenu() { return openInsertMenu; },
        get openSearchBox() { return openSearchBox; },
        get openSidebar() { return openSidebar; },
        get requestHostInsertion() { return requestHostInsertion; },
        get setCursorToEnd() { return setCursorToEnd; },
        get setEditorMode() { return setEditorMode; },
        get setupCodeBlockUI() { return setupCodeBlockUI; },
        get setupInlineMath() { return setupInlineMath; },
        get setupLink() { return setupLink; },
        get stopCommandPaletteOutsideClicks() { return stopCommandPaletteOutsideClicks; },
        get syncMarkdown() { return syncMarkdown; },
        get syncMarkdownSync() { return syncMarkdownSync; },
        get toggleUnderline() { return toggleUnderline; },
        get undoManager() { return undoManager; }
    });

    const { createInsertPreview, filterInsertWorkspace, editorRange, insertUnavailable, insertTrigger, positionInsertMenu, updateInsertScroll, restoreInsertRange, focusInsertChoice, closeInsertMenu, openInsertMenu, parseI18nLabel, createCommandPalette, commandItemLabel, matchingCommandItems, createCommandItem, renderCommandPaletteItems, moveCommandPaletteSelection, commandPaletteOutsideClickHandler, stopCommandPaletteOutsideClicks, commandPaletteRepositionHandler, openCommandPalette, closeCommandPalette } = require('./editor/ui/menus').createMenus({
        get actionDescription() { return actionDescription; },
        get applyHighlighting() { return applyHighlighting; },
        get closeToolbarOverflow() { return closeToolbarOverflow; },
        get COMMAND_PALETTE_GROUPS() { return COMMAND_PALETTE_GROUPS; },
        get COMMAND_PALETTE_ITEMS() { return COMMAND_PALETTE_ITEMS; },
        get commandPalette() { return commandPalette; }, set commandPalette(value) { commandPalette = value; },
        get commandPaletteCategory() { return commandPaletteCategory; }, set commandPaletteCategory(value) { commandPaletteCategory = value; },
        get commandPaletteCount() { return commandPaletteCount; }, set commandPaletteCount(value) { commandPaletteCount = value; },
        get commandPaletteInput() { return commandPaletteInput; }, set commandPaletteInput(value) { commandPaletteInput = value; },
        get commandPaletteList() { return commandPaletteList; }, set commandPaletteList(value) { commandPaletteList = value; },
        get commandPaletteOutsideClickTimer() { return commandPaletteOutsideClickTimer; }, set commandPaletteOutsideClickTimer(value) { commandPaletteOutsideClickTimer = value; },
        get commandPaletteSavedRange() { return commandPaletteSavedRange; }, set commandPaletteSavedRange(value) { commandPaletteSavedRange = value; },
        get commandPaletteVisible() { return commandPaletteVisible; }, set commandPaletteVisible(value) { commandPaletteVisible = value; },
        get editor() { return editor; },
        get executeCommandPaletteAction() { return executeCommandPaletteAction; },
        get i18n() { return i18n; },
        get insertButton() { return insertButton; },
        get insertCategory() { return insertCategory; },
        get insertCategorySelection() { return insertCategorySelection; }, set insertCategorySelection(value) { insertCategorySelection = value; },
        get insertMenu() { return insertMenu; },
        get insertMenuRange() { return insertMenuRange; }, set insertMenuRange(value) { insertMenuRange = value; },
        get insertSamples() { return insertSamples; },
        get insertSearch() { return insertSearch; },
        get isSourceMode() { return isSourceMode; },
        get LUCIDE_ICONS() { return LUCIDE_ICONS; },
        get savedToolbarRange() { return savedToolbarRange; },
        get toolbar() { return toolbar; },
        get toolbarMore() { return toolbarMore; },
        get undoManager() { return undoManager; }
    });

    const { readCommittedMarkdown, readCurrentMarkdown, cancelScheduledSync, saveCurrentDocument, debouncedSync, syncMarkdownDeferred, syncMarkdown, syncMarkdownSync, notifyChangeImmediate, notifyChange, markAsEdited, markActivelyEditing, applyQueuedExternalChange } = require('./editor/core/session').createSession({
        get clientRevision() { return clientRevision; }, set clientRevision(value) { clientRevision = value; },
        get currentForceRelativePath() { return currentForceRelativePath; }, set currentForceRelativePath(value) { currentForceRelativePath = value; },
        get currentImageDir() { return currentImageDir; }, set currentImageDir(value) { currentImageDir = value; },
        get EDITING_IDLE_TIMEOUT() { return EDITING_IDLE_TIMEOUT; },
        get editingIdleTimer() { return editingIdleTimer; }, set editingIdleTimer(value) { editingIdleTimer = value; },
        get extractForceRelativePathFromMarkdown() { return extractForceRelativePathFromMarkdown; },
        get extractImageDirFromMarkdown() { return extractImageDirFromMarkdown; },
        get finishInlineMathEdit() { return finishInlineMathEdit; },
        get hasUserEdited() { return hasUserEdited; }, set hasUserEdited(value) { hasUserEdited = value; },
        get host() { return host; },
        get htmlToMarkdown() { return htmlToMarkdown; },
        get isActivelyEditing() { return isActivelyEditing; }, set isActivelyEditing(value) { isActivelyEditing = value; },
        get isSourceMode() { return isSourceMode; },
        get logger() { return logger; },
        get markdown() { return markdown; }, set markdown(value) { markdown = value; },
        get pendingSave() { return pendingSave; }, set pendingSave(value) { pendingSave = value; },
        get pendingSync() { return pendingSync; }, set pendingSync(value) { pendingSync = value; },
        get queuedExternalContent() { return queuedExternalContent; }, set queuedExternalContent(value) { queuedExternalContent = value; },
        get refreshManagedTocs() { return refreshManagedTocs; },
        get saveTimeout() { return saveTimeout; }, set saveTimeout(value) { saveTimeout = value; },
        get showEditorToast() { return showEditorToast; },
        get sourceEditor() { return sourceEditor; },
        get syncGeneration() { return syncGeneration; }, set syncGeneration(value) { syncGeneration = value; },
        get syncTimeout() { return syncTimeout; }, set syncTimeout(value) { syncTimeout = value; },
        get updateFromMarkdown() { return updateFromMarkdown; },
        get updateOutline() { return updateOutline; },
        get updatePlaceholder() { return updatePlaceholder; },
        get updateStatus() { return updateStatus; },
        get updateWordCount() { return updateWordCount; },
        get visualSourceCurrent() { return visualSourceCurrent; }, set visualSourceCurrent(value) { visualSourceCurrent = value; }
    });

    const { showEditorToast, createDragCursor, showDragCursor, hideDragCursor, readAndInsertImage } = require('./editor/transfer/clipboard').createClipboard({
        get dragCursor() { return dragCursor; }, set dragCursor(value) { dragCursor = value; },
        get editor() { return editor; },
        get externalChangeToast() { return externalChangeToast; }, set externalChangeToast(value) { externalChangeToast = value; },
        get host() { return host; },
        get logger() { return logger; },
        get toastHideTimer() { return toastHideTimer; }, set toastHideTimer(value) { toastHideTimer = value; }
    });


    const { handleMathDelimiterEnter, handleContextSelectAll, handleKeydown } = require('./editor/input/dispatch').createDispatch({
        get getCurrentLine() { return getCurrentLine; },
        get mathBackslashDelimiters() { return mathBackslashDelimiters; },
        get undoManager() { return undoManager; },
        get mathBlockHtml() { return mathBlockHtml; },
        get setupMathBlocks() { return setupMathBlocks; },
        get enterSpecialWrapperEditMode() { return enterSpecialWrapperEditMode; },
        get syncMarkdown() { return syncMarkdown; },
        get logger() { return logger; },
        get handleEarlyListBackspace() { return handleEarlyListBackspace; },
        get handlePlainShiftEnter() { return handlePlainShiftEnter; },
        get handleInlineShiftEnter() { return handleInlineShiftEnter; },
        get handleTableEnter() { return handleTableEnter; },
        get handleCodeEnter() { return handleCodeEnter; },
        get handleQuoteEnter() { return handleQuoteEnter; },
        get handleListEnter() { return handleListEnter; },
        get handleProseEnter() { return handleProseEnter; },
        get handleSpacePatterns() { return handleSpacePatterns; },
        get handleTableTab() { return handleTableTab; },
        get handleCodeQuoteTab() { return handleCodeQuoteTab; },
        get handleMultiListTab() { return handleMultiListTab; },
        get handleSingleListTab() { return handleSingleListTab; },
        get handleGeneralTab() { return handleGeneralTab; },
        get handleTableArrows() { return handleTableArrows; },
        get handleBlockArrows() { return handleBlockArrows; },
        get handleFallbackEmptyList() { return handleFallbackEmptyList; },
        get handleParagraphInsideListDelete() { return handleParagraphInsideListDelete; },
        get handleParagraphDelete() { return handleParagraphDelete; },
        get handleCodeSpecialDelete() { return handleCodeSpecialDelete; },
        get handleHeadingQuoteDelete() { return handleHeadingQuoteDelete; },
        get handleRemainingListDelete() { return handleRemainingListDelete; },
        get isSourceMode() { return isSourceMode; },
        get markActivelyEditing() { return markActivelyEditing; },
        get editor() { return editor; },
        get handleBackspaceOnList() { return handleBackspaceOnList; }
    });
    const { handleEarlyListBackspace } = require('./editor/input/list-selection-delete').createListSelectionDelete({
        get logger() { return logger; },
        get editor() { return editor; },
        get syncMarkdownSync() { return syncMarkdownSync; },
        get setCursorToEnd() { return setCursorToEnd; },
        get syncMarkdown() { return syncMarkdown; }
    });
    const { handlePlainShiftEnter, handleInlineShiftEnter, handleProseEnter, handleSpacePatterns, handleGeneralTab, handleHeadingQuoteDelete } = require('./editor/input/paragraph-format').createParagraphFormat({
        get syncMarkdown() { return syncMarkdown; },
        get logger() { return logger; },
        get getCurrentLine() { return getCurrentLine; },
        get setCursorToStart() { return setCursorToStart; },
        get checkTablePattern() { return checkTablePattern; },
        get convertToTable() { return convertToTable; },
        get setCursorToEnd() { return setCursorToEnd; },
        get checkAllPatterns() { return checkAllPatterns; },
        get checkInlinePatterns() { return checkInlinePatterns; },
        get undoManager() { return undoManager; },
        get checkInlineEscape() { return checkInlineEscape; },
        get editor() { return editor; }
    });
    const { handleTableEnter, handleTableTab, handleTableArrows } = require('./editor/input/tables').createTables({
        get logger() { return logger; },
        get emptyTableCell() { return emptyTableCell; },
        get activeTableCell() { return activeTableCell; }, set activeTableCell(value) { activeTableCell = value; },
        get setCursorToEnd() { return setCursorToEnd; },
        get syncMarkdown() { return syncMarkdown; },
        get editor() { return editor; },
        get showTableToolbar() { return showTableToolbar; },
        get setCursorToLastLineStartByDOM() { return setCursorToLastLineStartByDOM; },
        get navigateToAdjacentElement() { return navigateToAdjacentElement; },
        get hideTableToolbar() { return hideTableToolbar; },
        get activeTable() { return activeTable; }, set activeTable(value) { activeTable = value; },
        get setCursorToStart() { return setCursorToStart; },
        get revealTableCaret() { return revealTableCaret; }
    });
    const { handleCodeEnter, handleQuoteEnter, handleCodeQuoteTab, handleBlockArrows, handleCodeSpecialDelete } = require('./editor/input/block-navigation').createBlockNavigation({
        get editor() { return editor; },
        get logger() { return logger; },
        get exitSpecialWrapperDisplayMode() { return exitSpecialWrapperDisplayMode; },
        get setCursorToEnd() { return setCursorToEnd; },
        get syncMarkdown() { return syncMarkdown; },
        get getCodePlainText() { return getCodePlainText; },
        get codeBlocksWithSentinel() { return codeBlocksWithSentinel; },
        get indentLinesInContainer() { return indentLinesInContainer; },
        get getCurrentLineInBlock() { return getCurrentLineInBlock; },
        get navigateToAdjacentElement() { return navigateToAdjacentElement; },
        get enterDisplayMode() { return enterDisplayMode; },
        get setCursorToLineStart() { return setCursorToLineStart; },
        get scrollCursorIntoView() { return scrollCursorIntoView; },
        get setCursorToFirstTextNode() { return setCursorToFirstTextNode; },
        get isSpecialWrapper() { return isSpecialWrapper; }
    });
    const { handleListEnter, handleMultiListTab, handleSingleListTab } = require('./editor/input/list-enter-tab').createListEnterTab({
        get editor() { return editor; },
        get setCursorToEnd() { return setCursorToEnd; },
        get syncMarkdown() { return syncMarkdown; },
        get getSelectedListItems() { return getSelectedListItems; },
        get logger() { return logger; },
        get outdentListItem() { return outdentListItem; },
        get indentListItem() { return indentListItem; },
        get setCursorToEndOfLi() { return setCursorToEndOfLi; }
    });
    const { handleBackspaceOnList, setCursorToEndOfLi } = require('./editor/input/list-backspace').createListBackspace({
        get editor() { return editor; },
        get logger() { return logger; },
        get setCursorToEnd() { return setCursorToEnd; },
        get setCursorToStart() { return setCursorToStart; },
        get syncMarkdown() { return syncMarkdown; }
    });
    const { handleFallbackEmptyList, handleParagraphInsideListDelete, handleRemainingListDelete } = require('./editor/input/list-boundaries').createListBoundaries({
        get logger() { return logger; },
        get editor() { return editor; },
        get setCursorToEnd() { return setCursorToEnd; },
        get syncMarkdown() { return syncMarkdown; }
    });
    const { handleParagraphDelete } = require('./editor/input/paragraph-delete').createParagraphDelete({
        get setCursorToStart() { return setCursorToStart; },
        get syncMarkdown() { return syncMarkdown; },
        get setCursorToEndOfLi() { return setCursorToEndOfLi; },
        get setCursorToEnd() { return setCursorToEnd; },
        get isNavigatingIntoBlock() { return isNavigatingIntoBlock; }, set isNavigatingIntoBlock(value) { isNavigatingIntoBlock = value; },
        get enterEditMode() { return enterEditMode; },
        get resetNavigationFlag() { return resetNavigationFlag; },
        get isSpecialWrapper() { return isSpecialWrapper; },
        get enterSpecialWrapperEditMode() { return enterSpecialWrapperEditMode; }
    });
    let editorRenderRevision = 0;
    let sourceBlockSequence = 0;
    // View identities survive Markdown-driven rebuilds. Wrap preferences live
    // outside document snapshots, so Undo changes content without undoing a view.
    let codeViewSequence = 0;
    const codeViewIds = new WeakMap();
    const codeViewStates = new Map();
    const mermaidRenderVersions = new WeakMap();
    const widthGuide = document.getElementById('editorWidthGuide');
    const widthBounds = document.getElementById('editorWidthBounds');
    const widthExplanation = document.getElementById('editorWidthExplanation');
    if (widthGuide) {
        for (const mark of widthGuide.querySelectorAll('button')) {
            mark.addEventListener('pointerdown', event => event.preventDefault());
            mark.addEventListener('pointerenter', () => { widthExplanation.hidden = false; });
            mark.addEventListener('pointerleave', () => { if (!widthGuide.contains(document.activeElement)) widthExplanation.hidden = true; });
            mark.addEventListener('focus', () => { widthExplanation.hidden = false; });
            mark.addEventListener('click', () => { widthExplanation.hidden = false; });
            mark.addEventListener('keydown', event => {
                if (event.key === 'Escape') {
                    event.preventDefault(); event.stopPropagation();
                    widthExplanation.hidden = true;
                    editor.focus({ preventScroll: true });
                }
            });
        }
        widthGuide.addEventListener('focusout', event => { if (!widthGuide.contains(event.relatedTarget)) widthExplanation.hidden = true; });
        new ResizeObserver(updateWidthIndicators).observe(editorWrapper);
        new MutationObserver(updateWidthIndicators).observe(editor, { attributes: true, attributeFilter: ['style'] });
        window.addEventListener('resize', updateWidthIndicators);
    }
    applyEditorWidth(document.documentElement.dataset.editorWidthMode, Number(document.documentElement.dataset.editorMaxWidth));

    // Reading-position outline state. The active section is the last heading
    // that has crossed the reading line 30% down the visible editor viewport.
    let outlineHeadings = [];
    let activeOutlineIndex = -1;
    let outlineScrollFrame = null;

    // Lucide Icons (inline SVG) - unified icon set for all toolbars
    const LUCIDE_ICONS = {
        'copy': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
        'check': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>',
        // Undo/Redo
        'undo': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
        'redo': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>',
        // Group A: Inline formatting
        'bold': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>',
        'italic': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>',
        'underline': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 12 0V3"/><path d="M4 21h16"/></svg>',
        'strikethrough': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/></svg>',
        'code': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>',
        // Group B: Block elements
        'heading1': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="m17 12 3-2v8"/></svg>',
        'heading2': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>',
        'heading3': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/></svg>',
        'heading4': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18V6"/><path d="M17 10v3a1 1 0 0 0 1 1h3"/><path d="M21 10v8"/><path d="M4 12h8"/><path d="M4 18V6"/></svg>',
        'heading5': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 13v-3h4"/><path d="M17 17.7c.4.2.8.3 1.3.3 1.5 0 2.7-1.1 2.7-2.5S19.8 13 18.3 13H17"/></svg>',
        'heading6': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><circle cx="19" cy="16" r="2"/><path d="M20 10c-2 2-3 3.5-3 6"/></svg>',
        'ul': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/></svg>',
        'ol': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/></svg>',
        'task': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/></svg>',
        'quote': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>',
        'codeblock': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10 9-3 3 3 3"/><path d="m14 15 3-3-3-3"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
        'hr': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>',
        'mermaid': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="18" r="3"/><path d="M12 2v4"/><path d="M6.8 15.2 12 6l5.2 9.2"/></svg>',
        'math': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 7V4H6l6 8-6 8h12v-3"/></svg>',
        // Group C: Insert/Media
        'link': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
        'image': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
        'imageDir': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>',
        'table': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>',
        // Utility
        'openOutline': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>',
        'openInTextEditor': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/></svg>',
        'source': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/></svg>',
        // Table toolbar icons
        'placement': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10 19H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5M3 9h18M9 3v16M3 14h6"/><path d="M16 12h2l.4 1.4 1.2.7 1.4-.3 1 1.8-1 1v1.4l1 1-1 1.8-1.4-.3-1.2.7-.4 1.4h-2l-.4-1.4-1.2-.7-1.4.3-1-1.8 1-1v-1.4l-1-1 1-1.8 1.4.3 1.2-.7Z"/><circle cx="17" cy="17.3" r="1.5"/></svg>',
        'add-col-left': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="13" x="3" y="8" rx="1"/><path d="m15 2-3 3-3-3"/><rect width="7" height="13" x="14" y="8" rx="1"/></svg>',
        'add-col-right': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="13" x="3" y="3" rx="1"/><path d="m9 22 3-3 3 3"/><rect width="7" height="13" x="14" y="3" rx="1"/></svg>',
        'del-col': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
        'add-row-above': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="13" height="7" x="8" y="3" rx="1"/><path d="m2 9 3 3-3 3"/><rect width="13" height="7" x="8" y="14" rx="1"/></svg>',
        'add-row-below': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="13" height="7" x="3" y="3" rx="1"/><path d="m22 15-3-3 3-3"/><rect width="13" height="7" x="3" y="14" rx="1"/></svg>',
        'del-row': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
        'align-left': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H3"/><path d="M15 12H3"/><path d="M17 19H3"/></svg>',
        'align-center': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H3"/><path d="M17 12H7"/><path d="M19 19H5"/></svg>',
        'align-right': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H3"/><path d="M21 12H9"/><path d="M21 19H7"/></svg>',
    };
    initToolbarIcons();

    // Keep complete actions in the bar and move the remainder into a menu.
    // Moving the original buttons retains their state, identity and listeners.
    var toolbarInner = document.getElementById('toolbarInner');
    var toolbarMore = document.getElementById('toolbarMore');
    var toolbarOverflow = document.getElementById('toolbarOverflow');
    var toolbarOverflowItems = document.getElementById('toolbarOverflowItems');
    var toolbarCommandSearch = document.getElementById('toolbarCommandSearch');
    var toolbarCommandResults = document.getElementById('toolbarCommandResults');
    var toolbarMenuRange = null;
    var toolbarMenuRevision = null;
    var toolbarMenuSourceSelection = null;
    var toolbarActions = [];
    var toolbarLayoutFrame = 0;
    if (toolbarMore && toolbarOverflow) {
        toolbar.querySelectorAll('button[data-action]').forEach(function(button) {
            const home = document.createComment('toolbar action');
            button.before(home);
            if (button.title) button.setAttribute('aria-label', button.title);
            const label = document.createElement('span');
            label.className = 'toolbar-action-label';
            label.textContent = button.title;
            button.appendChild(label);
            toolbarActions.push({ button, home, formatting: toolbarInner.contains(button) });
        });
    }

    if (toolbarMore) {
        toolbar.addEventListener('toolbar-submenu-open', () => closeToolbarOverflow(false));
        toolbarMore.addEventListener('click', function(event) {
            event.stopPropagation();
            if (toolbarOverflow.hidden) openToolbarOverflow(false);
            else closeToolbarOverflow(true);
        });
        toolbarMore.addEventListener('keydown', function(event) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                openToolbarOverflow(event.key === 'ArrowUp');
            }
        });
        toolbarOverflow.addEventListener('mousedown', event => { if (event.target.closest('button')) event.preventDefault(); });
        toolbarCommandSearch.addEventListener('input', renderToolbarCommandSearch);
        toolbarOverflow.addEventListener('click', event => {
            const control = event.target.closest('[data-menu-command]');
            if (!control || control.disabled) return;
            event.stopPropagation();
            const action = control.dataset.menuCommand;
            if (!action.startsWith('view') && (toolbarMenuRevision !== editorRenderRevision || !editorRange(toolbarMenuRange))) {
                closeToolbarOverflow(false); showEditorToast(i18n.insertUnavailableSelection); return;
            }
            const range = editorRange(toolbarMenuRange) ? toolbarMenuRange.cloneRange() : null;
            closeToolbarOverflow(false);
            if (!isSourceMode) {
                editor.focus({ preventScroll: true });
                // Focusing a previously unfocused editor can move its selection.
                if (range) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); }
            }
            savedToolbarRange = null;
            executeEditorCommand(action);
        });
        toolbarOverflow.addEventListener('keydown', function(event) {
            if (toolbarOverflow.hidden) return;
            const items = toolbarMenuChoices();
            const index = items.indexOf(document.activeElement);
            let next;
            if (event.key === 'ArrowDown') next = (index + 1) % items.length;
            if (event.key === 'ArrowUp') next = index < 0 ? items.length - 1 : (index + items.length - 1) % items.length;
            if (event.target !== toolbarCommandSearch && event.key === 'Home') next = 0;
            if (event.target !== toolbarCommandSearch && event.key === 'End') next = items.length - 1;
            if (next !== undefined) {
                event.preventDefault();
                event.stopPropagation();
                items[next]?.focus();
                items[next]?.scrollIntoView({ block: 'nearest' });
            } else if (event.key === 'Enter' && event.target === toolbarCommandSearch) {
                event.preventDefault(); event.stopPropagation(); items[0]?.click();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                closeToolbarOverflow(true);
            }
        });
        toolbarOverflow.addEventListener('focusout', function() {
            queueMicrotask(() => {
                if (!toolbarOverflow.contains(document.activeElement) && document.activeElement !== toolbarMore) closeToolbarOverflow(false);
            });
        });
        document.addEventListener('mousedown', function(event) {
            if (!toolbarOverflow.contains(event.target) && !toolbarMore.contains(event.target)) closeToolbarOverflow(false);
        });
        window.addEventListener('resize', scheduleToolbarLayout);
        new ResizeObserver(scheduleToolbarLayout).observe(toolbar);
        scheduleToolbarLayout();
    }

    const search = require('./editor/ui/search').createSearch({
        document, window, editor, sourceEditor, i18n, searchWorkerProgram: __SEARCH_WORKER__,
        getSourceMode: () => isSourceMode, getSplitMode: () => isSplitMode,
        readCommittedMarkdown: (...args) => readCommittedMarkdown(...args),
        sourceDomPositions: (...args) => sourceDomPositions(...args), editorRange: (...args) => editorRange(...args),
        setEditorMode: (...args) => setEditorMode(...args), updateSourceCorrespondence: (...args) => updateSourceCorrespondence(...args),
        setMarkdown: value => { markdown = value; }, saveSnapshot: () => undoManager.saveSnapshot(),
        markAsEdited: (...args) => markAsEdited(...args), cancelScheduledSync: (...args) => cancelScheduledSync(...args),
        scheduleSplitPreview: (...args) => scheduleSplitPreview(...args), renderFromMarkdown: (...args) => renderFromMarkdown(...args),
        setVisualSourceCurrent: value => { visualSourceCurrent = value; }, notifyChangeImmediate: (...args) => notifyChangeImmediate(...args)
    });
    const { searchReplaceBox, openSearchBox, closeSearchBox } = search;
    // Base URI for resolving relative image paths
    const documentBaseUri = '__DOCUMENT_BASE_URI__';

    let isSourceMode = false;
    let isSplitMode = false;
    let splitRenderTimer = null;
    let visualModeCursor = null;
    let sourceModeSelection = { start: 0, end: 0, scroll: 0 };
    let workspaceUi = null;
    // Decode Base64-encoded content to avoid escaping issues with special characters
    let markdown = '';
    try {
        markdown = decodeURIComponent(escape(atob(__CONTENT__)));
        // Strip BOM (Byte Order Mark) if present - some editors add this to UTF-8 files
        if (markdown.charCodeAt(0) === 0xFEFF) {
            markdown = markdown.slice(1);
        }
        // Normalize line endings: \r\n → \n, lone \r → \n
        markdown = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    } catch (e) {
        console.error('[Binary Markdown] Failed to decode Base64 content:', e);
    }
    let saveTimeout = null;
    let syncTimeout = null;
    let pendingSync = false;
    let visualSourceCurrent = true;
    let hasUserEdited = false; // Flag to track if user has made any edits
    let clientRevision = 0;
    let syncGeneration = 0;
    let pendingSave = null;
    let currentImageDir = null; // IMAGE_DIR directive value (preserved during sync)
    let currentForceRelativePath = null; // FORCE_RELATIVE_PATH directive value (preserved during sync)
    let imageDirDisplayPath = null; // Resolved display path from extension
    let imageDirSource = null; // 'file' | 'settings' | 'default'

    // Active editing detection — replaces simple focus-based guard
    let isActivelyEditing = false;
    let isNavigatingIntoBlock = false; // Suppress focusout during arrow-key navigation into code blocks
    // Track code blocks that had insertLineBreak during edit mode.
    // These have a browser sentinel \n at the end that must be stripped
    // by htmlToMarkdown (in edit mode) or by enterDisplayMode (on mode transition).
    const codeBlocksWithSentinel = new WeakSet();

    // Factories bind named capabilities; algorithms and DOM work run on demand.
    const { setCursorToLastLineStartByDOM, setCursorToLineStart, getCurrentLineInBlock } = require('./editor/selection/lines').createLineNavigation({
        logger, setCursorToStart: (...args) => setCursorToStart(...args),
        setCursorToEnd: (...args) => setCursorToEnd(...args),
        setCursorToFirstTextNode: (...args) => setCursorToFirstTextNode(...args),
        scrollCursorIntoView: (...args) => scrollCursorIntoView(...args)
    });
    const { REGEX, parseInline, escapeHtml, mdGetInlineMarkdown } = require('./editor/codec/inline').createInlineCodec({
        mathSyntax, mathBackslashDelimiters, resolveImagePath: (...args) => resolveImagePath(...args),
        inlineMathHtml: (...args) => inlineMathHtml(...args), inlineMathMarkdown: (...args) => inlineMathMarkdown(...args),
        wrapInlineCode: (...args) => wrapInlineCode(...args)
    });
    const { enterEditMode, enterDisplayMode, convertToSpecialBlock, applyHighlighting, getHighlightPatterns,
        SUPPORTED_LANGUAGES, LANGUAGE_ALIASES, LANGUAGE_NAMES, codeLanguageName, orderedCodeLanguages
    } = require('./editor/blocks/code-content').createCodeContent({
        editor, logger, i18n, document, window, codeBlocksWithSentinel,
        getCodePlainText: (...args) => getCodePlainText(...args),
        stripSentinelAndRebuildCode: (...args) => stripSentinelAndRebuildCode(...args),
        stripTrailingNewlines: (...args) => stripTrailingNewlines(...args), escapeHtml,
        renderMermaidDiagram: (...args) => renderMermaidDiagram(...args), renderMathBlock: (...args) => renderMathBlock(...args),
        setCursorToEnd: (...args) => setCursorToEnd(...args), syncMarkdown: (...args) => syncMarkdown(...args),
        syncMarkdownSync: (...args) => syncMarkdownSync(...args)
    });
    const initializedLinks = new WeakSet();
    const NAVIGATION_FLAG_RESET_DELAY = 200;
    const { resetNavigationFlag, getDeepestLastLi, navigateToAdjacentElement, setCursorToEnd, scrollCursorIntoView, setCursorToStart, setCursorToFirstTextNode, getSelectedListItems, getCurrentLine, saveCursorState, findPositionByTextOffset, restoreCursorState, getCodePlainText, getTextOffsetInContainer, textOffsetToDomPosition, indentLinesInContainer } = require('./editor/selection/dom').createDomSelection({
        editor, logger, NAVIGATION_FLAG_RESET_DELAY, enterEditMode,
        enterSpecialWrapperEditMode: (...args) => enterSpecialWrapperEditMode(...args),
        isSpecialWrapper: (...args) => isSpecialWrapper(...args), setCursorToLastLineStartByDOM,
        showTableToolbar: (...args) => showTableToolbar(...args), revealTableCaret: (...args) => revealTableCaret(...args),
        setNavigatingIntoBlock: value => { isNavigatingIntoBlock = value; },
        setActiveTable: value => { activeTable = value; }, setActiveTableCell: value => { activeTableCell = value; }
    });
    const { parseMarkdownLine, renderMarkdownBlock, markdownToHtmlFragment, getCodeFence, wrapInlineCode, stripTrailingNewlines, mdProcessNode, mdProcessListItem, mdGetTextContent, mdProcessBlockquote, readTableData, rememberTableSource, mdProcessTable, serializeMarkdownBlocks, clipboardHtml, serializeMarkdownFragment, htmlToMarkdown } = require('./editor/codec/blocks').createBlockCodec({
        document, editor, logger, REGEX, emptyTableCell, mathBackslashDelimiters, codeBlocksWithSentinel, parseInline, escapeHtml,
        renderFrontMatter: (...args) => renderFrontMatter(...args), renderTocBlock: (...args) => renderTocBlock(...args),
        mathBlockHtml: (...args) => mathBlockHtml(...args), inlineMathMarkdown: (...args) => inlineMathMarkdown(...args),
        mathBlockMarkdown: (...args) => mathBlockMarkdown(...args), mdGetInlineMarkdown,
        parseBlocks: (...args) => window.BinaryMarkdownBlocks.parse(...args), formatTable: (...args) => tableFormat.format(...args),
        nextSourceBlockSequence: () => ++sourceBlockSequence, getCurrentImageDir: () => currentImageDir,
        getCurrentForceRelativePath: () => currentForceRelativePath
    });


    let editingIdleTimer = null;
    let queuedExternalContent = null; // Queued external change waiting for idle
    const EDITING_IDLE_TIMEOUT = 1500; // 1.5 seconds of inactivity = idle

    // Extract IMAGE_DIR from markdown content
    // Supports both standalone and combined directive blocks
    function extractImageDirFromMarkdown(md) {
        // Pattern: matches IMAGE_DIR in a directive block (may have other directives before/after)
        const pattern = /\n---\n(?:[\s\S]*?\n)?IMAGE_DIR:\s*([^\n]+)/;
        const match = md.match(pattern);
        return match ? match[1].trim() : null;
    }

    // Extract FORCE_RELATIVE_PATH from markdown content
    // Supports both standalone and combined directive blocks
    function extractForceRelativePathFromMarkdown(md) {
        const pattern = /\n---\n(?:[\s\S]*?\n)?FORCE_RELATIVE_PATH:\s*(true|false)/i;
        const match = md.match(pattern);
        return match ? match[1].toLowerCase() === 'true' : null;
    }

    // Remove all directive blocks from markdown content (for rendering)
    // This removes all --- blocks containing IMAGE_DIR or FORCE_RELATIVE_PATH
    function removeDirectivesFromMarkdown(md) {
        // Remove standalone directive blocks (single directive)
        md = md.replace(/\n---\nIMAGE_DIR:\s*[^\n]+\s*$/g, '');
        md = md.replace(/\n---\nFORCE_RELATIVE_PATH:\s*(true|false)\s*$/gi, '');

        // Remove combined directive block at end of file
        // Pattern: ---\n followed by any combination of IMAGE_DIR and FORCE_RELATIVE_PATH lines
        md = md.replace(/\n---\n(?:(?:IMAGE_DIR:\s*[^\n]+|FORCE_RELATIVE_PATH:\s*(?:true|false))\n?)+\s*$/gi, '');

        return md;
    }

    // Initialize currentImageDir and currentForceRelativePath from initial content
    currentImageDir = extractImageDirFromMarkdown(markdown);
    currentForceRelativePath = extractForceRelativePathFromMarkdown(markdown);

    // Resolve relative image path to full webview URI
    function resolveImagePath(src) {
        if (!src) return '';
        // If already absolute URL or data URL, return as-is
        if (src.startsWith('http://') || src.startsWith('https://') ||
            src.startsWith('data:') || src.startsWith('vscode-resource:') ||
            src.startsWith('vscode-webview:')) {
            return src;
        }
        // If absolute file path (starts with /)
        if (src.startsWith('/')) {
            if (documentBaseUri && documentBaseUri.startsWith('file://')) {
                // Electron: use file:// protocol directly
                return 'file://' + src;
            }
            // VSCode webview: use vscode-resource URI
            return 'https://file+.vscode-resource.vscode-cdn.net' + src;
        }
        // Resolve relative path against document base URI
        if (documentBaseUri) {
            // Remove trailing slash from base and leading ./ from src
            const base = documentBaseUri.replace(/\/$/, '');
            const path = src.replace(/^\.\//,'');
            return base + '/' + path;
        }
        return src;
    }

    // Initialize
    logger.log('[Binary Markdown] Starting init(), markdown length:', markdown.length, 'editor element:', !!editor);
    init();
    logger.log('[Binary Markdown] init() completed, editor.innerHTML length:', editor.innerHTML.length);

    // ========== UNDO / REDO MANAGER ==========
    var undoManager = (function() {
        var MAX_STACK = 200;
        var undoStack = [];
        var redoStack = [];
        var typingTimer = null;
        var TYPING_DEBOUNCE = 500;
        var _isUndoRedo = false;

        function capture(current = false) {
            // Input snapshots need the previous Markdown; undo/redo must retain
            // the latest committed DOM even before its delayed sync runs.
            return { markdown: current ? readCommittedMarkdown() : markdown, cursor: saveCursorState(), sourceCursor: isSourceMode ? { start: sourceEditor.selectionStart, end: sourceEditor.selectionEnd } : null, codeViews: captureCodeViews() };
        }

        function saveSnapshot() {
            if (_isUndoRedo) return;
            var state = capture();
            if (undoStack.length > 0 && undoStack[undoStack.length - 1].markdown === state.markdown) return;
            undoStack.push(state);
            if (undoStack.length > MAX_STACK) undoStack.shift();
            redoStack.length = 0;
            updateButtons();
        }

        function saveSnapshotDebounced() {
            if (_isUndoRedo) return;
            if (typingTimer) return;
            saveSnapshot();
            typingTimer = setTimeout(function() { typingTimer = null; }, TYPING_DEBOUNCE);
        }

        function undo() {
            if (!undoStack.length) return;
            _isUndoRedo = true;
            try {
                clearTimeout(syncTimeout);
                syncTimeout = null;
                pendingSync = false;
                redoStack.push(capture(true));
                var state = undoStack.pop();
                markdown = state.markdown;
                renderFromMarkdown(state.codeViews);
                if (isSourceMode && state.sourceCursor) sourceEditor.setSelectionRange(state.sourceCursor.start, state.sourceCursor.end);
                else if (!isSourceMode && state.cursor) restoreCursorState(state.cursor);
                hasUserEdited = true;
                clientRevision++;
                notifyChangeImmediate();
            } finally {
                _isUndoRedo = false;
            }
            updateButtons();
        }

        function redo() {
            if (!redoStack.length) return;
            _isUndoRedo = true;
            try {
                clearTimeout(syncTimeout);
                syncTimeout = null;
                pendingSync = false;
                undoStack.push(capture(true));
                var state = redoStack.pop();
                markdown = state.markdown;
                renderFromMarkdown(state.codeViews);
                if (isSourceMode && state.sourceCursor) sourceEditor.setSelectionRange(state.sourceCursor.start, state.sourceCursor.end);
                else if (!isSourceMode && state.cursor) restoreCursorState(state.cursor);
                hasUserEdited = true;
                clientRevision++;
                notifyChangeImmediate();
            } finally {
                _isUndoRedo = false;
            }
            updateButtons();
        }

        function updateButtons() {
            var u = document.querySelector('[data-action="undo"]');
            var r = document.querySelector('[data-action="redo"]');
            if (u) { u.disabled = !undoStack.length; u.style.opacity = undoStack.length ? '1' : '0.3'; }
            if (r) { r.disabled = !redoStack.length; r.style.opacity = redoStack.length ? '1' : '0.3'; }
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
    })();
    undoManager.updateButtons();

    // Check if editor is effectively empty and toggle placeholder class
    function updatePlaceholder() {
        var children = editor.children;
        var isEmpty = children.length === 0 ||
            (children.length === 1 && children[0].tagName === 'P' &&
             (children[0].innerHTML === '<br>' || children[0].textContent === ''));
        if (isEmpty) {
            editor.classList.add('is-empty');
        } else {
            editor.classList.remove('is-empty');
        }
    }

    function init() {
        // Force browser to use <p> instead of <div> when pressing Enter in contenteditable
        try {
            document.execCommand('defaultParagraphSeparator', false, 'p');
        } catch (e) {
            // Some browsers don't support this command
        }
        try {
            renderFromMarkdown();
        } catch (e) {
            console.error('[Binary Markdown] renderFromMarkdown() failed:', e);
        }
        try { updateOutline(); } catch (e) { console.error('[Binary Markdown] updateOutline() failed:', e); }
        try { updateWordCount(); } catch (e) { console.error('[Binary Markdown] updateWordCount() failed:', e); }
        try { updateStatus(); } catch (e) { console.error('[Binary Markdown] updateStatus() failed:', e); }
        updatePlaceholder();
    }

    // Export uses the same parser/highlighter on a separate document tree. It
    // never calls renderFromMarkdown or attaches the live editor's listeners.
    let exportRenderSequence = 0;
    let exportRenderQueue = Promise.resolve();
    const exportRenderRequests = new Map();

    // ========== MERMAID DIAGRAM FUNCTIONALITY ==========

    var mermaidInitialized = false;
    var mermaidReady = false;

    editor.addEventListener('click', event => {
        const span = event.target.closest && event.target.closest('.math-inline');
        if (!span) return;
        event.preventDefault(); event.stopImmediatePropagation();
        editInlineMath(span);
    }, true);
    editor.addEventListener('keydown', event => {
        if (event.target.classList.contains('math-inline') && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault(); event.stopImmediatePropagation();
            editInlineMath(event.target);
        }
    }, true);
    window.addEventListener('resize', positionLanguageSelector);
    editorWrapper.addEventListener('scroll', positionLanguageSelector);
    new ResizeObserver(positionLanguageSelector).observe(editorWrapper);

    let activeTableCell = null;
    let activeTable = null;
    var tableControls = window.BinaryTableToolbar.create({
        editor, header: toolbar, messages: i18n, icons: LUCIDE_ICONS,
        isSourceMode: () => isSourceMode,
        onContext(cell) { activeTableCell = cell; activeTable = cell?.closest('table') || null; },
        onReveal: revealTableCaret,
        onTableResize(table, previousWidth) {
            if (isSourceMode || isTableColResizing || document.activeElement !== editor) return;
            const node = window.getSelection()?.anchorNode;
            const cell = (node?.nodeType === 3 ? node.parentElement : node)?.closest?.('td, th');
            // Late docking/scrollbar layout can clip a caret already revealed
            // by navigation. Correct only horizontal scroll, never focus or range.
            if (cell?.closest('table') === table) scrollTableToCaret(cell, previousWidth);
        },
        onLayout: scheduleToolbarLayout,
        onPreference(value) { host.setTableToolbarPosition?.(value); },
        onAction(action) {
            if (!activeTableCell || !editor.contains(activeTableCell)) return;
            markdown = readCommittedMarkdown();
            undoManager.saveSnapshot();
            switch (action) {
                case 'add-col-left': insertTableColumnLeft(); break;
                case 'add-col-right': insertTableColumnRight(); break;
                case 'del-col': deleteTableColumn(); break;
                case 'add-row-above': insertTableRowAbove(); break;
                case 'add-row-below': insertTableRowBelow(); break;
                case 'del-row': deleteTableRow(); break;
                case 'align-left': setColumnAlignment('left'); break;
                case 'align-center': setColumnAlignment('center'); break;
                case 'align-right': setColumnAlignment('right'); break;
            }
            showTableToolbar(activeTable);
        }
    });

    // ========== TABLE COLUMN RESIZE FUNCTIONALITY ==========

    let isTableColResizing = false;
    let resizeStartX = 0;
    let resizeStartWidth = 0;
    let resizingCell = null;
    let resizingTable = null;

    // Listen for mousedown on resize handles
    editor.addEventListener('mousedown', function(e) {
        const handle = e.target.closest('.table-col-resize-handle');
        if (handle) {
            handleResizeStart(e);
        }
    });

    // Initialize resize handles for existing tables
    initializeAllTableResizeHandles();

    // Track active cell on focus/click and show table toolbar
    editor.addEventListener('focusin', function(e) {
        const cell = e.target.closest ? e.target.closest('th, td') : null;
        if (cell && editor.contains(cell)) {
            activeTableCell = cell;
            const table = cell.closest('table');
            if (table) {
                showTableToolbar(table);
            }
        }
    });

    editor.addEventListener('click', function(e) {
        if (e.target.closest && e.target.closest('.front-matter')) return;
        const cell = e.target.closest ? e.target.closest('th, td') : null;
        if (cell && editor.contains(cell)) {
            activeTableCell = cell;
            const table = cell.closest('table');
            if (table) {
                showTableToolbar(table);
            }

            // Triple-click in table cell - select cell contents only (same behavior as Cmd+A)
            // This prevents browser's native line selection which can break table structure on paste
            if (e.detail === 3) {
                e.preventDefault();
                const sel = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(cell);
                sel.removeAllRanges();
                sel.addRange(range);
                logger.log('Triple-click: Selected all in table cell');
            }
        } else {
            // Clicked outside table - hide toolbar
            hideTableToolbar();
        }

        // Handle code block edit mode exit on click outside
        const clickedPre = e.target.closest ? e.target.closest('pre') : null;
        editor.querySelectorAll('pre[data-mode="edit"]').forEach(pre => {
            if (pre !== clickedPre) {
                enterDisplayMode(pre);
            }
        });

        // Handle mermaid/math wrapper edit mode exit on click outside
        const clickedSpecialWrapper = e.target.closest ? (e.target.closest('.mermaid-wrapper') || e.target.closest('.math-wrapper')) : null;
        editor.querySelectorAll('.mermaid-wrapper[data-mode="edit"], .math-wrapper[data-mode="edit"]').forEach(wrapper => {
            if (wrapper !== clickedSpecialWrapper) {
                exitSpecialWrapperDisplayMode(wrapper);
                // No syncMarkdown() here - exitSpecialWrapperDisplayMode already synced.
            }
        });
    });

    // ========== EVENT HANDLERS ==========

    // Capture Tab key at document level to prevent focus change
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Tab' && document.activeElement === editor) {
            // #region agent log
            logger.log('Document captured Tab key - preventing default (no stopPropagation)');
            // #endregion
            e.preventDefault();
            // Do NOT call stopPropagation - let the event reach the editor's keydown handler
        }
        // Disable browser native undo/redo in live preview mode
        var isMod = e.ctrlKey || e.metaKey;
        if (isMod && !isSourceMode && (e.key === 'z' || e.key === 'Z' || e.key === 'y')) {
            e.preventDefault();
        }
    }, true); // true = capture phase

    // Key input handler
    editor.addEventListener('keydown', handleKeydown);

    // BeforeInput handler - handle triple-click selection replacement
    editor.addEventListener('beforeinput', function(e) {
        if (e.target.closest && e.target.closest('.front-matter')) return;
        if (isSourceMode) return;

        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        const range = sel.getRangeAt(0);

        // Only handle when there's a selection (not collapsed)
        if (range.collapsed) return;

        // Check if this is a triple-click style selection (selection includes element boundaries)
        // Triple-click typically selects from start of element to start of next element
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;

        // Detect triple-click selection patterns:
        // 1. startContainer is an element (not text node) with offset 0
        // 2. endContainer is different from startContainer
        // 3. Selection spans across element boundaries
        const isTripleClickSelection = (
            (startContainer.nodeType === 1 && range.startOffset === 0) ||
            (endContainer.nodeType === 1 && range.endOffset === 0) ||
            (startContainer !== endContainer &&
             (startContainer.nodeType === 1 || endContainer.nodeType === 1))
        );

        if (!isTripleClickSelection) return;

        // Find the li element that contains the selection start
        let liElement = null;
        let node = startContainer;
        while (node && node !== editor) {
            if (node.nodeType === 1 && node.tagName.toLowerCase() === 'li') {
                liElement = node;
                break;
            }
            node = node.parentNode;
        }

        if (!liElement) return;

        // Handle insertText (typing characters)
        if (e.inputType === 'insertText' || e.inputType === 'insertReplacementText') {
            logger.log('BeforeInput: Triple-click selection detected in li, handling insertText');
            e.preventDefault();

            // Get nested list and checkbox before deletion
            const nestedList = liElement.querySelector(':scope > ul, :scope > ol');
            const checkbox = liElement.querySelector(':scope > input[type="checkbox"]');

            // Clear the li content but preserve structure
            // Remove all direct text and inline elements, keep nested list and checkbox
            const nodesToRemove = [];
            for (const child of liElement.childNodes) {
                if (child.nodeType === 3) {
                    nodesToRemove.push(child);
                } else if (child.nodeType === 1) {
                    const tag = child.tagName?.toLowerCase();
                    if (tag !== 'ul' && tag !== 'ol' && tag !== 'input') {
                        nodesToRemove.push(child);
                    }
                }
            }
            nodesToRemove.forEach(n => n.remove());

            // Insert the new text
            const textNode = document.createTextNode(e.data || '');
            if (checkbox) {
                checkbox.after(textNode);
            } else if (nestedList) {
                liElement.insertBefore(textNode, nestedList);
            } else {
                liElement.appendChild(textNode);
            }

            // Set cursor after the inserted text
            const newRange = document.createRange();
            newRange.setStartAfter(textNode);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);

            syncMarkdownSync();
            return;
        }

        // Handle deleteContentBackward/Forward (backspace/delete with selection)
        if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') {
            logger.log('BeforeInput: Triple-click selection detected in li, handling delete');
            e.preventDefault();

            // Get nested list and checkbox before deletion
            const nestedList = liElement.querySelector(':scope > ul, :scope > ol');
            const checkbox = liElement.querySelector(':scope > input[type="checkbox"]');

            // Clear the li content but preserve structure
            const nodesToRemove = [];
            for (const child of liElement.childNodes) {
                if (child.nodeType === 3) {
                    nodesToRemove.push(child);
                } else if (child.nodeType === 1) {
                    const tag = child.tagName?.toLowerCase();
                    if (tag !== 'ul' && tag !== 'ol' && tag !== 'input') {
                        nodesToRemove.push(child);
                    }
                }
            }
            nodesToRemove.forEach(n => n.remove());

            // Add a br if li is now empty (no text, no nested list)
            let hasContent = false;
            for (const child of liElement.childNodes) {
                if (child.nodeType === 3 && child.textContent.trim()) {
                    hasContent = true;
                    break;
                }
                if (child.nodeType === 1 && child.tagName?.toLowerCase() !== 'input') {
                    hasContent = true;
                    break;
                }
            }

            if (!hasContent) {
                const br = document.createElement('br');
                if (checkbox) {
                    checkbox.after(br);
                } else {
                    liElement.appendChild(br);
                }
            }

            // Set cursor in the li
            const newRange = document.createRange();
            if (checkbox && checkbox.nextSibling) {
                newRange.setStartBefore(checkbox.nextSibling);
            } else if (liElement.firstChild) {
                newRange.setStart(liElement, 0);
            }
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);

            syncMarkdownSync();
            return;
        }
    });

    // Input handler - debounced sync for performance
    editor.addEventListener('input', function(e) {
        if (e.target.closest && e.target.closest('.front-matter')) return;
        if (isSourceMode) return;
        markActivelyEditing();
        markAsEdited(); // User has made an edit
        undoManager.saveSnapshotDebounced();

        // Normalize <div> to <p>: Chromium's contenteditable sometimes creates <div>
        // despite defaultParagraphSeparator('p'), especially after tables or other block elements.
        var divChildren = editor.querySelectorAll(':scope > div:not(.mermaid-wrapper):not(.math-wrapper):not(.find-replace-container)');
        if (divChildren.length > 0) {
            // Save cursor position
            var sel = window.getSelection();
            var savedRange = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0).cloneRange() : null;
            var cursorInDiv = false;
            var cursorDiv = null;
            if (savedRange) {
                var cursorNode = savedRange.startContainer;
                while (cursorNode && cursorNode !== editor) {
                    if (cursorNode.nodeType === 1 && cursorNode.tagName === 'DIV' && cursorNode.parentNode === editor) {
                        cursorDiv = cursorNode;
                        cursorInDiv = true;
                        break;
                    }
                    cursorNode = cursorNode.parentNode;
                }
            }
            for (var i = 0; i < divChildren.length; i++) {
                var div = divChildren[i];
                // Skip divs that are part of known structures
                if (div.classList.length > 0) continue;
                var p = document.createElement('p');
                while (div.firstChild) {
                    p.appendChild(div.firstChild);
                }
                div.replaceWith(p);
                // If cursor was in this div, restore it in the new <p>
                if (cursorInDiv && div === cursorDiv && savedRange && sel) {
                    try {
                        sel.removeAllRanges();
                        sel.addRange(savedRange);
                    } catch (ex) {
                        // Range may be invalid if nodes moved
                    }
                }
            }
        }

        // Debounced sync - only updates markdown after user stops typing
        debouncedSync();
        updatePlaceholder();
    });

    // Both editable views share the document undo manager.
    sourceEditor.addEventListener('beforeinput', () => {
        if (isSourceMode) undoManager.saveSnapshotDebounced();
    });
    // Source mode input
    sourceEditor.addEventListener('input', function() {
        if (isSourceMode) {
            undoManager.saveSnapshotDebounced();
            markAsEdited(); // User has made an edit
            markdown = sourceEditor.value;
            notifyChange();
            scheduleSplitPreview();
            updateOutline();
        }
    });

    // ========== TOOLBAR ==========

    // Save the editor selection before toolbar buttons steal focus
    let savedToolbarRange = null;
    let pendingHostInsert = null;
    let hostInsertSequence = 0;
    toolbar.addEventListener('mousedown', captureToolbarSelection);
    toolbar.addEventListener('focusin', captureToolbarSelection);

    toolbar.addEventListener('click', function(e) {
        if (tableControls.owns(e.target)) return;
        const btn = e.target.closest('button');
        if (!btn) return;

        const action = btn.dataset.action;
        if (!action) return;
        if (['insertMenu', 'formatActions', 'allActions', 'contextToolbar'].includes(action)) return;
        if (btn.matches('[data-export-format], [data-export-action]') ||
            (action && action.indexOf('export') === 0)) return;
        closeToolbarOverflow(false);

        // View-only actions do not change Markdown content
        if (!['source', 'openOutline', 'openInTextEditor', 'link', 'image', 'underline'].includes(action)) {
            markAsEdited(); // User has made an edit
        }

        editor.focus();
        // Restore selection that was lost when toolbar button stole focus
        if (savedToolbarRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedToolbarRange);
            savedToolbarRange = null;
        }

        // Save snapshot before structural toolbar actions (not for undo/redo/source/openOutline)
        if (!['undo', 'redo', 'source', 'openOutline', 'openInTextEditor', 'link', 'image', 'underline'].includes(action)) {
            undoManager.saveSnapshot();
        }

        // Toolbar-only actions (not in command palette)
        switch (action) {
            case 'undo':
                undoManager.undo();
                break;
            case 'redo':
                undoManager.redo();
                break;
            case 'imageDir':
                host.requestSetImageDir();
                break;
            case 'openOutline':
                openSidebar();
                break;
            case 'openInTextEditor':
                host.openInTextEditor();
                break;
            case 'source':
                toggleSourceMode();
                break;
            default:
                // Shared actions (toolbar + command palette)
                dispatchToolbarAction(action);
                break;
        }
    });

    // ========== COMMAND PALETTE ==========

    var COMMAND_PALETTE_ITEMS = [
        // Group: Inline
        { group: 'inline', action: 'bold',          i18nKey: 'bold',          icon: 'bold' },
        { group: 'inline', action: 'italic',        i18nKey: 'italic',        icon: 'italic' },
        { group: 'inline', action: 'underline',     i18nKey: 'underline',   icon: 'underline' },
        { group: 'inline', action: 'strikethrough', i18nKey: 'strikethrough', icon: 'strikethrough' },
        { group: 'inline', action: 'code',          i18nKey: 'inlineCode',    icon: 'code' },
        { group: 'inline', action: 'inlineMath',    i18nKey: 'inlineMath',    icon: 'math' },
        // Group: Headings
        { group: 'headings', action: 'heading1', i18nKey: 'heading1', icon: 'heading1' },
        { group: 'headings', action: 'heading2', i18nKey: 'heading2', icon: 'heading2' },
        { group: 'headings', action: 'heading3', i18nKey: 'heading3', icon: 'heading3' },
        { group: 'headings', action: 'heading4', i18nKey: 'heading4', icon: 'heading4' },
        { group: 'headings', action: 'heading5', i18nKey: 'heading5', icon: 'heading5' },
        { group: 'headings', action: 'heading6', i18nKey: 'heading6', icon: 'heading6' },
        // Group: Lists
        { group: 'lists', action: 'ul',   i18nKey: 'unorderedList', icon: 'ul' },
        { group: 'lists', action: 'ol',   i18nKey: 'orderedList',   icon: 'ol' },
        { group: 'lists', action: 'task', i18nKey: 'taskList',      icon: 'task' },
        // Group: Blocks
        { group: 'blocks', action: 'quote',     i18nKey: 'blockquote',     icon: 'quote' },
        { group: 'blocks', action: 'codeblock', i18nKey: 'codeBlock',      icon: 'codeblock' },
        { group: 'blocks', action: 'hr',        i18nKey: 'horizontalRule', icon: 'hr' },
        { group: 'blocks', action: 'mermaid',  i18nKey: 'mermaidBlock',   icon: 'mermaid' },
        { group: 'blocks', action: 'math',     i18nKey: 'mathBlock',      icon: 'math' },
        // Group: Insert
        { group: 'insert', action: 'link',  i18nKey: 'insertLink',  icon: 'link' },
        { group: 'insert', action: 'image', i18nKey: 'insertImage', icon: 'image' },
        { group: 'insert', action: 'toc', i18nKey: 'insertToc', icon: 'ul' },
        { group: 'insert', action: 'table', i18nKey: 'insertTable', icon: 'table' },
        { group: 'view', action: 'viewUndo', i18nKey: 'undo', icon: 'undo' },
        { group: 'view', action: 'viewRedo', i18nKey: 'redo', icon: 'redo' },
        { group: 'view', action: 'viewInsert', i18nKey: 'commandPaletteInsert', icon: 'table' },
        { group: 'view', action: 'viewContextual', i18nKey: 'contextualTools', icon: 'code' },
        { group: 'view', action: 'viewVisual', i18nKey: 'modeVisual' },
        { group: 'view', action: 'viewSource', i18nKey: 'modeSource' },
        { group: 'view', action: 'viewSplit', i18nKey: 'modeSplit' },
        { group: 'view', action: 'viewOutline', i18nKey: 'outlineTitle', icon: 'openOutline' },
        { group: 'view', action: 'viewFind', i18nKey: 'searchPlaceholder' },
        { group: 'view', action: 'viewReplace', i18nKey: 'replace' },
        { group: 'view', action: 'viewExport', i18nKey: 'exportPanelTitle', icon: 'export' },
    ];

    var COMMAND_PALETTE_GROUPS = {
        inline:   function() { return i18n.commandPaletteInline   || 'Inline'; },
        headings: function() { return i18n.commandPaletteHeadings  || 'Headings'; },
        lists:    function() { return i18n.commandPaletteLists     || 'Lists'; },
        blocks:   function() { return i18n.commandPaletteBlocks    || 'Blocks'; },
        insert:   function() { return i18n.commandPaletteInsert    || 'Insert'; },
        view: function() { return i18n.editorModes; },
    };

    // The Insert dropdown reuses the command dispatcher and its localized names.
    // Keep its bookmark separate from toolbar focus so menu navigation is view-only.
    var insertButton = document.getElementById('insertButton');
    var insertMenu = document.getElementById('insertMenu');
    var insertMenuRange = null;
    var insertActions = ['table', 'inlineMath', 'codeblock', 'math', 'link', 'image', 'mermaid', 'toc'];

    const insertCategory = { inlineMath: 'equationsCategory', math: 'equationsCategory', table: 'structureCategory', toc: 'structureCategory', codeblock: 'codeCategory', mermaid: 'codeCategory', link: 'mediaCategory', image: 'mediaCategory' };
    const insertSamples = { inlineMath: '$x^2$', math: '$$\\frac{a+b}{c}$$', table: '| A | B |\n| --- | --- |', codeblock: '```javascript\nconst value = 1;\n```', link: '[text](https://example.com)', image: '![description](image.png)', mermaid: 'graph TD\n  A --> B', toc: '[TOC]' };
    const actionDescription = action => ['viewUndo','viewRedo'].includes(action) ? i18n.historyDescription : action.startsWith('view') ? i18n.viewDescription : i18n['insertDescription' + action[0].toUpperCase() + action.slice(1)] || (['bold','italic','underline','strikethrough','code'].includes(action) ? i18n.formatDescription : i18n.blockDescription);
    let insertSearch = null, insertCategorySelection = 'allCategory';

    if (insertMenu) {
        const searchBar = document.createElement('div'); searchBar.className = 'insert-search';
        insertSearch = document.createElement('input'); insertSearch.type = 'search';
        insertSearch.placeholder = i18n.commandPaletteFilter; insertSearch.setAttribute('aria-label', i18n.commandPaletteFilter);
        insertSearch.addEventListener('input', filterInsertWorkspace);
        const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = i18n.clearSearch;
        clear.addEventListener('click', () => { insertSearch.value = ''; insertCategorySelection = 'allCategory'; filterInsertWorkspace(); insertSearch.focus(); });
        searchBar.append(insertSearch, clear); insertMenu.appendChild(searchBar);
        const workspace = document.createElement('div'); workspace.className = 'insert-workspace';
        const categories = document.createElement('div'); categories.className = 'insert-categories';
        for (const category of ['allCategory','structureCategory','equationsCategory','codeCategory','mediaCategory']) {
            const choice = document.createElement('button'); choice.type = 'button'; choice.dataset.insertCategory = category;
            const icon = document.createElement('span'); icon.className = 'insert-category-icon'; icon.setAttribute('aria-hidden', 'true');
            icon.innerHTML = LUCIDE_ICONS[{ allCategory: 'table', structureCategory: 'ul', equationsCategory: 'math', codeCategory: 'codeblock', mediaCategory: 'image' }[category]];
            const title = document.createElement('span'); title.textContent = i18n[category]; choice.append(icon, title);
            choice.addEventListener('click', () => { insertCategorySelection = category; filterInsertWorkspace(); });
            categories.appendChild(choice);
        }
        const list = document.createElement('div'); list.className = 'insert-options'; list.setAttribute('role', 'menu'); list.setAttribute('aria-label', i18n.commandPaletteInsert);
        const results = document.createElement('div'); results.className = 'insert-results';
        const scrollControls = document.createElement('div'); scrollControls.className = 'insert-scroll'; scrollControls.hidden = true;
        const count = document.createElement('output'); count.setAttribute('aria-live', 'polite');
        for (const direction of ['previous', 'next']) {
            const control = document.createElement('button'); control.type = 'button'; control.dataset.direction = direction;
            control.textContent = direction === 'previous' ? '↑ ' + i18n.previousCommands : i18n.nextCommands + ' ↓';
            control.addEventListener('click', () => {
                const rows = [...list.querySelectorAll('.insert-command:not([hidden])')];
                const bounds = list.getBoundingClientRect();
                // Match the complete-card boundary used by updateInsertScroll.
                // A subpixel-aligned visible row must not become its own page target.
                const next = direction === 'next'
                    ? rows.find(row => row.getBoundingClientRect().bottom > bounds.bottom - 7)
                    : [...rows].reverse().find(row => row.getBoundingClientRect().top < bounds.top + 7);
                if (next) list.scrollTop += next.getBoundingClientRect().top - bounds.top - 8;
                updateInsertScroll();
            });
            scrollControls.appendChild(control);
            if (direction === 'previous') scrollControls.appendChild(count);
        }
        list.addEventListener('scroll', updateInsertScroll, { passive: true });
        results.append(list, scrollControls); workspace.append(categories, results); insertMenu.appendChild(workspace);
        const empty = document.createElement('div'); empty.className = 'insert-empty'; empty.setAttribute('role', 'status'); empty.hidden = true;
        const emptyTitle = document.createElement('strong'); emptyTitle.textContent = i18n.noMatchingActions;
        const emptyHelp = document.createElement('p'); emptyHelp.textContent = i18n.searchRecovery;
        const emptyClear = document.createElement('button'); emptyClear.type = 'button'; emptyClear.textContent = i18n.clearSearch;
        emptyClear.addEventListener('click', () => { insertSearch.value = ''; insertCategorySelection = 'allCategory'; filterInsertWorkspace(); insertSearch.focus(); });
        empty.append(emptyTitle, emptyHelp, emptyClear); list.appendChild(empty);
        for (const action of insertActions) {
            const command = COMMAND_PALETTE_ITEMS.find(item => item.action === action);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'insert-command';
            button.setAttribute('role', 'menuitem');
            button.dataset.insertAction = action;
            const icon = document.createElement('span'); icon.className = 'insert-command-icon'; icon.setAttribute('aria-hidden', 'true'); icon.innerHTML = LUCIDE_ICONS[command.icon] || '';
            const details = document.createElement('span'); details.className = 'insert-command-details';
            const label = document.createElement('strong'); label.className = 'insert-command-title';
            const parsed = parseI18nLabel(command.i18nKey); label.textContent = parsed.label;
            const reason = document.createElement('small');
            reason.id = 'insert-reason-' + action;
            reason.hidden = true;
            button.setAttribute('aria-describedby', reason.id);
            details.append(label, reason);
            const shortcut = document.createElement('kbd'); shortcut.className = 'insert-shortcut';
            const isMac = navigator.platform.toUpperCase().includes('MAC');
            shortcut.textContent = parsed.shortcut ? (isMac ? parsed.shortcut.replace(/Ctrl/g, 'Cmd') : parsed.shortcut) : '—';
            shortcut.setAttribute('aria-hidden', String(!parsed.shortcut));
            button.append(icon, details, createInsertPreview(action), shortcut);
            list.appendChild(button);
        }
        insertButton?.addEventListener('mousedown', event => { captureToolbarSelection(event); event.preventDefault(); });
        insertButton?.addEventListener('click', event => {
            event.stopPropagation();
            if (insertMenu.hidden) openInsertMenu(false); else closeInsertMenu(true);
        });
        insertButton?.addEventListener('keydown', event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault(); event.stopPropagation();
                openInsertMenu(event.key === 'ArrowUp');
            }
        });
        insertMenu.addEventListener('mousedown', event => { if (event.target !== insertSearch) event.preventDefault(); });
        insertMenu.addEventListener('keydown', event => {
            const choices = [...insertMenu.querySelectorAll('button[data-insert-action]:not([hidden])')];
            const index = choices.indexOf(document.activeElement);
            let next;
            if (event.key === 'ArrowDown') next = (index + 1) % choices.length;
            if (event.key === 'ArrowUp') next = index < 0 ? choices.length - 1 : (index + choices.length - 1) % choices.length;
            if (event.target !== insertSearch && event.key === 'Home') next = 0;
            if (event.target !== insertSearch && event.key === 'End') next = choices.length - 1;
            if (next !== undefined && choices.length) {
                event.preventDefault(); event.stopPropagation();
                focusInsertChoice(choices[next]);
            } else if (event.key === 'Enter' && event.target === insertSearch && choices.length) {
                event.preventDefault(); event.stopPropagation(); choices[0].click();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation(); closeInsertMenu(true);
            }
        });
        insertMenu.addEventListener('click', event => {
            const item = event.target.closest('button[data-insert-action]');
            if (!item) return;
            const action = item.dataset.insertAction;
            const reason = insertUnavailable(action, insertMenuRange);
            if (reason) { showEditorToast(reason); return; }
            closeInsertMenu(false);
            editor.focus({ preventScroll: true });
            if (!restoreInsertRange()) return;
            savedToolbarRange = null;
            // Dialog actions take their snapshot only when their host confirms.
            const directInsertion = !['link', 'image', 'toc'].includes(action);
            if (directInsertion) {
                markdown = readCurrentMarkdown();
                undoManager.saveSnapshot();
            }
            dispatchToolbarAction(action);
            // Redo must see the inserted block even when Undo arrives before
            // an asynchronous rendering-frame sync. Keep equation inputs open.
            if (directInsertion) syncMarkdownSync();
        });
        document.addEventListener('mousedown', event => {
            if (!insertMenu.hidden && !insertMenu.contains(event.target) && !insertTrigger().contains(event.target)) closeInsertMenu(false);
        });
        insertMenu.addEventListener('focusout', () => queueMicrotask(() => {
            if (!insertMenu.hidden && !insertMenu.contains(document.activeElement) && document.activeElement !== insertTrigger()) closeInsertMenu(false);
        }));
        window.addEventListener('resize', () => { if (!insertMenu.hidden) positionInsertMenu(); });
        new ResizeObserver(() => { if (!insertMenu.hidden) positionInsertMenu(); }).observe(toolbar);
    }

    var commandPalette = null;
    var commandPaletteInput = null;
    var commandPaletteList = null;
    var commandPaletteSavedRange = null;
    var commandPaletteVisible = false;
    var commandPaletteOutsideClickTimer = null;
    var commandPaletteCategory = '';
    var commandPaletteCount = null;

    // ========== UTILITIES ==========

    // Sidebar toggle functions
    const openSidebarBtn = document.getElementById('openSidebarBtn');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const sidebarResizer = document.getElementById('sidebarResizer');

    // Close sidebar button handler
    closeSidebarBtn.addEventListener('click', function() {
        closeSidebar();
    });

    // Image directory settings button handler
    const imageDirSettingsBtn = document.getElementById('imageDirSettingsBtn');
    if (imageDirSettingsBtn) {
        imageDirSettingsBtn.addEventListener('click', function() {
            host.requestSetImageDir();
        });
    }
    const extensionSettingsBtn = document.getElementById('extensionSettingsBtn');
    if (extensionSettingsBtn && typeof host.openSettings === 'function') {
        extensionSettingsBtn.addEventListener('click', function() {
            host.openSettings();
        });
    }

    // Sidebar resize functionality
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    sidebarResizer.addEventListener('mousedown', function(e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = sidebar.offsetWidth;
        sidebarResizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        const diff = e.clientX - startX;
        const newWidth = Math.min(Math.max(startWidth + diff, 150), 500);
        sidebar.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', function() {
        if (isResizing) {
            isResizing = false;
            sidebarResizer.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
    document.querySelectorAll('button[data-editor-mode]').forEach(button => button.addEventListener('click', () => setEditorMode(button.dataset.editorMode)));
    for (const type of ['click', 'beforeinput']) editor.addEventListener(type, event => {
        if (isSourceMode) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    for (const type of ['select', 'keyup']) sourceEditor.addEventListener(type, () => updateSourceCorrespondence());

    if (editorWrapper) {
        editorWrapper.addEventListener('scroll', scheduleActiveOutlineUpdate, { passive: true });
    }
    window.addEventListener('resize', scheduleActiveOutlineUpdate);

    // Keyboard shortcuts
    document.addEventListener('keydown', async function(e) {
        const isMod = e.ctrlKey || e.metaKey;

        // Handle paste shortcut for Kiro only
        // Kiro's paste event doesn't include image data, so we need to use Clipboard API
        // VSCode/Cursor paste event works normally, so skip this for them
        const isKiro = navigator.userAgent.includes('Kiro');
        if (isMod && e.key === 'v' && isKiro) {
            logger.log('Cmd/Ctrl+V keydown detected (Kiro)');

            if (navigator.clipboard && navigator.clipboard.read) {
                try {
                    const items = await navigator.clipboard.read();

                    for (const item of items) {
                        for (const type of item.types) {
                            if (type.startsWith('image/')) {
                                logger.log('Found image in clipboard via Clipboard API (Kiro):', type);
                                e.preventDefault();
                                const blob = await item.getType(type);
                                const reader = new FileReader();
                                reader.onload = function(event) {
                                    const dataUrl = event.target.result;
                                    host.saveImageAndInsert(dataUrl);
                                    logger.log('Image sent to extension for saving (Kiro)');
                                };
                                reader.readAsDataURL(blob);
                                return;
                            }
                        }
                    }
                    // No image found - let native paste event handle text
                    logger.log('No image in clipboard, falling through to native paste (Kiro)');
                } catch (err) {
                    logger.log('Clipboard API read failed (Kiro):', err.message);
                }
            }
        }

        // Undo (Ctrl+Z / Cmd+Z)
        if (isMod && !e.shiftKey && e.key === 'z') {
            e.preventDefault();
            e.stopPropagation();
            undoManager.undo();
            return;
        }

        // Redo (Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y)
        if (isMod && ((e.shiftKey && e.key.toLowerCase() === 'z') || (!e.shiftKey && e.key === 'y'))) {
            e.preventDefault();
            e.stopPropagation();
            undoManager.redo();
            return;
        }

        // Save snapshot before structural shortcuts (not for save/find/select-all/undo/redo/copy/cut/paste/modifier-only)
        if (isMod && !isSourceMode && e.key !== 's' && e.key !== 'f' && e.key !== 'h' && e.key !== 'l' && e.key !== 'a'
            && e.key !== 'z' && e.key !== 'Z' && e.key !== 'y' && e.key !== 'v' && e.key !== 'c' && e.key !== 'x'
            && e.key !== '/'
            && e.key.toLowerCase() !== 'u'
            && e.key !== 'Meta' && e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt') {
            undoManager.saveSnapshot();
        }

        // Save
        if (isMod && e.key === 's') {
            e.preventDefault();
            e.stopPropagation();
            saveCurrentDocument();
            return;
        }

        // Bold (Ctrl+B)
        if (isMod && !e.shiftKey && e.key === 'b') {
            e.preventDefault();
            e.stopPropagation();
            applyInlineFormat('strong');
            syncMarkdown();
            return;
        }

        // Italic (Ctrl+I)
        if (isMod && !e.shiftKey && e.key === 'i') {
            e.preventDefault();
            e.stopPropagation();
            applyInlineFormat('em');
            syncMarkdown();
            return;
        }

        // Underline (Ctrl+U / Cmd+U)
        if (isMod && !e.shiftKey && e.key.toLowerCase() === 'u') {
            e.preventDefault(); e.stopPropagation();
            toggleUnderline();
            return;
        }

        // Strikethrough (Ctrl+Shift+S)
        if (isMod && e.shiftKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            e.stopPropagation();
            applyInlineFormat('del');
            syncMarkdown();
            return;
        }

        // Heading shortcuts (Ctrl+1 to Ctrl+6)
        if (isMod && !e.shiftKey && e.key >= '1' && e.key <= '6') {
            e.preventDefault();
            e.stopPropagation();
            const level = parseInt(e.key);
            convertToHeading(level);
            return;
        }

        // Paragraph (Ctrl+0)
        if (isMod && !e.shiftKey && e.key === '0') {
            e.preventDefault();
            e.stopPropagation();
            convertToParagraph();
            return;
        }

        // Unordered list (Ctrl+Shift+U)
        if (isMod && e.shiftKey && e.key === 'U') {
            e.preventDefault();
            e.stopPropagation();
            if (!convertListToType('ul')) {
                convertToList('ul');
            }
            return;
        }

        // Ordered list (Ctrl+Shift+O)
        if (isMod && e.shiftKey && e.key === 'O') {
            e.preventDefault();
            e.stopPropagation();
            if (!convertListToType('ol')) {
                convertToList('ol');
            }
            return;
        }

        // Task list (Ctrl+Shift+X)
        if (isMod && e.shiftKey && e.key === 'X') {
            e.preventDefault();
            e.stopPropagation();
            if (!convertListToType('task')) {
                convertToTaskList();
            }
            return;
        }

        // Blockquote (Ctrl+Shift+Q)
        if (isMod && e.shiftKey && e.key === 'Q') {
            e.preventDefault();
            e.stopPropagation();
            convertToBlockquote();
            return;
        }

        // Code block (Ctrl+Shift+K)
        if (isMod && e.shiftKey && e.key === 'K') {
            e.preventDefault();
            e.stopPropagation();
            convertToCodeBlock();
            return;
        }

        // Table (Ctrl+T)
        if (isMod && !e.shiftKey && e.key === 't') {
            e.preventDefault();
            e.stopPropagation();
            insertTable();
            return;
        }

        // Horizontal rule (Ctrl+Shift+-)
        if (isMod && e.shiftKey && (e.key === '-' || e.key === '_')) {
            e.preventDefault();
            e.stopPropagation();
            insertHorizontalRule();
            return;
        }

        // Command Palette (Ctrl+/ or Cmd+/)
        if (isMod && !e.shiftKey && e.key === '/') {
            e.preventDefault();
            e.stopPropagation();
            if (commandPaletteVisible) {
                closeCommandPalette();
            } else {
                openCommandPalette();
            }
            return;
        }

        // Inline code (Ctrl+\`)
        if (isMod && !e.shiftKey && e.key === '\`') {
            e.preventDefault();
            e.stopPropagation();
            wrapWithInlineCode();
            return;
        }

        // Link (Ctrl+K)
        if (isMod && !e.shiftKey && e.key === 'k') {
            e.preventDefault();
            e.stopPropagation();
            insertLink();
            return;
        }

        // Image (Ctrl+Shift+I)
        if (isMod && e.shiftKey && e.key === 'I') {
            e.preventDefault();
            e.stopPropagation();
            // Trigger image insertion via toolbar
            toolbar.querySelector('[data-action="image"]')?.click();
            return;
        }

        // Send selection to chat (Cmd+L / Ctrl+L)
        if (isMod && e.key === 'l') {
            var chatSel = window.getSelection();
            if (!chatSel || chatSel.isCollapsed || !chatSel.rangeCount) return;
            e.preventDefault();
            e.stopPropagation();

            var chatRange = chatSel.getRangeAt(0);

            // Walk up to find direct children of editor
            function findEditorChild(node) {
                while (node && node.parentNode !== editor) {
                    node = node.parentNode;
                }
                return node;
            }

            // Find the nearest li or tr ancestor (sub-block element)
            function findSubBlockEl(node) {
                while (node && node !== editor) {
                    var tag = node.tagName && node.tagName.toLowerCase();
                    if (tag === 'li' || tag === 'tr') return node;
                    node = node.parentNode;
                }
                return null;
            }

            // Count total li elements in a list recursively
            function countLisInList(listEl) {
                var count = 0;
                for (var i = 0; i < listEl.children.length; i++) {
                    var li = listEl.children[i];
                    if (!li.tagName || li.tagName.toLowerCase() !== 'li') continue;
                    count++;
                    for (var j = 0; j < li.children.length; j++) {
                        var child = li.children[j];
                        var ct = child.tagName && child.tagName.toLowerCase();
                        if (ct === 'ul' || ct === 'ol') count += countLisInList(child);
                    }
                }
                return count;
            }

            // Get 0-indexed line offset of targetLi within a list block
            // Each li = 1 markdown line; nested lis follow their parent
            function getListLineOffset(listEl, targetLi) {
                const sourceLocation = getSourceListItemLocation(listEl, targetLi);
                if (sourceLocation) return sourceLocation.offset;
                var offset = 0;
                var found = false;
                function walk(ulOrOl) {
                    if (found) return;
                    for (var i = 0; i < ulOrOl.children.length; i++) {
                        if (found) return;
                        var li = ulOrOl.children[i];
                        if (!li.tagName || li.tagName.toLowerCase() !== 'li') continue;
                        if (li === targetLi) { found = true; return; }
                        if (li.contains(targetLi)) {
                            offset++; // this li's own line
                            for (var j = 0; j < li.children.length; j++) {
                                if (found) return;
                                var child = li.children[j];
                                var ct = child.tagName && child.tagName.toLowerCase();
                                if (ct === 'ul' || ct === 'ol') walk(child);
                            }
                            return;
                        }
                        // li not related to target — count it + all descendants
                        offset++;
                        for (var j = 0; j < li.children.length; j++) {
                            var child = li.children[j];
                            var ct = child.tagName && child.tagName.toLowerCase();
                            if (ct === 'ul' || ct === 'ol') offset += countLisInList(child);
                        }
                    }
                }
                walk(listEl);
                return found ? offset : 0;
            }

            // Get line count for a single li (1 for itself + nested lis)
            function getLiLineCount(li) {
                const sourceLocation = getSourceListItemLocation(findEditorChild(li), li);
                if (sourceLocation) return sourceLocation.count;
                var count = 1;
                for (var j = 0; j < li.children.length; j++) {
                    var child = li.children[j];
                    var ct = child.tagName && child.tagName.toLowerCase();
                    if (ct === 'ul' || ct === 'ol') count += countLisInList(child);
                }
                return count;
            }

            function getSourceListItemLocation(listEl, targetLi) {
                const content = sourceLocations.get(listEl)?.content;
                if (!content) return null;
                const items = [];
                const visit = block => {
                    if (block.type === 'list_item') items.push(block);
                    block.children.forEach(visit);
                };
                window.BinaryMarkdownBlocks.parse(content).blocks.forEach(visit);
                const index = Array.from(listEl.querySelectorAll('li')).indexOf(targetLi);
                const map = items[index]?.map;
                if (!map) return null;
                const text = content.split('\n').slice(map[0], map[1]).join('\n').trimEnd();
                return { offset: map[0], count: text.split('\n').length };
            }

            // Get 0-indexed markdown line offset of targetTr within a table
            // Row 0 → line 0 (header), separator → line 1, Row N (N≥1) → line N+1
            function getTableLineOffset(tableEl, targetTr) {
                var rows = tableEl.querySelectorAll('tr');
                for (var i = 0; i < rows.length; i++) {
                    if (rows[i] === targetTr) return i === 0 ? 0 : i + 1;
                }
                return 0;
            }

            // Count line index where next content starts (includes trailing empty lines)
            // "# Heading\n\n" → 2 (heading on line 0, empty on line 1, next starts at 2)
            function countLinesTotal(md) {
                if (!md) return 0;
                return md.split('\n').length - 1;
            }

            // Count content lines only (excludes trailing empty lines)
            // "# Heading\n\n" → 1 (only "# Heading" is content)
            function countContentLines(md) {
                if (!md) return 0;
                var lines = md.split('\n');
                while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
                return lines.length;
            }

            var startBlock = findEditorChild(chatRange.startContainer);
            var endBlock = findEditorChild(chatRange.endContainer);
            if (!startBlock || !endBlock) return;

            var editorChildren = Array.from(editor.childNodes);
            var startIdx = editorChildren.indexOf(startBlock);
            var endIdx = editorChildren.indexOf(endBlock);
            if (startIdx < 0 || endIdx < 0) return;

            var startSubEl = findSubBlockEl(chatRange.startContainer);
            var endSubEl = findSubBlockEl(chatRange.endContainer);

            // Source separators live outside the DOM; use the same layout
            // serializer as saving when mapping a selection back to lines.
            var sourceLocations = new Map();
            serializeMarkdownBlocks(editor, true, (node, before, content) => {
                sourceLocations.set(node, { start: countLinesTotal(before), content });
            });
            if (!sourceLocations.has(startBlock) || !sourceLocations.has(endBlock)) return;
            var startBaseLine = sourceLocations.get(startBlock).start;

            var startInBlockOffset = 0;
            var startBlockTag = startBlock.tagName && startBlock.tagName.toLowerCase();
            if (startSubEl && startSubEl.tagName) {
                var ssTag = startSubEl.tagName.toLowerCase();
                if (ssTag === 'li' && (startBlockTag === 'ul' || startBlockTag === 'ol')) {
                    startInBlockOffset = getListLineOffset(startBlock, startSubEl);
                } else if (ssTag === 'tr' && startBlockTag === 'table') {
                    startInBlockOffset = getTableLineOffset(startBlock, startSubEl);
                }
            }
            var startLine = startBaseLine + startInBlockOffset;

            // --- Calculate endLine ---
            var endBaseLine = sourceLocations.get(endBlock).start;

            var endLine;
            var endBlockTag = endBlock.tagName && endBlock.tagName.toLowerCase();
            if (endSubEl && endSubEl.tagName) {
                var esTag = endSubEl.tagName.toLowerCase();
                if (esTag === 'li' && (endBlockTag === 'ul' || endBlockTag === 'ol')) {
                    var endInBlockOffset = getListLineOffset(endBlock, endSubEl);
                    var endLiLines = getLiLineCount(endSubEl);
                    endLine = endBaseLine + endInBlockOffset + endLiLines - 1;
                } else if (esTag === 'tr' && endBlockTag === 'table') {
                    endLine = endBaseLine + getTableLineOffset(endBlock, endSubEl);
                } else {
                    endLine = endBaseLine + countContentLines(sourceLocations.get(endBlock).content) - 1;
                }
            } else {
                endLine = endBaseLine + countContentLines(sourceLocations.get(endBlock).content) - 1;
            }

            // --- selectedMarkdown: slice from full document markdown ---
            var fullMd = htmlToMarkdown();
            var fullLines = fullMd.split('\n');
            var safeEnd = Math.min(endLine, fullLines.length - 1);
            var mdSelected = fullLines.slice(startLine, safeEnd + 1).join('\n').trim();

            host.sendToChat(startLine, endLine, mdSelected);
            return;
        }
    });

    // Handle messages from host (VSCode / Electron / test)
    host.onMessage(function(message) {
        if (message.type === 'mathSourceWrap') {
            applyMathSourcePreference('mathSourceWrap', String(message.value === true));
            return;
        }
        if (message.type === 'mathSourcePosition') {
            applyMathSourcePreference('mathSourcePosition', message.value === 'below' ? 'below' : 'above');
            return;
        }
        if (message.type === 'codeLanguageOrder') {
            document.documentElement.dataset.codeLanguageOrder = ['a-z', 'z-a'].includes(message.value) ? message.value : 'default';
            document.querySelector('.lang-selector')?.refreshOrder?.();
            return;
        }
        if (message.type === 'editorWidthIndicators') {
            document.documentElement.dataset.editorWidthIndicators = String(message.value !== false);
            updateWidthIndicators();
            return;
        }
        if (message.type === 'editorWidth') {
            if (typeof message.indicators === 'boolean') document.documentElement.dataset.editorWidthIndicators = String(message.indicators);
            applyEditorWidth(message.mode, message.maxWidth, message.alignment);
            positionLanguageSelector();
            return;
        }
        if (message.type === 'tableToolbarPositionError') {
            showEditorToast(i18n.tablePositionSaveFailed || 'Could not save the table toolbar position. The previous setting remains active.');
            return;
        }
        if (message.type === 'theme') {
            if (!['github', 'sepia', 'night', 'dark', 'minimal', 'perplexity', 'things'].includes(message.value)) return;
            if (document.documentElement.dataset.theme === message.value) return;
            // A presentation change must not rebuild editable DOM or reset undo.
            document.documentElement.dataset.theme = message.value;
            mermaidInitialized = false;
            editor.querySelectorAll('.mermaid-wrapper').forEach(wrapper => renderMermaidDiagram(wrapper));
            return;
        }
        if (message.type === 'tableSourceFormat') {
            // Change future serialization only; retain the DOM, selection and undo.
            document.documentElement.dataset.tableSourceFormat = tableFormat.normalize(message.value);
            return;
        }
        if (message.type === 'tableToolbarPosition') {
            tableControls.setPreference(message.value);
            return;
        }
        if (message.type === 'toolbarMode') {
            if (!['full', 'simple'].includes(message.value)) return;
            document.documentElement.dataset.toolbarMode = message.value;
            scheduleToolbarLayout();
            tableControls.schedule();
            return;
        }
        if (message.type === 'validateExportImage') {
            if (typeof host.respondExport !== 'function') return;
            const image = new Image();
            const dataUri = message.dataUri;
            if (typeof dataUri !== 'string' || !/^data:image\/(?:png|jpeg|gif|webp|svg\+xml)(?:;[a-z0-9=.+-]+)*,/i.test(dataUri)) {
                host.respondExport({ type: 'exportImageValidated', requestId: message.requestId, valid: false });
                return;
            }
            image.src = dataUri;
            image.decode().then(() => {
                host.respondExport({ type: 'exportImageValidated', requestId: message.requestId, valid: image.naturalWidth > 0 && image.naturalHeight > 0 });
            }, () => {
                host.respondExport({ type: 'exportImageValidated', requestId: message.requestId, valid: false });
            }).finally(() => image.removeAttribute('src'));
            return;
        }
        if (message.type === 'documentSaved') {
            const normalizeSaved = value => value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
            if (typeof message.content === 'string' && normalizeSaved(readCurrentMarkdown()) === normalizeSaved(message.content)) {
                markdown = normalizeSaved(message.content);
                hasUserEdited = false;
                pendingSave = null;
                cancelScheduledSync();
            }
            return;
        }
        if (message.type === 'saveResult') {
            if (pendingSave && message.revision === pendingSave.revision) {
                if (message.success && message.revision === clientRevision) {
                    markdown = pendingSave.content;
                    hasUserEdited = false;
                    cancelScheduledSync();
                }
                pendingSave = null;
            }
            return;
        }
        if (message.type === 'cancelExportPreparation') {
            const controller = exportRenderRequests.get(message.requestId);
            if (controller) controller.abort();
            return;
        }
        if (message.type === 'prepareExport') {
            if (typeof host.respondExport !== 'function') return;
            // Capture before queuing so later editor settings cannot change an
            // in-flight export. Optional fields support older host fixtures.
            const appearance = {
                theme: message.theme || document.documentElement.dataset.theme || 'github',
                fontSize: message.fontSize || parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size')) || 16
            };
            const controller = new AbortController();
            exportRenderRequests.set(message.requestId, controller);
            exportRenderQueue = exportRenderQueue.catch(() => {}).then(async () => {
                try {
                    const prepared = await prepareExportDocument(message.markdown, appearance, controller.signal);
                    host.respondExport(Object.assign({ type: 'exportPrepared', requestId: message.requestId }, prepared));
                } catch (error) {
                    host.respondExport({ type: 'exportError', requestId: message.requestId, error: error.message || String(error) });
                } finally {
                    exportRenderRequests.delete(message.requestId);
                }
            });
            return;
        }
        if (message.type === 'captureExportSnapshot') {
            if (typeof host.respondExport === 'function') {
                if (message.refreshToc) {
                    try { refreshManagedTocs(false); }
                    catch (error) { host.respondExport({ type: 'exportError', requestId: message.requestId, error: error.message }); return; }
                }
                host.respondExport({
                    type: 'exportSnapshot', requestId: message.requestId,
                    content: readCurrentMarkdown(),
                    pending: Boolean(syncTimeout || saveTimeout || pendingSync || pendingSave || queuedExternalContent !== null)
                });
            }
            return;
        }
        if (message.type === 'performUndo') {
            undoManager.undo();
            return;
        }
        if (message.type === 'performRedo') {
            undoManager.redo();
            return;
        }
        if (message.type === 'insertToc') { insertManagedToc(); return; }
        if (message.type === 'toggleSourceMode') {
            toggleSourceMode();
            return;
        }
        if (message.type === 'update') {
            logger.log('[Binary Markdown] update message received, content length:', message.content?.length);

            // Normalize incoming content: strip BOM, normalize line endings
            let incomingContent = message.content || '';
            if (incomingContent.charCodeAt(0) === 0xFEFF) {
                incomingContent = incomingContent.slice(1);
            }
            incomingContent = incomingContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

            // Active editing guard: queue external changes while user is typing
            if (isActivelyEditing) {
                queuedExternalContent = incomingContent;
                logger.log('[Binary Markdown] update queued: user is actively editing');
                return;
            }

            // Idle state — apply external change immediately with cursor preservation
            markdown = incomingContent;
            currentImageDir = extractImageDirFromMarkdown(markdown);
            currentForceRelativePath = extractForceRelativePathFromMarkdown(markdown);
            if (isSourceMode) {
                sourceEditor.value = markdown;
            } else {
                updateFromMarkdown();
            }
            updateOutline();
            updateWordCount();
            updateStatus();
            undoManager.clear();
        } else if (message.type === 'setImageDir') {
            // Update currentImageDir and currentForceRelativePath from extension
            currentImageDir = message.dirPath;
            // Set forceRelativePath with true or false; clear it with null.
            if (message.forceRelativePath === null) {
                currentForceRelativePath = null;
            } else if (message.forceRelativePath !== undefined) {
                currentForceRelativePath = message.forceRelativePath;
            }
            updateStatus(); // Update status bar to show IMAGE_DIR and FORCE_RELATIVE_PATH
            syncMarkdown(); // Re-sync to include the new directives
        } else if (message.type === 'imageDirStatus') {
            imageDirDisplayPath = message.displayPath;
            imageDirSource = message.source;
            updateStatus();
        } else if (message.type === 'insertCancelled') {
            finishHostInsertion(message, false);
        } else if (message.type === 'insertImageHtml') {
            if (!finishHostInsertion(message, true)) return;
            logger.log('insertImageHtml received:', message);
            // Insert image at cursor position
            const img = document.createElement('img');
            img.src = message.displayUri;
            img.alt = message.markdownPath || '';
            img.dataset.markdownPath = message.markdownPath;
            img.style.maxWidth = '100%';
            img.onerror = function() {
                logger.error('Image failed to load:', message.displayUri);
            };
            img.onload = function() {
                logger.log('Image loaded successfully');
            };

            editor.focus();
            const sel = window.getSelection();
            if (sel && sel.rangeCount) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                range.insertNode(img);
                range.setStartAfter(img);
                range.setEndAfter(img);
                sel.removeAllRanges();
                sel.addRange(range);
            } else {
                editor.appendChild(img);
            }
            syncMarkdownSync();
            logger.log('Image element inserted');
        } else if (message.type === 'insertLinkHtml') {
            if (!finishHostInsertion(message, true)) return;
            // Insert link at cursor position
            const a = document.createElement('a');
            a.href = message.url;
            a.textContent = message.text;
            setupLink(a);

            const sel = window.getSelection();
            if (sel && sel.rangeCount) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                range.insertNode(a);
                range.setStartAfter(a);
                range.setEndAfter(a);
                sel.removeAllRanges();
                sel.addRange(range);
            } else {
                editor.appendChild(a);
            }
            syncMarkdownSync();
            editor.focus();
        } else if (message.type === 'externalChangeDetected') {
            // Show toast notification for external change
            showEditorToast(message.message);
        } else if (message.type === 'scrollToAnchor') {
            // Scroll to anchor (heading) in the document
            const anchor = message.anchor;
            if (anchor) {
                // Find heading by id or by text content
                const headings = editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
                for (const heading of headings) {
                    // Generate slug from heading text (same as GitHub-style anchor)
                    const headingText = heading.textContent || '';
                    const slug = headingText
                        .toLowerCase()
                        .trim()
                        .replace(/[^\w\s\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\uac00-\ud7af-]/g, '') // Keep alphanumeric, Japanese, Chinese, Korean, hyphen
                        .replace(/\s+/g, '-'); // Replace spaces with hyphens

                    if (slug === anchor || heading.id === anchor) {
                        const wrapper = editor.closest('.editor-wrapper');
                        if (wrapper) {
                            const wrapperRect = wrapper.getBoundingClientRect();
                            const headingRect = heading.getBoundingClientRect();
                            wrapper.scrollTo({ top: wrapper.scrollTop + headingRect.top - wrapperRect.top, behavior: 'smooth' });
                        } else {
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

    // Non-editing notifications retain the current selection and undo history.
    let externalChangeToast = null;
    let toastHideTimer = null;

    // Drag cursor indicator element
    let dragCursor = null;

    // Handle drag and drop for images - capture at document level for reliability
    document.addEventListener('dragenter', function(e) {
        if (editor.contains(e.target) || e.target === editor) {
            e.preventDefault();
            e.stopPropagation();
            logger.log('dragenter on editor');
            editor.classList.add('drag-over');
        }
    });

    document.addEventListener('dragover', function(e) {
        if (editor.contains(e.target) || e.target === editor) {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
            editor.classList.add('drag-over');
            // Show cursor at drop position
            showDragCursor(e.clientX, e.clientY);
        }
    });

    document.addEventListener('dragleave', function(e) {
        if (e.target === editor) {
            editor.classList.remove('drag-over');
            hideDragCursor();
        }
    });

    document.addEventListener('drop', function(e) {
        if (!editor.contains(e.target) && e.target !== editor) {
            return; // Not on editor
        }

        e.preventDefault();
        e.stopPropagation();
        editor.classList.remove('drag-over');
        hideDragCursor();

        logger.log('Drop event fired on editor');
        logger.log('dataTransfer:', e.dataTransfer);
        logger.log('files:', e.dataTransfer?.files);
        logger.log('items:', e.dataTransfer?.items);
        logger.log('types:', e.dataTransfer?.types);

        // Get drop position first
        const dropRange = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (dropRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(dropRange);
        }

        // Try to get files first
        const files = e.dataTransfer?.files;

        if (files && files.length > 0) {
            const file = files[0];
            logger.log('Dropped file from files:', file.name, file.type, file.size);

            if (file.type.startsWith('image/')) {
                readAndInsertImage(file);
                return;
            }
        }

        // Fallback: try items
        const items = e.dataTransfer?.items;
        if (items && items.length > 0) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                logger.log('Item:', item.kind, item.type);

                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        logger.log('Got file from items:', file.name, file.size);
                        readAndInsertImage(file);
                        return;
                    }
                }
            }
        }

        // Check for file URI drop (from Finder/Explorer via VS Code)
        const uriList = e.dataTransfer?.getData('text/uri-list');
        const plainText = e.dataTransfer?.getData('text/plain');
        logger.log('URI list:', uriList);
        logger.log('Plain text:', plainText);

        // Try to get file path from various sources
        let filePath = null;

        if (uriList) {
            // Parse URI list (can contain multiple URIs, one per line)
            const uris = uriList.split('\n').filter(u => u.trim());
            for (const uri of uris) {
                if (uri.startsWith('file://')) {
                    // Check if it's an image
                    if (uri.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
                        filePath = decodeURIComponent(uri.replace('file://', ''));
                        break;
                    }
                }
            }
        }

        if (!filePath && plainText) {
            // Sometimes the path is in plain text
            if (plainText.startsWith('file://')) {
                if (plainText.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
                    filePath = decodeURIComponent(plainText.replace('file://', ''));
                }
            } else if (plainText.startsWith('/') && plainText.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
                // Direct file path
                filePath = plainText;
            }
        }

        if (filePath) {
            logger.log('Found image file path:', filePath);
            // Send to extension to read the file
            host.readAndInsertImage(filePath);
            return;
        }

        // Check for web URL drop
        const url = uriList || plainText;
        if (url && url.startsWith('http') && url.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i)) {
            logger.log('Dropped web image URL:', url);
            // Insert as markdown image with URL
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'image';
            img.style.maxWidth = '100%';

            const sel = window.getSelection();
            if (sel && sel.rangeCount) {
                const range = sel.getRangeAt(0);
                range.insertNode(img);
                range.setStartAfter(img);
                range.collapse(true);
            } else {
                editor.appendChild(img);
            }
            syncMarkdown();
            return;
        }

        logger.log('No image found in drop');
    });

    // Copy handler - convert selection to Markdown and set to clipboard
    editor.addEventListener('copy', function(e) {
        if (e.target.closest && e.target.closest('.front-matter')) return;
        if (isSourceMode) return;

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

        e.preventDefault();

        // Get the selected HTML
        const range = sel.getRangeAt(0);
        const fragment = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);

        // Handle triple-click selection: when selection ends at offset 0 of next element,
        // remove the trailing empty element that was included
        const endOffset = range.endOffset;
        if (endOffset === 0 && tempDiv.lastChild) {
            const lastChild = tempDiv.lastChild;
            // Check if the last child is empty or only contains empty elements
            const lastChildText = lastChild.textContent || '';
            if (lastChildText.trim() === '') {
                tempDiv.removeChild(lastChild);
            }
        }

        // Handle triple-click on nested list item: when selection includes parent li with only nested list,
        // unwrap to get just the nested list content
        // Pattern: <li><ul><li>content</li></ul></li> -> should become just the nested li content
        if (tempDiv.childNodes.length === 1) {
            const onlyChild = tempDiv.childNodes[0];
            if (onlyChild.nodeType === 1 && onlyChild.tagName.toLowerCase() === 'li') {
                // Check if this li has no direct text content, only a nested list
                let hasDirectText = false;
                let nestedList = null;
                for (const child of onlyChild.childNodes) {
                    if (child.nodeType === 3 && child.textContent.trim()) {
                        hasDirectText = true;
                        break;
                    }
                    if (child.nodeType === 1) {
                        const tag = child.tagName.toLowerCase();
                        if (tag === 'ul' || tag === 'ol') {
                            nestedList = child;
                        } else if (tag !== 'br') {
                            // Has other inline content
                            hasDirectText = true;
                            break;
                        }
                    }
                }

                if (!hasDirectText && nestedList) {
                    // Replace the parent li with the nested list's content
                    tempDiv.innerHTML = '';
                    for (const li of nestedList.children) {
                        tempDiv.appendChild(li.cloneNode(true));
                    }
                }
            }
        }

        const selectedHtml = clipboardHtml(tempDiv);

        logger.log('Copy - selected HTML:', selectedHtml.substring(0, 500));
        logger.log('Copy - tempDiv children count:', tempDiv.childNodes.length);
        logger.log('Copy - tempDiv children:', Array.from(tempDiv.childNodes).map(n => n.nodeName + '(' + (n.textContent || '').substring(0, 30) + ')').join(', '));

        try {
            let md = '';

            // Check if the selection is just text (no block elements)
            const hasBlockElements = tempDiv.querySelector('p, h1, h2, h3, h4, h5, h6, ul, ol, li, pre, blockquote, table, hr');

            logger.log('Copy - hasBlockElements:', hasBlockElements ? hasBlockElements.tagName : 'null');

            if (!hasBlockElements) {
                // Selection is just text - need to check if it's a full element selection or partial
                const startContainer = range.startContainer;
                let contextNode = startContainer;

                // Find the nearest block-level parent
                while (contextNode && contextNode !== editor) {
                    if (contextNode.nodeType === 1) {
                        const tag = contextNode.tagName.toLowerCase();
                        if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'pre', 'blockquote', 'td', 'th'].includes(tag)) {
                            break;
                        }
                    }
                    contextNode = contextNode.parentNode;
                }

                logger.log('Copy - context node:', contextNode ? contextNode.tagName : 'none');

                // Check if the selection covers the entire text content of the context node
                const selectedText = sel.toString();
                let isFullSelection = false;

                if (contextNode && contextNode !== editor && contextNode.nodeType === 1) {
                    const tag = contextNode.tagName.toLowerCase();

                    // Get the text content of the context node (excluding nested lists for li)
                    let contextText = '';
                    if (tag === 'li') {
                        // For list items, get text content excluding nested ul/ol
                        for (const child of contextNode.childNodes) {
                            if (child.nodeType === 3) {
                                contextText += child.textContent;
                            } else if (child.nodeType === 1) {
                                const childTag = child.tagName.toLowerCase();
                                if (childTag !== 'ul' && childTag !== 'ol' && childTag !== 'input') {
                                    contextText += child.textContent;
                                }
                            }
                        }
                    } else {
                        contextText = contextNode.textContent;
                    }
                    contextText = contextText.trim();

                    // Check if selection matches the full text content
                    isFullSelection = selectedText.trim() === contextText;

                    logger.log('Copy - selectedText:', selectedText, 'contextText:', contextText, 'isFullSelection:', isFullSelection);

                    if (isFullSelection) {
                        // Full selection - apply context-specific formatting
                        if (tag === 'li') {
                            // Check if it's inside a list and get the proper indent
                            let indent = '';
                            let listParent = contextNode.parentNode;
                            while (listParent && listParent !== editor) {
                                if (listParent.tagName && (listParent.tagName.toLowerCase() === 'ul' || listParent.tagName.toLowerCase() === 'ol')) {
                                    // Check if this list is nested inside another li
                                    if (listParent.parentNode && listParent.parentNode.tagName && listParent.parentNode.tagName.toLowerCase() === 'li') {
                                        indent = '  ' + indent;
                                    }
                                }
                                listParent = listParent.parentNode;
                            }

                            // Check for checkbox
                            const checkbox = contextNode.querySelector(':scope > input[type="checkbox"]');
                            if (checkbox) {
                                const checked = checkbox.checked ? 'x' : ' ';
                                md = indent + '- [' + checked + '] ' + selectedText;
                            } else {
                                // Determine marker (- for ul, number for ol)
                                const parentList = contextNode.parentNode;
                                if (parentList && parentList.tagName && parentList.tagName.toLowerCase() === 'ol') {
                                    // Find the index of this li in the ol
                                    const siblings = Array.from(parentList.children).filter(c => c.tagName && c.tagName.toLowerCase() === 'li');
                                    const index = siblings.indexOf(contextNode) + 1;
                                    md = indent + index + '. ' + selectedText;
                                } else {
                                    md = indent + '- ' + selectedText;
                                }
                            }
                        } else if (tag === 'h1') {
                            md = '# ' + selectedText;
                        } else if (tag === 'h2') {
                            md = '## ' + selectedText;
                        } else if (tag === 'h3') {
                            md = '### ' + selectedText;
                        } else if (tag === 'h4') {
                            md = '#### ' + selectedText;
                        } else if (tag === 'h5') {
                            md = '##### ' + selectedText;
                        } else if (tag === 'h6') {
                            md = '###### ' + selectedText;
                        } else if (tag === 'blockquote') {
                            // Add > prefix to each line
                            const lines = selectedText.split('\n');
                            md = lines.map(line => '> ' + line).join('\n');
                        } else if (tag === 'pre') {
                            // Code block: copy as plain text without fences
                            md = selectedText;
                        } else {
                            // Default: just the text
                            md = selectedText;
                        }
                    } else {
                        // Partial selection - just use plain text
                        md = selectedText;
                    }
                } else {
                    // No context found, just use the text
                    md = sel.toString();
                }
            } else {
                // Selection contains block elements - process normally
                logger.log('Copy - processing block elements, childNodes count:', tempDiv.childNodes.length);

                // Special case: If selection starts with text node followed by nested list,
                // and the selection started inside a list item, we need to wrap the text as a list item
                const firstChild = tempDiv.childNodes[0];
                const hasNestedList = tempDiv.querySelector('ul, ol');
                const startContainer = range.startContainer;

                // Find if selection started inside a list item
                let startLi = null;
                let node = startContainer;
                while (node && node !== editor) {
                    if (node.nodeType === 1 && node.tagName && node.tagName.toLowerCase() === 'li') {
                        startLi = node;
                        break;
                    }
                    node = node.parentNode;
                }

                // Check if first child is text OR if it's a checkbox followed by text (task list case)
                // Also check for inline elements (strong, em, a, code, etc.) that are not block elements
                const isFirstChildText = firstChild && firstChild.nodeType === 3;
                const isFirstChildInlineElement = firstChild && firstChild.nodeType === 1 &&
                    !['ul', 'ol', 'li', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote', 'table', 'hr', 'div'].includes(firstChild.tagName.toLowerCase());
                const isTaskListSelection = firstChild && firstChild.nodeName === 'INPUT' &&
                    firstChild.type === 'checkbox' &&
                    tempDiv.childNodes.length >= 2 &&
                    tempDiv.childNodes[1].nodeType === 3;

                logger.log('Copy - firstChild is text:', isFirstChildText);
                logger.log('Copy - firstChild is inline element:', isFirstChildInlineElement);
                logger.log('Copy - isTaskListSelection:', isTaskListSelection);
                logger.log('Copy - hasNestedList:', !!hasNestedList);
                logger.log('Copy - startLi:', startLi ? 'found' : 'null');
                logger.log('Copy - startLi has checkbox:', startLi ? !!startLi.querySelector(':scope > input[type="checkbox"]') : false);

                // If first child is text/inline element (or checkbox+text for task list), followed by a list, and we started in a list item
                if ((isFirstChildText || isFirstChildInlineElement || isTaskListSelection) && hasNestedList && startLi) {
                    // Calculate indent based on list nesting level
                    let indent = '';
                    let listParent = startLi.parentNode;
                    while (listParent && listParent !== editor) {
                        if (listParent.tagName && (listParent.tagName.toLowerCase() === 'ul' || listParent.tagName.toLowerCase() === 'ol')) {
                            if (listParent.parentNode && listParent.parentNode.tagName && listParent.parentNode.tagName.toLowerCase() === 'li') {
                                indent = '  ' + indent;
                            }
                        }
                        listParent = listParent.parentNode;
                    }

                    // Determine marker type
                    const parentList = startLi.parentNode;
                    let marker = '-';
                    if (parentList && parentList.tagName && parentList.tagName.toLowerCase() === 'ol') {
                        const siblings = Array.from(parentList.children).filter(c => c.tagName && c.tagName.toLowerCase() === 'li');
                        const index = siblings.indexOf(startLi) + 1;
                        marker = index + '.';
                    }

                    // Get text content - for task list, it's the second child; for normal list, it's the first child
                    let textContent;
                    let startIndex; // Index to start processing remaining children

                    if (isTaskListSelection) {
                        // Task list: INPUT, #text, UL...
                        textContent = tempDiv.childNodes[1].textContent.trim();
                        startIndex = 2; // Skip INPUT and #text
                        // Get checkbox state from the copied INPUT element
                        const copiedCheckbox = firstChild;
                        const checked = copiedCheckbox.checked ? 'x' : ' ';
                        md = indent + '- [' + checked + '] ' + textContent + '\n';
                        logger.log('Copy - task list: checkbox checked:', copiedCheckbox.checked, 'text:', textContent);
                    } else {
                        // Normal list: #text or inline element, followed by UL...
                        // Collect all inline content before the nested list
                        let inlineContent = '';
                        startIndex = 0;
                        for (let i = 0; i < tempDiv.childNodes.length; i++) {
                            const child = tempDiv.childNodes[i];
                            if (child.nodeType === 1) {
                                const tag = child.tagName.toLowerCase();
                                if (tag === 'ul' || tag === 'ol') {
                                    // Found the nested list, stop collecting inline content
                                    startIndex = i;
                                    break;
                                }
                            }
                            // Process inline content (text nodes and inline elements)
                            inlineContent += mdProcessNode(child);
                        }
                        textContent = inlineContent.trim();

                        // Check for checkbox in the original list item
                        const checkbox = startLi.querySelector(':scope > input[type="checkbox"]');
                        if (checkbox) {
                            const checked = checkbox.checked ? 'x' : ' ';
                            md = indent + '- [' + checked + '] ' + textContent + '\n';
                        } else {
                            md = indent + marker + ' ' + textContent + '\n';
                        }
                    }

                    // Process remaining children (the nested list)
                    for (let i = startIndex; i < tempDiv.childNodes.length; i++) {
                        const child = tempDiv.childNodes[i];
                        logger.log('Copy - processing remaining child:', child.nodeName);
                        // Nested list should have increased indent
                        md += mdProcessNode(child, indent + '  ');
                    }

                    logger.log('Copy - used list item wrapping for text + nested list');
                } else {
                    md = serializeMarkdownFragment(tempDiv);
                }
                md = md.trim();
            }

            logger.log('Copy - converted markdown:', md.substring(0, 200));

            // Set clipboard data
            e.clipboardData.setData('text/plain', md);
            e.clipboardData.setData('text/html', selectedHtml);
            e.clipboardData.setData('text/x-binary-markdown', md);

        } catch (err) {
            logger.error('Copy error:', err);
            // Fallback to plain text
            e.clipboardData.setData('text/plain', sel.toString());
        }
    });

    // Cut handler - same as copy but also delete selection
    editor.addEventListener('cut', function(e) {
        if (e.target.closest && e.target.closest('.front-matter')) return;
        if (isSourceMode) return;

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

        e.preventDefault();
        markAsEdited();

        // Get the selected HTML
        const range = sel.getRangeAt(0);
        const fragment = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);
        const selectedHtml = clipboardHtml(tempDiv);

        // Convert to Markdown using the same logic as htmlToMarkdown()
        try {
            const md = serializeMarkdownFragment(tempDiv);

            e.clipboardData.setData('text/plain', md);
            e.clipboardData.setData('text/html', selectedHtml);
            e.clipboardData.setData('text/x-binary-markdown', md);
        } catch (err) {
            e.clipboardData.setData('text/plain', sel.toString());
        }

        // Delete the selection
        range.deleteContents();
        syncMarkdown();
    });

    // Paste handler - insert Markdown into source, then re-render
    const { handlePaste } = require('./editor/transfer/paste').createPaste({
        editor, logger, getSourceMode: () => isSourceMode,
        saveSnapshot: () => undoManager.saveSnapshot(),
        markAsEdited: (...args) => markAsEdited(...args),
        saveImageAndInsert: (...args) => host.saveImageAndInsert(...args),
        syncMarkdown: (...args) => syncMarkdown(...args),
        syncMarkdownSync: (...args) => syncMarkdownSync(...args),
        setupLink: (...args) => setupLink(...args),
        parseInline: (...args) => parseInline(...args),
        markdownToHtmlFragment: (...args) => markdownToHtmlFragment(...args),
        setupInteractiveElements: (...args) => setupInteractiveElements(...args)
    });
    editor.addEventListener('paste', handlePaste);

    // Focus/blur notifications for sync policy
    editor.addEventListener('focus', function() {
        host.reportFocus();
    });
    editor.addEventListener('blur', function() {
        // Flush pending edits immediately on blur
        if (!isSourceMode && hasUserEdited) {
            clearTimeout(syncTimeout);
            syncTimeout = null;
            markdown = htmlToMarkdown();
            host.syncContent(markdown);
        }

        // Force idle state on blur
        clearTimeout(editingIdleTimer);
        isActivelyEditing = false;
        host.reportEditingState(false);
        host.reportBlur();

        // Apply queued external changes now that we're definitely idle
        applyQueuedExternalChange();
    });

    sourceEditor.addEventListener('focus', function() {
        host.reportFocus();
    });
    sourceEditor.addEventListener('blur', function() {
        if (isSourceMode && hasUserEdited) {
            markdown = sourceEditor.value;
            host.syncContent(markdown);
        }

        clearTimeout(editingIdleTimer);
        isActivelyEditing = false;
        host.reportEditingState(false);
        host.reportBlur();

        applyQueuedExternalChange();
    });

    // Also save when the webview itself loses visibility
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden' && hasUserEdited) {
            if (isSourceMode) {
                markdown = sourceEditor.value;
            } else {
                clearTimeout(syncTimeout);
                syncTimeout = null;
                markdown = htmlToMarkdown();
            }
            host.syncContent(markdown);
        }
    });

    search.initialize();

    workspaceUi = window.BinaryWorkspaceUi?.create({
        editor, sourceEditor, sidebar, outline, wrapper: editorWrapper, toolbar, i18n,
        icons: LUCIDE_ICONS, isSourceMode: () => isSourceMode,
        openActions: openCommandPalette, layout: scheduleToolbarLayout,
        selection: () => savedToolbarRange,
        format: action => {
            if (isSourceMode) return;
            const original = toolbarActions.find(item => item.button.dataset.action === action)?.button;
            if (original) original.click();
        },
        openTextEditor: () => host.openInTextEditor(),
        statistics: () => wordCount.textContent
    });

    // Expose htmlToMarkdown globally for Electron's executeJavaScript
    if (typeof window !== 'undefined') {
        window.htmlToMarkdown = htmlToMarkdown;
    }

    // Expose functions for testing (only when __testApi is defined)
    if (typeof window !== 'undefined' && window.__testApi) {
        window.__testApi.getMarkdown = () => htmlToMarkdown();
        window.__testApi.getHtml = () => editor.innerHTML;
        window.__testApi.setMarkdown = (md) => {
            markdown = md;
            renderFromMarkdown();
        };
        window.__testApi.setupInteractiveElements = setupInteractiveElements;
        window.__testApi.renderFromMarkdown = renderFromMarkdown;
        window.__testApi.htmlToMarkdown = htmlToMarkdown;
        window.__testApi.updateOutline = updateOutline;
        window.__testApi.updateActiveOutlineItem = updateActiveOutlineItem;
        window.__testApi.ready = true;

        // Table operation functions for testing
        window.__testApi.initializeTableColumnWidths = initializeTableColumnWidths;
        window.__testApi.updateColumnWidth = updateColumnWidth;
        window.__testApi.setColumnAlignment = setColumnAlignment;
        window.__testApi.insertTableColumnRight = insertTableColumnRight;
        window.__testApi.syncMarkdown = syncMarkdown;
        window.__testApi.setCursorToLastLineStartByDOM = setCursorToLastLineStartByDOM;

        // List conversion functions for testing
        window.__testApi.convertListToType = convertListToType;
        window.__testApi.convertToList = convertToList;
        window.__testApi.convertToTaskList = convertToTaskList;

        // Also expose directly on window for backward compatibility with existing tests
        window.initializeTableColumnWidths = initializeTableColumnWidths;
        window.updateColumnWidth = updateColumnWidth;
        window.setColumnAlignment = setColumnAlignment;
        window.insertTableColumnRight = insertTableColumnRight;
        window.syncMarkdown = syncMarkdown;
        window.renderFromMarkdownText = (md) => {
            markdown = md;
            renderFromMarkdown();
        };

        // Expose activeTableCell and activeTable as properties
        Object.defineProperty(window, 'activeTableCell', {
            get: () => activeTableCell,
            set: (value) => { activeTableCell = value; }
        });
        Object.defineProperty(window, 'activeTable', {
            get: () => activeTable,
            set: (value) => { activeTable = value; }
        });
        Object.defineProperty(window, 'markdown', {
            get: () => markdown,
            set: (value) => { markdown = value; }
        });
    }
})();
