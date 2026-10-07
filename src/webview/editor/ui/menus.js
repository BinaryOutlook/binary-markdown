'use strict';

// Named capabilities remain live; this factory installs no listeners.
function createMenus(dependencies) {


    // Only fixed illustrative samples enter previews. These are view controls,
    // never authored editor content or an additional command execution path.
    function createInsertPreview(action) {
        const preview = document.createElement('span');
        preview.className = 'insert-preview insert-preview-' + action;
        preview.setAttribute('aria-hidden', 'true');
        if (action === 'table') {
            const grid = document.createElement('span'); grid.className = 'insert-table-preview';
            for (const value of ['A', 'B', 'C', '', '', '']) {
                const cell = document.createElement('span'); cell.textContent = value; grid.appendChild(cell);
            }
            preview.appendChild(grid);
        } else if (action === 'inlineMath' || action === 'math') {
            const sample = action === 'inlineMath' ? 'E=mc^2' : '\\frac{a+b}{c}';
            if (window.katex) window.katex.render(sample, preview, { throwOnError: false, trust: false, displayMode: false });
            else preview.textContent = action === 'inlineMath' ? 'E = mc²' : '(a + b) / c';
        } else if (action === 'codeblock') {
            const pre = document.createElement('pre'); pre.dataset.lang = 'javascript'; const code = document.createElement('code');
            code.className = 'language-javascript'; code.textContent = 'const value = 1;';
            pre.appendChild(code); dependencies.applyHighlighting(pre); preview.appendChild(code);
        } else if (action === 'image') {
            preview.innerHTML = dependencies.LUCIDE_ICONS.image; // Static project-owned icon.
        } else if (action === 'toc') {
            preview.textContent = '1. Research notes\n   1.1 Method\n   1.2 Results';
        } else {
            preview.textContent = dependencies.insertSamples[action];
        }
        return preview;
    }

    function filterInsertWorkspace() {
        const query = (dependencies.insertSearch?.value || '').trim().toLocaleLowerCase();
        let visible = 0;
        dependencies.insertMenu.querySelectorAll('[data-insert-action]').forEach(item => {
            item.hidden = Boolean((dependencies.insertCategorySelection !== 'allCategory' && dependencies.insertCategory[item.dataset.insertAction] !== dependencies.insertCategorySelection) || (query && !(item.textContent + ' ' + item.dataset.insertAction).toLocaleLowerCase().includes(query)));
            if (!item.hidden) visible++;
        });
        const empty = dependencies.insertMenu.querySelector('.insert-empty');
        if (empty) empty.hidden = visible > 0;
        const options = dependencies.insertMenu.querySelector('.insert-options');
        if (options) options.scrollTop = 0;
        if (!dependencies.insertMenu.hidden) positionInsertMenu();
        dependencies.insertMenu.querySelectorAll('[data-insert-category]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.insertCategory === dependencies.insertCategorySelection)));
    }


    function editorRange(range) {
        return range && range.startContainer.isConnected && range.endContainer.isConnected &&
            dependencies.editor.contains(range.startContainer) && dependencies.editor.contains(range.endContainer);
    }


    function insertUnavailable(action, range) {
        if (dependencies.isSourceMode) return dependencies.i18n.insertUnavailableSource;
        if (!editorRange(range)) return dependencies.i18n.insertUnavailableSelection;
        const element = node => node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        const start = element(range.startContainer), end = element(range.endContainer);
        const protectedBlock = 'pre, .math-wrapper, .mermaid-wrapper, .front-matter, .toc-block, .math-inline';
        if (start.closest(protectedBlock) || end.closest(protectedBlock)) return dependencies.i18n.insertUnavailableContext;
        const inline = ['inlineMath', 'link', 'image'].includes(action);
        if (!inline && (start.closest('li, td, th, blockquote') || end.closest('li, td, th, blockquote'))) {
            return dependencies.i18n.insertUnavailableBlock;
        }
        return '';
    }


    function insertTrigger() {
        return dependencies.insertButton?.getClientRects().length ? dependencies.insertButton : dependencies.toolbarMore;
    }


    function positionInsertMenu() {
        const rect = insertTrigger().getBoundingClientRect();
        const width = Math.min(960, Math.max(0, window.innerWidth - 16));
        dependencies.insertMenu.style.width = width + 'px';
        dependencies.insertMenu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) + 'px';
        dependencies.insertMenu.style.top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 320)) + 'px';
        dependencies.insertMenu.style.maxHeight = Math.max(80, window.innerHeight - parseFloat(dependencies.insertMenu.style.top) - 8) + 'px';
        const options = dependencies.insertMenu.querySelector('.insert-options');
        if (options) {
            options.style.maxHeight = '';
            if (window.innerWidth <= 760) {
                const available = window.innerHeight - parseFloat(dependencies.insertMenu.style.top)
                    - dependencies.insertMenu.querySelector('.insert-search').getBoundingClientRect().height
                    - dependencies.insertMenu.querySelector('.insert-categories').getBoundingClientRect().height - 64;
                let used = 16;
                const rows = [...options.querySelectorAll('.insert-command:not([hidden])')];
                for (const row of rows) {
                    const pitch = row.getBoundingClientRect().height + 8;
                    if (used + pitch > available) break;
                    used += pitch;
                }
                const tallest = Math.max(0, ...rows.map(row => row.getBoundingClientRect().height)) + 16;
                options.style.maxHeight = Math.max(80, Math.min(available, Math.max(used, tallest))) + 'px';
            }
        }
        requestAnimationFrame(updateInsertScroll);
    }


    function updateInsertScroll() {
        const list = dependencies.insertMenu.querySelector('.insert-options');
        const footer = dependencies.insertMenu.querySelector('.insert-scroll');
        if (!list || !footer) return;
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
            if (complete) visible.push(index);
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
        if (!editorRange(dependencies.insertMenuRange)) return false;
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(dependencies.insertMenuRange);
        return true;
    }


    function focusInsertChoice(choice) {
        const list = dependencies.insertMenu.querySelector('.insert-options');
        const bounds = list.getBoundingClientRect(), rect = choice.getBoundingClientRect();
        if (rect.top < bounds.top + 8) list.scrollTop += rect.top - bounds.top - 8;
        else if (rect.bottom > bounds.bottom - 8) list.scrollTop += rect.bottom - bounds.bottom + 8;
        // Reveal the whole card before focusing: a visibility-hidden partial
        // card cannot accept keyboard focus in a narrow workspace.
        updateInsertScroll(); choice.focus({ preventScroll: true });
    }


    function closeInsertMenu(restoreFocus) {
        if (!dependencies.insertMenu) return;
        dependencies.insertMenu.hidden = true;
        dependencies.insertButton?.setAttribute('aria-expanded', 'false');
        restoreInsertRange();
        if (restoreFocus) insertTrigger().focus({ preventScroll: true });
    }


    function openInsertMenu(last) {
        const selection = window.getSelection();
        const current = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
        dependencies.insertMenuRange = editorRange(current) ? current.cloneRange()
            : editorRange(dependencies.savedToolbarRange) ? dependencies.savedToolbarRange.cloneRange() : null;
        if (!dependencies.insertMenuRange) {
            dependencies.insertMenuRange = document.createRange();
            dependencies.insertMenuRange.selectNodeContents(dependencies.editor);
            dependencies.insertMenuRange.collapse(false);
        }
        dependencies.toolbar.dispatchEvent(new CustomEvent('toolbar-submenu-open', { bubbles: true }));
        for (const item of dependencies.insertMenu.querySelectorAll('button[data-insert-action]')) {
            const reason = insertUnavailable(item.dataset.insertAction, dependencies.insertMenuRange);
            item.setAttribute('aria-disabled', String(Boolean(reason)));
            const description = item.querySelector('small');
            description.textContent = reason || dependencies.actionDescription(item.dataset.insertAction);
            description.hidden = false;
        }
        dependencies.insertMenu.hidden = false;
        dependencies.insertButton?.setAttribute('aria-expanded', 'true');
        dependencies.insertSearch.value = ''; dependencies.insertCategorySelection = 'allCategory'; filterInsertWorkspace();
        positionInsertMenu();
        const choices = [...dependencies.insertMenu.querySelectorAll('button[data-insert-action]')];
        if (last) focusInsertChoice(choices.at(-1));
        else dependencies.insertSearch.focus({ preventScroll: true });
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
        if (dependencies.commandPalette) return;

        dependencies.commandPalette = document.createElement('div');
        dependencies.commandPalette.id = 'commandPalette';
        dependencies.commandPalette.className = 'command-palette';
        dependencies.commandPalette.setAttribute('role', 'dialog'); dependencies.commandPalette.setAttribute('aria-label', dependencies.i18n.allActions);
        dependencies.commandPalette.style.display = 'none';

        // Search area
        var searchDiv = document.createElement('div');
        searchDiv.className = 'command-palette-search';
        dependencies.commandPaletteInput = document.createElement('input');
        dependencies.commandPaletteInput.type = 'text';
        dependencies.commandPaletteInput.setAttribute('aria-label', dependencies.i18n.commandPaletteFilter);
        dependencies.commandPaletteInput.className = 'command-palette-input';
        dependencies.commandPaletteInput.placeholder = dependencies.i18n.commandPaletteFilter || 'Type to filter...';
        searchDiv.appendChild(dependencies.commandPaletteInput);
        dependencies.commandPalette.appendChild(searchDiv);

        const categories = document.createElement('div'); categories.className = 'command-palette-categories';
        categories.setAttribute('role', 'group'); categories.setAttribute('aria-label', dependencies.i18n.commandPaletteFilter);
        for (const key of ['', ...Object.keys(dependencies.COMMAND_PALETTE_GROUPS)]) {
            const category = document.createElement('button'); category.type = 'button'; category.dataset.paletteCategory = key;
            category.textContent = key ? dependencies.COMMAND_PALETTE_GROUPS[key]() : dependencies.i18n.allCategory;
            category.addEventListener('click', () => { dependencies.commandPaletteCategory = key; renderCommandPaletteItems(dependencies.commandPaletteInput.value); dependencies.commandPaletteInput.focus(); });
            categories.appendChild(category);
        }
        dependencies.commandPalette.appendChild(categories);

        // List area
        dependencies.commandPaletteList = document.createElement('div');
        dependencies.commandPaletteList.className = 'command-palette-list';
        dependencies.commandPalette.appendChild(dependencies.commandPaletteList);
        dependencies.commandPaletteCount = document.createElement('output'); dependencies.commandPaletteCount.className = 'command-palette-count';
        dependencies.commandPaletteCount.setAttribute('aria-live', 'polite'); dependencies.commandPalette.appendChild(dependencies.commandPaletteCount);

        // Prevent focus loss when clicking palette (except input)
        dependencies.commandPalette.addEventListener('mousedown', function(e) {
            if (e.target === dependencies.commandPaletteInput) return;
            e.preventDefault();
        });

        // Handle item click
        dependencies.commandPaletteList.addEventListener('click', function(e) {
            var item = e.target.closest('.command-palette-item');
            if (!item) return;
            dependencies.executeCommandPaletteAction(item.dataset.action);
        });

        // Unify hover and keyboard selection: mousemove moves .selected
        dependencies.commandPaletteList.addEventListener('mousemove', function(e) {
            var item = e.target.closest('.command-palette-item');
            if (!item) return;
            if (item.classList.contains('selected')) return;
            var prev = dependencies.commandPaletteList.querySelector('.command-palette-item.selected');
            if (prev) prev.classList.remove('selected');
            item.classList.add('selected');
        });

        // Handle input for filtering
        dependencies.commandPaletteInput.addEventListener('input', function() {
            renderCommandPaletteItems(dependencies.commandPaletteInput.value);
        });

        // Handle keyboard navigation within the palette
        dependencies.commandPaletteInput.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                moveCommandPaletteSelection(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                moveCommandPaletteSelection(-1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                var selected = dependencies.commandPaletteList.querySelector('.command-palette-item.selected');
                if (selected) {
                    dependencies.executeCommandPaletteAction(selected.dataset.action);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeCommandPalette();
            }
        });

        document.body.appendChild(dependencies.commandPalette);
    }


    function commandItemLabel(item) {
        return item.action === 'viewExport'
            ? { label: document.getElementById('exportButton').getAttribute('aria-label'), shortcut: '' }
            : parseI18nLabel(item.i18nKey);
    }


    function matchingCommandItems(filter) {
        const query = (filter || '').trim().toLocaleLowerCase();
        return dependencies.COMMAND_PALETTE_ITEMS.filter(item => {
            if (item.action === 'viewExport' && !document.getElementById('exportButton')) return false;
            const parsed = commandItemLabel(item);
            return !query || [parsed.label, item.action, parsed.shortcut, dependencies.actionDescription(item.action)]
                .join(' ').toLocaleLowerCase().includes(query);
        });
    }


    function createCommandItem(item) {
        const parsed = commandItemLabel(item);
        const isMac = navigator.platform.toUpperCase().includes('MAC');
        var el = document.createElement('button'); el.type = 'button';
        el.className = 'command-palette-item';
        el.dataset.action = item.action;
        if (item.action === 'viewUndo') el.disabled = !dependencies.undoManager.canUndo;
        if (item.action === 'viewRedo') el.disabled = !dependencies.undoManager.canRedo;

        // Icon
        var iconSpan = document.createElement('span');
        iconSpan.className = 'command-palette-icon';
        iconSpan.innerHTML = dependencies.LUCIDE_ICONS[item.icon] || '';
        el.appendChild(iconSpan);

        // Label
        var labelSpan = document.createElement('span');
        labelSpan.className = 'command-palette-label';
        labelSpan.textContent = parsed.label;
        const description = document.createElement('small'); description.textContent = dependencies.actionDescription(item.action);
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
        dependencies.commandPaletteList.innerHTML = '';

        var currentGroup = null;
        var visibleIndex = 0;

        for (const item of matchingCommandItems(filter)) {
            if (dependencies.commandPaletteCategory && item.group !== dependencies.commandPaletteCategory) continue;
            // Insert group header if new group
            if (item.group !== currentGroup) {
                currentGroup = item.group;
                var groupLabel = document.createElement('div');
                groupLabel.className = 'command-palette-group-label';
                groupLabel.textContent = dependencies.COMMAND_PALETTE_GROUPS[item.group]();
                dependencies.commandPaletteList.appendChild(groupLabel);
            }

            const el = createCommandItem(item);
            if (visibleIndex === 0) el.classList.add('selected');
            dependencies.commandPaletteList.appendChild(el);
            visibleIndex++;
        }
        if (!visibleIndex) {
            const empty = document.createElement('p'); empty.className = 'command-palette-empty'; empty.setAttribute('role', 'status');
            empty.textContent = dependencies.i18n.noMatchingActions + '. ' + dependencies.i18n.searchRecovery; dependencies.commandPaletteList.appendChild(empty);
            const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'command-palette-clear'; clear.textContent = dependencies.i18n.clearSearch;
            clear.addEventListener('click', event => { event.stopPropagation(); dependencies.commandPaletteInput.value = ''; dependencies.commandPaletteCategory = ''; renderCommandPaletteItems(''); dependencies.commandPaletteInput.focus(); });
            dependencies.commandPaletteList.appendChild(clear);
        }
        dependencies.commandPalette.querySelectorAll('[data-palette-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.paletteCategory === dependencies.commandPaletteCategory)));
        dependencies.commandPaletteCount.textContent = (dependencies.i18n.paletteActionCount || '{count} actions').replace('{count}', String(visibleIndex));
    }


    function moveCommandPaletteSelection(direction) {
        var items = dependencies.commandPaletteList.querySelectorAll('.command-palette-item:not(:disabled)');
        if (items.length === 0) return;

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
        if (newIdx < 0) newIdx = items.length - 1;
        if (newIdx >= items.length) newIdx = 0;

        items[newIdx].classList.add('selected');
        // Temporarily disable pointer-events to prevent mousemove from
        // overriding keyboard selection when scrollIntoView moves items
        // under the stationary mouse cursor
        dependencies.commandPaletteList.style.pointerEvents = 'none';
        items[newIdx].scrollIntoView({ block: 'nearest' });
        requestAnimationFrame(function() {
            if (dependencies.commandPaletteList) dependencies.commandPaletteList.style.pointerEvents = '';
        });
    }


    function commandPaletteOutsideClickHandler(e) {
        if (dependencies.commandPalette && !dependencies.commandPalette.contains(e.target)) {
            closeCommandPalette();
        }
    }


    function stopCommandPaletteOutsideClicks() {
        clearTimeout(dependencies.commandPaletteOutsideClickTimer);
        dependencies.commandPaletteOutsideClickTimer = null;
        document.removeEventListener('click', commandPaletteOutsideClickHandler);
    }


    function commandPaletteRepositionHandler() {
        if (dependencies.commandPaletteVisible) closeCommandPalette();
    }


    function openCommandPalette() {
        if (dependencies.isSourceMode) return;
        stopCommandPaletteOutsideClicks();
        dependencies.closeToolbarOverflow(false);
        createCommandPalette();

        // Save editor selection
        var sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            dependencies.commandPaletteSavedRange = sel.getRangeAt(0).cloneRange();
        } else {
            dependencies.commandPaletteSavedRange = null;
        }

        // Get cursor line rect for positioning
        var anchorRect = null;
        if (dependencies.commandPaletteSavedRange) {
            var rects = dependencies.commandPaletteSavedRange.getClientRects();
            if (rects.length > 0 && (rects[0].width > 0 || rects[0].height > 0)) {
                anchorRect = rects[0];
            }
            // Collapsed range at empty line may return zero rect - use parent element
            if (!anchorRect) {
                var node = dependencies.commandPaletteSavedRange.startContainer;
                var el = node.nodeType === 3 ? node.parentElement : node;
                if (el && el.getBoundingClientRect) {
                    var elRect = el.getBoundingClientRect();
                    if (elRect.height > 0) anchorRect = elRect;
                }
            }
        }
        if (!anchorRect) {
            anchorRect = dependencies.toolbar.getBoundingClientRect();
        }

        // Position below cursor line (or above if not enough space below)
        dependencies.commandPaletteCategory = ''; dependencies.commandPaletteInput.value = ''; renderCommandPaletteItems('');
        dependencies.commandPalette.style.maxHeight = Math.max(120, window.innerHeight - 16) + 'px';
        dependencies.commandPalette.style.display = 'flex';
        var paletteHeight = dependencies.commandPalette.getBoundingClientRect().height;
        var paletteWidth = Math.min(360, window.innerWidth - 16);
        var top, left;

        if (anchorRect.bottom + paletteHeight + 4 <= window.innerHeight) {
            // Below cursor line
            top = anchorRect.bottom + 4;
        } else {
            // Above cursor line
            top = anchorRect.top - paletteHeight - 4;
            if (top < 0) top = 4;
        }
        left = anchorRect.left;

        if (left + paletteWidth > window.innerWidth) {
            left = window.innerWidth - paletteWidth - 8;
        }
        if (left < 4) left = 4;

        dependencies.commandPalette.style.top = top + 'px';
        dependencies.commandPalette.style.left = left + 'px';
        dependencies.commandPalette.style.display = 'flex';
        dependencies.commandPaletteVisible = true;
        for (const id of ['formatButton', 'allActionsButton']) document.getElementById(id)?.setAttribute('aria-expanded', 'true');

        // Show selection highlight via CSS Custom Highlight API (persists when input gets focus)
        if (dependencies.commandPaletteSavedRange && !dependencies.commandPaletteSavedRange.collapsed && CSS.highlights) {
            CSS.highlights.set('command-palette-selection', new Highlight(dependencies.commandPaletteSavedRange));
        }

        // Focus the input
        requestAnimationFrame(function() {
            dependencies.commandPaletteInput.focus();
        });

        // Close on click outside
        dependencies.commandPaletteOutsideClickTimer = setTimeout(function() {
            dependencies.commandPaletteOutsideClickTimer = null;
            if (dependencies.commandPaletteVisible) document.addEventListener('click', commandPaletteOutsideClickHandler);
        }, 0);

        // Close on scroll/resize
        window.addEventListener('resize', commandPaletteRepositionHandler);
        dependencies.editor.addEventListener('scroll', commandPaletteRepositionHandler);
    }


    function closeCommandPalette() {
        if (!dependencies.commandPalette || !dependencies.commandPaletteVisible) return;

        dependencies.commandPalette.style.display = 'none';
        dependencies.commandPaletteVisible = false;
        for (const id of ['formatButton', 'allActionsButton']) document.getElementById(id)?.setAttribute('aria-expanded', 'false');
        stopCommandPaletteOutsideClicks();
        window.removeEventListener('resize', commandPaletteRepositionHandler);
        dependencies.editor.removeEventListener('scroll', commandPaletteRepositionHandler);

        // Remove custom highlight
        if (CSS.highlights) CSS.highlights.delete('command-palette-selection');

        // Restore editor focus and selection without scrolling
        dependencies.editor.focus({ preventScroll: true });
        if (dependencies.commandPaletteSavedRange) {
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(dependencies.commandPaletteSavedRange);
            dependencies.commandPaletteSavedRange = null;
        }
    }

    return { createInsertPreview, filterInsertWorkspace, editorRange, insertUnavailable, insertTrigger, positionInsertMenu, updateInsertScroll, restoreInsertRange, focusInsertChoice, closeInsertMenu, openInsertMenu, parseI18nLabel, createCommandPalette, commandItemLabel, matchingCommandItems, createCommandItem, renderCommandPaletteItems, moveCommandPaletteSelection, commandPaletteOutsideClickHandler, stopCommandPaletteOutsideClicks, commandPaletteRepositionHandler, openCommandPalette, closeCommandPalette };
}

module.exports = { createMenus };
