'use strict';

// Named capabilities remain live; this factory installs no listeners.
function createChrome(dependencies) {


    function updateWidthIndicators() {
        if (!dependencies.widthGuide) return;
        const visible = document.documentElement.dataset.editorWidthIndicators !== 'false' && dependencies.editor.style.display !== 'none';
        if (!visible && dependencies.widthGuide.contains(document.activeElement)) {
            (dependencies.editor.style.display === 'none' ? dependencies.sourceEditor : dependencies.editor).focus({ preventScroll: true });
        }
        dependencies.widthGuide.hidden = !visible;
        const pane = dependencies.editorWrapper.getBoundingClientRect();
        const column = dependencies.editor.getBoundingClientRect();
        // Reserve the guide strip while enabled, so revealing the marks cannot
        // add a scrollbar and oscillate around the width threshold.
        const capped = visible && document.documentElement.dataset.editorWidthMode !== 'full' && dependencies.editorWrapper.clientWidth - column.width > 0.5;
        dependencies.widthGuide.dataset.capped = String(capped);
        if (!capped) {
            if (dependencies.widthGuide.contains(document.activeElement)) dependencies.editor.focus({ preventScroll: true });
            dependencies.widthExplanation.hidden = true;
        }
        dependencies.widthBounds.style.left = (column.left - pane.left) + 'px';
        dependencies.widthBounds.style.width = column.width + 'px';
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
        if (keepCaret) dependencies.editorWrapper.scrollTop += range.getBoundingClientRect().top - caretBefore.top;
        else if (anchor && anchorTop !== undefined) dependencies.editorWrapper.scrollTop += anchor.getBoundingClientRect().top - anchorTop;
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
        if (dependencies.workspaceUi) dependencies.workspaceUi.refresh();
        // CSS changes the layout without detaching the active editable node.
        if (keepCaret) dependencies.editorWrapper.scrollTop += range.getBoundingClientRect().top - caretBefore.top;
    }


    // Populate toolbar buttons with Lucide icons
    function initToolbarIcons() {
        dependencies.toolbar.querySelectorAll('button[data-action]').forEach(function(btn) {
            var icon = btn.dataset.action === 'contextToolbar' ? null : dependencies.LUCIDE_ICONS[btn.dataset.action];
            if (icon) btn.innerHTML = icon;
        });
    }


    function closeToolbarOverflow(restoreFocus) {
        if (!dependencies.toolbarOverflow) return;
        dependencies.toolbarOverflow.hidden = true;
        dependencies.toolbarMore.setAttribute('aria-expanded', 'false');
        if (dependencies.editorRange(dependencies.toolbarMenuRange)) {
            const selection = window.getSelection();
            selection.removeAllRanges(); selection.addRange(dependencies.toolbarMenuRange);
        }
        if (dependencies.toolbarMenuSourceSelection && dependencies.isSourceMode) {
            dependencies.sourceEditor.setSelectionRange(dependencies.toolbarMenuSourceSelection.start, dependencies.toolbarMenuSourceSelection.end);
        }
        dependencies.toolbarMenuRange = null; dependencies.toolbarMenuSourceSelection = null;
        if (restoreFocus) dependencies.toolbarMore.focus({ preventScroll: true });
    }


    function positionToolbarOverflow() {
        const rect = dependencies.toolbarMore.getBoundingClientRect();
        const width = Math.min(300, Math.max(0, window.innerWidth - 16));
        dependencies.toolbarOverflow.style.width = width + 'px';
        dependencies.toolbarOverflow.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) + 'px';
        dependencies.toolbarOverflow.style.top = Math.min(rect.bottom + 4, window.innerHeight - 36) + 'px';
        dependencies.toolbarOverflow.style.maxHeight = Math.max(28, window.innerHeight - rect.bottom - 12) + 'px';
    }


    function toolbarMenuChoices() {
        return [...dependencies.toolbarOverflow.querySelectorAll('button:not(:disabled)')].filter(button => button.getClientRects().length);
    }


    function renderToolbarCommandSearch() {
        const query = dependencies.toolbarCommandSearch.value.trim();
        const searching = Boolean(query) || !dependencies.toolbarOverflowItems.children.length;
        dependencies.toolbarOverflowItems.hidden = searching;
        dependencies.toolbarCommandResults.hidden = !searching;
        dependencies.toolbarCommandResults.replaceChildren();
        if (!searching) return;
        for (const item of dependencies.matchingCommandItems(query)) {
            const control = dependencies.createCommandItem(item);
            delete control.dataset.action;
            control.dataset.menuCommand = item.action;
            control.setAttribute('role', 'menuitem');
            const reason = dependencies.isSourceMode && !item.action.startsWith('view') ? dependencies.i18n.insertUnavailableSource
                : dependencies.insertActions.includes(item.action) ? dependencies.insertUnavailable(item.action, dependencies.toolbarMenuRange) : '';
            if (reason) { control.disabled = true; control.querySelector('small').textContent = reason; }
            dependencies.toolbarCommandResults.appendChild(control);
        }
        if (!dependencies.toolbarCommandResults.children.length) {
            const empty = document.createElement('p'); empty.setAttribute('role', 'status');
            empty.textContent = dependencies.i18n.noMatchingActions + '. ' + dependencies.i18n.searchRecovery;
            const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = dependencies.i18n.clearSearch;
            clear.addEventListener('click', event => {
                event.stopPropagation(); dependencies.toolbarCommandSearch.value = ''; renderToolbarCommandSearch(); dependencies.toolbarCommandSearch.focus();
            });
            dependencies.toolbarCommandResults.append(empty, clear);
        }
    }


    function openToolbarOverflow(last) {
        const selection = window.getSelection();
        const current = selection?.rangeCount ? selection.getRangeAt(0) : null;
        dependencies.toolbarMenuRange = dependencies.editorRange(current) ? current.cloneRange()
            : dependencies.editorRange(dependencies.savedToolbarRange) ? dependencies.savedToolbarRange.cloneRange() : null;
        if (!dependencies.toolbarMenuRange && !dependencies.isSourceMode) {
            dependencies.toolbarMenuRange = document.createRange(); dependencies.toolbarMenuRange.selectNodeContents(dependencies.editor); dependencies.toolbarMenuRange.collapse(false);
        }
        dependencies.toolbarMenuRevision = dependencies.editorRenderRevision;
        dependencies.toolbarMenuSourceSelection = dependencies.isSourceMode ? { start: dependencies.sourceEditor.selectionStart, end: dependencies.sourceEditor.selectionEnd } : null;
        dependencies.toolbarCommandSearch.value = '';
        renderToolbarCommandSearch();
        dependencies.toolbarOverflow.hidden = false;
        dependencies.toolbarMore.setAttribute('aria-expanded', 'true');
        positionToolbarOverflow();
        if (last) toolbarMenuChoices().at(-1)?.focus({ preventScroll: true });
        else dependencies.toolbarCommandSearch.focus({ preventScroll: true });
    }


    function scheduleToolbarLayout() {
        if (!dependencies.toolbarMore || dependencies.toolbarLayoutFrame) return;
        dependencies.toolbarLayoutFrame = requestAnimationFrame(layoutToolbarActions);
    }


    function layoutToolbarActions() {
        dependencies.toolbarLayoutFrame = 0;
        const active = document.activeElement;
        const focusedAction = dependencies.toolbarActions.find(item => item.button === active);
        const wasOpen = !dependencies.toolbarOverflow.hidden;
        const full = document.documentElement.dataset.toolbarMode !== 'simple';
        for (const { button, home } of dependencies.toolbarActions) {
            if (button.parentNode !== home.parentNode) home.after(button);
            button.removeAttribute('role');
        }
        dependencies.toolbarMore.hidden = false;
        dependencies.toolbar.querySelectorAll('.toolbar-fixed').forEach(section => section.classList.remove('toolbar-empty'));
        const utilityWidth = [...dependencies.toolbar.querySelectorAll('.toolbar-fixed')].reduce((width, section) => width + section.getBoundingClientRect().width, 0);
        if (dependencies.toolbar.dataset.utilityWidth !== String(utilityWidth)) {
            dependencies.toolbar.dataset.utilityWidth = String(utilityWidth);
            dependencies.tableControls.schedule();
        }
        const fits = () => {
            const fixedWidth = [...dependencies.toolbar.children].filter(child => child !== dependencies.toolbarInner && child !== dependencies.toolbarOverflow && child.getClientRects().length)
                .reduce((width, child) => {
                    const style = getComputedStyle(child);
                    return width + child.getBoundingClientRect().width + (parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0);
                }, 0);
            return fixedWidth <= dependencies.toolbar.clientWidth + 0.5 && (!full || dependencies.toolbarInner.scrollWidth <= dependencies.toolbarInner.clientWidth);
        };
        if (!fits()) {
            dependencies.toolbarMore.hidden = false;
            const candidates = dependencies.toolbarActions.filter(item => full && item.formatting).reverse()
                .concat(dependencies.toolbarActions.filter(item => !item.formatting && item.button.closest('.toolbar-fixed--right')).reverse())
                .concat(dependencies.toolbarActions.filter(item => !item.formatting && item.button.closest('.toolbar-fixed--tools')).reverse())
                .concat(dependencies.toolbarActions.filter(item => !item.formatting && item.button.closest('.toolbar-fixed--left')).reverse());
            for (const { button, home } of candidates) {
                if (fits()) break;
                if (!button.getClientRects().length) continue;
                dependencies.toolbarOverflowItems.appendChild(button);
                button.setAttribute('role', 'menuitem');
                const section = home.parentElement.closest('.toolbar-fixed');
                if (section && ![...section.querySelectorAll('button')].some(item => item.getClientRects().length)) {
                    section.classList.add('toolbar-empty');
                }
            }
        }
        // Original order in the menu remains stable as its membership changes.
        for (const { button } of dependencies.toolbarActions) {
            if (button.parentNode === dependencies.toolbarOverflowItems) dependencies.toolbarOverflowItems.appendChild(button);
        }
        if (wasOpen || focusedAction?.button.parentNode === dependencies.toolbarOverflowItems) {
            renderToolbarCommandSearch();
            dependencies.toolbarOverflow.hidden = false;
            dependencies.toolbarMore.setAttribute('aria-expanded', 'true');
            positionToolbarOverflow();
        }
        if (active.dataset?.menuCommand) dependencies.toolbarCommandResults.querySelector('[data-menu-command="' + active.dataset.menuCommand + '"]')?.focus({ preventScroll: true });
        else if (active === dependencies.toolbarMore && !dependencies.toolbarMore.hidden) dependencies.toolbarMore.focus({ preventScroll: true });
        else if (focusedAction && active.getClientRects().length) active.focus({ preventScroll: true });
        else if (focusedAction || (active === dependencies.toolbarMore && dependencies.toolbarMore.hidden)) {
            const first = dependencies.toolbarActions.find(item => item.button.getClientRects().length && !item.button.disabled);
            first?.button.focus({ preventScroll: true });
        }
    }


    function requestHostInsertion(action) {
        if (dependencies.pendingHostInsert || dependencies.isSourceMode) return;
        const selection = window.getSelection();
        const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
        if (!dependencies.editorRange(range)) return;
        const requestId = 'insert-' + Date.now().toString(36) + '-' + (++dependencies.hostInsertSequence);
        dependencies.pendingHostInsert = { requestId, action, range: range.cloneRange(), startNode: range.startContainer, endNode: range.endContainer, renderRevision: dependencies.editorRenderRevision };
        if (action === 'link') dependencies.host.requestInsertLink(selection.toString() || '', requestId);
        else dependencies.host.requestInsertImage(requestId);
    }


    function finishHostInsertion(message, committed) {
        // Clipboard/drop image responses retain their existing insertion route.
        if (!message.requestId) return true;
        if (!dependencies.pendingHostInsert || message.requestId !== dependencies.pendingHostInsert.requestId) return false;
        const pending = dependencies.pendingHostInsert;
        if (committed && message.type !== (pending.action === 'link' ? 'insertLinkHtml' : 'insertImageHtml')) return false;
        dependencies.pendingHostInsert = null;
        // Live Ranges collapse onto the editor when their original nodes are
        // removed. Retain node identity so a reload cannot redirect a response.
        if (dependencies.isSourceMode || pending.renderRevision !== dependencies.editorRenderRevision || !dependencies.editorRange(pending.range) || !pending.startNode.isConnected || !pending.endNode.isConnected) {
            if (committed) dependencies.showEditorToast(dependencies.i18n.insertUnavailableSelection);
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
        if (dependencies.tableControls.owns(e.target)) return;
        const btn = e.target.closest('button');
        if (!btn) return;
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && dependencies.editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
            dependencies.savedToolbarRange = sel.getRangeAt(0).cloneRange();
        }
    }


    function setSidebarOpen(open) {
        dependencies.sidebar.dataset.overlayOpen = String(open && innerWidth <= 700);
        dependencies.sidebar.classList.toggle('hidden', !open);
        dependencies.openSidebarBtn.classList.toggle('hidden', open);
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
        dependencies.editor.contentEditable = dependencies.isSourceMode ? 'false' : 'true';
        if (!dependencies.isSourceMode) return;
        dependencies.editor.querySelectorAll('[contenteditable]').forEach(node => { node.contentEditable = 'false'; });
        dependencies.editor.querySelectorAll('button,input,textarea,select').forEach(node => { node.disabled = true; });
    }


    function scheduleSplitPreview() {
        clearTimeout(dependencies.splitRenderTimer);
        if (!dependencies.isSplitMode) return;
        dependencies.splitRenderTimer = setTimeout(() => {
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
        if (!dependencies.isSourceMode) return;
        const line = dependencies.sourceEditor.value.slice(0, dependencies.sourceEditor.selectionStart || 0).split('\n').length - 1;
        const headings = sourceHeadings();
        let index = -1;
        headings.forEach((heading, i) => { if (heading.line <= line) index = i; });
        const nodes = [...dependencies.editor.querySelectorAll('h1,h2,h3,h4,h5,h6')];
        nodes.forEach((node, i) => node.classList.toggle('source-correspondence', dependencies.isSplitMode && i === index));
        if (dependencies.workspaceUi) dependencies.workspaceUi.markSourceHeading(headings[index]?.line);
        if (index >= 0) setActiveOutlineItem(index, false);
        if (dependencies.isSplitMode && scroll && nodes[index]) nodes[index].scrollIntoView({ block: 'nearest' });
        const position = document.getElementById('documentPosition');
        if (position) position.textContent = (dependencies.i18n.sourceLine || 'Source line') + ' ' + (line + 1);
    }


    function sourceDomPositions(source) {
        const positions = []; let boundary = 0;
        for (const block of dependencies.editor.children) {
            let raw = block.dataset.mdSource ? decodeURIComponent(block.dataset.mdSource) : '';
            let at = raw ? source.indexOf(raw, boundary) : -1;
            if (at < 0) { raw = dependencies.mdProcessNode(block).trimEnd(); at = raw ? source.indexOf(raw, boundary) : -1; }
            if (at < 0) continue;
            boundary = at + raw.length;
            const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, { acceptNode(node) {
                return node.parentElement?.closest('.code-block-header,.block-chrome,.document-aux,.math-display,.mermaid-diagram,.math-inline') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            } });
            let cursor = 0, node;
            while ((node = walker.nextNode())) {
                if (!node.textContent) continue;
                const found = raw.indexOf(node.textContent, cursor);
                if (found < 0) continue;
                positions.push({ node, start: at + found, end: at + found + node.textContent.length }); cursor = found + node.textContent.length;
            }
        }
        return positions;
    }

    function sourceSelectionFromVisual(source) {
        const selection = window.getSelection();
        const range = dependencies.editorRange(dependencies.savedToolbarRange) ? dependencies.savedToolbarRange : selection?.rangeCount ? selection.getRangeAt(0) : null;
        if (!dependencies.editorRange(range)) return null;
        const positions = sourceDomPositions(source);
        const start = positions.find(item => item.node === range.startContainer);
        const end = positions.find(item => item.node === range.endContainer);
        if (start && end) return { start: start.start + range.startOffset, end: end.start + range.endOffset, scroll: 0 };
        return null;
    }

    function restoreVisualFromSource(start, end) {
        const positions = sourceDomPositions(dependencies.markdown);
        const first = positions.find(item => start >= item.start && start <= item.end);
        const last = positions.findLast(item => end >= item.start && end <= item.end);
        if (!first || !last) return false;
        const range = document.createRange(); range.setStart(first.node, start - first.start); range.setEnd(last.node, end - last.start);
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        first.node.parentElement.scrollIntoView({ block: 'nearest' }); return true;
    }


    function setEditorMode(mode) {
        if (!['visual', 'source', 'split'].includes(mode)) return;
        const previous = dependencies.isSplitMode ? 'split' : dependencies.isSourceMode ? 'source' : 'visual';
        if (mode === previous) return;
        dependencies.closeInsertMenu(false);
        dependencies.closeLanguageSelector();
        dependencies.hideTableToolbar();
        if (typeof dependencies.closeSearchBox === 'function' && dependencies.searchReplaceBox.style.display !== 'none') dependencies.closeSearchBox();
        dependencies.markdown = dependencies.readCurrentMarkdown();
        dependencies.cancelScheduledSync();
        clearTimeout(dependencies.splitRenderTimer);
        if (!dependencies.isSourceMode) { dependencies.visualModeCursor = dependencies.saveCursorState(); dependencies.sourceModeSelection = sourceSelectionFromVisual(dependencies.markdown) || dependencies.sourceModeSelection; }
        else dependencies.sourceModeSelection = { start: dependencies.sourceEditor.selectionStart, end: dependencies.sourceEditor.selectionEnd, scroll: dependencies.sourceEditor.scrollTop };
        dependencies.isSourceMode = mode !== 'visual';
        dependencies.isSplitMode = mode === 'split';
        document.documentElement.dataset.editorMode = mode;
        dependencies.sourceEditor.style.display = dependencies.isSourceMode ? 'block' : 'none';
        dependencies.editor.style.display = mode === 'source' ? 'none' : 'block';
        for (const id of ['sourcePaneHeading', 'previewPaneHeading']) { const label = document.getElementById(id); if (label) label.hidden = !dependencies.isSplitMode; }
        if (dependencies.isSourceMode) {
            dependencies.sourceEditor.value = dependencies.markdown;
            if (dependencies.isSplitMode) dependencies.renderFromMarkdown();
            dependencies.sourceEditor.focus({ preventScroll: true });
            dependencies.sourceEditor.setSelectionRange(dependencies.sourceModeSelection.start, dependencies.sourceModeSelection.end);
            dependencies.sourceEditor.scrollTop = dependencies.sourceModeSelection.scroll;
        } else {
            dependencies.renderFromMarkdown();
            dependencies.editor.focus({ preventScroll: true });
            if (!restoreVisualFromSource(dependencies.sourceModeSelection.start, dependencies.sourceModeSelection.end) && dependencies.visualModeCursor) dependencies.restoreCursorState(dependencies.visualModeCursor);
        }
        dependencies.savedToolbarRange = null;
        document.querySelectorAll('button[data-editor-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.editorMode === mode)));
        dependencies.toolbarActions.filter(item => item.formatting || item.button.dataset.action === 'insertMenu').forEach(item => { item.button.disabled = dependencies.isSourceMode; });
        for (const id of ['formatButton', 'allActionsButton']) {
            const control = document.getElementById(id);
            if (control) control.disabled = dependencies.isSourceMode;
        }
        const help = document.getElementById('modeHelp');
        if (help) { help.hidden = !dependencies.isSourceMode; help.textContent = dependencies.isSplitMode ? dependencies.i18n.splitHelp : dependencies.i18n.insertUnavailableSource; }
        dependencies.notifyChangeImmediate();
        updateOutline();
        updateWordCount();
        updateWidthIndicators();
        updateSourceCorrespondence();
        if (dependencies.workspaceUi) dependencies.workspaceUi.refresh();
    }


    function toggleSourceMode() { setEditorMode(dependencies.isSourceMode ? 'visual' : 'source'); }


    function updateOutline() {
        dependencies.assignHeadingAnchors(dependencies.editor, dependencies.readCommittedMarkdown());
        const headings = dependencies.editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const headingsArray = Array.from(headings);
        const sourceItems = dependencies.isSourceMode ? sourceHeadings() : null;
        dependencies.outlineHeadings = headingsArray;
        dependencies.outline.innerHTML = (sourceItems || headingsArray).map((h, i) => {
            const level = sourceItems ? h.level : h.tagName[1];
            return '<button type="button" class="outline-item" data-level="' + level + '" data-index="' + i + '">' + dependencies.escapeHtml(sourceItems ? h.text : h.textContent) + '</button>';
        }).join('');
        // The links were recreated, so reapply the active state even if the
        // numerical heading index did not change.
        dependencies.activeOutlineIndex = -1;

        dependencies.outline.querySelectorAll('.outline-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index);
                if (dependencies.isSourceMode && sourceItems[idx]) {
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
                    } else {
                        headingsArray[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            });
        });

        updateActiveOutlineItem();
        if (dependencies.isSourceMode) updateSourceCorrespondence(false);
        if (dependencies.workspaceUi) dependencies.workspaceUi.refresh();
    }


    function setActiveOutlineItem(index, ensureVisible = true) {
        const items = dependencies.outline.querySelectorAll('.outline-item');
        if (!items.length) {
            dependencies.activeOutlineIndex = -1;
            return;
        }

        const boundedIndex = Math.max(0, Math.min(index, items.length - 1));
        if (dependencies.activeOutlineIndex !== boundedIndex) {
            items.forEach((item, itemIndex) => {
                const active = itemIndex === boundedIndex;
                item.classList.toggle('is-active', active);
                if (active) item.setAttribute('aria-current', 'location');
                else item.removeAttribute('aria-current');
            });
            dependencies.activeOutlineIndex = boundedIndex;
            if (dependencies.workspaceUi) dependencies.workspaceUi.refresh();
        }

        if (!ensureVisible) return;
        const activeItem = items[boundedIndex];
        const outlineRect = dependencies.outline.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const margin = 8;
        if (itemRect.top < outlineRect.top + margin) {
            dependencies.outline.scrollTop -= outlineRect.top + margin - itemRect.top;
        } else if (itemRect.bottom > outlineRect.bottom - margin) {
            dependencies.outline.scrollTop += itemRect.bottom - (outlineRect.bottom - margin);
        }
    }


    function updateActiveOutlineItem() {
        if (!dependencies.outlineHeadings.length || dependencies.isSourceMode) {
            dependencies.activeOutlineIndex = -1;
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
        for (let index = 0; index < dependencies.outlineHeadings.length; index++) {
            if (dependencies.outlineHeadings[index].getBoundingClientRect().top <= readingLine + 1) {
                activeIndex = index;
            } else {
                break;
            }
        }
        setActiveOutlineItem(activeIndex);
    }


    function scheduleActiveOutlineUpdate() {
        if (dependencies.outlineScrollFrame !== null) return;
        dependencies.outlineScrollFrame = requestAnimationFrame(() => {
            dependencies.outlineScrollFrame = null;
            updateActiveOutlineItem();
        });
    }


    function updateWordCount() {
        let plain = dependencies.editor.cloneNode(true);
        if (dependencies.isSourceMode) {
            const template = document.createElement('template'); template.innerHTML = dependencies.markdownToHtmlFragment(dependencies.sourceEditor.value);
            plain = template.content;
        }
        plain.querySelectorAll('.math-inline').forEach(span => { span.textContent = dependencies.inlineMathMarkdown(span); });
        plain.querySelectorAll('.math-display,.mermaid-diagram,.document-aux,.code-block-header,.block-chrome').forEach(display => display.remove());
        const text = plain.textContent || '';
        const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
        const chars = text.length;
        const lines = dependencies.markdown.split('\n').length;

        dependencies.wordCount.textContent = words + ' ' + dependencies.i18n.words + ' · ' + chars + ' ' + dependencies.i18n.characters + ' · ' + lines + ' ' + dependencies.i18n.lines;
        if (dependencies.workspaceUi) dependencies.workspaceUi.refresh();
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

    return { updateWidthIndicators, applyEditorWidth, applyMathSourcePreference, initToolbarIcons, closeToolbarOverflow, positionToolbarOverflow, toolbarMenuChoices, renderToolbarCommandSearch, openToolbarOverflow, scheduleToolbarLayout, layoutToolbarActions, requestHostInsertion, finishHostInsertion, captureToolbarSelection, setSidebarOpen, openSidebar, closeSidebar, applyPreviewReadOnly, scheduleSplitPreview, sourceHeadings, sourceOffset, updateSourceCorrespondence, sourceDomPositions, sourceSelectionFromVisual, restoreVisualFromSource, setEditorMode, toggleSourceMode, updateOutline, setActiveOutlineItem, updateActiveOutlineItem, scheduleActiveOutlineUpdate, updateWordCount, updateStatus };
}

module.exports = { createChrome };
