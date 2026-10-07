'use strict';
// Construction defines capabilities; bootstrap controls the original initialization order.
function createCodeControls(dependencies) {
    let codeViewSequence, codeViewIds, codeViewStates;
    function ordinaryCodeBlocks() {
        return Array.from(dependencies.editor.querySelectorAll('pre')).filter(pre => pre.querySelector('code') && !pre.closest('.math-wrapper,.mermaid-wrapper') &&
            !['math', 'mermaid'].includes(pre.getAttribute('data-lang')));
    }
    function codeViewId(pre) {
        if (!codeViewIds.has(pre))
            codeViewIds.set(pre, ++codeViewSequence);
        return codeViewIds.get(pre);
    }
    function captureCodeViews() {
        return ordinaryCodeBlocks().map(pre => ({ id: codeViewId(pre), source: dependencies.mdProcessNode(pre) }));
    }
    function restoreCodeViews(previous) {
        const blocks = ordinaryCodeBlocks();
        const unused = new Set(previous);
        const pending = [];
        for (const [index, pre] of blocks.entries()) {
            const existing = codeViewIds.get(pre);
            if (existing) {
                const match = previous.find(view => view.id === existing);
                unused.delete(match);
            }
            else
                pending.push({ pre, index, source: dependencies.mdProcessNode(pre) });
        }
        // Match unchanged blocks first, including nested blocks and duplicates.
        // Positional fallback retains the identity of a source-edited block when
        // the number of blocks is unchanged, without assigning it to an insertion.
        for (const item of pending) {
            const match = previous.find(view => unused.has(view) && view.source === item.source);
            if (match) {
                codeViewIds.set(item.pre, match.id);
                unused.delete(match);
            }
        }
        for (const { pre, index } of pending) {
            if (codeViewIds.has(pre))
                continue;
            const match = blocks.length === previous.length && unused.has(previous[index]) ? previous[index] : null;
            if (match) {
                codeViewIds.set(pre, match.id);
                unused.delete(match);
            }
            else
                codeViewId(pre);
        }
    }
    function applyCodeWrap(pre) {
        const state = codeViewStates.get(codeViewId(pre));
        const wrapped = state?.wrapped === true;
        pre.classList.toggle('code-wrapped', wrapped);
        pre.querySelector('.code-wrap-btn')?.setAttribute('aria-pressed', String(wrapped));
        const notice = pre.querySelector('.code-wrap-notice');
        if (notice)
            notice.hidden = !wrapped;
    }
    function toggleCodeWrap(pre) {
        const code = pre.querySelector('code');
        if (!code)
            return;
        const id = codeViewId(pre);
        const state = codeViewStates.get(id) || { wrapped: false, scrollLeft: 0 };
        const selection = window.getSelection();
        const range = selection?.rangeCount && code.contains(selection.anchorNode) ? selection.getRangeAt(0) : null;
        const caret = range?.getBoundingClientRect();
        const pane = dependencies.editorWrapper.getBoundingClientRect();
        const keepCaret = caret?.height && caret.top >= pane.top && caret.bottom <= pane.bottom;
        if (!state.wrapped)
            state.scrollLeft = code.scrollLeft;
        state.wrapped = !state.wrapped;
        codeViewStates.set(id, state);
        applyCodeWrap(pre);
        code.scrollLeft = state.wrapped ? 0 : state.scrollLeft;
        if (keepCaret)
            dependencies.editorWrapper.scrollTop += range.getBoundingClientRect().top - caret.top;
    }
    // Setup UI for a single code block (header, highlight)
    function setupCodeBlockUI(pre) {
        // Skip if already setup
        if (pre.querySelector('.code-block-header'))
            return;
        const code = pre.querySelector('code');
        if (!code)
            return;
        pre.classList.add('code-block-with-toolbar');
        // Ensure display mode attributes
        if (!pre.hasAttribute('data-mode')) {
            pre.setAttribute('data-mode', 'display');
        }
        if (!code.hasAttribute('contenteditable')) {
            code.setAttribute('contenteditable', 'false');
        }
        // Create header with language tag and copy button
        const header = document.createElement('div');
        header.className = 'code-block-header';
        header.setAttribute('contenteditable', 'false');
        const lang = pre.getAttribute('data-lang') || 'plaintext';
        const langTag = document.createElement('button');
        langTag.type = 'button';
        langTag.className = 'code-lang-tag';
        langTag.textContent = lang || 'plaintext';
        langTag.title = langTag.textContent;
        langTag.setAttribute('contenteditable', 'false');
        langTag.setAttribute('aria-haspopup', 'listbox');
        langTag.setAttribute('aria-expanded', 'false');
        langTag.setAttribute('aria-label', (dependencies.i18n.languagePickerLabel || 'Code language') + ': ' + langTag.textContent);
        langTag.addEventListener('mousedown', e => e.preventDefault());
        langTag.addEventListener('keydown', event => {
            // Button activation must not also run the editable document's Enter handler.
            if (!event.ctrlKey && !event.metaKey)
                event.stopPropagation();
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                showLanguageSelector(pre, langTag);
            }
        });
        langTag.addEventListener('click', (e) => {
            e.stopPropagation();
            showLanguageSelector(pre, langTag);
        });
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'code-copy-btn';
        copyBtn.innerHTML = dependencies.LUCIDE_ICONS.copy;
        const copyLabel = document.createElement('span');
        copyLabel.className = 'code-action-label';
        copyLabel.textContent = dependencies.i18n.copyCode;
        copyBtn.appendChild(copyLabel);
        copyBtn.title = dependencies.i18n.copyCode || 'Copy code';
        copyBtn.setAttribute('aria-label', copyBtn.title);
        copyBtn.dataset.copyState = 'idle';
        copyBtn.setAttribute('contenteditable', 'false');
        copyBtn.addEventListener('keydown', event => {
            if (!event.ctrlKey && !event.metaKey)
                event.stopPropagation();
        });
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Switch to display mode if in edit mode
            if (pre.getAttribute('data-mode') === 'edit') {
                dependencies.enterDisplayMode(pre);
            }
            copyCodeBlock(pre);
        });
        const wrapBtn = document.createElement('button');
        wrapBtn.type = 'button';
        wrapBtn.className = 'code-wrap-btn';
        wrapBtn.title = dependencies.i18n.wrapCode || 'Wrap code';
        wrapBtn.setAttribute('aria-label', wrapBtn.title);
        wrapBtn.setAttribute('aria-pressed', 'false');
        wrapBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M3 12h14a4 4 0 0 1 0 8h-4m3-3-3 3 3 3M3 18h4"/></svg>';
        const wrapLabel = document.createElement('span');
        wrapLabel.className = 'code-action-label';
        wrapLabel.textContent = dependencies.i18n.wrapCode;
        wrapBtn.appendChild(wrapLabel);
        wrapBtn.addEventListener('pointerdown', event => event.preventDefault());
        wrapBtn.addEventListener('keydown', event => {
            if (!event.ctrlKey && !event.metaKey)
                event.stopPropagation();
        });
        wrapBtn.addEventListener('click', event => { event.stopPropagation(); toggleCodeWrap(pre); });
        const wrapNotice = document.createElement('span');
        wrapNotice.className = 'code-wrap-notice';
        wrapNotice.textContent = dependencies.i18n.codeWrapped || 'Wrapped';
        wrapNotice.title = dependencies.i18n.codeWrappedHelp || 'Visual wrapping only. Source line breaks are unchanged.';
        wrapNotice.hidden = true;
        // Expand/collapse button
        const expandBtn = document.createElement('button');
        expandBtn.type = 'button';
        expandBtn.className = 'code-expand-btn';
        expandBtn.textContent = '⤢';
        expandBtn.title = dependencies.i18n.expandCodeBlock || 'Expand';
        expandBtn.setAttribute('contenteditable', 'false');
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = pre.classList.toggle('code-expanded');
            expandBtn.textContent = isExpanded ? '⤡' : '⤢';
            expandBtn.title = isExpanded ? (dependencies.i18n.collapseCodeBlock || 'Collapse') : (dependencies.i18n.expandCodeBlock || 'Expand');
            if (isExpanded) {
                // Calculate width to fill editor-wrapper
                const editorWrapper = document.querySelector('.editor-wrapper');
                const editorEl = document.getElementById('editor');
                if (editorWrapper && editorEl) {
                    const wrapperRect = editorWrapper.getBoundingClientRect();
                    const editorRect = editorEl.getBoundingClientRect();
                    const preRect = pre.getBoundingClientRect();
                    // Calculate how much to expand left and right
                    const leftOffset = preRect.left - wrapperRect.left - 20; // 20px padding
                    const rightOffset = wrapperRect.right - preRect.right - 20;
                    const newWidth = preRect.width + leftOffset + rightOffset;
                    pre.style.width = newWidth + 'px';
                    pre.style.marginLeft = -leftOffset + 'px';
                }
            }
            else {
                // Reset to default
                pre.style.width = '';
                pre.style.marginLeft = '';
            }
        });
        // Delete the complete fenced block without requiring a text selection.
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'code-delete-btn';
        deleteBtn.title = dependencies.i18n.deleteCodeBlock || 'Delete code block';
        deleteBtn.setAttribute('aria-label', deleteBtn.title);
        deleteBtn.setAttribute('contenteditable', 'false');
        deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
        deleteBtn.addEventListener('mousedown', (e) => {
            // Keep the current block from losing its selection before the
            // click handler captures the undo snapshot.
            e.preventDefault();
        });
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteCodeBlock(pre);
        });
        header.appendChild(expandBtn);
        header.appendChild(langTag);
        header.appendChild(wrapNotice);
        header.appendChild(wrapBtn);
        header.appendChild(copyBtn);
        const openCode = document.createElement('button');
        openCode.type = 'button';
        openCode.className = 'code-open-btn';
        openCode.title = dependencies.i18n.openInTextEditor;
        openCode.setAttribute('aria-label', openCode.title);
        openCode.innerHTML = dependencies.LUCIDE_ICONS.openInTextEditor || dependencies.LUCIDE_ICONS.code;
        const openLabel = document.createElement('span');
        openLabel.className = 'code-action-label';
        openLabel.textContent = dependencies.i18n.openInTextEditor;
        openCode.appendChild(openLabel);
        openCode.addEventListener('mousedown', event => event.preventDefault());
        openCode.addEventListener('click', event => { event.stopPropagation(); dependencies.host.openInTextEditor(); });
        header.appendChild(openCode);
        header.appendChild(deleteBtn);
        const status = document.createElement('span');
        status.className = 'code-block-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('aria-atomic', 'true');
        header.appendChild(status);
        pre.insertBefore(header, pre.firstChild);
        applyCodeWrap(pre);
        // Apply syntax highlighting for display mode
        if (pre.getAttribute('data-mode') === 'display') {
            dependencies.applyHighlighting(pre);
        }
        // Add click handler to enter edit mode
        code.addEventListener('click', (e) => {
            if (pre.getAttribute('data-mode') === 'display') {
                e.stopPropagation();
                dependencies.enterEditMode(pre);
            }
        });
        // Add focusout handler to return to display mode
        code.addEventListener('focusout', (e) => {
            // Delay to check if focus moved to language selector
            setTimeout(() => {
                // Suppress during arrow-key navigation into this block
                if (dependencies.isNavigatingIntoBlock)
                    return;
                const activeEl = document.activeElement;
                // Nested contenteditable code can retain the outer editor's
                // focus. A view toggle must not end that active code selection.
                const selectionInCode = activeEl === dependencies.editor && code.contains(window.getSelection()?.anchorNode);
                if (!pre.contains(activeEl) && !selectionInCode && !document.querySelector('.lang-selector')) {
                    if (pre.getAttribute('data-mode') === 'edit') {
                        dependencies.enterDisplayMode(pre);
                    }
                }
            }, 100);
        });
    }
    function deleteCodeBlock(pre) {
        if (!pre || !dependencies.editor.contains(pre))
            return;
        // Commit any in-progress edit before capturing the pre-delete state so
        // Undo restores exactly what the user saw, including their latest text.
        if (pre.getAttribute('data-mode') === 'edit') {
            dependencies.enterDisplayMode(pre);
        }
        dependencies.markdown = dependencies.htmlToMarkdown();
        dependencies.undoManager.saveSnapshot();
        const nextBlock = pre.nextElementSibling;
        const previousBlock = pre.previousElementSibling;
        pre.remove();
        let focusTarget = nextBlock || previousBlock;
        if (!dependencies.editor.children.length) {
            focusTarget = document.createElement('p');
            focusTarget.innerHTML = '<br>';
            dependencies.editor.appendChild(focusTarget);
        }
        dependencies.syncMarkdownSync();
        dependencies.updateOutline();
        dependencies.updateWordCount();
        if (focusTarget && /^(P|H[1-6]|DIV|BLOCKQUOTE|LI)$/.test(focusTarget.tagName)) {
            if (focusTarget === nextBlock)
                dependencies.setCursorToFirstTextNode(focusTarget);
            else
                dependencies.setCursorToEnd(focusTarget);
        }
        else {
            dependencies.editor.focus({ preventScroll: true });
        }
    }
    function closeLanguageSelector(restoreFocus = false) {
        document.querySelector('.lang-selector')?.closePicker?.(restoreFocus);
    }
    // The input remains visible while its result list scrolls in short panes.
    function positionLanguageSelector() {
        const selector = document.querySelector('.lang-selector');
        const anchor = selector?.languageAnchor;
        if (!anchor)
            return;
        if (!anchor.isConnected || !anchor.getClientRects().length) {
            closeLanguageSelector();
            return;
        }
        const rect = anchor.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
            closeLanguageSelector();
            return;
        }
        const below = window.innerHeight - rect.bottom - 8;
        const above = rect.top - 8;
        const upward = below < 250 && above > below;
        const compact = Math.max(above, below) < 120;
        selector.style.maxHeight = Math.max(0, Math.min(300, compact ? window.innerHeight - 8 : upward ? above : below)) + 'px';
        selector.style.width = Math.min(260, Math.max(0, window.innerWidth - 8)) + 'px';
        selector.style.top = compact ? '4px' : upward ? 'auto' : Math.max(4, rect.bottom + 4) + 'px';
        selector.style.bottom = compact || !upward ? 'auto' : Math.max(4, window.innerHeight - rect.top + 4) + 'px';
        selector.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - selector.offsetWidth - 4)) + 'px';
    }
    function showLanguageSelector(pre, langTag) {
        closeLanguageSelector();
        const selection = window.getSelection();
        const savedRange = selection.rangeCount && dependencies.editor.contains(selection.getRangeAt(0).commonAncestorContainer)
            ? selection.getRangeAt(0).cloneRange() : null;
        const wasEditing = pre.getAttribute('data-mode') === 'edit';
        const current = pre.getAttribute('data-lang') || 'plaintext';
        const currentId = dependencies.LANGUAGE_ALIASES[current.toLowerCase()] || current.toLowerCase();
        const selector = document.createElement('div');
        selector.className = 'lang-selector';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'lang-selector-search';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.placeholder = dependencies.i18n.languagePickerPlaceholder || 'Search names or aliases';
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-label', dependencies.i18n.languagePickerLabel || 'Code language');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-expanded', 'true');
        input.setAttribute('aria-controls', 'codeLanguageOptions');
        const currentLabel = document.createElement('div');
        currentLabel.className = 'lang-selector-current';
        currentLabel.textContent = (dependencies.i18n.languagePickerCurrent || 'Current language') + ': ' + current;
        currentLabel.title = currentLabel.textContent;
        const list = document.createElement('div');
        list.className = 'lang-selector-options';
        list.id = 'codeLanguageOptions';
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-label', dependencies.i18n.languagePickerLabel || 'Code language');
        const empty = document.createElement('div');
        empty.className = 'lang-selector-empty';
        empty.setAttribute('role', 'status');
        empty.textContent = dependencies.i18n.languagePickerNoResults || 'No matching languages.';
        selector.append(input, currentLabel, list, empty);
        let results = [], active = -1, closed = false;
        const observer = new MutationObserver(() => { if (!dependencies.editor.contains(pre))
            closeLanguageSelector(); });
        const outside = event => { if (!selector.contains(event.target) && event.target !== langTag)
            closeLanguageSelector(); };
        selector.closePicker = restoreFocus => {
            if (closed)
                return;
            closed = true;
            observer.disconnect();
            document.removeEventListener('pointerdown', outside, true);
            selector.remove();
            langTag.setAttribute('aria-expanded', 'false');
            if (restoreFocus && dependencies.editor.contains(pre)) {
                const code = pre.querySelector('code');
                const target = wasEditing && savedRange && code.contains(savedRange.commonAncestorContainer) ? code : langTag;
                target.focus({ preventScroll: true });
                if (savedRange?.startContainer.isConnected && savedRange.endContainer.isConnected) {
                    selection.removeAllRanges();
                    selection.addRange(savedRange);
                }
            }
        };
        const activate = index => {
            active = index;
            for (let i = 0; i < list.children.length; i++)
                list.children[i].setAttribute('aria-selected', String(i === active));
            const option = list.children[active];
            if (option) {
                input.setAttribute('aria-activedescendant', option.id);
                option.scrollIntoView({ block: 'nearest' });
            }
            else
                input.removeAttribute('aria-activedescendant');
        };
        const choose = id => {
            if (dependencies.isSourceMode || !dependencies.editor.contains(pre)) {
                closeLanguageSelector();
                return;
            }
            closeLanguageSelector(true);
            if (id === current)
                return;
            // Capture the latest code edit, then make the language choice one undo step.
            dependencies.markdown = dependencies.htmlToMarkdown();
            dependencies.undoManager.saveSnapshot();
            if (id === 'mermaid' || id === 'math') {
                dependencies.convertToSpecialBlock(pre, id);
                dependencies.editor.focus({ preventScroll: true });
                return;
            }
            pre.setAttribute('data-lang', id);
            langTag.textContent = id;
            langTag.title = id;
            langTag.setAttribute('aria-label', (dependencies.i18n.languagePickerLabel || 'Code language') + ': ' + id);
            if (pre.getAttribute('data-mode') === 'display')
                dependencies.applyHighlighting(pre);
            dependencies.syncMarkdownSync();
        };
        const render = (keepActive = false) => {
            const selected = keepActive ? results[active] : undefined;
            const query = input.value.trim().toLowerCase();
            results = dependencies.orderedCodeLanguages().map(id => {
                const terms = [id, dependencies.codeLanguageName(id).toLowerCase(), ...Object.keys(dependencies.LANGUAGE_ALIASES).filter(alias => dependencies.LANGUAGE_ALIASES[alias] === id)];
                const rank = !query ? 0 : terms.some(term => term === query) ? 0 : terms.some(term => term.startsWith(query)) ? 1 : terms.some(term => term.includes(query)) ? 2 : 3;
                return { id, rank };
            }).filter(item => item.rank < 3).sort((a, b) => a.rank - b.rank).map(item => item.id);
            list.replaceChildren();
            for (const id of results) {
                const item = document.createElement('div');
                item.className = 'lang-selector-item';
                item.id = 'codeLanguageOption-' + id;
                item.dataset.language = id;
                item.setAttribute('role', 'option');
                item.dataset.currentLanguage = String(id === currentId);
                const name = document.createElement('span');
                name.textContent = dependencies.codeLanguageName(id);
                const identifier = document.createElement('small');
                identifier.textContent = id;
                item.append(name, identifier);
                if (id === currentId) {
                    const mark = document.createElement('span');
                    mark.className = 'lang-selector-current-mark';
                    mark.textContent = '✓';
                    mark.setAttribute('aria-hidden', 'true');
                    item.appendChild(mark);
                    item.setAttribute('aria-label', dependencies.codeLanguageName(id) + ': ' + (dependencies.i18n.languagePickerCurrent || 'Current language'));
                }
                item.addEventListener('mousedown', event => event.preventDefault());
                item.addEventListener('click', () => choose(id));
                list.appendChild(item);
            }
            empty.hidden = results.length > 0;
            activate(selected && results.includes(selected) ? results.indexOf(selected) :
                query ? (results.length ? 0 : -1) : Math.max(0, results.indexOf(currentId)));
            positionLanguageSelector();
        };
        input.addEventListener('input', () => render());
        selector.refreshOrder = () => render(true);
        selector.addEventListener('keydown', event => {
            event.stopPropagation();
            if (event.isComposing)
                return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                if (results.length)
                    activate((active + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
            }
            else if (event.key === 'Enter') {
                event.preventDefault();
                if (results[active])
                    choose(results[active]);
            }
            else if (event.key === 'Escape') {
                event.preventDefault();
                closeLanguageSelector(true);
            }
            else if (event.key === 'Tab')
                closeLanguageSelector(true);
        });
        selector.languageAnchor = langTag;
        document.body.appendChild(selector);
        langTag.setAttribute('aria-expanded', 'true');
        observer.observe(dependencies.editor, { childList: true, subtree: true });
        document.addEventListener('pointerdown', outside, true);
        render();
        input.focus({ preventScroll: true });
    }
    function setCodeCopyState(pre, state) {
        const button = pre.querySelector('.code-copy-btn');
        const status = pre.querySelector('.code-block-status');
        if (!button || !status)
            return;
        clearTimeout(button.copyFeedbackTimer);
        // Temporary feedback must not shift neighboring controls. Keep long
        // failure details in the tooltip/status rather than in the button row.
        button.style.minWidth = state === 'idle' ? '' : button.getBoundingClientRect().width + 'px';
        button.dataset.copyState = state;
        button.innerHTML = state === 'copied' ? dependencies.LUCIDE_ICONS.check : dependencies.LUCIDE_ICONS.copy;
        const message = state === 'copied' ? (dependencies.i18n.copiedCode || 'Copied') :
            state === 'error' ? (dependencies.i18n.copyCodeFailed || 'Could not copy code. Try again.') : '';
        const label = document.createElement('span');
        label.className = 'code-action-label';
        label.textContent = state === 'copied' ? message : dependencies.i18n.copyCode;
        button.appendChild(label);
        status.textContent = message;
        status.dataset.copyState = state;
        button.title = message || (dependencies.i18n.copyCode || 'Copy code');
        if (state !== 'idle')
            button.copyFeedbackTimer = setTimeout(() => setCodeCopyState(pre, 'idle'), 2000);
    }
    // Copy code block content to clipboard
    function copyCodeBlock(pre) {
        const code = pre.querySelector('code');
        if (!code)
            return;
        // Preserve rendered line breaks, excluding browser-only placeholders.
        // Do not trim: indentation and trailing blank lines are user content.
        const isEmptyCodeBlock = code.childNodes.length === 1 &&
            code.firstChild.nodeType === 1 && code.firstChild.tagName === 'BR';
        const text = isEmptyCodeBlock
            ? ''
            : dependencies.stripTrailingNewlines(dependencies.getCodePlainText(code), code, pre);
        setCodeCopyState(pre, 'idle');
        navigator.clipboard.writeText(text).then(() => {
            setCodeCopyState(pre, 'copied');
        }).catch((err) => {
            setCodeCopyState(pre, 'error');
            dependencies.logger.error('Failed to copy to clipboard:', err);
        });
    }
    let initializeCodeViewSequenceDone = false;
    function initializeCodeViewSequence() {
        if (initializeCodeViewSequenceDone)
            return;
        initializeCodeViewSequenceDone = true;
        (codeViewSequence = 0);
        (codeViewIds = new WeakMap());
        (codeViewStates = new Map());
    }
    let initializeControls1Done = false;
    function initializeControls1() {
        if (initializeControls1Done)
            return;
        initializeControls1Done = true;
        window.addEventListener('resize', positionLanguageSelector);
        dependencies.editorWrapper.addEventListener('scroll', positionLanguageSelector);
        new ResizeObserver(positionLanguageSelector).observe(dependencies.editorWrapper);
    }
    return {
        ordinaryCodeBlocks,
        codeViewId,
        captureCodeViews,
        restoreCodeViews,
        applyCodeWrap,
        toggleCodeWrap,
        setupCodeBlockUI,
        deleteCodeBlock,
        closeLanguageSelector,
        positionLanguageSelector,
        showLanguageSelector,
        setCodeCopyState,
        copyCodeBlock,
        get codeViewSequence() { return codeViewSequence; }, set codeViewSequence(value) { codeViewSequence = value; },
        get codeViewIds() { return codeViewIds; }, set codeViewIds(value) { codeViewIds = value; },
        get codeViewStates() { return codeViewStates; }, set codeViewStates(value) { codeViewStates = value; },
        initializeCodeViewSequence,
        initializeControls1
    };
}
module.exports = { createCodeControls };
