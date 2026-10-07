/**
 * Search state, worker lifecycle, navigation and replacement controls.
 * Mutable document/mode state is read or changed through named capabilities.
 * initialize() installs listeners and performs late search-panel DOM setup.
 */
function createSearch({
    document,
    window,
    editor,
    sourceEditor,
    i18n,
    searchWorkerProgram,
    getSourceMode,
    getSplitMode,
    readCommittedMarkdown,
    sourceDomPositions,
    editorRange,
    setEditorMode,
    updateSourceCorrespondence,
    setMarkdown,
    saveSnapshot,
    markAsEdited,
    cancelScheduledSync,
    scheduleSplitPreview,
    renderFromMarkdown,
    setVisualSourceCurrent,
    notifyChangeImmediate
}) {
    // Search & Replace elements
    const searchReplaceBox = document.getElementById('searchReplaceBox');
    const searchInput = document.getElementById('searchInput');
    const replaceInput = document.getElementById('replaceInput');
    const searchCount = document.getElementById('searchCount');
    const searchPrev = document.getElementById('searchPrev');
    const searchNext = document.getElementById('searchNext');
    const toggleReplace = document.getElementById('toggleReplace');
    const closeSearch = document.getElementById('closeSearch');
    const replaceRow = document.getElementById('replaceRow');
    const replaceOne = document.getElementById('replaceOne');
    const replaceAll = document.getElementById('replaceAll');
    const searchCaseSensitive = document.getElementById('searchCaseSensitive');
    const searchWholeWord = document.getElementById('searchWholeWord');
    const searchRegex = document.getElementById('searchRegex');

    // Search state
    let searchMatches = [];
    let currentMatchIndex = -1;

    let searchResults, searchFeedback, replaceSelected, selectAllSearch, replacementScope, searchSelectedCount, replacementActions;
    // ==================== Search & Replace Functions ====================

    let searchWorker = null, searchWorkerTimer = null, searchId = 0, searchedSource = '', searchTruncated = false;
    let searchSavedRange = null, searchSavedSource = null;
    const selectedSearchMatches = new Set();
    // Keep the two scope-sensitive replacement commands beside one another.
    function stopSearchWorker() { window.clearTimeout(searchWorkerTimer); searchWorker?.terminate(); searchWorker = null; }
    function openSearchBox(showReplace = false) {
        if (searchReplaceBox.style.display === 'none') {
            const selection = window.getSelection();
            searchSavedRange = selection?.rangeCount && editor.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
            searchSavedSource = { start: sourceEditor.selectionStart, end: sourceEditor.selectionEnd };
            const text = getSourceMode() ? sourceEditor.value.slice(sourceEditor.selectionStart, sourceEditor.selectionEnd) : selection?.toString();
            if (text && text.length < 100 && !text.includes('\n')) searchInput.value = text;
        }
        searchReplaceBox.style.display = 'block';
        if (showReplace) replaceRow.style.display = 'flex';
        searchInput.focus(); performSearch();
    }
    function closeSearchBox() {
        stopSearchWorker(); searchId++;
        searchReplaceBox.style.display = 'none'; clearSearchHighlights();
        searchMatches = []; selectedSearchMatches.clear(); currentMatchIndex = -1;
        searchCount.textContent = '0/0';
        if (getSourceMode()) {
            sourceEditor.focus({ preventScroll: true });
            if (searchSavedSource) sourceEditor.setSelectionRange(searchSavedSource.start, searchSavedSource.end);
        } else {
            editor.focus({ preventScroll: true });
            if (editorRange(searchSavedRange)) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(searchSavedRange); }
        }
    }
    function clearSearchHighlights() {
        if (window.CSS.highlights) { window.CSS.highlights.delete('document-search'); window.CSS.highlights.delete('document-search-current'); }
    }
    function visualSearchRanges(source, matches) {
        const ranges = new Map(), positions = sourceDomPositions(source);
        matches.forEach((match, index) => {
            const first = positions.find(item => match.start >= item.start && match.start < item.end);
            const last = positions.findLast(item => match.end > item.start && match.end <= item.end);
            if (!first || !last) return;
            const range = document.createRange(); range.setStart(first.node, match.start - first.start); range.setEnd(last.node, match.end - last.start); ranges.set(index, range);
        });
        return ranges;
    }
    let searchRanges = new Map(), renderedSearchCount = 0;
    function renderSearchResults(reset = true) {
        if (!searchResults) return;
        if (reset) { searchResults.replaceChildren(); renderedSearchCount = 0; }
        searchResults.querySelector('.search-more')?.remove();
        const end = Math.min(searchMatches.length, renderedSearchCount + 200);
        for (let index = renderedSearchCount; index < end; index++) {
            const match = searchMatches[index];
            const row = document.createElement('div'); row.className = 'search-result'; row.dataset.matchIndex = String(index);
            const check = document.createElement('input'); check.type = 'checkbox'; check.checked = selectedSearchMatches.has(index); check.setAttribute('aria-label', i18n.selectMatch + ' ' + (index + 1));
            check.addEventListener('change', () => { if (check.checked) selectedSearchMatches.add(index); else selectedSearchMatches.delete(index); updateSearchActions(); });
            const choice = document.createElement('button'); choice.type = 'button';
            const label = document.createElement('small'); label.textContent = i18n.sourceLine + ' ' + (searchedSource.slice(0, match.start).split('\n').length);
            const context = document.createElement('span');
            const before = searchedSource.slice(Math.max(searchedSource.lastIndexOf('\n', match.start - 1) + 1, match.start - 35), match.start);
            const after = searchedSource.slice(match.end, Math.min(searchedSource.indexOf('\n', match.end) < 0 ? searchedSource.length : searchedSource.indexOf('\n', match.end), match.end + 55));
            const highlight = document.createElement('mark'); highlight.textContent = match.text.slice(0, 120);
            context.append(document.createTextNode(before), highlight, document.createTextNode(after)); choice.append(label, context);
            choice.addEventListener('click', () => goToMatch(index)); row.append(check, choice);
            if (!getSourceMode() && !searchRanges.has(index)) {
                const sourceAction = document.createElement('button'); sourceAction.type = 'button'; sourceAction.className = 'search-source-action'; sourceAction.textContent = i18n.sourceLabel;
                sourceAction.addEventListener('click', () => {
                    const query = searchInput.value, showReplace = replaceRow.style.display !== 'none';
                    setEditorMode('source'); openSearchBox(showReplace); searchInput.value = query; performSearch(false);
                    sourceEditor.setSelectionRange(match.start, match.end); sourceEditor.scrollTop = Math.max(0, searchedSource.slice(0, match.start).split('\n').length * (parseFloat(window.getComputedStyle(sourceEditor).lineHeight) || 21) - sourceEditor.clientHeight / 3);
                }); row.appendChild(sourceAction);
            }
            searchResults.appendChild(row);
        }
        renderedSearchCount = end;
        if (end < searchMatches.length) {
            const more = document.createElement('button'); more.type = 'button'; more.className = 'search-more'; more.textContent = i18n.showMoreMatches;
            more.addEventListener('click', () => renderSearchResults(false)); searchResults.appendChild(more);
        }
        updateSearchActions();
    }
    function updateSearchActions() {
        const selectedOnly = replacementScope?.value === 'selected';
        replaceOne.disabled = currentMatchIndex < 0 || (selectedOnly && !selectedSearchMatches.has(currentMatchIndex));
        replaceAll.disabled = selectedOnly || !searchMatches.length || searchTruncated;
        if (searchSelectedCount) searchSelectedCount.textContent = (i18n.selectedMatchCount || '{count} selected').replace('{count}', String(selectedSearchMatches.size));
        if (replaceSelected) replaceSelected.disabled = !selectedSearchMatches.size;
        if (selectAllSearch) {
            selectAllSearch.checked = Boolean(searchMatches.length && selectedSearchMatches.size === searchMatches.length);
            selectAllSearch.indeterminate = selectedSearchMatches.size > 0 && selectedSearchMatches.size < searchMatches.length;
        }
    }
    function performSearch(navigate = true) {
        if (typeof navigate !== "boolean") navigate = true;
        stopSearchWorker(); const id = ++searchId;
        clearSearchHighlights(); searchMatches = []; currentMatchIndex = -1; selectedSearchMatches.clear(); searchRanges.clear();
        searchedSource = readCommittedMarkdown(); searchTruncated = false; searchCount.textContent = '0/0';
        if (searchFeedback) searchFeedback.textContent = '';
        renderSearchResults();
        if (!searchInput.value) return;
        const url = window.URL.createObjectURL(new window.Blob([searchWorkerProgram], { type: 'text/javascript' }));
        try { searchWorker = new window.Worker(url); } catch (_) { if (searchFeedback) searchFeedback.textContent = i18n.searchUnavailable; window.URL.revokeObjectURL(url); return; }
        window.URL.revokeObjectURL(url);
        const failed = key => { stopSearchWorker(); if (searchFeedback) searchFeedback.textContent = i18n[key]; };
        searchWorker.onerror = () => failed('searchUnavailable');
        searchWorker.onmessage = event => {
            if (event.data.id !== searchId || event.data.id !== id) return;
            stopSearchWorker();
            if (event.data.error) { failed('invalidSearch'); return; }
            if (readCommittedMarkdown() !== searchedSource) { performSearch(navigate); return; }
            searchMatches = event.data.matches; searchTruncated = event.data.truncated;
            searchRanges = visualSearchRanges(searchedSource, searchMatches);
            if (window.CSS.highlights) window.CSS.highlights.set('document-search', new window.Highlight(...searchRanges.values()));
            if (searchFeedback) searchFeedback.textContent = searchTruncated ? i18n.searchLimit : searchMatches.length ? '' : i18n.noSearchMatches;
            renderSearchResults();
            if (searchMatches.length) goToMatch(0, navigate); else searchCount.textContent = '0/0';
        };
        // A pathological regex cannot hold the editor's main thread or remain alive.
        searchWorkerTimer = window.setTimeout(() => failed('searchTimeout'), 500);
        searchWorker.postMessage({ id, source: searchedSource, query: searchInput.value, regex: searchRegex.checked, caseSensitive: searchCaseSensitive.checked, wholeWord: searchWholeWord.checked });
    }
    function goToMatch(index, reveal = true) {
        if (!searchMatches.length) return;
        index = (index + searchMatches.length) % searchMatches.length;
        currentMatchIndex = index;
        const match = searchMatches[index], range = searchRanges.get(index);
        if (getSourceMode() && reveal) {
            sourceEditor.setSelectionRange(match.start, match.end);
            const line = searchedSource.slice(0, match.start).split('\n').length - 1;
            const visibleHeight = window.innerWidth <= 700 ? Math.max(60, Math.min(sourceEditor.clientHeight, searchReplaceBox.getBoundingClientRect().top - sourceEditor.getBoundingClientRect().top - 8)) : sourceEditor.clientHeight;
            sourceEditor.scrollTop = Math.max(0, line * (parseFloat(window.getComputedStyle(sourceEditor).lineHeight) || 21) - visibleHeight / 3);
            updateSourceCorrespondence();
        } else if (range) {
            if (window.CSS.highlights) window.CSS.highlights.set('document-search-current', new window.Highlight(range));
            if (reveal) {
                range.startContainer.parentElement?.scrollIntoView({ block: 'nearest' });
                if (window.innerWidth <= 700) {
                    const bounds = range.getBoundingClientRect(), scroller = getSplitMode() ? editor : document.getElementById('editorWrapper');
                    const top = scroller.getBoundingClientRect().top + 8, bottom = searchReplaceBox.getBoundingClientRect().top - 8;
                    if (bounds.bottom > bottom) scroller.scrollTop += bounds.bottom - bottom;
                    else if (bounds.top < top) scroller.scrollTop -= top - bounds.top;
                }
            }
        }
        searchResults?.querySelectorAll('[data-match-index]').forEach(row => row.classList.toggle('is-current', Number(row.dataset.matchIndex) === index));
        if (reveal && window.innerWidth <= 700) searchResults?.querySelector('.is-current')?.scrollIntoView({ block: 'nearest' });
        searchCount.textContent = (index + 1) + '/' + searchMatches.length + (searchTruncated ? '+' : ''); updateSearchActions();
    }
    let searchRefreshTimer = null;
    function refreshSearchAfterEdit() {
        window.clearTimeout(searchRefreshTimer);
        if (searchReplaceBox.style.display !== 'none') searchRefreshTimer = window.setTimeout(() => {
            if (searchReplaceBox.style.display !== 'none' && readCommittedMarkdown() !== searchedSource) performSearch(false);
        }, 200);
    }
    function replaceMatchIndices(indices) {
        if (!indices.length) return;
        if (readCommittedMarkdown() !== searchedSource) { performSearch(); return; }
        setMarkdown(searchedSource); saveSnapshot();
        let next = searchedSource;
        for (const index of [...indices].sort((a, b) => b - a)) {
            const match = searchMatches[index]; if (match) next = next.slice(0, match.start) + replaceInput.value + next.slice(match.end);
        }
        markAsEdited(); setMarkdown(next); cancelScheduledSync();
        if (getSourceMode()) { sourceEditor.value = next; scheduleSplitPreview(); }
        else renderFromMarkdown();
        setVisualSourceCurrent(true); notifyChangeImmediate(); performSearch();
    }
    function replaceCurrentMatch() { if (!replaceOne.disabled && currentMatchIndex >= 0) replaceMatchIndices([currentMatchIndex]); }
    function replaceAllMatches() { if (!replaceAll.disabled && !searchTruncated) replaceMatchIndices(searchMatches.map((_, index) => index)); }
    let initialized = false;
    function initialize() {
        if (initialized) return;
        initialized = true;
        searchResults = document.getElementById('searchResults');
        searchFeedback = document.getElementById('searchFeedback');
        replaceSelected = document.getElementById('replaceSelected');
        selectAllSearch = document.getElementById('searchSelectAll');
        replacementScope = document.getElementById('replaceScope');
        searchSelectedCount = document.getElementById('searchSelectedCount');
        replacementActions = document.getElementById('searchReplacementActions');
        if (replacementActions) {
            const selected = document.createElement('button'); selected.type = 'button'; selected.id = 'replaceSelected'; selected.textContent = i18n.replaceSelected;
            replacementActions.append(selected, replaceAll); replaceSelected = selected;
        }
        editor.addEventListener('input', refreshSearchAfterEdit); sourceEditor.addEventListener('input', refreshSearchAfterEdit);
        if (replacementScope) replacementScope.addEventListener('change', updateSearchActions);
        if (replaceSelected) replaceSelected.addEventListener('click', () => replaceMatchIndices([...selectedSearchMatches]));
        if (selectAllSearch) selectAllSearch.addEventListener('change', () => {
            selectedSearchMatches.clear(); if (selectAllSearch.checked) searchMatches.forEach((_, index) => selectedSearchMatches.add(index));
            searchResults.querySelectorAll('input[type="checkbox"]').forEach((check, index) => { check.checked = selectedSearchMatches.has(index); }); updateSearchActions();
        });
        window.addEventListener('pagehide', stopSearchWorker);

        // Search event listeners
        searchInput.addEventListener('input', () => {
            performSearch();
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    goToMatch(currentMatchIndex - 1);
                } else {
                    goToMatch(currentMatchIndex + 1);
                }
            } else if (e.key === 'Escape') {
                closeSearchBox();
            }
        });

        replaceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                replaceCurrentMatch();
            } else if (e.key === 'Escape') {
                closeSearchBox();
            }
        });

        searchPrev.addEventListener('click', () => goToMatch(currentMatchIndex - 1));
        searchNext.addEventListener('click', () => goToMatch(currentMatchIndex + 1));
        closeSearch.addEventListener('click', closeSearchBox);

        toggleReplace.addEventListener('click', () => {
            if (replaceRow.style.display === 'none') {
                replaceRow.style.display = 'flex';
            } else {
                replaceRow.style.display = 'none';
            }
        });

        replaceOne.addEventListener('click', replaceCurrentMatch);
        replaceAll.addEventListener('click', replaceAllMatches);

        searchCaseSensitive.addEventListener('change', performSearch);
        searchWholeWord.addEventListener('change', performSearch);
        searchRegex.addEventListener('change', performSearch);

        // Ctrl+F / Cmd+F to open search
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                e.stopPropagation();
                openSearchBox(false);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                e.preventDefault();
                e.stopPropagation();
                openSearchBox(true);
            }
        });
    }

    return {
        initialize,
        openSearchBox,
        closeSearchBox,
        performSearch,
        goToMatch,
        refreshSearchAfterEdit,
        replaceCurrentMatch,
        replaceAllMatches,
        replaceMatchIndices,
        clearSearchHighlights,
        stopSearchWorker,
        get searchReplaceBox() { return searchReplaceBox; },
        get searchInput() { return searchInput; },
        get replaceInput() { return replaceInput; },
        get searchCount() { return searchCount; },
        get searchPrev() { return searchPrev; },
        get searchNext() { return searchNext; },
        get toggleReplace() { return toggleReplace; },
        get closeSearch() { return closeSearch; },
        get replaceRow() { return replaceRow; },
        get replaceOne() { return replaceOne; },
        get replaceAll() { return replaceAll; },
        get searchCaseSensitive() { return searchCaseSensitive; },
        get searchWholeWord() { return searchWholeWord; },
        get searchRegex() { return searchRegex; },
        get searchResults() { return searchResults; },
        get searchFeedback() { return searchFeedback; },
        get replaceSelected() { return replaceSelected; },
        get selectAllSearch() { return selectAllSearch; },
        get replacementScope() { return replacementScope; },
        get searchSelectedCount() { return searchSelectedCount; },
        get replacementActions() { return replacementActions; },
    };
}

module.exports = { createSearch };
