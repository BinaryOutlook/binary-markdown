'use strict';
// Construction defines capabilities; bootstrap controls the original initialization order.
function createChrome(dependencies) {
    let widthGuide, widthBounds, widthExplanation, outlineHeadings, activeOutlineIndex, outlineScrollFrame, LUCIDE_ICONS, toolbarInner, toolbarMore, toolbarOverflow, toolbarOverflowItems, toolbarCommandSearch, toolbarCommandResults, toolbarMenuRange, toolbarMenuRevision, toolbarMenuSourceSelection, toolbarActions, toolbarLayoutFrame, isSourceMode, isSplitMode, splitRenderTimer, visualModeCursor, sourceModeSelection, openSidebarBtn, closeSidebarBtn, sidebarResizer, imageDirSettingsBtn, extensionSettingsBtn, isResizing, startX, startWidth;
    function updateWidthIndicators() {
        if (!widthGuide)
            return;
        const visible = document.documentElement.dataset.editorWidthIndicators !== 'false' && dependencies.editor.style.display !== 'none';
        if (!visible && widthGuide.contains(document.activeElement)) {
            (dependencies.editor.style.display === 'none' ? dependencies.sourceEditor : dependencies.editor).focus({ preventScroll: true });
        }
        widthGuide.hidden = !visible;
        const pane = dependencies.editorWrapper.getBoundingClientRect();
        const column = dependencies.editor.getBoundingClientRect();
        // Reserve the guide strip while enabled, so revealing the marks cannot
        // add a scrollbar and oscillate around the width threshold.
        const capped = visible && document.documentElement.dataset.editorWidthMode !== 'full' && dependencies.editorWrapper.clientWidth - column.width > 0.5;
        widthGuide.dataset.capped = String(capped);
        if (!capped) {
            if (widthGuide.contains(document.activeElement))
                dependencies.editor.focus({ preventScroll: true });
            widthExplanation.hidden = true;
        }
        widthBounds.style.left = (column.left - pane.left) + 'px';
        widthBounds.style.width = column.width + 'px';
    }
    function applyEditorWidth(mode, width, alignment = document.documentElement.dataset.editorAlignment) {
        const layout = window.BinaryEditorLayout;
        const preference = layout.normalizeWidthMode(mode);
        const maximum = layout.normalizeMaxWidth(width);
        const placement = layout.normalizeAlignment(alignment);
        const bounds = dependencies.editorWrapper.getBoundingClientRect();
        const selection = window.getSelection();
        const range = selection?.rangeCount && dependencies.editor.contains(selection.anchorNode) ? selection.getRangeAt(0) : null;
        const caretBefore = range?.getBoundingClientRect();
        const keepCaret = caretBefore?.height && caretBefore.top >= bounds.top && caretBefore.bottom <= bounds.bottom;
        const anchor = Array.from(dependencies.editor.children).find(child => child.getBoundingClientRect().bottom > bounds.top);
        const anchorTop = anchor?.getBoundingClientRect().top;
        document.documentElement.dataset.editorWidthMode = preference;
        document.documentElement.dataset.editorMaxWidth = String(maximum);
        document.documentElement.dataset.editorAlignment = placement;
        // Set only the live editor. Source and detached export preparation keep
        // their own layout, and no editable nodes or undo snapshots are replaced.
        dependencies.editor.style.maxWidth = preference === 'full' ? 'none' : (preference === 'custom' ? maximum : layout.defaultWidth) + 'px';
        dependencies.editor.style.marginLeft = placement === 'left' ? '0' : 'auto';
        dependencies.editor.style.marginRight = placement === 'right' ? '0' : 'auto';
        if (keepCaret)
            dependencies.editorWrapper.scrollTop += range.getBoundingClientRect().top - caretBefore.top;
        else if (anchor && anchorTop !== undefined)
            dependencies.editorWrapper.scrollTop += anchor.getBoundingClientRect().top - anchorTop;
        updateWidthIndicators();
    }
    function applyMathSourcePreference(name, value) {
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        const node = selection?.anchorNode;
        const wrapper = (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement)?.closest('.math-wrapper[data-mode="edit"]');
        const caretBefore = wrapper && range?.getBoundingClientRect();
        const bounds = dependencies.editorWrapper.getBoundingClientRect();
        const keepCaret = caretBefore?.height && caretBefore.top >= bounds.top && caretBefore.bottom <= bounds.bottom;
        document.documentElement.dataset[name] = value;
        if (dependencies.workspaceUi)
            dependencies.workspaceUi.refresh();
        // CSS changes the layout without detaching the active editable node.
        if (keepCaret)
            dependencies.editorWrapper.scrollTop += range.getBoundingClientRect().top - caretBefore.top;
    }
    // Populate toolbar buttons with Lucide icons
    function initToolbarIcons() {
        dependencies.toolbar.querySelectorAll('button[data-action]').forEach(function (btn) {
            var icon = btn.dataset.action === 'contextToolbar' ? null : LUCIDE_ICONS[btn.dataset.action];
            if (icon)
                btn.innerHTML = icon;
        });
    }
    function closeToolbarOverflow(restoreFocus) {
        if (!toolbarOverflow)
            return;
        toolbarOverflow.hidden = true;
        toolbarMore.setAttribute('aria-expanded', 'false');
        if (dependencies.editorRange(toolbarMenuRange)) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(toolbarMenuRange);
        }
        if (toolbarMenuSourceSelection && isSourceMode) {
            dependencies.sourceEditor.setSelectionRange(toolbarMenuSourceSelection.start, toolbarMenuSourceSelection.end);
        }
        toolbarMenuRange = null;
        toolbarMenuSourceSelection = null;
        if (restoreFocus)
            toolbarMore.focus({ preventScroll: true });
    }
    function positionToolbarOverflow() {
        const rect = toolbarMore.getBoundingClientRect();
        const width = Math.min(300, Math.max(0, window.innerWidth - 16));
        toolbarOverflow.style.width = width + 'px';
        toolbarOverflow.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) + 'px';
        toolbarOverflow.style.top = Math.min(rect.bottom + 4, window.innerHeight - 36) + 'px';
        toolbarOverflow.style.maxHeight = Math.max(28, window.innerHeight - rect.bottom - 12) + 'px';
    }
    function toolbarMenuChoices() {
        return [...toolbarOverflow.querySelectorAll('button:not(:disabled)')].filter(button => button.getClientRects().length);
    }
    function renderToolbarCommandSearch() {
        const query = toolbarCommandSearch.value.trim();
        const searching = Boolean(query) || !toolbarOverflowItems.children.length;
        toolbarOverflowItems.hidden = searching;
        toolbarCommandResults.hidden = !searching;
        toolbarCommandResults.replaceChildren();
        if (!searching)
            return;
        for (const item of dependencies.matchingCommandItems(query)) {
            const control = dependencies.createCommandItem(item);
            delete control.dataset.action;
            control.dataset.menuCommand = item.action;
            control.setAttribute('role', 'menuitem');
            const reason = isSourceMode && !item.action.startsWith('view') ? dependencies.i18n.insertUnavailableSource
                : dependencies.insertActions.includes(item.action) ? dependencies.insertUnavailable(item.action, toolbarMenuRange) : '';
            if (reason) {
                control.disabled = true;
                control.querySelector('small').textContent = reason;
            }
            toolbarCommandResults.appendChild(control);
        }
        if (!toolbarCommandResults.children.length) {
            const empty = document.createElement('p');
            empty.setAttribute('role', 'status');
            empty.textContent = dependencies.i18n.noMatchingActions + '. ' + dependencies.i18n.searchRecovery;
            const clear = document.createElement('button');
            clear.type = 'button';
            clear.textContent = dependencies.i18n.clearSearch;
            clear.addEventListener('click', event => {
                event.stopPropagation();
                toolbarCommandSearch.value = '';
                renderToolbarCommandSearch();
                toolbarCommandSearch.focus();
            });
            toolbarCommandResults.append(empty, clear);
        }
    }
    function openToolbarOverflow(last) {
        const selection = window.getSelection();
        const current = selection?.rangeCount ? selection.getRangeAt(0) : null;
        toolbarMenuRange = dependencies.editorRange(current) ? current.cloneRange()
            : dependencies.editorRange(dependencies.savedToolbarRange) ? dependencies.savedToolbarRange.cloneRange() : null;
        if (!toolbarMenuRange && !isSourceMode) {
            toolbarMenuRange = document.createRange();
            toolbarMenuRange.selectNodeContents(dependencies.editor);
            toolbarMenuRange.collapse(false);
        }
        toolbarMenuRevision = dependencies.editorRenderRevision;
        toolbarMenuSourceSelection = isSourceMode ? { start: dependencies.sourceEditor.selectionStart, end: dependencies.sourceEditor.selectionEnd } : null;
        toolbarCommandSearch.value = '';
        renderToolbarCommandSearch();
        toolbarOverflow.hidden = false;
        toolbarMore.setAttribute('aria-expanded', 'true');
        positionToolbarOverflow();
        if (last)
            toolbarMenuChoices().at(-1)?.focus({ preventScroll: true });
        else
            toolbarCommandSearch.focus({ preventScroll: true });
    }
    function scheduleToolbarLayout() {
        if (!toolbarMore || toolbarLayoutFrame)
            return;
        toolbarLayoutFrame = requestAnimationFrame(layoutToolbarActions);
    }
    function layoutToolbarActions() {
        toolbarLayoutFrame = 0;
        const active = document.activeElement;
        const focusedAction = toolbarActions.find(item => item.button === active);
        const wasOpen = !toolbarOverflow.hidden;
        const full = document.documentElement.dataset.toolbarMode !== 'simple';
        for (const { button, home } of toolbarActions) {
            if (button.parentNode !== home.parentNode)
                home.after(button);
            button.removeAttribute('role');
        }
        toolbarMore.hidden = false;
        dependencies.toolbar.querySelectorAll('.toolbar-fixed').forEach(section => section.classList.remove('toolbar-empty'));
        const utilityWidth = [...dependencies.toolbar.querySelectorAll('.toolbar-fixed')].reduce((width, section) => width + section.getBoundingClientRect().width, 0);
        if (dependencies.toolbar.dataset.utilityWidth !== String(utilityWidth)) {
            dependencies.toolbar.dataset.utilityWidth = String(utilityWidth);
            dependencies.tableControls.schedule();
        }
        const fits = () => {
            const fixedWidth = [...dependencies.toolbar.children].filter(child => child !== toolbarInner && child !== toolbarOverflow && child.getClientRects().length)
                .reduce((width, child) => {
                const style = getComputedStyle(child);
                return width + child.getBoundingClientRect().width + (parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0);
            }, 0);
            return fixedWidth <= dependencies.toolbar.clientWidth + 0.5 && (!full || toolbarInner.scrollWidth <= toolbarInner.clientWidth);
        };
        if (!fits()) {
            toolbarMore.hidden = false;
            const candidates = toolbarActions.filter(item => full && item.formatting).reverse()
                .concat(toolbarActions.filter(item => !item.formatting && item.button.closest('.toolbar-fixed--right')).reverse())
                .concat(toolbarActions.filter(item => !item.formatting && item.button.closest('.toolbar-fixed--tools')).reverse())
                .concat(toolbarActions.filter(item => !item.formatting && item.button.closest('.toolbar-fixed--left')).reverse());
            for (const { button, home } of candidates) {
                if (fits())
                    break;
                if (!button.getClientRects().length)
                    continue;
                toolbarOverflowItems.appendChild(button);
                button.setAttribute('role', 'menuitem');
                const section = home.parentElement.closest('.toolbar-fixed');
                if (section && ![...section.querySelectorAll('button')].some(item => item.getClientRects().length)) {
                    section.classList.add('toolbar-empty');
                }
            }
        }
        // Original order in the menu remains stable as its membership changes.
        for (const { button } of toolbarActions) {
            if (button.parentNode === toolbarOverflowItems)
                toolbarOverflowItems.appendChild(button);
        }
        if (wasOpen || focusedAction?.button.parentNode === toolbarOverflowItems) {
            renderToolbarCommandSearch();
            toolbarOverflow.hidden = false;
            toolbarMore.setAttribute('aria-expanded', 'true');
            positionToolbarOverflow();
        }
        if (active.dataset?.menuCommand)
            toolbarCommandResults.querySelector('[data-menu-command="' + active.dataset.menuCommand + '"]')?.focus({ preventScroll: true });
        else if (active === toolbarMore && !toolbarMore.hidden)
            toolbarMore.focus({ preventScroll: true });
        else if (focusedAction && active.getClientRects().length)
            active.focus({ preventScroll: true });
        else if (focusedAction || (active === toolbarMore && toolbarMore.hidden)) {
            const first = toolbarActions.find(item => item.button.getClientRects().length && !item.button.disabled);
            first?.button.focus({ preventScroll: true });
        }
    }
    function requestHostInsertion(action) {
        if (dependencies.pendingHostInsert || isSourceMode)
            return;
        const selection = window.getSelection();
        const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
        if (!dependencies.editorRange(range))
            return;
        const requestId = 'insert-' + Date.now().toString(36) + '-' + (++dependencies.hostInsertSequence);
        dependencies.pendingHostInsert = { requestId, action, range: range.cloneRange(), startNode: range.startContainer, endNode: range.endContainer, renderRevision: dependencies.editorRenderRevision };
        if (action === 'link')
            dependencies.host.requestInsertLink(selection.toString() || '', requestId);
        else
            dependencies.host.requestInsertImage(requestId);
    }
    function finishHostInsertion(message, committed) {
        // Clipboard/drop image responses retain their existing insertion route.
        if (!message.requestId)
            return true;
        if (!dependencies.pendingHostInsert || message.requestId !== dependencies.pendingHostInsert.requestId)
            return false;
        const pending = dependencies.pendingHostInsert;
        if (committed && message.type !== (pending.action === 'link' ? 'insertLinkHtml' : 'insertImageHtml'))
            return false;
        dependencies.pendingHostInsert = null;
        // Live Ranges collapse onto the editor when their original nodes are
        // removed. Retain node identity so a reload cannot redirect a response.
        if (isSourceMode || pending.renderRevision !== dependencies.editorRenderRevision || !dependencies.editorRange(pending.range) || !pending.startNode.isConnected || !pending.endNode.isConnected) {
            if (committed)
                dependencies.showEditorToast(dependencies.i18n.insertUnavailableSelection);
            return false;
        }
        dependencies.editor.focus({ preventScroll: true });
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(pending.range);
        if (committed) {
            dependencies.markdown = dependencies.readCurrentMarkdown();
            dependencies.undoManager.saveSnapshot();
        }
        return true;
    }
    function captureToolbarSelection(e) {
        if (dependencies.tableControls.owns(e.target))
            return;
        const btn = e.target.closest('button');
        if (!btn)
            return;
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && dependencies.editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            dependencies.savedToolbarRange = sel.getRangeAt(0).cloneRange();
        }
    }
    function setSidebarOpen(open) {
        dependencies.sidebar.dataset.overlayOpen = String(open && innerWidth <= 700);
        dependencies.sidebar.classList.toggle('hidden', !open);
        openSidebarBtn.classList.toggle('hidden', open);
        if (!open) {
            // Clear inline width so .hidden class can take effect
            dependencies.sidebar.style.width = '';
        }
        dependencies.host.reportOutlineState(open);
    }
    function openSidebar() {
        setSidebarOpen(true);
    }
    function closeSidebar() {
        setSidebarOpen(false);
    }
    function applyPreviewReadOnly() {
        dependencies.editor.contentEditable = isSourceMode ? 'false' : 'true';
        if (!isSourceMode)
            return;
        dependencies.editor.querySelectorAll('[contenteditable]').forEach(node => { node.contentEditable = 'false'; });
        dependencies.editor.querySelectorAll('button,input,textarea,select').forEach(node => { node.disabled = true; });
    }
    function scheduleSplitPreview() {
        clearTimeout(splitRenderTimer);
        if (!isSplitMode)
            return;
        splitRenderTimer = setTimeout(() => {
            const scroll = dependencies.editor.scrollTop;
            dependencies.markdown = dependencies.sourceEditor.value;
            dependencies.renderFromMarkdown();
            dependencies.editor.scrollTop = scroll;
            updateOutline();
            updateSourceCorrespondence(false);
        }, 150);
    }
    function sourceHeadings() {
        const headings = [];
        const frontLines = dependencies.documentAux.splitFrontMatter(dependencies.readCommittedMarkdown()).raw.split('\n').length - 1;
        const visit = block => {
            if (block.type === 'heading' && block.map) {
                const text = block.children.find(child => child.type === 'inline')?.content || '';
                headings.push({ text, level: Number(block.tag?.slice(1)) || 1, line: block.map[0] + frontLines });
            }
            block.children.forEach(visit);
        };
        window.BinaryMarkdownBlocks.parse(dependencies.readCommittedMarkdown(), { backslashDelimiters: dependencies.mathBackslashDelimiters }).blocks.forEach(visit);
        return headings;
    }
    function sourceOffset(line) {
        const lines = dependencies.sourceEditor.value.split('\n');
        return lines.slice(0, line).reduce((offset, text) => offset + text.length + 1, 0);
    }
    function updateSourceCorrespondence(scroll = true) {
        if (!isSourceMode)
            return;
        const line = dependencies.sourceEditor.value.slice(0, dependencies.sourceEditor.selectionStart || 0).split('\n').length - 1;
        const headings = sourceHeadings();
        let index = -1;
        headings.forEach((heading, i) => { if (heading.line <= line)
            index = i; });
        const nodes = [...dependencies.editor.querySelectorAll('h1,h2,h3,h4,h5,h6')];
        nodes.forEach((node, i) => node.classList.toggle('source-correspondence', isSplitMode && i === index));
        if (dependencies.workspaceUi)
            dependencies.workspaceUi.markSourceHeading(headings[index]?.line);
        if (index >= 0)
            setActiveOutlineItem(index, false);
        if (isSplitMode && scroll && nodes[index])
            nodes[index].scrollIntoView({ block: 'nearest' });
        const position = document.getElementById('documentPosition');
        if (position)
            position.textContent = (dependencies.i18n.sourceLine || 'Source line') + ' ' + (line + 1);
    }
    function sourceDomPositions(source) {
        const positions = [];
        let boundary = 0;
        for (const block of dependencies.editor.children) {
            let raw = block.dataset.mdSource ? decodeURIComponent(block.dataset.mdSource) : '';
            let at = raw ? source.indexOf(raw, boundary) : -1;
            if (at < 0) {
                raw = dependencies.mdProcessNode(block).trimEnd();
                at = raw ? source.indexOf(raw, boundary) : -1;
            }
            if (at < 0)
                continue;
            boundary = at + raw.length;
            const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, { acceptNode(node) {
                    return node.parentElement?.closest('.code-block-header,.block-chrome,.document-aux,.math-display,.mermaid-diagram,.math-inline') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
                } });
            let cursor = 0, node;
            while ((node = walker.nextNode())) {
                if (!node.textContent)
                    continue;
                const found = raw.indexOf(node.textContent, cursor);
                if (found < 0)
                    continue;
                positions.push({ node, start: at + found, end: at + found + node.textContent.length });
                cursor = found + node.textContent.length;
            }
        }
        return positions;
    }
    function sourceSelectionFromVisual(source) {
        const selection = window.getSelection();
        const range = dependencies.editorRange(dependencies.savedToolbarRange) ? dependencies.savedToolbarRange : selection?.rangeCount ? selection.getRangeAt(0) : null;
        if (!dependencies.editorRange(range))
            return null;
        const positions = sourceDomPositions(source);
        const start = positions.find(item => item.node === range.startContainer);
        const end = positions.find(item => item.node === range.endContainer);
        if (start && end)
            return { start: start.start + range.startOffset, end: end.start + range.endOffset, scroll: 0 };
        return null;
    }
    function restoreVisualFromSource(start, end) {
        const positions = sourceDomPositions(dependencies.markdown);
        const first = positions.find(item => start >= item.start && start <= item.end);
        const last = positions.findLast(item => end >= item.start && end <= item.end);
        if (!first || !last)
            return false;
        const range = document.createRange();
        range.setStart(first.node, start - first.start);
        range.setEnd(last.node, end - last.start);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        first.node.parentElement.scrollIntoView({ block: 'nearest' });
        return true;
    }
    function setEditorMode(mode) {
        if (!['visual', 'source', 'split'].includes(mode))
            return;
        const previous = isSplitMode ? 'split' : isSourceMode ? 'source' : 'visual';
        if (mode === previous)
            return;
        dependencies.closeInsertMenu(false);
        dependencies.closeLanguageSelector();
        dependencies.hideTableToolbar();
        if (typeof dependencies.closeSearchBox === 'function' && dependencies.searchReplaceBox.style.display !== 'none')
            dependencies.closeSearchBox();
        dependencies.markdown = dependencies.readCurrentMarkdown();
        dependencies.cancelScheduledSync();
        clearTimeout(splitRenderTimer);
        if (!isSourceMode) {
            visualModeCursor = dependencies.saveCursorState();
            sourceModeSelection = sourceSelectionFromVisual(dependencies.markdown) || sourceModeSelection;
        }
        else
            sourceModeSelection = { start: dependencies.sourceEditor.selectionStart, end: dependencies.sourceEditor.selectionEnd, scroll: dependencies.sourceEditor.scrollTop };
        isSourceMode = mode !== 'visual';
        isSplitMode = mode === 'split';
        document.documentElement.dataset.editorMode = mode;
        dependencies.sourceEditor.style.display = isSourceMode ? 'block' : 'none';
        dependencies.editor.style.display = mode === 'source' ? 'none' : 'block';
        for (const id of ['sourcePaneHeading', 'previewPaneHeading']) {
            const label = document.getElementById(id);
            if (label)
                label.hidden = !isSplitMode;
        }
        if (isSourceMode) {
            dependencies.sourceEditor.value = dependencies.markdown;
            if (isSplitMode)
                dependencies.renderFromMarkdown();
            dependencies.sourceEditor.focus({ preventScroll: true });
            dependencies.sourceEditor.setSelectionRange(sourceModeSelection.start, sourceModeSelection.end);
            dependencies.sourceEditor.scrollTop = sourceModeSelection.scroll;
        }
        else {
            dependencies.renderFromMarkdown();
            dependencies.editor.focus({ preventScroll: true });
            if (!restoreVisualFromSource(sourceModeSelection.start, sourceModeSelection.end) && visualModeCursor)
                dependencies.restoreCursorState(visualModeCursor);
        }
        dependencies.savedToolbarRange = null;
        document.querySelectorAll('button[data-editor-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.editorMode === mode)));
        toolbarActions.filter(item => item.formatting || item.button.dataset.action === 'insertMenu').forEach(item => { item.button.disabled = isSourceMode; });
        for (const id of ['formatButton', 'allActionsButton']) {
            const control = document.getElementById(id);
            if (control)
                control.disabled = isSourceMode;
        }
        const help = document.getElementById('modeHelp');
        if (help) {
            help.hidden = !isSourceMode;
            help.textContent = isSplitMode ? dependencies.i18n.splitHelp : dependencies.i18n.insertUnavailableSource;
        }
        dependencies.notifyChangeImmediate();
        updateOutline();
        updateWordCount();
        updateWidthIndicators();
        updateSourceCorrespondence();
        if (dependencies.workspaceUi)
            dependencies.workspaceUi.refresh();
    }
    function toggleSourceMode() { setEditorMode(isSourceMode ? 'visual' : 'source'); }
    function updateOutline() {
        dependencies.assignHeadingAnchors(dependencies.editor, dependencies.readCommittedMarkdown());
        const headings = dependencies.editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const headingsArray = Array.from(headings);
        const sourceItems = isSourceMode ? sourceHeadings() : null;
        outlineHeadings = headingsArray;
        dependencies.outline.innerHTML = (sourceItems || headingsArray).map((h, i) => {
            const level = sourceItems ? h.level : h.tagName[1];
            return '<button type="button" class="outline-item" data-level="' + level + '" data-index="' + i + '">' + dependencies.escapeHtml(sourceItems ? h.text : h.textContent) + '</button>';
        }).join('');
        // The links were recreated, so reapply the active state even if the
        // numerical heading index did not change.
        activeOutlineIndex = -1;
        dependencies.outline.querySelectorAll('.outline-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index);
                if (isSourceMode && sourceItems[idx]) {
                    const offset = sourceOffset(sourceItems[idx].line);
                    dependencies.sourceEditor.focus({ preventScroll: true });
                    dependencies.sourceEditor.setSelectionRange(offset, offset);
                    // A textarea's selection is not automatically revealed by setSelectionRange.
                    const lineHeight = parseFloat(getComputedStyle(dependencies.sourceEditor).lineHeight) || 21;
                    dependencies.sourceEditor.scrollTop = Math.max(0, sourceItems[idx].line * lineHeight - dependencies.sourceEditor.clientHeight / 3);
                    updateSourceCorrespondence();
                    return;
                }
                if (headingsArray[idx]) {
                    setActiveOutlineItem(idx, false);
                    const wrapper = dependencies.editorWrapper || dependencies.editor.closest('.editor-wrapper');
                    if (wrapper) {
                        const wrapperRect = wrapper.getBoundingClientRect();
                        const headingRect = headingsArray[idx].getBoundingClientRect();
                        wrapper.scrollTo({ top: wrapper.scrollTop + headingRect.top - wrapperRect.top, behavior: 'smooth' });
                    }
                    else {
                        headingsArray[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            });
        });
        updateActiveOutlineItem();
        if (isSourceMode)
            updateSourceCorrespondence(false);
        if (dependencies.workspaceUi)
            dependencies.workspaceUi.refresh();
    }
    function setActiveOutlineItem(index, ensureVisible = true) {
        const items = dependencies.outline.querySelectorAll('.outline-item');
        if (!items.length) {
            activeOutlineIndex = -1;
            return;
        }
        const boundedIndex = Math.max(0, Math.min(index, items.length - 1));
        if (activeOutlineIndex !== boundedIndex) {
            items.forEach((item, itemIndex) => {
                const active = itemIndex === boundedIndex;
                item.classList.toggle('is-active', active);
                if (active)
                    item.setAttribute('aria-current', 'location');
                else
                    item.removeAttribute('aria-current');
            });
            activeOutlineIndex = boundedIndex;
            if (dependencies.workspaceUi)
                dependencies.workspaceUi.refresh();
        }
        if (!ensureVisible)
            return;
        const activeItem = items[boundedIndex];
        const outlineRect = dependencies.outline.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const margin = 8;
        if (itemRect.top < outlineRect.top + margin) {
            dependencies.outline.scrollTop -= outlineRect.top + margin - itemRect.top;
        }
        else if (itemRect.bottom > outlineRect.bottom - margin) {
            dependencies.outline.scrollTop += itemRect.bottom - (outlineRect.bottom - margin);
        }
    }
    function updateActiveOutlineItem() {
        if (!outlineHeadings.length || isSourceMode) {
            activeOutlineIndex = -1;
            dependencies.outline.querySelectorAll('.outline-item').forEach(item => {
                item.classList.remove('is-active');
                item.removeAttribute('aria-current');
            });
            return;
        }
        const wrapper = dependencies.editorWrapper || dependencies.editor.closest('.editor-wrapper');
        if (!wrapper) {
            setActiveOutlineItem(0);
            return;
        }
        const wrapperRect = wrapper.getBoundingClientRect();
        const readingLine = wrapperRect.top + wrapper.clientHeight * 0.3;
        let activeIndex = 0;
        for (let index = 0; index < outlineHeadings.length; index++) {
            if (outlineHeadings[index].getBoundingClientRect().top <= readingLine + 1) {
                activeIndex = index;
            }
            else {
                break;
            }
        }
        setActiveOutlineItem(activeIndex);
    }
    function scheduleActiveOutlineUpdate() {
        if (outlineScrollFrame !== null)
            return;
        outlineScrollFrame = requestAnimationFrame(() => {
            outlineScrollFrame = null;
            updateActiveOutlineItem();
        });
    }
    function updateWordCount() {
        let plain = dependencies.editor.cloneNode(true);
        if (isSourceMode) {
            const template = document.createElement('template');
            template.innerHTML = dependencies.markdownToHtmlFragment(dependencies.sourceEditor.value);
            plain = template.content;
        }
        plain.querySelectorAll('.math-inline').forEach(span => { span.textContent = dependencies.inlineMathMarkdown(span); });
        plain.querySelectorAll('.math-display,.mermaid-diagram,.document-aux,.code-block-header,.block-chrome').forEach(display => display.remove());
        const text = plain.textContent || '';
        const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
        const chars = text.length;
        const lines = dependencies.markdown.split('\n').length;
        dependencies.wordCount.textContent = words + ' ' + dependencies.i18n.words + ' · ' + chars + ' ' + dependencies.i18n.characters + ' · ' + lines + ' ' + dependencies.i18n.lines;
        if (dependencies.workspaceUi)
            dependencies.workspaceUi.refresh();
    }
    function updateStatus() {
        // Update IMAGE_DIR display in sidebar footer
        if (dependencies.statusImageDir) {
            const pathEl = document.getElementById('imageDirPath');
            const sourceEl = document.getElementById('imageDirSource');
            if (pathEl && dependencies.imageDirDisplayPath !== null) {
                pathEl.textContent = dependencies.imageDirDisplayPath;
                pathEl.title = dependencies.imageDirDisplayPath;
            }
            if (sourceEl && dependencies.imageDirSource) {
                const labels = {
                    file: dependencies.i18n.imageDirSourceFile || 'File',
                    settings: dependencies.i18n.imageDirSourceSettings || 'Settings',
                    default: dependencies.i18n.imageDirSourceDefault || 'Default'
                };
                sourceEl.textContent = labels[dependencies.imageDirSource] || dependencies.imageDirSource;
            }
        }
    }
    let initializeWidthGuideDone = false;
    function initializeWidthGuide() {
        if (initializeWidthGuideDone)
            return;
        initializeWidthGuideDone = true;
        (widthGuide = document.getElementById('editorWidthGuide'));
        (widthBounds = document.getElementById('editorWidthBounds'));
        (widthExplanation = document.getElementById('editorWidthExplanation'));
        if (widthGuide) {
            for (const mark of widthGuide.querySelectorAll('button')) {
                mark.addEventListener('pointerdown', event => event.preventDefault());
                mark.addEventListener('pointerenter', () => { widthExplanation.hidden = false; });
                mark.addEventListener('pointerleave', () => { if (!widthGuide.contains(document.activeElement))
                    widthExplanation.hidden = true; });
                mark.addEventListener('focus', () => { widthExplanation.hidden = false; });
                mark.addEventListener('click', () => { widthExplanation.hidden = false; });
                mark.addEventListener('keydown', event => {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        event.stopPropagation();
                        widthExplanation.hidden = true;
                        dependencies.editor.focus({ preventScroll: true });
                    }
                });
            }
            widthGuide.addEventListener('focusout', event => { if (!widthGuide.contains(event.relatedTarget))
                widthExplanation.hidden = true; });
            new ResizeObserver(updateWidthIndicators).observe(dependencies.editorWrapper);
            new MutationObserver(updateWidthIndicators).observe(dependencies.editor, { attributes: true, attributeFilter: ['style'] });
            window.addEventListener('resize', updateWidthIndicators);
        }
        applyEditorWidth(document.documentElement.dataset.editorWidthMode, Number(document.documentElement.dataset.editorMaxWidth));
        (outlineHeadings = []);
        (activeOutlineIndex = -1);
        (outlineScrollFrame = null);
        (LUCIDE_ICONS = {
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
        });
        initToolbarIcons();
        (toolbarInner = document.getElementById('toolbarInner'));
        (toolbarMore = document.getElementById('toolbarMore'));
        (toolbarOverflow = document.getElementById('toolbarOverflow'));
        (toolbarOverflowItems = document.getElementById('toolbarOverflowItems'));
        (toolbarCommandSearch = document.getElementById('toolbarCommandSearch'));
        (toolbarCommandResults = document.getElementById('toolbarCommandResults'));
        (toolbarMenuRange = null);
        (toolbarMenuRevision = null);
        (toolbarMenuSourceSelection = null);
        (toolbarActions = []);
        (toolbarLayoutFrame = 0);
        if (toolbarMore && toolbarOverflow) {
            dependencies.toolbar.querySelectorAll('button[data-action]').forEach(function (button) {
                const home = document.createComment('toolbar action');
                button.before(home);
                if (button.title)
                    button.setAttribute('aria-label', button.title);
                const label = document.createElement('span');
                label.className = 'toolbar-action-label';
                label.textContent = button.title;
                button.appendChild(label);
                toolbarActions.push({ button, home, formatting: toolbarInner.contains(button) });
            });
        }
        if (toolbarMore) {
            dependencies.toolbar.addEventListener('toolbar-submenu-open', () => closeToolbarOverflow(false));
            toolbarMore.addEventListener('click', function (event) {
                event.stopPropagation();
                if (toolbarOverflow.hidden)
                    openToolbarOverflow(false);
                else
                    closeToolbarOverflow(true);
            });
            toolbarMore.addEventListener('keydown', function (event) {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    openToolbarOverflow(event.key === 'ArrowUp');
                }
            });
            toolbarOverflow.addEventListener('mousedown', event => { if (event.target.closest('button'))
                event.preventDefault(); });
            toolbarCommandSearch.addEventListener('input', renderToolbarCommandSearch);
            toolbarOverflow.addEventListener('click', event => {
                const control = event.target.closest('[data-menu-command]');
                if (!control || control.disabled)
                    return;
                event.stopPropagation();
                const action = control.dataset.menuCommand;
                if (!action.startsWith('view') && (toolbarMenuRevision !== dependencies.editorRenderRevision || !dependencies.editorRange(toolbarMenuRange))) {
                    closeToolbarOverflow(false);
                    dependencies.showEditorToast(dependencies.i18n.insertUnavailableSelection);
                    return;
                }
                const range = dependencies.editorRange(toolbarMenuRange) ? toolbarMenuRange.cloneRange() : null;
                closeToolbarOverflow(false);
                if (!isSourceMode) {
                    dependencies.editor.focus({ preventScroll: true });
                    // Focusing a previously unfocused editor can move its selection.
                    if (range) {
                        const selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                }
                dependencies.savedToolbarRange = null;
                dependencies.executeEditorCommand(action);
            });
            toolbarOverflow.addEventListener('keydown', function (event) {
                if (toolbarOverflow.hidden)
                    return;
                const items = toolbarMenuChoices();
                const index = items.indexOf(document.activeElement);
                let next;
                if (event.key === 'ArrowDown')
                    next = (index + 1) % items.length;
                if (event.key === 'ArrowUp')
                    next = index < 0 ? items.length - 1 : (index + items.length - 1) % items.length;
                if (event.target !== toolbarCommandSearch && event.key === 'Home')
                    next = 0;
                if (event.target !== toolbarCommandSearch && event.key === 'End')
                    next = items.length - 1;
                if (next !== undefined) {
                    event.preventDefault();
                    event.stopPropagation();
                    items[next]?.focus();
                    items[next]?.scrollIntoView({ block: 'nearest' });
                }
                else if (event.key === 'Enter' && event.target === toolbarCommandSearch) {
                    event.preventDefault();
                    event.stopPropagation();
                    items[0]?.click();
                }
                else if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    closeToolbarOverflow(true);
                }
            });
            toolbarOverflow.addEventListener('focusout', function () {
                queueMicrotask(() => {
                    if (!toolbarOverflow.contains(document.activeElement) && document.activeElement !== toolbarMore)
                        closeToolbarOverflow(false);
                });
            });
            document.addEventListener('mousedown', function (event) {
                if (!toolbarOverflow.contains(event.target) && !toolbarMore.contains(event.target))
                    closeToolbarOverflow(false);
            });
            window.addEventListener('resize', scheduleToolbarLayout);
            new ResizeObserver(scheduleToolbarLayout).observe(dependencies.toolbar);
            scheduleToolbarLayout();
        }
    }
    let initializeIsSourceMode1Done = false;
    function initializeIsSourceMode1() {
        if (initializeIsSourceMode1Done)
            return;
        initializeIsSourceMode1Done = true;
        (isSourceMode = false);
        (isSplitMode = false);
        (splitRenderTimer = null);
        (visualModeCursor = null);
        (sourceModeSelection = { start: 0, end: 0, scroll: 0 });
    }
    let initializeControls2Done = false;
    function initializeControls2() {
        if (initializeControls2Done)
            return;
        initializeControls2Done = true;
        dependencies.toolbar.addEventListener('mousedown', captureToolbarSelection);
        dependencies.toolbar.addEventListener('focusin', captureToolbarSelection);
        dependencies.toolbar.addEventListener('click', function (e) {
            if (dependencies.tableControls.owns(e.target))
                return;
            const btn = e.target.closest('button');
            if (!btn)
                return;
            const action = btn.dataset.action;
            if (!action)
                return;
            if (['insertMenu', 'formatActions', 'allActions', 'contextToolbar'].includes(action))
                return;
            if (btn.matches('[data-export-format], [data-export-action]') ||
                (action && action.indexOf('export') === 0))
                return;
            closeToolbarOverflow(false);
            // View-only actions do not change Markdown content
            if (!['source', 'openOutline', 'openInTextEditor', 'link', 'image', 'underline'].includes(action)) {
                dependencies.markAsEdited(); // User has made an edit
            }
            dependencies.editor.focus();
            // Restore selection that was lost when toolbar button stole focus
            if (dependencies.savedToolbarRange) {
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(dependencies.savedToolbarRange);
                dependencies.savedToolbarRange = null;
            }
            // Save snapshot before structural toolbar actions (not for undo/redo/source/openOutline)
            if (!['undo', 'redo', 'source', 'openOutline', 'openInTextEditor', 'link', 'image', 'underline'].includes(action)) {
                dependencies.undoManager.saveSnapshot();
            }
            // Toolbar-only actions (not in command palette)
            switch (action) {
                case 'undo':
                    dependencies.undoManager.undo();
                    break;
                case 'redo':
                    dependencies.undoManager.redo();
                    break;
                case 'imageDir':
                    dependencies.host.requestSetImageDir();
                    break;
                case 'openOutline':
                    openSidebar();
                    break;
                case 'openInTextEditor':
                    dependencies.host.openInTextEditor();
                    break;
                case 'source':
                    toggleSourceMode();
                    break;
                default:
                    // Shared actions (toolbar + command palette)
                    dependencies.dispatchToolbarAction(action);
                    break;
            }
        });
    }
    let initializeOpenSidebarBtn3Done = false;
    function initializeOpenSidebarBtn3() {
        if (initializeOpenSidebarBtn3Done)
            return;
        initializeOpenSidebarBtn3Done = true;
        (openSidebarBtn = document.getElementById('openSidebarBtn'));
        (closeSidebarBtn = document.getElementById('closeSidebar'));
        (sidebarResizer = document.getElementById('sidebarResizer'));
        closeSidebarBtn.addEventListener('click', function () {
            closeSidebar();
        });
        (imageDirSettingsBtn = document.getElementById('imageDirSettingsBtn'));
        if (imageDirSettingsBtn) {
            imageDirSettingsBtn.addEventListener('click', function () {
                dependencies.host.requestSetImageDir();
            });
        }
        (extensionSettingsBtn = document.getElementById('extensionSettingsBtn'));
        if (extensionSettingsBtn && typeof dependencies.host.openSettings === 'function') {
            extensionSettingsBtn.addEventListener('click', function () {
                dependencies.host.openSettings();
            });
        }
        (isResizing = false);
        (startX = 0);
        (startWidth = 0);
        sidebarResizer.addEventListener('mousedown', function (e) {
            isResizing = true;
            startX = e.clientX;
            startWidth = dependencies.sidebar.offsetWidth;
            sidebarResizer.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        document.addEventListener('mousemove', function (e) {
            if (!isResizing)
                return;
            const diff = e.clientX - startX;
            const newWidth = Math.min(Math.max(startWidth + diff, 150), 500);
            dependencies.sidebar.style.width = newWidth + 'px';
        });
        document.addEventListener('mouseup', function () {
            if (isResizing) {
                isResizing = false;
                sidebarResizer.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
        document.querySelectorAll('button[data-editor-mode]').forEach(button => button.addEventListener('click', () => setEditorMode(button.dataset.editorMode)));
        for (const type of ['click', 'beforeinput'])
            dependencies.editor.addEventListener(type, event => {
                if (isSourceMode) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            }, true);
        for (const type of ['select', 'keyup'])
            dependencies.sourceEditor.addEventListener(type, () => updateSourceCorrespondence());
        if (dependencies.editorWrapper) {
            dependencies.editorWrapper.addEventListener('scroll', scheduleActiveOutlineUpdate, { passive: true });
        }
        window.addEventListener('resize', scheduleActiveOutlineUpdate);
    }
    return {
        updateWidthIndicators,
        applyEditorWidth,
        applyMathSourcePreference,
        initToolbarIcons,
        closeToolbarOverflow,
        positionToolbarOverflow,
        toolbarMenuChoices,
        renderToolbarCommandSearch,
        openToolbarOverflow,
        scheduleToolbarLayout,
        layoutToolbarActions,
        requestHostInsertion,
        finishHostInsertion,
        captureToolbarSelection,
        setSidebarOpen,
        openSidebar,
        closeSidebar,
        applyPreviewReadOnly,
        scheduleSplitPreview,
        sourceHeadings,
        sourceOffset,
        updateSourceCorrespondence,
        sourceDomPositions,
        sourceSelectionFromVisual,
        restoreVisualFromSource,
        setEditorMode,
        toggleSourceMode,
        updateOutline,
        setActiveOutlineItem,
        updateActiveOutlineItem,
        scheduleActiveOutlineUpdate,
        updateWordCount,
        updateStatus,
        get widthGuide() { return widthGuide; }, set widthGuide(value) { widthGuide = value; },
        get widthBounds() { return widthBounds; }, set widthBounds(value) { widthBounds = value; },
        get widthExplanation() { return widthExplanation; }, set widthExplanation(value) { widthExplanation = value; },
        get outlineHeadings() { return outlineHeadings; }, set outlineHeadings(value) { outlineHeadings = value; },
        get activeOutlineIndex() { return activeOutlineIndex; }, set activeOutlineIndex(value) { activeOutlineIndex = value; },
        get outlineScrollFrame() { return outlineScrollFrame; }, set outlineScrollFrame(value) { outlineScrollFrame = value; },
        get LUCIDE_ICONS() { return LUCIDE_ICONS; }, set LUCIDE_ICONS(value) { LUCIDE_ICONS = value; },
        get toolbarInner() { return toolbarInner; }, set toolbarInner(value) { toolbarInner = value; },
        get toolbarMore() { return toolbarMore; }, set toolbarMore(value) { toolbarMore = value; },
        get toolbarOverflow() { return toolbarOverflow; }, set toolbarOverflow(value) { toolbarOverflow = value; },
        get toolbarOverflowItems() { return toolbarOverflowItems; }, set toolbarOverflowItems(value) { toolbarOverflowItems = value; },
        get toolbarCommandSearch() { return toolbarCommandSearch; }, set toolbarCommandSearch(value) { toolbarCommandSearch = value; },
        get toolbarCommandResults() { return toolbarCommandResults; }, set toolbarCommandResults(value) { toolbarCommandResults = value; },
        get toolbarMenuRange() { return toolbarMenuRange; }, set toolbarMenuRange(value) { toolbarMenuRange = value; },
        get toolbarMenuRevision() { return toolbarMenuRevision; }, set toolbarMenuRevision(value) { toolbarMenuRevision = value; },
        get toolbarMenuSourceSelection() { return toolbarMenuSourceSelection; }, set toolbarMenuSourceSelection(value) { toolbarMenuSourceSelection = value; },
        get toolbarActions() { return toolbarActions; }, set toolbarActions(value) { toolbarActions = value; },
        get toolbarLayoutFrame() { return toolbarLayoutFrame; }, set toolbarLayoutFrame(value) { toolbarLayoutFrame = value; },
        get isSourceMode() { return isSourceMode; }, set isSourceMode(value) { isSourceMode = value; },
        get isSplitMode() { return isSplitMode; }, set isSplitMode(value) { isSplitMode = value; },
        get splitRenderTimer() { return splitRenderTimer; }, set splitRenderTimer(value) { splitRenderTimer = value; },
        get visualModeCursor() { return visualModeCursor; }, set visualModeCursor(value) { visualModeCursor = value; },
        get sourceModeSelection() { return sourceModeSelection; }, set sourceModeSelection(value) { sourceModeSelection = value; },
        get openSidebarBtn() { return openSidebarBtn; }, set openSidebarBtn(value) { openSidebarBtn = value; },
        get closeSidebarBtn() { return closeSidebarBtn; }, set closeSidebarBtn(value) { closeSidebarBtn = value; },
        get sidebarResizer() { return sidebarResizer; }, set sidebarResizer(value) { sidebarResizer = value; },
        get imageDirSettingsBtn() { return imageDirSettingsBtn; }, set imageDirSettingsBtn(value) { imageDirSettingsBtn = value; },
        get extensionSettingsBtn() { return extensionSettingsBtn; }, set extensionSettingsBtn(value) { extensionSettingsBtn = value; },
        get isResizing() { return isResizing; }, set isResizing(value) { isResizing = value; },
        get startX() { return startX; }, set startX(value) { startX = value; },
        get startWidth() { return startWidth; }, set startWidth(value) { startWidth = value; },
        initializeWidthGuide,
        initializeIsSourceMode1,
        initializeControls2,
        initializeOpenSidebarBtn3
    };
}
module.exports = { createChrome };
