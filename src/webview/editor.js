// Preserve the existing browser helper APIs while bundling CommonJS modules.
require('./workspace-ui');
window.BinaryTableFormat = require('../shared/table-format');
window.BinaryEditorLayout = require('../shared/editor-layout');
window.BinaryTablePlacement = require('../shared/table-placement');
require('./table-toolbar');
window.BinaryMath = require('../shared/math-syntax');
(function () {
    const blocksSpecialService = require('./editor/blocks/special').createSpecial({
        get editor() { return editor; },
        get codeBlocksWithSentinel() { return blocksCodeContentService.codeBlocksWithSentinel; },
        get setCursorToEnd() { return selectionDomService.setCursorToEnd; },
        get setCursorToFirstTextNode() { return selectionDomService.setCursorToFirstTextNode; },
        get setCursorToLastLineStartByDOM() { return selectionLinesService.setCursorToLastLineStartByDOM; },
        get getCodePlainText() { return selectionDomService.getCodePlainText; },
        get escapeHtml() { return codecInlineService.escapeHtml; },
        get logger() { return logger; },
        get i18n() { return i18n; },
        get workspaceUi() { return workspaceUi; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get isSourceMode() { return uiChromeService.isSourceMode; },
        get markdown() { return coreSessionService.markdown; }, set markdown(value) { coreSessionService.markdown = value; },
        get readCurrentMarkdown() { return coreSessionService.readCurrentMarkdown; },
        get undoManager() { return coreSessionService.undoManager; },
        get syncMarkdownSync() { return coreSessionService.syncMarkdownSync; },
        get saveCurrentDocument() { return coreSessionService.saveCurrentDocument; },
        get stripTrailingNewlines() { return codecBlocksService.stripTrailingNewlines; }
    });
    const blocksRenderService = require('./editor/blocks/render').createRender({
        get editor() { return editor; },
        get updateOutline() { return uiChromeService.updateOutline; },
        get updateWordCount() { return uiChromeService.updateWordCount; },
        get updateStatus() { return uiChromeService.updateStatus; },
        get captureCodeViews() { return blocksCodeControlsService.captureCodeViews; },
        get closeInsertMenu() { return uiMenusService.closeInsertMenu; },
        get closeLanguageSelector() { return blocksCodeControlsService.closeLanguageSelector; },
        get tableControls() { return blocksTablesService.tableControls; },
        get isSourceMode() { return uiChromeService.isSourceMode; },
        get sourceEditor() { return sourceEditor; },
        get markdown() { return coreSessionService.markdown; }, set markdown(value) { coreSessionService.markdown = value; },
        get logger() { return logger; },
        get markdownToHtmlFragment() { return codecBlocksService.markdownToHtmlFragment; },
        get visualSourceCurrent() { return coreSessionService.visualSourceCurrent; }, set visualSourceCurrent(value) { coreSessionService.visualSourceCurrent = value; },
        get restoreCodeViews() { return blocksCodeControlsService.restoreCodeViews; },
        get applyPreviewReadOnly() { return uiChromeService.applyPreviewReadOnly; },
        get workspaceUi() { return workspaceUi; },
        get saveCursorState() { return selectionDomService.saveCursorState; },
        get restoreCursorState() { return selectionDomService.restoreCursorState; },
        get escapeHtml() { return codecInlineService.escapeHtml; },
        get i18n() { return i18n; },
        get documentAux() { return documentAux; },
        get readCurrentMarkdown() { return coreSessionService.readCurrentMarkdown; },
        get cancelScheduledSync() { return coreSessionService.cancelScheduledSync; },
        get undoManager() { return coreSessionService.undoManager; },
        get markAsEdited() { return coreSessionService.markAsEdited; },
        get notifyChangeImmediate() { return coreSessionService.notifyChangeImmediate; },
        get getCurrentLine() { return selectionDomService.getCurrentLine; },
        get syncMarkdownSync() { return coreSessionService.syncMarkdownSync; },
        get showEditorToast() { return transferClipboardService.showEditorToast; },
        get markActivelyEditing() { return coreSessionService.markActivelyEditing; },
        get saveCurrentDocument() { return coreSessionService.saveCurrentDocument; },
        get host() { return host; },
        get setupInlineMath() { return blocksSpecialService.setupInlineMath; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get addTableResizeHandles() { return blocksTablesService.addTableResizeHandles; },
        get setupCodeBlockUI() { return blocksCodeControlsService.setupCodeBlockUI; },
        get setupMermaidDiagrams() { return blocksSpecialService.setupMermaidDiagrams; },
        get setupMathBlocks() { return blocksSpecialService.setupMathBlocks; }
    });
    const editingListsService = require('./editor/editing/lists').createLists({
        get logger() { return logger; },
        get setCursorToEnd() { return selectionDomService.setCursorToEnd; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get editor() { return editor; },
        get getSelectedListItems() { return selectionDomService.getSelectedListItems; },
        get setupInteractiveElements() { return blocksRenderService.setupInteractiveElements; }
    });
    const editingBlockPatternsService = require('./editor/editing/block-patterns').createBlockPatterns({
        get emptyTableCell() { return emptyTableCell; },
        get addTableResizeHandles() { return blocksTablesService.addTableResizeHandles; },
        get setCursorToEnd() { return selectionDomService.setCursorToEnd; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get checkInlinePatterns() { return editingInlineFormatService.checkInlinePatterns; },
        get logger() { return logger; },
        get editor() { return editor; },
        get changeParentListType() { return editingListsService.changeParentListType; },
        get renderMermaidDiagram() { return blocksSpecialService.renderMermaidDiagram; },
        get renderMathBlock() { return blocksSpecialService.renderMathBlock; },
        get setupCodeBlockUI() { return blocksCodeControlsService.setupCodeBlockUI; }
    });
    const editingInlineFormatService = require('./editor/editing/inline-format').createInlineFormat({
        get logger() { return logger; },
        get mathSyntax() { return mathSyntax; },
        get mathBackslashDelimiters() { return mathBackslashDelimiters; },
        get inlineMathHtml() { return blocksSpecialService.inlineMathHtml; },
        get setupInlineMath() { return blocksSpecialService.setupInlineMath; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get editor() { return editor; },
        get isSourceMode() { return uiChromeService.isSourceMode; },
        get editorRange() { return uiMenusService.editorRange; },
        get showEditorToast() { return transferClipboardService.showEditorToast; },
        get i18n() { return i18n; },
        get markdown() { return coreSessionService.markdown; }, set markdown(value) { coreSessionService.markdown = value; },
        get readCurrentMarkdown() { return coreSessionService.readCurrentMarkdown; },
        get undoManager() { return coreSessionService.undoManager; },
        get syncMarkdownSync() { return coreSessionService.syncMarkdownSync; }
    });
    const blocksExportService = require('./editor/blocks/export').createExport({
        get documentAux() { return documentAux; },
        get markdownToHtmlFragment() { return codecBlocksService.markdownToHtmlFragment; },
        get assignHeadingAnchors() { return blocksRenderService.assignHeadingAnchors; },
        get applyHighlighting() { return blocksCodeContentService.applyHighlighting; },
        get renderInlineMath() { return blocksSpecialService.renderInlineMath; },
        get inlineMathMarkdown() { return blocksSpecialService.inlineMathMarkdown; },
        get getCodePlainText() { return selectionDomService.getCodePlainText; },
        get renderMathBlock() { return blocksSpecialService.renderMathBlock; },
        get initMermaid() { return blocksSpecialService.initMermaid; }
    });
    const blocksTablesService = require('./editor/blocks/tables').createTables({
        get editor() { return editor; },
        get toolbar() { return toolbar; },
        get i18n() { return i18n; },
        get LUCIDE_ICONS() { return uiChromeService.LUCIDE_ICONS; },
        get isSourceMode() { return uiChromeService.isSourceMode; },
        get scheduleToolbarLayout() { return uiChromeService.scheduleToolbarLayout; },
        get host() { return host; },
        get markdown() { return coreSessionService.markdown; }, set markdown(value) { coreSessionService.markdown = value; },
        get readCommittedMarkdown() { return coreSessionService.readCommittedMarkdown; },
        get undoManager() { return coreSessionService.undoManager; },
        get logger() { return logger; },
        get enterDisplayMode() { return blocksCodeContentService.enterDisplayMode; },
        get exitSpecialWrapperDisplayMode() { return blocksSpecialService.exitSpecialWrapperDisplayMode; },
        get setCursorToEnd() { return selectionDomService.setCursorToEnd; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get emptyTableCell() { return emptyTableCell; }
    });
    const blocksCodeControlsService = require('./editor/blocks/code-controls').createCodeControls({
        get editorWrapper() { return editorWrapper; },
        get editor() { return editor; },
        get mdProcessNode() { return codecBlocksService.mdProcessNode; },
        get i18n() { return i18n; },
        get LUCIDE_ICONS() { return uiChromeService.LUCIDE_ICONS; },
        get enterDisplayMode() { return blocksCodeContentService.enterDisplayMode; },
        get host() { return host; },
        get applyHighlighting() { return blocksCodeContentService.applyHighlighting; },
        get enterEditMode() { return blocksCodeContentService.enterEditMode; },
        get isNavigatingIntoBlock() { return selectionDomService.isNavigatingIntoBlock; },
        get markdown() { return coreSessionService.markdown; }, set markdown(value) { coreSessionService.markdown = value; },
        get htmlToMarkdown() { return codecBlocksService.htmlToMarkdown; },
        get undoManager() { return coreSessionService.undoManager; },
        get syncMarkdownSync() { return coreSessionService.syncMarkdownSync; },
        get updateOutline() { return uiChromeService.updateOutline; },
        get updateWordCount() { return uiChromeService.updateWordCount; },
        get setCursorToFirstTextNode() { return selectionDomService.setCursorToFirstTextNode; },
        get setCursorToEnd() { return selectionDomService.setCursorToEnd; },
        get LANGUAGE_ALIASES() { return blocksCodeContentService.LANGUAGE_ALIASES; },
        get isSourceMode() { return uiChromeService.isSourceMode; },
        get convertToSpecialBlock() { return blocksCodeContentService.convertToSpecialBlock; },
        get orderedCodeLanguages() { return blocksCodeContentService.orderedCodeLanguages; },
        get codeLanguageName() { return blocksCodeContentService.codeLanguageName; },
        get stripTrailingNewlines() { return codecBlocksService.stripTrailingNewlines; },
        get getCodePlainText() { return selectionDomService.getCodePlainText; },
        get logger() { return logger; }
    });
    const uiChromeService = require('./editor/ui/chrome').createChrome({
        get editor() { return editor; },
        get editorWrapper() { return editorWrapper; },
        get toolbar() { return toolbar; },
        get editorRenderRevision() { return blocksRenderService.editorRenderRevision; },
        get editorRange() { return uiMenusService.editorRange; },
        get showEditorToast() { return transferClipboardService.showEditorToast; },
        get i18n() { return i18n; },
        get savedToolbarRange() { return uiCommandsService.savedToolbarRange; }, set savedToolbarRange(value) { uiCommandsService.savedToolbarRange = value; },
        get executeEditorCommand() { return uiCommandsService.executeEditorCommand; },
        get tableControls() { return blocksTablesService.tableControls; },
        get markAsEdited() { return coreSessionService.markAsEdited; },
        get undoManager() { return coreSessionService.undoManager; },
        get host() { return host; },
        get dispatchToolbarAction() { return uiCommandsService.dispatchToolbarAction; },
        get sidebar() { return sidebar; },
        get sourceEditor() { return sourceEditor; },
        get workspaceUi() { return workspaceUi; },
        get matchingCommandItems() { return uiMenusService.matchingCommandItems; },
        get createCommandItem() { return uiMenusService.createCommandItem; },
        get insertActions() { return uiMenusService.insertActions; },
        get insertUnavailable() { return uiMenusService.insertUnavailable; },
        get pendingHostInsert() { return uiCommandsService.pendingHostInsert; }, set pendingHostInsert(value) { uiCommandsService.pendingHostInsert = value; },
        get hostInsertSequence() { return uiCommandsService.hostInsertSequence; }, set hostInsertSequence(value) { uiCommandsService.hostInsertSequence = value; },
        get markdown() { return coreSessionService.markdown; }, set markdown(value) { coreSessionService.markdown = value; },
        get readCurrentMarkdown() { return coreSessionService.readCurrentMarkdown; },
        get renderFromMarkdown() { return blocksRenderService.renderFromMarkdown; },
        get documentAux() { return documentAux; },
        get readCommittedMarkdown() { return coreSessionService.readCommittedMarkdown; },
        get mathBackslashDelimiters() { return mathBackslashDelimiters; },
        get mdProcessNode() { return codecBlocksService.mdProcessNode; },
        get closeInsertMenu() { return uiMenusService.closeInsertMenu; },
        get closeLanguageSelector() { return blocksCodeControlsService.closeLanguageSelector; },
        get hideTableToolbar() { return blocksTablesService.hideTableToolbar; },
        get closeSearchBox() { return uiSearchService.closeSearchBox; },
        get searchReplaceBox() { return uiSearchService.searchReplaceBox; },
        get cancelScheduledSync() { return coreSessionService.cancelScheduledSync; },
        get saveCursorState() { return selectionDomService.saveCursorState; },
        get restoreCursorState() { return selectionDomService.restoreCursorState; },
        get notifyChangeImmediate() { return coreSessionService.notifyChangeImmediate; },
        get assignHeadingAnchors() { return blocksRenderService.assignHeadingAnchors; },
        get outline() { return outline; },
        get escapeHtml() { return codecInlineService.escapeHtml; },
        get markdownToHtmlFragment() { return codecBlocksService.markdownToHtmlFragment; },
        get inlineMathMarkdown() { return blocksSpecialService.inlineMathMarkdown; },
        get wordCount() { return wordCount; },
        get statusImageDir() { return statusImageDir; },
        get imageDirDisplayPath() { return coreSessionService.imageDirDisplayPath; },
        get imageDirSource() { return coreSessionService.imageDirSource; }
    });
    const uiCommandsService = require('./editor/ui/commands').createCommands({
        get logger() { return logger; },
        get host() { return host; },
        get undoManager() { return coreSessionService.undoManager; },
        get isSourceMode() { return uiChromeService.isSourceMode; },
        get saveCurrentDocument() { return coreSessionService.saveCurrentDocument; },
        get applyInlineFormat() { return editingInlineFormatService.applyInlineFormat; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get toggleUnderline() { return editingInlineFormatService.toggleUnderline; },
        get convertListToType() { return editingListsService.convertListToType; },
        get convertToList() { return editingListsService.convertToList; },
        get convertToTaskList() { return editingListsService.convertToTaskList; },
        get commandPaletteVisible() { return uiMenusService.commandPaletteVisible; }, set commandPaletteVisible(value) { uiMenusService.commandPaletteVisible = value; },
        get closeCommandPalette() { return uiMenusService.closeCommandPalette; },
        get openCommandPalette() { return uiMenusService.openCommandPalette; },
        get toolbar() { return toolbar; },
        get editor() { return editor; },
        get serializeMarkdownBlocks() { return codecBlocksService.serializeMarkdownBlocks; },
        get htmlToMarkdown() { return codecBlocksService.htmlToMarkdown; },
        get escapeHtml() { return codecInlineService.escapeHtml; },
        get getCurrentLine() { return selectionDomService.getCurrentLine; },
        get setCursorToEnd() { return selectionDomService.setCursorToEnd; },
        get setupCodeBlockUI() { return blocksCodeControlsService.setupCodeBlockUI; },
        get enterEditMode() { return blocksCodeContentService.enterEditMode; },
        get convertToSpecialBlock() { return blocksCodeContentService.convertToSpecialBlock; },
        get isSpecialWrapper() { return blocksSpecialService.isSpecialWrapper; },
        get enterSpecialWrapperEditMode() { return blocksSpecialService.enterSpecialWrapperEditMode; },
        get editorRange() { return uiMenusService.editorRange; },
        get inlineMathHtml() { return blocksSpecialService.inlineMathHtml; },
        get setupInlineMath() { return blocksSpecialService.setupInlineMath; },
        get syncMarkdownSync() { return coreSessionService.syncMarkdownSync; },
        get editInlineMath() { return blocksSpecialService.editInlineMath; },
        get requestHostInsertion() { return uiChromeService.requestHostInsertion; },
        get insertManagedToc() { return blocksRenderService.insertManagedToc; },
        get commandPalette() { return uiMenusService.commandPalette; },
        get stopCommandPaletteOutsideClicks() { return uiMenusService.stopCommandPaletteOutsideClicks; },
        get commandPaletteRepositionHandler() { return uiMenusService.commandPaletteRepositionHandler; },
        get commandPaletteSavedRange() { return uiMenusService.commandPaletteSavedRange; }, set commandPaletteSavedRange(value) { uiMenusService.commandPaletteSavedRange = value; },
        get openInsertMenu() { return uiMenusService.openInsertMenu; },
        get setEditorMode() { return uiChromeService.setEditorMode; },
        get openSidebar() { return uiChromeService.openSidebar; },
        get openSearchBox() { return uiSearchService.openSearchBox; },
        get markAsEdited() { return coreSessionService.markAsEdited; },
        get insertActions() { return uiMenusService.insertActions; },
        get setupLink() { return blocksRenderService.setupLink; }
    });
    const uiMenusService = require('./editor/ui/menus').createMenus({
        get i18n() { return i18n; },
        get LUCIDE_ICONS() { return uiChromeService.LUCIDE_ICONS; },
        get captureToolbarSelection() { return uiChromeService.captureToolbarSelection; },
        get showEditorToast() { return transferClipboardService.showEditorToast; },
        get editor() { return editor; },
        get savedToolbarRange() { return uiCommandsService.savedToolbarRange; }, set savedToolbarRange(value) { uiCommandsService.savedToolbarRange = value; },
        get markdown() { return coreSessionService.markdown; }, set markdown(value) { coreSessionService.markdown = value; },
        get readCurrentMarkdown() { return coreSessionService.readCurrentMarkdown; },
        get undoManager() { return coreSessionService.undoManager; },
        get dispatchToolbarAction() { return uiCommandsService.dispatchToolbarAction; },
        get syncMarkdownSync() { return coreSessionService.syncMarkdownSync; },
        get toolbar() { return toolbar; },
        get applyHighlighting() { return blocksCodeContentService.applyHighlighting; },
        get isSourceMode() { return uiChromeService.isSourceMode; },
        get toolbarMore() { return uiChromeService.toolbarMore; },
        get executeCommandPaletteAction() { return uiCommandsService.executeCommandPaletteAction; },
        get closeToolbarOverflow() { return uiChromeService.closeToolbarOverflow; }
    });
    const coreSessionService = require('./editor/core/session').createSession({
        get saveCursorState() { return selectionDomService.saveCursorState; },
        get isSourceMode() { return uiChromeService.isSourceMode; },
        get sourceEditor() { return sourceEditor; },
        get captureCodeViews() { return blocksCodeControlsService.captureCodeViews; },
        get renderFromMarkdown() { return blocksRenderService.renderFromMarkdown; },
        get restoreCursorState() { return selectionDomService.restoreCursorState; },
        get scheduleSplitPreview() { return uiChromeService.scheduleSplitPreview; },
        get updateOutline() { return uiChromeService.updateOutline; },
        get editor() { return editor; },
        get host() { return host; },
        get htmlToMarkdown() { return codecBlocksService.htmlToMarkdown; },
        get finishInlineMathEdit() { return blocksSpecialService.finishInlineMathEdit; },
        get refreshManagedTocs() { return blocksRenderService.refreshManagedTocs; },
        get showEditorToast() { return transferClipboardService.showEditorToast; },
        get updatePlaceholder() { return blocksRenderService.updatePlaceholder; },
        get updateWordCount() { return uiChromeService.updateWordCount; },
        get updateStatus() { return uiChromeService.updateStatus; },
        get logger() { return logger; },
        get updateFromMarkdown() { return blocksRenderService.updateFromMarkdown; }
    });
    const transferClipboardService = require('./editor/transfer/clipboard').createClipboard({
        get editor() { return editor; },
        get logger() { return logger; },
        get host() { return host; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get isSourceMode() { return uiChromeService.isSourceMode; },
        get clipboardHtml() { return codecBlocksService.clipboardHtml; },
        get mdProcessNode() { return codecBlocksService.mdProcessNode; },
        get serializeMarkdownFragment() { return codecBlocksService.serializeMarkdownFragment; },
        get markAsEdited() { return coreSessionService.markAsEdited; }
    });
    const inputDispatchService = require('./editor/input/dispatch').createDispatch({
        get editor() { return editor; },
        get logger() { return logger; },
        get isSourceMode() { return uiChromeService.isSourceMode; },
        get syncMarkdownSync() { return coreSessionService.syncMarkdownSync; },
        get markActivelyEditing() { return coreSessionService.markActivelyEditing; },
        get markAsEdited() { return coreSessionService.markAsEdited; },
        get undoManager() { return coreSessionService.undoManager; },
        get debouncedSync() { return coreSessionService.debouncedSync; },
        get updatePlaceholder() { return blocksRenderService.updatePlaceholder; },
        get getCurrentLine() { return selectionDomService.getCurrentLine; },
        get mathBackslashDelimiters() { return mathBackslashDelimiters; },
        get mathBlockHtml() { return blocksSpecialService.mathBlockHtml; },
        get setupMathBlocks() { return blocksSpecialService.setupMathBlocks; },
        get enterSpecialWrapperEditMode() { return blocksSpecialService.enterSpecialWrapperEditMode; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get handleEarlyListBackspace() { return inputListSelectionDeleteService.handleEarlyListBackspace; },
        get handlePlainShiftEnter() { return inputParagraphFormatService.handlePlainShiftEnter; },
        get handleInlineShiftEnter() { return inputParagraphFormatService.handleInlineShiftEnter; },
        get handleTableEnter() { return inputTablesService.handleTableEnter; },
        get handleCodeEnter() { return inputBlockNavigationService.handleCodeEnter; },
        get handleQuoteEnter() { return inputBlockNavigationService.handleQuoteEnter; },
        get handleListEnter() { return inputListEnterTabService.handleListEnter; },
        get handleProseEnter() { return inputParagraphFormatService.handleProseEnter; },
        get handleSpacePatterns() { return inputParagraphFormatService.handleSpacePatterns; },
        get handleTableTab() { return inputTablesService.handleTableTab; },
        get handleCodeQuoteTab() { return inputBlockNavigationService.handleCodeQuoteTab; },
        get handleMultiListTab() { return inputListEnterTabService.handleMultiListTab; },
        get handleSingleListTab() { return inputListEnterTabService.handleSingleListTab; },
        get handleGeneralTab() { return inputParagraphFormatService.handleGeneralTab; },
        get handleTableArrows() { return inputTablesService.handleTableArrows; },
        get handleBlockArrows() { return inputBlockNavigationService.handleBlockArrows; },
        get handleBackspaceOnList() { return inputListBackspaceService.handleBackspaceOnList; },
        get handleFallbackEmptyList() { return inputListBoundariesService.handleFallbackEmptyList; },
        get handleParagraphInsideListDelete() { return inputListBoundariesService.handleParagraphInsideListDelete; },
        get handleParagraphDelete() { return inputParagraphDeleteService.handleParagraphDelete; },
        get handleCodeSpecialDelete() { return inputBlockNavigationService.handleCodeSpecialDelete; },
        get handleHeadingQuoteDelete() { return inputParagraphFormatService.handleHeadingQuoteDelete; },
        get handleRemainingListDelete() { return inputListBoundariesService.handleRemainingListDelete; }
    });
    const inputListSelectionDeleteService = require('./editor/input/list-selection-delete').createListSelectionDelete({
        get logger() { return logger; },
        get editor() { return editor; },
        get syncMarkdownSync() { return coreSessionService.syncMarkdownSync; },
        get setCursorToEnd() { return selectionDomService.setCursorToEnd; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; }
    });
    const inputParagraphFormatService = require('./editor/input/paragraph-format').createParagraphFormat({
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get logger() { return logger; },
        get getCurrentLine() { return selectionDomService.getCurrentLine; },
        get setCursorToStart() { return selectionDomService.setCursorToStart; },
        get checkTablePattern() { return editingBlockPatternsService.checkTablePattern; },
        get convertToTable() { return editingBlockPatternsService.convertToTable; },
        get setCursorToEnd() { return selectionDomService.setCursorToEnd; },
        get checkAllPatterns() { return editingBlockPatternsService.checkAllPatterns; },
        get checkInlinePatterns() { return editingInlineFormatService.checkInlinePatterns; },
        get undoManager() { return coreSessionService.undoManager; },
        get checkInlineEscape() { return editingInlineFormatService.checkInlineEscape; },
        get editor() { return editor; }
    });
    const inputTablesService = require('./editor/input/tables').createTables({
        get logger() { return logger; },
        get emptyTableCell() { return emptyTableCell; },
        get activeTableCell() { return blocksTablesService.activeTableCell; }, set activeTableCell(value) { blocksTablesService.activeTableCell = value; },
        get setCursorToEnd() { return selectionDomService.setCursorToEnd; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get editor() { return editor; },
        get showTableToolbar() { return blocksTablesService.showTableToolbar; },
        get setCursorToLastLineStartByDOM() { return selectionLinesService.setCursorToLastLineStartByDOM; },
        get navigateToAdjacentElement() { return selectionDomService.navigateToAdjacentElement; },
        get hideTableToolbar() { return blocksTablesService.hideTableToolbar; },
        get activeTable() { return blocksTablesService.activeTable; }, set activeTable(value) { blocksTablesService.activeTable = value; },
        get setCursorToStart() { return selectionDomService.setCursorToStart; },
        get revealTableCaret() { return blocksTablesService.revealTableCaret; }
    });
    const inputBlockNavigationService = require('./editor/input/block-navigation').createBlockNavigation({
        get editor() { return editor; },
        get logger() { return logger; },
        get exitSpecialWrapperDisplayMode() { return blocksSpecialService.exitSpecialWrapperDisplayMode; },
        get setCursorToEnd() { return selectionDomService.setCursorToEnd; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get getCodePlainText() { return selectionDomService.getCodePlainText; },
        get codeBlocksWithSentinel() { return blocksCodeContentService.codeBlocksWithSentinel; },
        get indentLinesInContainer() { return selectionDomService.indentLinesInContainer; },
        get getCurrentLineInBlock() { return selectionLinesService.getCurrentLineInBlock; },
        get navigateToAdjacentElement() { return selectionDomService.navigateToAdjacentElement; },
        get enterDisplayMode() { return blocksCodeContentService.enterDisplayMode; },
        get setCursorToLineStart() { return selectionLinesService.setCursorToLineStart; },
        get scrollCursorIntoView() { return selectionDomService.scrollCursorIntoView; },
        get setCursorToFirstTextNode() { return selectionDomService.setCursorToFirstTextNode; },
        get isSpecialWrapper() { return blocksSpecialService.isSpecialWrapper; }
    });
    const inputListEnterTabService = require('./editor/input/list-enter-tab').createListEnterTab({
        get editor() { return editor; },
        get setCursorToEnd() { return selectionDomService.setCursorToEnd; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get getSelectedListItems() { return selectionDomService.getSelectedListItems; },
        get logger() { return logger; },
        get outdentListItem() { return editingListsService.outdentListItem; },
        get indentListItem() { return editingListsService.indentListItem; },
        get setCursorToEndOfLi() { return inputListBackspaceService.setCursorToEndOfLi; }
    });
    const inputListBackspaceService = require('./editor/input/list-backspace').createListBackspace({
        get editor() { return editor; },
        get logger() { return logger; },
        get setCursorToEnd() { return selectionDomService.setCursorToEnd; },
        get setCursorToStart() { return selectionDomService.setCursorToStart; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; }
    });
    const inputListBoundariesService = require('./editor/input/list-boundaries').createListBoundaries({
        get logger() { return logger; },
        get editor() { return editor; },
        get setCursorToEnd() { return selectionDomService.setCursorToEnd; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; }
    });
    const inputParagraphDeleteService = require('./editor/input/paragraph-delete').createParagraphDelete({
        get setCursorToStart() { return selectionDomService.setCursorToStart; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get setCursorToEndOfLi() { return inputListBackspaceService.setCursorToEndOfLi; },
        get setCursorToEnd() { return selectionDomService.setCursorToEnd; },
        get isNavigatingIntoBlock() { return selectionDomService.isNavigatingIntoBlock; }, set isNavigatingIntoBlock(value) { selectionDomService.isNavigatingIntoBlock = value; },
        get enterEditMode() { return blocksCodeContentService.enterEditMode; },
        get resetNavigationFlag() { return selectionDomService.resetNavigationFlag; },
        get isSpecialWrapper() { return blocksSpecialService.isSpecialWrapper; },
        get enterSpecialWrapperEditMode() { return blocksSpecialService.enterSpecialWrapperEditMode; }
    });
    const uiSearchService = require('./editor/ui/search').createSearchController({
        get editor() { return editor; },
        get sourceEditor() { return sourceEditor; },
        get i18n() { return i18n; },
        get isSourceMode() { return uiChromeService.isSourceMode; },
        get isSplitMode() { return uiChromeService.isSplitMode; },
        get readCommittedMarkdown() { return coreSessionService.readCommittedMarkdown; },
        get sourceDomPositions() { return uiChromeService.sourceDomPositions; },
        get editorRange() { return uiMenusService.editorRange; },
        get setEditorMode() { return uiChromeService.setEditorMode; },
        get updateSourceCorrespondence() { return uiChromeService.updateSourceCorrespondence; },
        get markdown() { return coreSessionService.markdown; }, set markdown(value) { coreSessionService.markdown = value; },
        get undoManager() { return coreSessionService.undoManager; },
        get markAsEdited() { return coreSessionService.markAsEdited; },
        get cancelScheduledSync() { return coreSessionService.cancelScheduledSync; },
        get scheduleSplitPreview() { return uiChromeService.scheduleSplitPreview; },
        get renderFromMarkdown() { return blocksRenderService.renderFromMarkdown; },
        get visualSourceCurrent() { return coreSessionService.visualSourceCurrent; }, set visualSourceCurrent(value) { coreSessionService.visualSourceCurrent = value; },
        get notifyChangeImmediate() { return coreSessionService.notifyChangeImmediate; }
    });
    const selectionDomService = require('./editor/selection/dom').createDomController({
        get editor() { return editor; },
        get logger() { return logger; },
        get enterEditMode() { return blocksCodeContentService.enterEditMode; },
        get enterSpecialWrapperEditMode() { return blocksSpecialService.enterSpecialWrapperEditMode; },
        get isSpecialWrapper() { return blocksSpecialService.isSpecialWrapper; },
        get setCursorToLastLineStartByDOM() { return selectionLinesService.setCursorToLastLineStartByDOM; },
        get showTableToolbar() { return blocksTablesService.showTableToolbar; },
        get revealTableCaret() { return blocksTablesService.revealTableCaret; },
        get activeTable() { return blocksTablesService.activeTable; }, set activeTable(value) { blocksTablesService.activeTable = value; },
        get activeTableCell() { return blocksTablesService.activeTableCell; }, set activeTableCell(value) { blocksTablesService.activeTableCell = value; }
    });
    const blocksCodeContentService = require('./editor/blocks/code-content').createCodeContentController({
        get editor() { return editor; },
        get logger() { return logger; },
        get i18n() { return i18n; },
        get getCodePlainText() { return selectionDomService.getCodePlainText; },
        get stripSentinelAndRebuildCode() { return blocksSpecialService.stripSentinelAndRebuildCode; },
        get stripTrailingNewlines() { return codecBlocksService.stripTrailingNewlines; },
        get escapeHtml() { return codecInlineService.escapeHtml; },
        get renderMermaidDiagram() { return blocksSpecialService.renderMermaidDiagram; },
        get renderMathBlock() { return blocksSpecialService.renderMathBlock; },
        get setCursorToEnd() { return selectionDomService.setCursorToEnd; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get syncMarkdownSync() { return coreSessionService.syncMarkdownSync; }
    });
    const selectionLinesService = require('./editor/selection/lines').createLinesController({
        get logger() { return logger; },
        get setCursorToStart() { return selectionDomService.setCursorToStart; },
        get setCursorToEnd() { return selectionDomService.setCursorToEnd; },
        get setCursorToFirstTextNode() { return selectionDomService.setCursorToFirstTextNode; },
        get scrollCursorIntoView() { return selectionDomService.scrollCursorIntoView; }
    });
    const codecInlineService = require('./editor/codec/inline').createInlineController({
        get documentBaseUri() { return documentBaseUri; },
        get mathSyntax() { return mathSyntax; },
        get mathBackslashDelimiters() { return mathBackslashDelimiters; },
        get inlineMathHtml() { return blocksSpecialService.inlineMathHtml; },
        get inlineMathMarkdown() { return blocksSpecialService.inlineMathMarkdown; },
        get wrapInlineCode() { return codecBlocksService.wrapInlineCode; }
    });
    const codecBlocksService = require('./editor/codec/blocks').createBlocksController({
        get editor() { return editor; },
        get logger() { return logger; },
        get REGEX() { return codecInlineService.REGEX; },
        get emptyTableCell() { return emptyTableCell; },
        get mathBackslashDelimiters() { return mathBackslashDelimiters; },
        get codeBlocksWithSentinel() { return blocksCodeContentService.codeBlocksWithSentinel; },
        get parseInline() { return codecInlineService.parseInline; },
        get escapeHtml() { return codecInlineService.escapeHtml; },
        get renderFrontMatter() { return blocksRenderService.renderFrontMatter; },
        get renderTocBlock() { return blocksRenderService.renderTocBlock; },
        get mathBlockHtml() { return blocksSpecialService.mathBlockHtml; },
        get inlineMathMarkdown() { return blocksSpecialService.inlineMathMarkdown; },
        get mathBlockMarkdown() { return blocksSpecialService.mathBlockMarkdown; },
        get mdGetInlineMarkdown() { return codecInlineService.mdGetInlineMarkdown; },
        get tableFormat() { return tableFormat; },
        get sourceBlockSequence() { return blocksRenderService.sourceBlockSequence; }, set sourceBlockSequence(value) { blocksRenderService.sourceBlockSequence = value; },
        get currentImageDir() { return coreSessionService.currentImageDir; },
        get currentForceRelativePath() { return coreSessionService.currentForceRelativePath; }
    });
    const transferPasteService = require('./editor/transfer/paste').createPasteController({
        get editor() { return editor; },
        get logger() { return logger; },
        get isSourceMode() { return uiChromeService.isSourceMode; },
        get undoManager() { return coreSessionService.undoManager; },
        get markAsEdited() { return coreSessionService.markAsEdited; },
        get host() { return host; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get syncMarkdownSync() { return coreSessionService.syncMarkdownSync; },
        get setupLink() { return blocksRenderService.setupLink; },
        get parseInline() { return codecInlineService.parseInline; },
        get markdownToHtmlFragment() { return codecBlocksService.markdownToHtmlFragment; },
        get setupInteractiveElements() { return blocksRenderService.setupInteractiveElements; }
    });
    const coreHostService = require('./editor/core/host').createHost({
        get host() { return host; },
        get applyMathSourcePreference() { return uiChromeService.applyMathSourcePreference; },
        get updateWidthIndicators() { return uiChromeService.updateWidthIndicators; },
        get applyEditorWidth() { return uiChromeService.applyEditorWidth; },
        get positionLanguageSelector() { return blocksCodeControlsService.positionLanguageSelector; },
        get showEditorToast() { return transferClipboardService.showEditorToast; },
        get i18n() { return i18n; },
        get mermaidInitialized() { return blocksSpecialService.mermaidInitialized; }, set mermaidInitialized(value) { blocksSpecialService.mermaidInitialized = value; },
        get editor() { return editor; },
        get renderMermaidDiagram() { return blocksSpecialService.renderMermaidDiagram; },
        get tableFormat() { return tableFormat; },
        get tableControls() { return blocksTablesService.tableControls; },
        get scheduleToolbarLayout() { return uiChromeService.scheduleToolbarLayout; },
        get readCurrentMarkdown() { return coreSessionService.readCurrentMarkdown; },
        get markdown() { return coreSessionService.markdown; }, set markdown(value) { coreSessionService.markdown = value; },
        get hasUserEdited() { return coreSessionService.hasUserEdited; }, set hasUserEdited(value) { coreSessionService.hasUserEdited = value; },
        get pendingSave() { return coreSessionService.pendingSave; }, set pendingSave(value) { coreSessionService.pendingSave = value; },
        get cancelScheduledSync() { return coreSessionService.cancelScheduledSync; },
        get clientRevision() { return coreSessionService.clientRevision; },
        get exportRenderRequests() { return blocksExportService.exportRenderRequests; },
        get exportRenderQueue() { return blocksExportService.exportRenderQueue; }, set exportRenderQueue(value) { blocksExportService.exportRenderQueue = value; },
        get prepareExportDocument() { return blocksExportService.prepareExportDocument; },
        get refreshManagedTocs() { return blocksRenderService.refreshManagedTocs; },
        get syncTimeout() { return coreSessionService.syncTimeout; },
        get saveTimeout() { return coreSessionService.saveTimeout; },
        get pendingSync() { return coreSessionService.pendingSync; },
        get queuedExternalContent() { return coreSessionService.queuedExternalContent; }, set queuedExternalContent(value) { coreSessionService.queuedExternalContent = value; },
        get undoManager() { return coreSessionService.undoManager; },
        get insertManagedToc() { return blocksRenderService.insertManagedToc; },
        get toggleSourceMode() { return uiChromeService.toggleSourceMode; },
        get logger() { return logger; },
        get isActivelyEditing() { return coreSessionService.isActivelyEditing; },
        get currentImageDir() { return coreSessionService.currentImageDir; }, set currentImageDir(value) { coreSessionService.currentImageDir = value; },
        get extractImageDirFromMarkdown() { return coreSessionService.extractImageDirFromMarkdown; },
        get currentForceRelativePath() { return coreSessionService.currentForceRelativePath; }, set currentForceRelativePath(value) { coreSessionService.currentForceRelativePath = value; },
        get extractForceRelativePathFromMarkdown() { return coreSessionService.extractForceRelativePathFromMarkdown; },
        get isSourceMode() { return uiChromeService.isSourceMode; },
        get sourceEditor() { return sourceEditor; },
        get updateFromMarkdown() { return blocksRenderService.updateFromMarkdown; },
        get updateOutline() { return uiChromeService.updateOutline; },
        get updateWordCount() { return uiChromeService.updateWordCount; },
        get updateStatus() { return uiChromeService.updateStatus; },
        get syncMarkdown() { return coreSessionService.syncMarkdown; },
        get imageDirDisplayPath() { return coreSessionService.imageDirDisplayPath; }, set imageDirDisplayPath(value) { coreSessionService.imageDirDisplayPath = value; },
        get imageDirSource() { return coreSessionService.imageDirSource; }, set imageDirSource(value) { coreSessionService.imageDirSource = value; },
        get finishHostInsertion() { return uiChromeService.finishHostInsertion; },
        get syncMarkdownSync() { return coreSessionService.syncMarkdownSync; },
        get setupLink() { return blocksRenderService.setupLink; }
    });
    const DEBUG_MODE = __DEBUG_MODE__;
    const logger = {
        log: DEBUG_MODE ? (...args) => console.log('[DEBUG]', ...args) : () => { },
        warn: DEBUG_MODE ? (...args) => console.warn('[DEBUG]', ...args) : () => { },
        error: DEBUG_MODE ? (...args) => console.error('[DEBUG]', ...args) : () => { }
    };
    const host = window.hostBridge;
    const mathSyntax = window.BinaryMath;
    const tableFormat = window.BinaryTableFormat;
    const emptyTableCell = '<br data-table-placeholder="true">';
    const mathBackslashDelimiters = __MATH_BACKSLASH__;
    blocksSpecialService.initializeFinishInlineMathEdit();
    const documentAux = window.documentAux;
    blocksRenderService.initializeFrontMatterOpen();
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
    blocksRenderService.initializeEditorRenderRevision1();
    blocksCodeControlsService.initializeCodeViewSequence();
    blocksSpecialService.initializeMermaidRenderVersions1();
    uiChromeService.initializeWidthGuide();
    uiSearchService.initializeSearch();
    const documentBaseUri = __DOCUMENT_BASE_URI__;
    uiChromeService.initializeIsSourceMode1();
    let workspaceUi = null;
    coreSessionService.initializeMarkdown();
    try {
        coreSessionService.markdown = decodeURIComponent(escape(atob(__CONTENT__)));
        // Strip BOM (Byte Order Mark) if present - some editors add this to UTF-8 files
        if (coreSessionService.markdown.charCodeAt(0) === 0xFEFF) {
            coreSessionService.markdown = coreSessionService.markdown.slice(1);
        }
        // Normalize line endings: \r\n → \n, lone \r → \n
        coreSessionService.markdown = coreSessionService.markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }
    catch (e) {
        console.error('[Binary Markdown] Failed to decode Base64 content:', e);
    }
    coreSessionService.initializeSaveTimeout1();
    selectionDomService.initializeIsNavigatingIntoBlock();
    blocksCodeContentService.initializeCodeBlocksWithSentinel();
    selectionLinesService.initializeSetCursorToLastLineStartByDOM();
    codecInlineService.initializeREGEX();
    blocksCodeContentService.initializeEnterEditMode1();
    blocksRenderService.initializeInitializedLinks2();
    selectionDomService.initializeNAVIGATION_FLAG_RESET_DELAY1();
    codecBlocksService.initializeParseMarkdownLine();
    coreSessionService.initializeEditingIdleTimer2();
    coreSessionService.currentImageDir = coreSessionService.extractImageDirFromMarkdown(coreSessionService.markdown);
    coreSessionService.currentForceRelativePath = coreSessionService.extractForceRelativePathFromMarkdown(coreSessionService.markdown);
    logger.log('[Binary Markdown] Starting init(), markdown length:', coreSessionService.markdown.length, 'editor element:', !!editor);
    blocksRenderService.init();
    logger.log('[Binary Markdown] init() completed, editor.innerHTML length:', editor.innerHTML.length);
    coreSessionService.initializeUndoManager3();
    blocksExportService.initializeExportRenderSequence();
    blocksSpecialService.initializeMermaidInitialized2();
    blocksCodeControlsService.initializeControls1();
    blocksTablesService.initializeActiveTableCell();
    inputDispatchService.initializeControls();
    coreSessionService.initializeSourceEvents4();
    uiCommandsService.initializeSavedToolbarRange();
    uiChromeService.initializeControls2();
    uiMenusService.initializeCOMMAND_PALETTE_ITEMS();
    uiChromeService.initializeOpenSidebarBtn3();
    uiCommandsService.initializeControls1();
    coreHostService.initializeControls();
    transferClipboardService.initializeExternalChangeToast();
    transferPasteService.initializeHandlePaste();
    coreSessionService.initializeEditorEvents5();
    uiSearchService.initializeControls1();
    workspaceUi = window.BinaryWorkspaceUi?.create({
        editor, sourceEditor, sidebar, outline, wrapper: editorWrapper, toolbar, i18n,
        icons: uiChromeService.LUCIDE_ICONS, isSourceMode: () => uiChromeService.isSourceMode,
        openActions: uiMenusService.openCommandPalette, layout: uiChromeService.scheduleToolbarLayout,
        selection: () => uiCommandsService.savedToolbarRange,
        format: action => {
            if (uiChromeService.isSourceMode)
                return;
            const original = uiChromeService.toolbarActions.find(item => item.button.dataset.action === action)?.button;
            if (original)
                original.click();
        },
        openTextEditor: () => host.openInTextEditor(),
        statistics: () => wordCount.textContent
    });
    if (typeof window !== 'undefined') {
        window.htmlToMarkdown = codecBlocksService.htmlToMarkdown;
    }
    if (typeof window !== 'undefined' && window.__testApi) {
        window.__testApi.getMarkdown = () => codecBlocksService.htmlToMarkdown();
        window.__testApi.getHtml = () => editor.innerHTML;
        window.__testApi.setMarkdown = (md) => {
            coreSessionService.markdown = md;
            blocksRenderService.renderFromMarkdown();
        };
        window.__testApi.setupInteractiveElements = blocksRenderService.setupInteractiveElements;
        window.__testApi.renderFromMarkdown = blocksRenderService.renderFromMarkdown;
        window.__testApi.htmlToMarkdown = codecBlocksService.htmlToMarkdown;
        window.__testApi.updateOutline = uiChromeService.updateOutline;
        window.__testApi.updateActiveOutlineItem = uiChromeService.updateActiveOutlineItem;
        window.__testApi.ready = true;
        // Table operation functions for testing
        window.__testApi.initializeTableColumnWidths = blocksTablesService.initializeTableColumnWidths;
        window.__testApi.updateColumnWidth = blocksTablesService.updateColumnWidth;
        window.__testApi.setColumnAlignment = blocksTablesService.setColumnAlignment;
        window.__testApi.insertTableColumnRight = blocksTablesService.insertTableColumnRight;
        window.__testApi.syncMarkdown = coreSessionService.syncMarkdown;
        window.__testApi.setCursorToLastLineStartByDOM = selectionLinesService.setCursorToLastLineStartByDOM;
        // List conversion functions for testing
        window.__testApi.convertListToType = editingListsService.convertListToType;
        window.__testApi.convertToList = editingListsService.convertToList;
        window.__testApi.convertToTaskList = editingListsService.convertToTaskList;
        // Also expose directly on window for backward compatibility with existing tests
        window.initializeTableColumnWidths = blocksTablesService.initializeTableColumnWidths;
        window.updateColumnWidth = blocksTablesService.updateColumnWidth;
        window.setColumnAlignment = blocksTablesService.setColumnAlignment;
        window.insertTableColumnRight = blocksTablesService.insertTableColumnRight;
        window.syncMarkdown = coreSessionService.syncMarkdown;
        window.renderFromMarkdownText = (md) => {
            coreSessionService.markdown = md;
            blocksRenderService.renderFromMarkdown();
        };
        // Expose activeTableCell and activeTable as properties
        Object.defineProperty(window, 'activeTableCell', {
            get: () => blocksTablesService.activeTableCell,
            set: (value) => { blocksTablesService.activeTableCell = value; }
        });
        Object.defineProperty(window, 'activeTable', {
            get: () => blocksTablesService.activeTable,
            set: (value) => { blocksTablesService.activeTable = value; }
        });
        Object.defineProperty(window, 'markdown', {
            get: () => coreSessionService.markdown,
            set: (value) => { coreSessionService.markdown = value; }
        });
    }
})();
