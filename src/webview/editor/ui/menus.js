'use strict';
// Construction defines capabilities; bootstrap controls the original initialization order.
function createMenus(dependencies) {
    let COMMAND_PALETTE_ITEMS, COMMAND_PALETTE_GROUPS, insertButton, insertMenu, insertMenuRange, insertActions, insertCategory, insertSamples, actionDescription, insertSearch, insertCategorySelection, commandPalette, commandPaletteInput, commandPaletteList, commandPaletteSavedRange, commandPaletteVisible, commandPaletteOutsideClickTimer, commandPaletteCategory, commandPaletteCount;
    // Only fixed illustrative samples enter previews. These are view controls,
    // never authored editor content or an additional command execution path.
    function createInsertPreview(action) {
        const preview = document.createElement('span');
        preview.className = 'insert-preview insert-preview-' + action;
        preview.setAttribute('aria-hidden', 'true');
        if (action === 'table') {
            const grid = document.createElement('span');
            grid.className = 'insert-table-preview';
            for (const value of ['A', 'B', 'C', '', '', '']) {
                const cell = document.createElement('span');
                cell.textContent = value;
                grid.appendChild(cell);
            }
            preview.appendChild(grid);
        }
        else if (action === 'inlineMath' || action === 'math') {
            const sample = action === 'inlineMath' ? 'E=mc^2' : '\\frac{a+b}{c}';
            if (window.katex)
                window.katex.render(sample, preview, { throwOnError: false, trust: false, displayMode: false });
            else
                preview.textContent = action === 'inlineMath' ? 'E = mc²' : '(a + b) / c';
        }
        else if (action === 'codeblock') {
            const pre = document.createElement('pre');
            pre.dataset.lang = 'javascript';
            const code = document.createElement('code');
            code.className = 'language-javascript';
            code.textContent = 'const value = 1;';
            pre.appendChild(code);
            dependencies.applyHighlighting(pre);
            preview.appendChild(code);
        }
        else if (action === 'image') {
            preview.innerHTML = dependencies.LUCIDE_ICONS.image; // Static project-owned icon.
        }
        else if (action === 'toc') {
            preview.textContent = '1. Research notes\n   1.1 Method\n   1.2 Results';
        }
        else {
            preview.textContent = insertSamples[action];
        }
        return preview;
    }
    function filterInsertWorkspace() {
        const query = (insertSearch?.value || '').trim().toLocaleLowerCase();
        let visible = 0;
        insertMenu.querySelectorAll('[data-insert-action]').forEach(item => {
            item.hidden = Boolean((insertCategorySelection !== 'allCategory' && insertCategory[item.dataset.insertAction] !== insertCategorySelection) || (query && !(item.textContent + ' ' + item.dataset.insertAction).toLocaleLowerCase().includes(query)));
            if (!item.hidden)
                visible++;
        });
        const empty = insertMenu.querySelector('.insert-empty');
        if (empty)
            empty.hidden = visible > 0;
        const options = insertMenu.querySelector('.insert-options');
        if (options)
            options.scrollTop = 0;
        if (!insertMenu.hidden)
            positionInsertMenu();
        insertMenu.querySelectorAll('[data-insert-category]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.insertCategory === insertCategorySelection)));
    }
    function editorRange(range) {
        return range && range.startContainer.isConnected && range.endContainer.isConnected &&
            dependencies.editor.contains(range.startContainer) && dependencies.editor.contains(range.endContainer);
    }
    function insertUnavailable(action, range) {
        if (dependencies.isSourceMode)
            return dependencies.i18n.insertUnavailableSource;
        if (!editorRange(range))
            return dependencies.i18n.insertUnavailableSelection;
        const element = node => node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        const start = element(range.startContainer), end = element(range.endContainer);
        const protectedBlock = 'pre, .math-wrapper, .mermaid-wrapper, .front-matter, .toc-block, .math-inline';
        if (start.closest(protectedBlock) || end.closest(protectedBlock))
            return dependencies.i18n.insertUnavailableContext;
        const inline = ['inlineMath', 'link', 'image'].includes(action);
        if (!inline && (start.closest('li, td, th, blockquote') || end.closest('li, td, th, blockquote'))) {
            return dependencies.i18n.insertUnavailableBlock;
        }
        return '';
    }
    function insertTrigger() {
        return insertButton?.getClientRects().length ? insertButton : dependencies.toolbarMore;
    }
    function positionInsertMenu() {
        const rect = insertTrigger().getBoundingClientRect();
        const width = Math.min(960, Math.max(0, window.innerWidth - 16));
        insertMenu.style.width = width + 'px';
        insertMenu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) + 'px';
        insertMenu.style.top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 320)) + 'px';
        insertMenu.style.maxHeight = Math.max(80, window.innerHeight - parseFloat(insertMenu.style.top) - 8) + 'px';
        const options = insertMenu.querySelector('.insert-options');
        if (options) {
            options.style.maxHeight = '';
            if (window.innerWidth <= 760) {
                const available = window.innerHeight - parseFloat(insertMenu.style.top)
                    - insertMenu.querySelector('.insert-search').getBoundingClientRect().height
                    - insertMenu.querySelector('.insert-categories').getBoundingClientRect().height - 64;
                let used = 16;
                const rows = [...options.querySelectorAll('.insert-command:not([hidden])')];
                for (const row of rows) {
                    const pitch = row.getBoundingClientRect().height + 8;
                    if (used + pitch > available)
                        break;
                    used += pitch;
                }
                const tallest = Math.max(0, ...rows.map(row => row.getBoundingClientRect().height)) + 16;
                options.style.maxHeight = Math.max(80, Math.min(available, Math.max(used, tallest))) + 'px';
            }
        }
        requestAnimationFrame(updateInsertScroll);
    }
    function updateInsertScroll() {
        const list = insertMenu.querySelector('.insert-options');
        const footer = insertMenu.querySelector('.insert-scroll');
        if (!list || !footer)
            return;
        const rows = [...list.querySelectorAll('.insert-command:not([hidden])')];
        const overflow = list.scrollHeight > list.clientHeight + 1;
        footer.hidden = !overflow;
        const bounds = list.getBoundingClientRect();
        const narrow = window.innerWidth <= 760;
        const visible = [];
        rows.forEach((row, index) => {
            const rect = row.getBoundingClientRect();
            const complete = rect.top >= bounds.top + 7 && rect.bottom <= bounds.bottom - 7;
            row.classList.toggle('insert-command-clipped', narrow && !complete);
            if (complete)
                visible.push(index);
        });
        const atEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
        footer.querySelector('[data-direction="previous"]').disabled = list.scrollTop <= 1;
        footer.querySelector('[data-direction="next"]').disabled = atEnd;
        if (narrow && atEnd && visible.length) {
            // Whole-card clipping can leave a partial preceding card's empty
            // space above the final page. Fit that page to its complete rows,
            // preserving the bottom anchor and every command's hit target.
            const gap = rows[visible[0]].getBoundingClientRect().top - bounds.top - 8;
            if (gap > 8) {
                list.style.maxHeight = Math.max(80, list.clientHeight - gap) + 'px';
                list.scrollTop = list.scrollHeight;
                requestAnimationFrame(updateInsertScroll);
                return;
            }
        }
        footer.querySelector('output').textContent = visible.length ? (visible[0] + 1) + '–' + (visible.at(-1) + 1) + ' / ' + rows.length : String(rows.length);
    }
    function restoreInsertRange() {
        if (!editorRange(insertMenuRange))
            return false;
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(insertMenuRange);
        return true;
    }
    function focusInsertChoice(choice) {
        const list = insertMenu.querySelector('.insert-options');
        const bounds = list.getBoundingClientRect(), rect = choice.getBoundingClientRect();
        if (rect.top < bounds.top + 8)
            list.scrollTop += rect.top - bounds.top - 8;
        else if (rect.bottom > bounds.bottom - 8)
            list.scrollTop += rect.bottom - bounds.bottom + 8;
        // Reveal the whole card before focusing: a visibility-hidden partial
        // card cannot accept keyboard focus in a narrow workspace.
        updateInsertScroll();
        choice.focus({ preventScroll: true });
    }
    function closeInsertMenu(restoreFocus) {
        if (!insertMenu)
            return;
        insertMenu.hidden = true;
        insertButton?.setAttribute('aria-expanded', 'false');
        restoreInsertRange();
        if (restoreFocus)
            insertTrigger().focus({ preventScroll: true });
    }
    function openInsertMenu(last) {
        const selection = window.getSelection();
        const current = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
        insertMenuRange = editorRange(current) ? current.cloneRange()
            : editorRange(dependencies.savedToolbarRange) ? dependencies.savedToolbarRange.cloneRange() : null;
        if (!insertMenuRange) {
            insertMenuRange = document.createRange();
            insertMenuRange.selectNodeContents(dependencies.editor);
            insertMenuRange.collapse(false);
        }
        dependencies.toolbar.dispatchEvent(new CustomEvent('toolbar-submenu-open', { bubbles: true }));
        for (const item of insertMenu.querySelectorAll('button[data-insert-action]')) {
            const reason = insertUnavailable(item.dataset.insertAction, insertMenuRange);
            item.setAttribute('aria-disabled', String(Boolean(reason)));
            const description = item.querySelector('small');
            description.textContent = reason || actionDescription(item.dataset.insertAction);
            description.hidden = false;
        }
        insertMenu.hidden = false;
        insertButton?.setAttribute('aria-expanded', 'true');
        insertSearch.value = '';
        insertCategorySelection = 'allCategory';
        filterInsertWorkspace();
        positionInsertMenu();
        const choices = [...insertMenu.querySelectorAll('button[data-insert-action]')];
        if (last)
            focusInsertChoice(choices.at(-1));
        else
            insertSearch.focus({ preventScroll: true });
    }
    function parseI18nLabel(i18nKey) {
        var fullText = dependencies.i18n[i18nKey] || i18nKey;
        var match = fullText.match(/^(.+?)\s*\((.+)\)$/);
        if (match) {
            return { label: match[1], shortcut: match[2] };
        }
        return { label: fullText, shortcut: '' };
    }
    function createCommandPalette() {
        if (commandPalette)
            return;
        commandPalette = document.createElement('div');
        commandPalette.id = 'commandPalette';
        commandPalette.className = 'command-palette';
        commandPalette.setAttribute('role', 'dialog');
        commandPalette.setAttribute('aria-label', dependencies.i18n.allActions);
        commandPalette.style.display = 'none';
        // Search area
        var searchDiv = document.createElement('div');
        searchDiv.className = 'command-palette-search';
        commandPaletteInput = document.createElement('input');
        commandPaletteInput.type = 'text';
        commandPaletteInput.setAttribute('aria-label', dependencies.i18n.commandPaletteFilter);
        commandPaletteInput.className = 'command-palette-input';
        commandPaletteInput.placeholder = dependencies.i18n.commandPaletteFilter || 'Type to filter...';
        searchDiv.appendChild(commandPaletteInput);
        commandPalette.appendChild(searchDiv);
        const categories = document.createElement('div');
        categories.className = 'command-palette-categories';
        categories.setAttribute('role', 'group');
        categories.setAttribute('aria-label', dependencies.i18n.commandPaletteFilter);
        for (const key of ['', ...Object.keys(COMMAND_PALETTE_GROUPS)]) {
            const category = document.createElement('button');
            category.type = 'button';
            category.dataset.paletteCategory = key;
            category.textContent = key ? COMMAND_PALETTE_GROUPS[key]() : dependencies.i18n.allCategory;
            category.addEventListener('click', () => { commandPaletteCategory = key; renderCommandPaletteItems(commandPaletteInput.value); commandPaletteInput.focus(); });
            categories.appendChild(category);
        }
        commandPalette.appendChild(categories);
        // List area
        commandPaletteList = document.createElement('div');
        commandPaletteList.className = 'command-palette-list';
        commandPalette.appendChild(commandPaletteList);
        commandPaletteCount = document.createElement('output');
        commandPaletteCount.className = 'command-palette-count';
        commandPaletteCount.setAttribute('aria-live', 'polite');
        commandPalette.appendChild(commandPaletteCount);
        // Prevent focus loss when clicking palette (except input)
        commandPalette.addEventListener('mousedown', function (e) {
            if (e.target === commandPaletteInput)
                return;
            e.preventDefault();
        });
        // Handle item click
        commandPaletteList.addEventListener('click', function (e) {
            var item = e.target.closest('.command-palette-item');
            if (!item)
                return;
            dependencies.executeCommandPaletteAction(item.dataset.action);
        });
        // Unify hover and keyboard selection: mousemove moves .selected
        commandPaletteList.addEventListener('mousemove', function (e) {
            var item = e.target.closest('.command-palette-item');
            if (!item)
                return;
            if (item.classList.contains('selected'))
                return;
            var prev = commandPaletteList.querySelector('.command-palette-item.selected');
            if (prev)
                prev.classList.remove('selected');
            item.classList.add('selected');
        });
        // Handle input for filtering
        commandPaletteInput.addEventListener('input', function () {
            renderCommandPaletteItems(commandPaletteInput.value);
        });
        // Handle keyboard navigation within the palette
        commandPaletteInput.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                moveCommandPaletteSelection(1);
            }
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                moveCommandPaletteSelection(-1);
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                var selected = commandPaletteList.querySelector('.command-palette-item.selected');
                if (selected) {
                    dependencies.executeCommandPaletteAction(selected.dataset.action);
                }
            }
            else if (e.key === 'Escape') {
                e.preventDefault();
                closeCommandPalette();
            }
        });
        document.body.appendChild(commandPalette);
    }
    function commandItemLabel(item) {
        return item.action === 'viewExport'
            ? { label: document.getElementById('exportButton').getAttribute('aria-label'), shortcut: '' }
            : parseI18nLabel(item.i18nKey);
    }
    function matchingCommandItems(filter) {
        const query = (filter || '').trim().toLocaleLowerCase();
        return COMMAND_PALETTE_ITEMS.filter(item => {
            if (item.action === 'viewExport' && !document.getElementById('exportButton'))
                return false;
            const parsed = commandItemLabel(item);
            return !query || [parsed.label, item.action, parsed.shortcut, actionDescription(item.action)]
                .join(' ').toLocaleLowerCase().includes(query);
        });
    }
    function createCommandItem(item) {
        const parsed = commandItemLabel(item);
        const isMac = navigator.platform.toUpperCase().includes('MAC');
        var el = document.createElement('button');
        el.type = 'button';
        el.className = 'command-palette-item';
        el.dataset.action = item.action;
        if (item.action === 'viewUndo')
            el.disabled = !dependencies.undoManager.canUndo;
        if (item.action === 'viewRedo')
            el.disabled = !dependencies.undoManager.canRedo;
        // Icon
        var iconSpan = document.createElement('span');
        iconSpan.className = 'command-palette-icon';
        iconSpan.innerHTML = dependencies.LUCIDE_ICONS[item.icon] || '';
        el.appendChild(iconSpan);
        // Label
        var labelSpan = document.createElement('span');
        labelSpan.className = 'command-palette-label';
        labelSpan.textContent = parsed.label;
        const description = document.createElement('small');
        description.textContent = actionDescription(item.action);
        labelSpan.appendChild(description);
        el.appendChild(labelSpan);
        // Shortcut
        if (parsed.shortcut) {
            var shortcutSpan = document.createElement('span');
            shortcutSpan.className = 'command-palette-shortcut';
            shortcutSpan.textContent = isMac ? parsed.shortcut.replace(/Ctrl/g, 'Cmd') : parsed.shortcut;
            el.appendChild(shortcutSpan);
        }
        return el;
    }
    function renderCommandPaletteItems(filter) {
        commandPaletteList.innerHTML = '';
        var currentGroup = null;
        var visibleIndex = 0;
        for (const item of matchingCommandItems(filter)) {
            if (commandPaletteCategory && item.group !== commandPaletteCategory)
                continue;
            // Insert group header if new group
            if (item.group !== currentGroup) {
                currentGroup = item.group;
                var groupLabel = document.createElement('div');
                groupLabel.className = 'command-palette-group-label';
                groupLabel.textContent = COMMAND_PALETTE_GROUPS[item.group]();
                commandPaletteList.appendChild(groupLabel);
            }
            const el = createCommandItem(item);
            if (visibleIndex === 0)
                el.classList.add('selected');
            commandPaletteList.appendChild(el);
            visibleIndex++;
        }
        if (!visibleIndex) {
            const empty = document.createElement('p');
            empty.className = 'command-palette-empty';
            empty.setAttribute('role', 'status');
            empty.textContent = dependencies.i18n.noMatchingActions + '. ' + dependencies.i18n.searchRecovery;
            commandPaletteList.appendChild(empty);
            const clear = document.createElement('button');
            clear.type = 'button';
            clear.className = 'command-palette-clear';
            clear.textContent = dependencies.i18n.clearSearch;
            clear.addEventListener('click', event => { event.stopPropagation(); commandPaletteInput.value = ''; commandPaletteCategory = ''; renderCommandPaletteItems(''); commandPaletteInput.focus(); });
            commandPaletteList.appendChild(clear);
        }
        commandPalette.querySelectorAll('[data-palette-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.paletteCategory === commandPaletteCategory)));
        commandPaletteCount.textContent = (dependencies.i18n.paletteActionCount || '{count} actions').replace('{count}', String(visibleIndex));
    }
    function moveCommandPaletteSelection(direction) {
        var items = commandPaletteList.querySelectorAll('.command-palette-item:not(:disabled)');
        if (items.length === 0)
            return;
        var currentIdx = -1;
        for (var i = 0; i < items.length; i++) {
            if (items[i].classList.contains('selected')) {
                currentIdx = i;
                break;
            }
        }
        if (currentIdx >= 0) {
            items[currentIdx].classList.remove('selected');
        }
        var newIdx = currentIdx + direction;
        if (newIdx < 0)
            newIdx = items.length - 1;
        if (newIdx >= items.length)
            newIdx = 0;
        items[newIdx].classList.add('selected');
        // Temporarily disable pointer-events to prevent mousemove from
        // overriding keyboard selection when scrollIntoView moves items
        // under the stationary mouse cursor
        commandPaletteList.style.pointerEvents = 'none';
        items[newIdx].scrollIntoView({ block: 'nearest' });
        requestAnimationFrame(function () {
            if (commandPaletteList)
                commandPaletteList.style.pointerEvents = '';
        });
    }
    function commandPaletteOutsideClickHandler(e) {
        if (commandPalette && !commandPalette.contains(e.target)) {
            closeCommandPalette();
        }
    }
    function stopCommandPaletteOutsideClicks() {
        clearTimeout(commandPaletteOutsideClickTimer);
        commandPaletteOutsideClickTimer = null;
        document.removeEventListener('click', commandPaletteOutsideClickHandler);
    }
    function commandPaletteRepositionHandler() {
        if (commandPaletteVisible)
            closeCommandPalette();
    }
    function openCommandPalette() {
        if (dependencies.isSourceMode)
            return;
        stopCommandPaletteOutsideClicks();
        dependencies.closeToolbarOverflow(false);
        createCommandPalette();
        // Save editor selection
        var sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            commandPaletteSavedRange = sel.getRangeAt(0).cloneRange();
        }
        else {
            commandPaletteSavedRange = null;
        }
        // Get cursor line rect for positioning
        var anchorRect = null;
        if (commandPaletteSavedRange) {
            var rects = commandPaletteSavedRange.getClientRects();
            if (rects.length > 0 && (rects[0].width > 0 || rects[0].height > 0)) {
                anchorRect = rects[0];
            }
            // Collapsed range at empty line may return zero rect - use parent element
            if (!anchorRect) {
                var node = commandPaletteSavedRange.startContainer;
                var el = node.nodeType === 3 ? node.parentElement : node;
                if (el && el.getBoundingClientRect) {
                    var elRect = el.getBoundingClientRect();
                    if (elRect.height > 0)
                        anchorRect = elRect;
                }
            }
        }
        if (!anchorRect) {
            anchorRect = dependencies.toolbar.getBoundingClientRect();
        }
        // Position below cursor line (or above if not enough space below)
        commandPaletteCategory = '';
        commandPaletteInput.value = '';
        renderCommandPaletteItems('');
        commandPalette.style.maxHeight = Math.max(120, window.innerHeight - 16) + 'px';
        commandPalette.style.display = 'flex';
        var paletteHeight = commandPalette.getBoundingClientRect().height;
        var paletteWidth = Math.min(360, window.innerWidth - 16);
        var top, left;
        if (anchorRect.bottom + paletteHeight + 4 <= window.innerHeight) {
            // Below cursor line
            top = anchorRect.bottom + 4;
        }
        else {
            // Above cursor line
            top = anchorRect.top - paletteHeight - 4;
            if (top < 0)
                top = 4;
        }
        left = anchorRect.left;
        if (left + paletteWidth > window.innerWidth) {
            left = window.innerWidth - paletteWidth - 8;
        }
        if (left < 4)
            left = 4;
        commandPalette.style.top = top + 'px';
        commandPalette.style.left = left + 'px';
        commandPalette.style.display = 'flex';
        commandPaletteVisible = true;
        for (const id of ['formatButton', 'allActionsButton'])
            document.getElementById(id)?.setAttribute('aria-expanded', 'true');
        // Show selection highlight via CSS Custom Highlight API (persists when input gets focus)
        if (commandPaletteSavedRange && !commandPaletteSavedRange.collapsed && CSS.highlights) {
            CSS.highlights.set('command-palette-selection', new Highlight(commandPaletteSavedRange));
        }
        // Focus the input
        requestAnimationFrame(function () {
            commandPaletteInput.focus();
        });
        // Close on click outside
        commandPaletteOutsideClickTimer = setTimeout(function () {
            commandPaletteOutsideClickTimer = null;
            if (commandPaletteVisible)
                document.addEventListener('click', commandPaletteOutsideClickHandler);
        }, 0);
        // Close on scroll/resize
        window.addEventListener('resize', commandPaletteRepositionHandler);
        dependencies.editor.addEventListener('scroll', commandPaletteRepositionHandler);
    }
    function closeCommandPalette() {
        if (!commandPalette || !commandPaletteVisible)
            return;
        commandPalette.style.display = 'none';
        commandPaletteVisible = false;
        for (const id of ['formatButton', 'allActionsButton'])
            document.getElementById(id)?.setAttribute('aria-expanded', 'false');
        stopCommandPaletteOutsideClicks();
        window.removeEventListener('resize', commandPaletteRepositionHandler);
        dependencies.editor.removeEventListener('scroll', commandPaletteRepositionHandler);
        // Remove custom highlight
        if (CSS.highlights)
            CSS.highlights.delete('command-palette-selection');
        // Restore editor focus and selection without scrolling
        dependencies.editor.focus({ preventScroll: true });
        if (commandPaletteSavedRange) {
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(commandPaletteSavedRange);
            commandPaletteSavedRange = null;
        }
    }
    let initializeCOMMAND_PALETTE_ITEMSDone = false;
    function initializeCOMMAND_PALETTE_ITEMS() {
        if (initializeCOMMAND_PALETTE_ITEMSDone)
            return;
        initializeCOMMAND_PALETTE_ITEMSDone = true;
        (COMMAND_PALETTE_ITEMS = [
            // Group: Inline
            { group: 'inline', action: 'bold', i18nKey: 'bold', icon: 'bold' },
            { group: 'inline', action: 'italic', i18nKey: 'italic', icon: 'italic' },
            { group: 'inline', action: 'underline', i18nKey: 'underline', icon: 'underline' },
            { group: 'inline', action: 'strikethrough', i18nKey: 'strikethrough', icon: 'strikethrough' },
            { group: 'inline', action: 'code', i18nKey: 'inlineCode', icon: 'code' },
            { group: 'inline', action: 'inlineMath', i18nKey: 'inlineMath', icon: 'math' },
            // Group: Headings
            { group: 'headings', action: 'heading1', i18nKey: 'heading1', icon: 'heading1' },
            { group: 'headings', action: 'heading2', i18nKey: 'heading2', icon: 'heading2' },
            { group: 'headings', action: 'heading3', i18nKey: 'heading3', icon: 'heading3' },
            { group: 'headings', action: 'heading4', i18nKey: 'heading4', icon: 'heading4' },
            { group: 'headings', action: 'heading5', i18nKey: 'heading5', icon: 'heading5' },
            { group: 'headings', action: 'heading6', i18nKey: 'heading6', icon: 'heading6' },
            // Group: Lists
            { group: 'lists', action: 'ul', i18nKey: 'unorderedList', icon: 'ul' },
            { group: 'lists', action: 'ol', i18nKey: 'orderedList', icon: 'ol' },
            { group: 'lists', action: 'task', i18nKey: 'taskList', icon: 'task' },
            // Group: Blocks
            { group: 'blocks', action: 'quote', i18nKey: 'blockquote', icon: 'quote' },
            { group: 'blocks', action: 'codeblock', i18nKey: 'codeBlock', icon: 'codeblock' },
            { group: 'blocks', action: 'hr', i18nKey: 'horizontalRule', icon: 'hr' },
            { group: 'blocks', action: 'mermaid', i18nKey: 'mermaidBlock', icon: 'mermaid' },
            { group: 'blocks', action: 'math', i18nKey: 'mathBlock', icon: 'math' },
            // Group: Insert
            { group: 'insert', action: 'link', i18nKey: 'insertLink', icon: 'link' },
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
        ]);
        (COMMAND_PALETTE_GROUPS = {
            inline: function () { return dependencies.i18n.commandPaletteInline || 'Inline'; },
            headings: function () { return dependencies.i18n.commandPaletteHeadings || 'Headings'; },
            lists: function () { return dependencies.i18n.commandPaletteLists || 'Lists'; },
            blocks: function () { return dependencies.i18n.commandPaletteBlocks || 'Blocks'; },
            insert: function () { return dependencies.i18n.commandPaletteInsert || 'Insert'; },
            view: function () { return dependencies.i18n.editorModes; },
        });
        (insertButton = document.getElementById('insertButton'));
        (insertMenu = document.getElementById('insertMenu'));
        (insertMenuRange = null);
        (insertActions = ['table', 'inlineMath', 'codeblock', 'math', 'link', 'image', 'mermaid', 'toc']);
        (insertCategory = { inlineMath: 'equationsCategory', math: 'equationsCategory', table: 'structureCategory', toc: 'structureCategory', codeblock: 'codeCategory', mermaid: 'codeCategory', link: 'mediaCategory', image: 'mediaCategory' });
        (insertSamples = { inlineMath: '$x^2$', math: '$$\\frac{a+b}{c}$$', table: '| A | B |\n| --- | --- |', codeblock: '```javascript\nconst value = 1;\n```', link: '[text](https://example.com)', image: '![description](image.png)', mermaid: 'graph TD\n  A --> B', toc: '[TOC]' });
        (actionDescription = action => ['viewUndo', 'viewRedo'].includes(action) ? dependencies.i18n.historyDescription : action.startsWith('view') ? dependencies.i18n.viewDescription : dependencies.i18n['insertDescription' + action[0].toUpperCase() + action.slice(1)] || (['bold', 'italic', 'underline', 'strikethrough', 'code'].includes(action) ? dependencies.i18n.formatDescription : dependencies.i18n.blockDescription));
        (insertSearch = null);
        (insertCategorySelection = 'allCategory');
        if (insertMenu) {
            const searchBar = document.createElement('div');
            searchBar.className = 'insert-search';
            insertSearch = document.createElement('input');
            insertSearch.type = 'search';
            insertSearch.placeholder = dependencies.i18n.commandPaletteFilter;
            insertSearch.setAttribute('aria-label', dependencies.i18n.commandPaletteFilter);
            insertSearch.addEventListener('input', filterInsertWorkspace);
            const clear = document.createElement('button');
            clear.type = 'button';
            clear.textContent = dependencies.i18n.clearSearch;
            clear.addEventListener('click', () => { insertSearch.value = ''; insertCategorySelection = 'allCategory'; filterInsertWorkspace(); insertSearch.focus(); });
            searchBar.append(insertSearch, clear);
            insertMenu.appendChild(searchBar);
            const workspace = document.createElement('div');
            workspace.className = 'insert-workspace';
            const categories = document.createElement('div');
            categories.className = 'insert-categories';
            for (const category of ['allCategory', 'structureCategory', 'equationsCategory', 'codeCategory', 'mediaCategory']) {
                const choice = document.createElement('button');
                choice.type = 'button';
                choice.dataset.insertCategory = category;
                const icon = document.createElement('span');
                icon.className = 'insert-category-icon';
                icon.setAttribute('aria-hidden', 'true');
                icon.innerHTML = dependencies.LUCIDE_ICONS[{ allCategory: 'table', structureCategory: 'ul', equationsCategory: 'math', codeCategory: 'codeblock', mediaCategory: 'image' }[category]];
                const title = document.createElement('span');
                title.textContent = dependencies.i18n[category];
                choice.append(icon, title);
                choice.addEventListener('click', () => { insertCategorySelection = category; filterInsertWorkspace(); });
                categories.appendChild(choice);
            }
            const list = document.createElement('div');
            list.className = 'insert-options';
            list.setAttribute('role', 'menu');
            list.setAttribute('aria-label', dependencies.i18n.commandPaletteInsert);
            const results = document.createElement('div');
            results.className = 'insert-results';
            const scrollControls = document.createElement('div');
            scrollControls.className = 'insert-scroll';
            scrollControls.hidden = true;
            const count = document.createElement('output');
            count.setAttribute('aria-live', 'polite');
            for (const direction of ['previous', 'next']) {
                const control = document.createElement('button');
                control.type = 'button';
                control.dataset.direction = direction;
                control.textContent = direction === 'previous' ? '↑ ' + dependencies.i18n.previousCommands : dependencies.i18n.nextCommands + ' ↓';
                control.addEventListener('click', () => {
                    const rows = [...list.querySelectorAll('.insert-command:not([hidden])')];
                    const bounds = list.getBoundingClientRect();
                    // Match the complete-card boundary used by updateInsertScroll.
                    // A subpixel-aligned visible row must not become its own page target.
                    const next = direction === 'next'
                        ? rows.find(row => row.getBoundingClientRect().bottom > bounds.bottom - 7)
                        : [...rows].reverse().find(row => row.getBoundingClientRect().top < bounds.top + 7);
                    if (next)
                        list.scrollTop += next.getBoundingClientRect().top - bounds.top - 8;
                    updateInsertScroll();
                });
                scrollControls.appendChild(control);
                if (direction === 'previous')
                    scrollControls.appendChild(count);
            }
            list.addEventListener('scroll', updateInsertScroll, { passive: true });
            results.append(list, scrollControls);
            workspace.append(categories, results);
            insertMenu.appendChild(workspace);
            const empty = document.createElement('div');
            empty.className = 'insert-empty';
            empty.setAttribute('role', 'status');
            empty.hidden = true;
            const emptyTitle = document.createElement('strong');
            emptyTitle.textContent = dependencies.i18n.noMatchingActions;
            const emptyHelp = document.createElement('p');
            emptyHelp.textContent = dependencies.i18n.searchRecovery;
            const emptyClear = document.createElement('button');
            emptyClear.type = 'button';
            emptyClear.textContent = dependencies.i18n.clearSearch;
            emptyClear.addEventListener('click', () => { insertSearch.value = ''; insertCategorySelection = 'allCategory'; filterInsertWorkspace(); insertSearch.focus(); });
            empty.append(emptyTitle, emptyHelp, emptyClear);
            list.appendChild(empty);
            for (const action of insertActions) {
                const command = COMMAND_PALETTE_ITEMS.find(item => item.action === action);
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'insert-command';
                button.setAttribute('role', 'menuitem');
                button.dataset.insertAction = action;
                const icon = document.createElement('span');
                icon.className = 'insert-command-icon';
                icon.setAttribute('aria-hidden', 'true');
                icon.innerHTML = dependencies.LUCIDE_ICONS[command.icon] || '';
                const details = document.createElement('span');
                details.className = 'insert-command-details';
                const label = document.createElement('strong');
                label.className = 'insert-command-title';
                const parsed = parseI18nLabel(command.i18nKey);
                label.textContent = parsed.label;
                const reason = document.createElement('small');
                reason.id = 'insert-reason-' + action;
                reason.hidden = true;
                button.setAttribute('aria-describedby', reason.id);
                details.append(label, reason);
                const shortcut = document.createElement('kbd');
                shortcut.className = 'insert-shortcut';
                const isMac = navigator.platform.toUpperCase().includes('MAC');
                shortcut.textContent = parsed.shortcut ? (isMac ? parsed.shortcut.replace(/Ctrl/g, 'Cmd') : parsed.shortcut) : '—';
                shortcut.setAttribute('aria-hidden', String(!parsed.shortcut));
                button.append(icon, details, createInsertPreview(action), shortcut);
                list.appendChild(button);
            }
            insertButton?.addEventListener('mousedown', event => { dependencies.captureToolbarSelection(event); event.preventDefault(); });
            insertButton?.addEventListener('click', event => {
                event.stopPropagation();
                if (insertMenu.hidden)
                    openInsertMenu(false);
                else
                    closeInsertMenu(true);
            });
            insertButton?.addEventListener('keydown', event => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    event.stopPropagation();
                    openInsertMenu(event.key === 'ArrowUp');
                }
            });
            insertMenu.addEventListener('mousedown', event => { if (event.target !== insertSearch)
                event.preventDefault(); });
            insertMenu.addEventListener('keydown', event => {
                const choices = [...insertMenu.querySelectorAll('button[data-insert-action]:not([hidden])')];
                const index = choices.indexOf(document.activeElement);
                let next;
                if (event.key === 'ArrowDown')
                    next = (index + 1) % choices.length;
                if (event.key === 'ArrowUp')
                    next = index < 0 ? choices.length - 1 : (index + choices.length - 1) % choices.length;
                if (event.target !== insertSearch && event.key === 'Home')
                    next = 0;
                if (event.target !== insertSearch && event.key === 'End')
                    next = choices.length - 1;
                if (next !== undefined && choices.length) {
                    event.preventDefault();
                    event.stopPropagation();
                    focusInsertChoice(choices[next]);
                }
                else if (event.key === 'Enter' && event.target === insertSearch && choices.length) {
                    event.preventDefault();
                    event.stopPropagation();
                    choices[0].click();
                }
                else if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    closeInsertMenu(true);
                }
            });
            insertMenu.addEventListener('click', event => {
                const item = event.target.closest('button[data-insert-action]');
                if (!item)
                    return;
                const action = item.dataset.insertAction;
                const reason = insertUnavailable(action, insertMenuRange);
                if (reason) {
                    dependencies.showEditorToast(reason);
                    return;
                }
                closeInsertMenu(false);
                dependencies.editor.focus({ preventScroll: true });
                if (!restoreInsertRange())
                    return;
                dependencies.savedToolbarRange = null;
                // Dialog actions take their snapshot only when their host confirms.
                const directInsertion = !['link', 'image', 'toc'].includes(action);
                if (directInsertion) {
                    dependencies.markdown = dependencies.readCurrentMarkdown();
                    dependencies.undoManager.saveSnapshot();
                }
                dependencies.dispatchToolbarAction(action);
                // Redo must see the inserted block even when Undo arrives before
                // an asynchronous rendering-frame sync. Keep equation inputs open.
                if (directInsertion)
                    dependencies.syncMarkdownSync();
            });
            document.addEventListener('mousedown', event => {
                if (!insertMenu.hidden && !insertMenu.contains(event.target) && !insertTrigger().contains(event.target))
                    closeInsertMenu(false);
            });
            insertMenu.addEventListener('focusout', () => queueMicrotask(() => {
                if (!insertMenu.hidden && !insertMenu.contains(document.activeElement) && document.activeElement !== insertTrigger())
                    closeInsertMenu(false);
            }));
            window.addEventListener('resize', () => { if (!insertMenu.hidden)
                positionInsertMenu(); });
            new ResizeObserver(() => { if (!insertMenu.hidden)
                positionInsertMenu(); }).observe(dependencies.toolbar);
        }
        (commandPalette = null);
        (commandPaletteInput = null);
        (commandPaletteList = null);
        (commandPaletteSavedRange = null);
        (commandPaletteVisible = false);
        (commandPaletteOutsideClickTimer = null);
        (commandPaletteCategory = '');
        (commandPaletteCount = null);
    }
    return {
        createInsertPreview,
        filterInsertWorkspace,
        editorRange,
        insertUnavailable,
        insertTrigger,
        positionInsertMenu,
        updateInsertScroll,
        restoreInsertRange,
        focusInsertChoice,
        closeInsertMenu,
        openInsertMenu,
        parseI18nLabel,
        createCommandPalette,
        commandItemLabel,
        matchingCommandItems,
        createCommandItem,
        renderCommandPaletteItems,
        moveCommandPaletteSelection,
        commandPaletteOutsideClickHandler,
        stopCommandPaletteOutsideClicks,
        commandPaletteRepositionHandler,
        openCommandPalette,
        closeCommandPalette,
        get COMMAND_PALETTE_ITEMS() { return COMMAND_PALETTE_ITEMS; }, set COMMAND_PALETTE_ITEMS(value) { COMMAND_PALETTE_ITEMS = value; },
        get COMMAND_PALETTE_GROUPS() { return COMMAND_PALETTE_GROUPS; }, set COMMAND_PALETTE_GROUPS(value) { COMMAND_PALETTE_GROUPS = value; },
        get insertButton() { return insertButton; }, set insertButton(value) { insertButton = value; },
        get insertMenu() { return insertMenu; }, set insertMenu(value) { insertMenu = value; },
        get insertMenuRange() { return insertMenuRange; }, set insertMenuRange(value) { insertMenuRange = value; },
        get insertActions() { return insertActions; }, set insertActions(value) { insertActions = value; },
        get insertCategory() { return insertCategory; }, set insertCategory(value) { insertCategory = value; },
        get insertSamples() { return insertSamples; }, set insertSamples(value) { insertSamples = value; },
        get actionDescription() { return actionDescription; }, set actionDescription(value) { actionDescription = value; },
        get insertSearch() { return insertSearch; }, set insertSearch(value) { insertSearch = value; },
        get insertCategorySelection() { return insertCategorySelection; }, set insertCategorySelection(value) { insertCategorySelection = value; },
        get commandPalette() { return commandPalette; }, set commandPalette(value) { commandPalette = value; },
        get commandPaletteInput() { return commandPaletteInput; }, set commandPaletteInput(value) { commandPaletteInput = value; },
        get commandPaletteList() { return commandPaletteList; }, set commandPaletteList(value) { commandPaletteList = value; },
        get commandPaletteSavedRange() { return commandPaletteSavedRange; }, set commandPaletteSavedRange(value) { commandPaletteSavedRange = value; },
        get commandPaletteVisible() { return commandPaletteVisible; }, set commandPaletteVisible(value) { commandPaletteVisible = value; },
        get commandPaletteOutsideClickTimer() { return commandPaletteOutsideClickTimer; }, set commandPaletteOutsideClickTimer(value) { commandPaletteOutsideClickTimer = value; },
        get commandPaletteCategory() { return commandPaletteCategory; }, set commandPaletteCategory(value) { commandPaletteCategory = value; },
        get commandPaletteCount() { return commandPaletteCount; }, set commandPaletteCount(value) { commandPaletteCount = value; },
        initializeCOMMAND_PALETTE_ITEMS
    };
}
module.exports = { createMenus };
