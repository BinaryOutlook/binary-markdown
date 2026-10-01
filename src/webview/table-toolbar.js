(function() {
    'use strict';
    const geometry = window.BinaryTablePlacement;
    window.BinaryTableToolbar = { create };

    function create(options) {
        const { editor, header, messages, icons } = options;
        const wrapper = document.getElementById('editorWrapper') || editor.parentElement;
        const label = (key, fallback) => messages[key] || fallback;
        let preference = geometry.normalize(document.documentElement.dataset.tableToolbarPosition);
        let table = null, cell = null, savedRange = null, current = null;
        let frame = 0, settleTimer = 0, settled = true, pointerDown = false, hovering = false, disposed = false;
        let menuOpen = false;
        const listeners = [];
        const scrollHints = new Map();
        const listen = (node, type, handler, capture = false) => {
            node.addEventListener(type, handler, capture);
            listeners.push(() => node.removeEventListener(type, handler, capture));
        };
        const controls = document.createElement('div');
        controls.className = 'table-toolbar'; controls.hidden = true;
        controls.setAttribute('role', 'toolbar');
        controls.setAttribute('aria-label', label('tableControls', 'Table controls'));
        const direction = document.createElement('div'); direction.className = 'table-insert-direction'; controls.appendChild(direction);
        const items = [
            ['add-col-left', 'addColLeft', 'Insert column left', '←Col'],
            ['add-col-right', 'addColRight', 'Insert column right', 'Col→'],
            ['del-col', 'deleteCol', 'Delete column'], null,
            ['add-row-above', 'addRowAbove', 'Insert row above', '↑Row'],
            ['add-row-below', 'addRowBelow', 'Insert row below', 'Row↓'],
            ['del-row', 'deleteRow', 'Delete row'], null,
            ['align-left', 'alignLeft', 'Align left'], ['align-center', 'alignCenter', 'Align center'],
            ['align-right', 'alignRight', 'Align right'], null,
            ['placement', 'tablePlacement', 'Table toolbar position'],
        ];
        for (const item of items) {
            if (!item) {
                const separator = document.createElement('span');
                separator.className = 'separator';
                separator.setAttribute('aria-hidden', 'true');
                controls.appendChild(separator);
                continue;
            }
            const [action, key, fallback, text] = item;
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.action = action;
            button.title = label(key, fallback);
            button.setAttribute('aria-label', button.title);
            button.tabIndex = -1;
            if (text) { button.textContent = text; button.className = 'text-btn'; }
            else button.innerHTML = icons[action];
            if (action === 'placement') { button.setAttribute('aria-haspopup', 'menu'); button.setAttribute('aria-expanded', 'false'); }
            if (action.startsWith('add-')) { button.textContent = ({ 'add-row-above': '↑', 'add-col-left': '←', 'add-col-right': '→', 'add-row-below': '↓' })[action]; direction.appendChild(button); }
            else controls.appendChild(button);
        }
        const selectionInspector = document.createElement('div'); selectionInspector.className = 'table-selection-inspector';
        const navigator = key => {
            const field = document.createElement('label'); field.textContent = label(key, key === 'tableRows' ? 'Rows' : 'Columns');
            const select = document.createElement('select'); select.setAttribute('aria-label', field.textContent); field.appendChild(select); selectionInspector.appendChild(field); return select;
        };
        const rowSelect = navigator('tableRows'), columnSelect = navigator('tableColumns');
        controls.prepend(selectionInspector);
        const group = (className, key, fallback) => {
            const node = document.createElement('div'); node.className = className;
            node.setAttribute('role', 'group'); node.setAttribute('aria-label', label(key, fallback));
            const title = document.createElement('strong'); title.textContent = label(key, fallback); node.appendChild(title); return node;
        };
        const insertGroup = group('table-direction-group', 'insertTableGroup', 'Insert'); insertGroup.appendChild(direction); controls.appendChild(insertGroup);
        const alignmentGroup = group('table-alignment-group', 'tableAlignment', 'Alignment');
        const advancedGroup = group('table-advanced-group', 'tableAdvanced', 'Advanced');
        for (const button of [...controls.querySelectorAll('button')]) {
            if (button.dataset.action.startsWith('align-')) alignmentGroup.appendChild(button);
            else if (!button.dataset.action.startsWith('add-')) advancedGroup.appendChild(button);
        }
        controls.querySelectorAll('.separator').forEach(node => node.remove());
        controls.append(alignmentGroup, advancedGroup);
        const gutters = document.createElement('div'); gutters.className = 'table-coordinate-gutters'; gutters.hidden = true;
        gutters.setAttribute('aria-hidden', 'true'); document.body.appendChild(gutters);
        const boundaries = document.createElement('div'); boundaries.className = 'table-boundary-actions'; boundaries.hidden = true;
        for (const [action, key] of [['add-col-right','addColRight'], ['add-row-below','addRowBelow']]) {
            const button = document.createElement('button'); button.type = 'button'; button.dataset.action = action; button.textContent = '+'; button.setAttribute('aria-label', label(key, action)); button.title = button.getAttribute('aria-label'); boundaries.appendChild(button);
        }
        document.body.appendChild(boundaries);
        controls.querySelector('button').tabIndex = 0;
        document.body.appendChild(controls);
        const dock = document.createElement('div');
        dock.className = 'table-toolbar-dock';
        dock.hidden = true;
        header.insertBefore(dock, header.querySelector('.toolbar-fixed--right'));
        const row = document.createElement('div');
        row.className = 'table-toolbar-row';
        row.hidden = true;
        header.after(row);
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'table-toolbar-toggle';
        toggle.innerHTML = icons.table;
        toggle.title = label('tableControls', 'Table controls');
        toggle.querySelector('svg').setAttribute('aria-hidden', 'true');
        toggle.setAttribute('aria-label', toggle.title);
        toggle.setAttribute('aria-haspopup', 'menu');
        toggle.setAttribute('aria-expanded', 'false');
        dock.appendChild(toggle);
        const picker = document.createElement('div');
        picker.className = 'table-placement-menu';
        picker.setAttribute('role', 'menu');
        picker.setAttribute('aria-label', label('tablePlacement', 'Table toolbar position'));
        picker.hidden = true;
        document.body.appendChild(picker);
        const sizes = [false, true, 'dock'].map(layout => {
            const clone = controls.cloneNode(true);
            clone.className = 'table-toolbar visible table-toolbar-measure'; clone.hidden = false;
            clone.dataset.vertical = String(layout === true);
            clone.dataset.docked = String(layout === 'dock');
            clone.setAttribute('aria-hidden', 'true');
            clone.inert = true;
            document.body.appendChild(clone);
            return clone;
        });
        const actions = [...controls.querySelectorAll('button')];
        const more = document.createElement('button');
        more.type = 'button';
        more.dataset.action = 'more';
        more.textContent = '⋯';
        more.title = label('tableMoreActions', 'More table actions');
        more.setAttribute('aria-label', more.title);
        more.setAttribute('aria-haspopup', 'menu');
        more.setAttribute('aria-expanded', 'false');
        more.tabIndex = -1;
        more.hidden = true;
        controls.appendChild(more);
        const overflow = document.createElement('div');
        overflow.className = 'table-overflow-menu';
        overflow.setAttribute('role', 'menu');
        overflow.setAttribute('aria-label', more.title);
        overflow.hidden = true;
        const overflowActions = actions.map(button => {
            const copy = button.cloneNode(false);
            copy.removeAttribute('class');
            copy.setAttribute('role', 'menuitem');
            const icon = button.querySelector('svg');
            if (icon) copy.appendChild(icon.cloneNode(true));
            const text = document.createElement('span');
            text.textContent = button.title;
            copy.appendChild(text);
            overflow.appendChild(copy);
            return copy;
        });
        document.body.appendChild(overflow);
        let pickerAnchor = actions[actions.length - 1];
        const resize = new ResizeObserver(() => schedule());
        const scrollResize = new ResizeObserver(() => schedule());
        for (const element of new Set([editor, wrapper, header, row])) resize.observe(element);
        const mutations = new MutationObserver(() => schedule());
        mutations.observe(editor, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });

        function owns(node) { return controls.contains(node) || boundaries.contains(node) || dock.contains(node) || picker.contains(node) || overflow.contains(node) || [...scrollHints.values()].some(hint => hint.contains(node)); }
        function valid() { return table && cell && editor.contains(table) && table.contains(cell) && !options.isSourceMode(); }
        function closeMenus() {
            picker.hidden = true;
            overflow.hidden = true;
            more.setAttribute('aria-expanded', 'false');
            overflowActions[overflowActions.length - 1].setAttribute('aria-expanded', 'false');
            menuOpen = false;
            if (current === 'top-bar' && !toggle.hidden) { controls.classList.remove('visible'); controls.hidden = true; }
            toggle.setAttribute('aria-expanded', 'false');
            controls.querySelector('[data-action="placement"]').setAttribute('aria-expanded', 'false');
        }
        function hide() {
            boundaries.hidden = true;
            gutters.hidden = true;
            const changed = !dock.hidden || !row.hidden;
            closeMenus();
            controls.classList.remove('visible'); controls.hidden = true;
            dock.hidden = true;
            row.hidden = true;
            if (changed) options.onLayout();
        }
        function clear() {
            if (table) { table.classList.remove('table-inspected'); table.querySelectorAll('.table-context-row,.table-context-column').forEach(node => node.classList.remove('table-context-row','table-context-column')); }
            if (table) resize.unobserve(table);
            table = cell = savedRange = current = null;
            hovering = false;
            options.onContext(null);
            hide();
        }
        function show(nextTable, nextCell) {
            if (!nextCell || !nextTable?.contains(nextCell)) return clear();
            if (table !== nextTable) {
                if (table) resize.unobserve(table);
                table = nextTable;
                resize.observe(table);
                current = null;
                closeMenus();
            }
            cell = nextCell;
            table.classList.add('table-inspected');
            table.querySelectorAll('tr').forEach((row, r) => [...row.cells].forEach((item, c) => {
                item.dataset.tableRow = String(r + 1); item.dataset.tableColumn = String(c + 1);
                item.classList.toggle('table-context-row', r === cell.parentElement.rowIndex);
                item.classList.toggle('table-context-column', c === cell.cellIndex);
            }));
            const fill = (select, length, selected) => {
                select.replaceChildren();
                for (let i = 0; i < length; i++) { const option = document.createElement('option'); option.value = String(i); option.textContent = String(i + 1); select.appendChild(option); }
                select.value = String(selected);
            };
            fill(rowSelect, table.rows.length, cell.parentElement.rowIndex);
            fill(columnSelect, table.rows[0].cells.length, cell.cellIndex);
            const headerRow = cell.parentElement === table.rows[0];
            controls.querySelector('[data-action="add-row-above"]').disabled = headerRow;
            controls.querySelector('[data-action="del-row"]').disabled = headerRow;
            controls.querySelector('[data-action="del-col"]').disabled = table.rows[0].cells.length <= 1;
            const selection = window.getSelection();
            if (selection.rangeCount && cell.contains(selection.anchorNode)) savedRange = selection.getRangeAt(0).cloneRange();
            schedule();
        }
        for (const field of [rowSelect, columnSelect]) field.addEventListener('change', event => {
            if (!valid()) return;
            const next = table.rows[Number(rowSelect.value)]?.cells[Number(columnSelect.value)];
            if (!next) return;
            savedRange = null; options.onContext(next); show(table, next); restore(true);
        });
        function restore(reveal = false) {
            if (!valid()) return;
            const target = cell;
            const range = savedRange && target.contains(savedRange.startContainer) ? savedRange : document.createRange();
            if (range !== savedRange) { range.selectNodeContents(target); range.collapse(false); }
            editor.focus({ preventScroll: true });
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            if (cell !== target) { options.onContext(target); show(target.closest('table'), target); }
            if (reveal) {
                target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                options.onReveal?.(cell);
            }
        }
        function schedule() {
            if (disposed) return;
            settled = false;
            clearTimeout(settleTimer);
            settleTimer = setTimeout(() => { settled = true; request(); }, 200);
            request();
        }
        function request() {
            if (!frame && !disposed) frame = requestAnimationFrame(() => { frame = 0; render(); });
        }
        function obstacles(bounds) {
            const result = [];
            // Walk visible neighbors at each ancestor level, including text next
            // to a nested table in a list or quotation. Never scan the whole document.
            for (let block = table; block !== editor && editor.contains(block); block = block.parentElement) {
                for (const direction of ['previousSibling', 'nextSibling']) {
                    for (let node = block[direction]; node; node = node[direction]) {
                        let rect;
                        if (node.nodeType === 1) rect = node.getBoundingClientRect();
                        else if (node.nodeType === 3 && node.textContent.trim()) {
                            const range = document.createRange();
                            range.selectNodeContents(node);
                            rect = range.getBoundingClientRect();
                        }
                        if (!rect?.width || !rect.height) continue;
                        if (direction === 'previousSibling' && rect.bottom < bounds.top) break;
                        if (direction === 'nextSibling' && rect.top > bounds.bottom) break;
                        result.push(rect);
                    }
                }
            }
            const search = document.getElementById('searchReplaceBox');
            if (search?.getClientRects().length) result.push(search.getBoundingClientRect());
            return result;
        }
        function placeMenu(node, anchor) {
            const rect = anchor.getBoundingClientRect();
            node.style.maxWidth = Math.max(1, innerWidth - 12) + 'px';
            node.style.maxHeight = Math.max(1, innerHeight - 12) + 'px';
            const size = node.getBoundingClientRect();
            node.style.left = Math.max(6, Math.min(rect.left, innerWidth - size.width - 6)) + 'px';
            node.style.top = Math.max(6, Math.min(rect.bottom + 4, innerHeight - size.height - 6)) + 'px';
        }
        function fitActions(width, height) {
            const vertical = controls.dataset.vertical === 'true';
            const measure = sizes[controls.dataset.docked === 'true' ? 2 : Number(vertical)];
            const natural = measure.getBoundingClientRect();
            const measured = [...measure.querySelectorAll('button')];
            const style = getComputedStyle(controls);
            const endPadding = parseFloat(vertical ? style.paddingBottom : style.paddingRight) + parseFloat(vertical ? style.borderBottomWidth : style.borderRightWidth);
            const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
            const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
            const moreStyle = getComputedStyle(more);
            const moreSize = parseFloat(vertical ? moreStyle.height : moreStyle.width);
            const gap = parseFloat(vertical ? style.rowGap : style.columnGap);
            const limit = vertical ? height : width;
            const compactMenu = controls.getAttribute('role') === 'menu';
            const selectionSize = measure.querySelector('.table-selection-inspector').getBoundingClientRect();
            // Keep the insertion diamond reachable before falling back to the
            // complete compact menu. Measure hidden navigation consistently.
            const navigationInOverflow = !compactMenu && width < (vertical ? 150 : selectionSize.width + 158);
            const focusedNavigation = selectionInspector.contains(document.activeElement) ? document.activeElement : null;
            const navigationParent = navigationInOverflow ? overflow : controls;
            if (selectionInspector.parentElement !== navigationParent) {
                navigationParent.prepend(selectionInspector);
                if (focusedNavigation) focusedNavigation.focus({ preventScroll: true });
            }
            selectionInspector.hidden = false;
            const omitted = navigationInOverflow ? (vertical ? selectionSize.height : selectionSize.width) + gap : 0;
            let count = actions.length;
            const navigationTrigger = navigationInOverflow ? moreSize + gap : 0;
            if (!compactMenu && (natural.width - (vertical ? 0 : omitted) + (vertical ? 0 : navigationTrigger) > width || natural.height - (vertical ? omitted : 0) + (vertical ? navigationTrigger : 0) > height)) {
                count = 0;
                for (const button of measured) {
                    const rect = button.getBoundingClientRect();
                    const end = (vertical ? rect.bottom - natural.top : rect.right - natural.left) - omitted;
                    // Reserve the overflow trigger before accepting another whole action.
                    if (end + gap + moreSize + endPadding > limit || rect.width > width - horizontalPadding || rect.height > height - verticalPadding) break;
                    count++;
                }
            }
            if (count < 4) count = 0; // Keep the four directional controls together.
            if (count > 4 && count < 7) count = 4; // Keep Alignment together.
            direction.hidden = count === 0;
            const focused = document.activeElement;
            const focusedAction = actions.indexOf(focused) >= 0 ? actions.indexOf(focused) : overflowActions.indexOf(focused);
            actions.forEach((button, index) => {
                button.hidden = index >= count;
                overflowActions[index].hidden = index < count;
                overflowActions[index].disabled = button.disabled;
            });
            for (const separator of controls.querySelectorAll('.separator')) {
                const next = separator.nextElementSibling;
                separator.hidden = !next || next.hidden;
            }
            more.hidden = count === actions.length && !navigationInOverflow;
            if (more.hidden) { overflow.hidden = true; more.setAttribute('aria-expanded', 'false'); }
            if (focusedAction >= 0 && focused.hidden) {
                if (actions[focusedAction].hidden) {
                    overflow.hidden = false;
                    more.setAttribute('aria-expanded', 'true');
                    overflowActions[focusedAction].focus({ preventScroll: true });
                } else {
                    overflow.hidden = true;
                    more.setAttribute('aria-expanded', 'false');
                    actions[focusedAction].focus({ preventScroll: true });
                }
            } else if (focused === more && more.hidden) actions.find(button => !button.disabled)?.focus({ preventScroll: true });
            const visible = [...actions, more].filter(button => !button.hidden && !button.disabled);
            const tabStop = visible.includes(document.activeElement) ? document.activeElement : visible.find(button => button.tabIndex === 0) || visible[0];
            [...actions, more].forEach(button => { button.tabIndex = button === tabStop ? 0 : -1; });
            if (!overflow.hidden) placeMenu(overflow, more);
            if (overflow.contains(document.activeElement)) document.activeElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            if (!picker.hidden) placeMenu(picker, pickerAnchor.getClientRects().length ? pickerAnchor : more.hidden ? actions[actions.length - 1] : more);
        }
        function updateDockHost(docked) {
            const secondRow = docked && document.documentElement.dataset.toolbarMode !== 'simple';
            const parent = secondRow ? row : header;
            row.hidden = !secondRow;
            if (dock.parentElement !== parent) {
                // Reparent the existing controls without losing a focused action
                // or its open menu during a live toolbar-mode change.
                const focused = document.activeElement;
                parent.insertBefore(dock, secondRow ? null : header.querySelector('.toolbar-fixed--right'));
                if (dock.contains(focused)) focused.focus({ preventScroll: true });
            }
        }
        function dockWidth() {
            if (!row.hidden) return Math.max(28, row.clientWidth - 28);
            // Use the utilities' natural width even when their own overflow hides them.
            // Otherwise the two toolbars can repeatedly take space from each other.
            const fixed = Number(header.dataset.utilityWidth) || [...header.querySelectorAll('.toolbar-fixed')].reduce((total, node) => total + node.getBoundingClientRect().width, 0);
            return Math.max(28, header.clientWidth - fixed - 12);
        }
        function renderGutters(bounds, rect) {
            const left = rect.left - 32, top = rect.top - 28;
            gutters.hidden = rect.bottom < bounds.top || rect.top > bounds.bottom;
            if (gutters.hidden) return;
            gutters.style.left = left + 'px'; gutters.style.top = top + 'px';
            gutters.style.width = (rect.width + 32) + 'px'; gutters.style.height = (rect.height + 28) + 'px';
            gutters.replaceChildren();
            const coordinate = (value, x, y, width, height, active) => {
                const node = document.createElement('span'); node.textContent = value; node.classList.toggle('is-active', active);
                Object.assign(node.style, { left: x + 'px', top: y + 'px', width: width + 'px', height: height + 'px' }); gutters.appendChild(node);
            };
            const letters = index => { let result = ''; for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result; return result; };
            for (const [index, heading] of [...table.rows[0].cells].entries()) {
                const box = heading.getBoundingClientRect();
                if (box.left >= rect.left - 1 && box.right <= rect.right + 1) coordinate(letters(index), box.left - left, 0, box.width, 28, index === cell.cellIndex);
            }
            for (const [index, row] of [...table.rows].entries()) {
                const box = row.getBoundingClientRect();
                if (box.top >= bounds.top && box.bottom <= bounds.bottom) coordinate(String(index + 1), 0, box.top - top, 32, box.height, index === cell.parentElement.rowIndex);
            }
        }
        function renderScrollHints() {
            for (const [target, hint] of scrollHints) {
                if (editor.contains(target)) continue;
                scrollResize.unobserve(target); hint.remove(); scrollHints.delete(target);
            }
            const viewport = wrapper.getBoundingClientRect();
            for (const target of editor.querySelectorAll('table')) {
                let hint = scrollHints.get(target);
                if (!hint) {
                    hint = document.createElement('div'); hint.className = 'table-scroll-hint';
                    hint.setAttribute('role', 'group'); hint.setAttribute('aria-label', label('tableScrollHint', 'Scroll columns'));
                    const title = document.createElement('span'); title.textContent = hint.getAttribute('aria-label'); hint.appendChild(title);
                    for (const [delta, key, fallback, symbol] of [[-1, 'tableScrollLeft', 'Scroll table left', '←'], [1, 'tableScrollRight', 'Scroll table right', '→']]) {
                        const button = document.createElement('button'); button.type = 'button'; button.textContent = symbol;
                        button.setAttribute('aria-label', label(key, fallback));
                        button.addEventListener('click', () => { target.scrollLeft += delta * Math.max(80, target.clientWidth * .65); schedule(); });
                        hint.appendChild(button);
                    }
                    hint.addEventListener('mousedown', event => event.preventDefault());
                    document.body.appendChild(hint); scrollHints.set(target, hint); scrollResize.observe(target);
                }
                const box = target.getBoundingClientRect();
                // A column's resize handle can extend a few pixels beyond a
                // fitted table. It does not make another column unreachable.
                hint.hidden = options.isSourceMode() || target.scrollWidth <= target.clientWidth + 4 || box.bottom + 32 > viewport.bottom || box.bottom < viewport.top || box.left >= viewport.right || box.right <= viewport.left;
                if (hint.hidden) continue;
                Object.assign(hint.style, { left: Math.max(viewport.left, box.left) + 'px', top: (box.bottom + 6) + 'px', width: Math.max(0, Math.min(viewport.right, box.right) - Math.max(viewport.left, box.left)) + 'px' });
                const buttons = hint.querySelectorAll('button');
                buttons[0].disabled = target.scrollLeft <= 1;
                buttons[1].disabled = target.scrollLeft >= target.scrollWidth - target.clientWidth - 1;
            }
        }
        function render() {
            renderScrollHints();
            if (valid()) {
                const bounds = wrapper.getBoundingClientRect(), rect = table.getBoundingClientRect(), selected = cell.getBoundingClientRect();
                document.documentElement.style.setProperty('--table-inspector-height', sizes[0].getBoundingClientRect().height + 'px');
                document.documentElement.style.setProperty('--table-inspector-width', sizes[1].getBoundingClientRect().width + 'px');
                renderGutters(bounds, rect);
                boundaries.hidden = rect.bottom < bounds.top || rect.top > bounds.bottom;
                if (!boundaries.hidden) {
                    const right = boundaries.children[0], below = boundaries.children[1];
                    right.style.left = (rect.right + 6) + 'px'; right.style.top = Math.max(bounds.top + 4, Math.min(selected.top + selected.height / 2 - 12, bounds.bottom - 28)) + 'px';
                    below.style.left = (rect.left - 30) + 'px'; below.style.top = (rect.bottom + 8) + 'px';
                    right.hidden = rect.right + 30 > Math.min(innerWidth, bounds.right);
                    below.hidden = rect.bottom + 32 > Math.min(innerHeight, bounds.bottom);
                }
            } else { boundaries.hidden = true; gutters.hidden = true; }
            if (!valid()) return clear();
            const palette = document.querySelector('.command-palette');
            if (palette?.getClientRects().length) return hide();
            updateDockHost(current === 'top-bar');
            const rect = wrapper.getBoundingClientRect();
            const wrapperStyle = getComputedStyle(wrapper);
            const laneLeft = parseFloat(wrapperStyle.marginLeft), laneRight = parseFloat(wrapperStyle.marginRight);
            const laneTop = parseFloat(wrapperStyle.marginTop);
            const left = Math.max(0, rect.left - laneLeft);
            const top = Math.max(0, rect.top - laneTop, header.getBoundingClientRect().bottom);
            const bounds = geometry.box(left, top,
                Math.max(0, Math.min(innerWidth, rect.left + wrapper.clientWidth + laneRight) - left),
                Math.max(0, Math.min(innerHeight, rect.top + wrapper.clientHeight) - top));
            if (pointerDown || hovering || owns(document.activeElement) || !picker.hidden) {
                // Keep the chosen placement stable during interaction, but never
                // strand a focused menu outside a pane that has just shrunk.
                if (controls.dataset.docked !== 'true' && controls.classList.contains('visible')) {
                    controls.style.maxWidth = Math.max(1, bounds.width - 12) + 'px';
                    controls.style.maxHeight = Math.max(1, bounds.height - 12) + 'px';
                    fitActions(Math.max(1, bounds.width - 12), Math.max(1, bounds.height - 12));
                    const size = controls.getBoundingClientRect();
                    controls.style.left = Math.max(bounds.left + 6, Math.min(size.left, bounds.right - size.width - 6)) + 'px';
                    controls.style.top = Math.max(bounds.top + 6, Math.min(size.top, bounds.bottom - size.height - 6)) + 'px';
                } else if (controls.dataset.docked === 'true') {
                    // Retain the current dock while interacting, reducing it to
                    // the overflow button if necessary instead of hiding focus.
                    const available = Math.max(44, dockWidth());
                    dock.style.maxWidth = controls.style.maxWidth = available + 'px';
                    fitActions(available, sizes[0].getBoundingClientRect().height);
                }
                if (!overflow.hidden) placeMenu(overflow, more);
                if (controls.getAttribute('role') === 'menu' && controls.contains(document.activeElement)) {
                    document.activeElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }
                if (!picker.hidden) placeMenu(picker, pickerAnchor.getClientRects().length ? pickerAnchor : more);
                return;
            }
            const horizontal = sizes[0].getBoundingClientRect(), vertical = sizes[1].getBoundingClientRect();
            const next = geometry.choose({ preference, table: table.getBoundingClientRect(), cell: cell.getBoundingClientRect(), bounds,
                horizontal, vertical, obstacles: obstacles(bounds), current, allowUndock: settled });
            // Explicit inspectors use reserved, non-editable lanes. The preference
            // stays unchanged while scrolling cannot clamp the panel over content.
            if (next.placement !== 'hidden' && next.placement !== 'top-bar') {
                if (laneTop && preference.startsWith('top-')) next.top = bounds.top + 6;
                if (laneLeft && preference === 'left') next.left = bounds.left + 6;
                if (laneRight && preference === 'right') next.left = bounds.right - next.width - 6;
            }
            current = next.placement;
            if (current === 'hidden') return hide();
            updateDockHost(current === 'top-bar');
            controls.dataset.placement = current;
            controls.dataset.vertical = String(Boolean(next.vertical));
            controls.setAttribute('aria-orientation', next.vertical ? 'vertical' : 'horizontal');
            controls.setAttribute('role', 'toolbar');
            controls.querySelectorAll('button').forEach(button => button.removeAttribute('role'));
            controls.classList.add('visible'); controls.hidden = false;
            controls.style.maxWidth = '';
            controls.style.maxHeight = '';
            let available = next.width;
            if (current === 'top-bar') {
                available = dockWidth();
                dock.hidden = false;
                dock.style.maxWidth = available + 'px';
                const dockStyle = getComputedStyle(sizes[2]);
                const minimumDock = sizes[2].querySelector('.table-direction-group').getBoundingClientRect().width
                    + parseFloat(getComputedStyle(more).width) + parseFloat(dockStyle.columnGap)
                    + parseFloat(dockStyle.paddingLeft) + parseFloat(dockStyle.paddingRight)
                    + parseFloat(dockStyle.borderLeftWidth) + parseFloat(dockStyle.borderRightWidth);
                const compact = available < minimumDock;
                toggle.hidden = !compact;
                if (compact) {
                    document.body.appendChild(controls);
                    controls.dataset.docked = 'false';
                    controls.classList.toggle('visible', menuOpen); controls.hidden = !menuOpen;
                    controls.dataset.vertical = 'true';
                    controls.setAttribute('role', 'menu');
                    controls.setAttribute('aria-orientation', 'vertical');
                    controls.querySelectorAll('button').forEach(button => button.setAttribute('role', 'menuitem'));
                    if (menuOpen) placeMenu(controls, toggle);
                } else {
                    dock.appendChild(controls);
                    controls.dataset.docked = 'true';
                    controls.style.maxWidth = available + 'px';
                }
            } else {
                dock.hidden = true;
                document.body.appendChild(controls);
                controls.dataset.docked = 'false';
                controls.style.left = next.left + 'px';
                controls.style.top = next.top + 'px';
                controls.style.maxWidth = next.width + 'px';
                controls.style.maxHeight = next.height + 'px';
            }
            fitActions(available, current === 'top-bar' ? innerHeight - 12 : next.height);
            options.onLayout();
        }

        const positionLabels = {
            auto: label('tablePositionAuto', 'Automatic (recommended)'), 'top-bar': label('tablePositionTopBar', 'Always in top bar'),
            'top-left': label('tablePositionTopLeft', 'Top left'), 'top-right': label('tablePositionTopRight', 'Top right'),
            'bottom-left': label('tablePositionBottomLeft', 'Bottom left'), 'bottom-right': label('tablePositionBottomRight', 'Bottom right'),
            left: label('tablePositionLeft', 'Left side (vertical)'), right: label('tablePositionRight', 'Right side (vertical)'),
        };
        function openPicker(fixed = false, anchor = pickerAnchor) {
            pickerAnchor = anchor;
            picker.replaceChildren();
            for (const value of fixed ? geometry.positions.slice(1, 7) : ['auto', 'top-bar', 'fixed']) {
                const button = document.createElement('button');
                button.type = 'button';
                button.dataset.position = value;
                button.textContent = value === 'fixed' ? label('tablePositionFixed', 'Choose a fixed position…') : positionLabels[value];
                button.setAttribute('role', value === 'fixed' ? 'menuitem' : 'menuitemradio');
                if (value !== 'fixed') button.setAttribute('aria-checked', String(value === preference));
                button.tabIndex = -1;
                picker.appendChild(button);
            }
            picker.hidden = false;
            controls.querySelector('[data-action="placement"]').setAttribute('aria-expanded', 'true');
            anchor.setAttribute('aria-expanded', 'true');
            placeMenu(picker, anchor);
            picker.firstElementChild.tabIndex = 0;
            picker.firstElementChild.focus({ preventScroll: true });
        }
        for (const node of [controls, dock, picker, overflow, boundaries]) {
            listen(node, 'mousedown', event => { if (!event.target.closest('select')) event.preventDefault(); event.stopPropagation(); });
            listen(node, 'click', event => event.stopPropagation());
        }
        function activate(event) {
            const button = event.target.closest('button');
            if (!button || button.disabled || !valid()) return;
            if (button === more) {
                overflow.hidden = !overflow.hidden;
                more.setAttribute('aria-expanded', String(!overflow.hidden));
                if (!overflow.hidden) {
                    overflow.scrollTop = 0;
                    placeMenu(overflow, more);
                    overflowActions.find(action => !action.hidden && !action.disabled)?.focus({ preventScroll: true });
                } else more.focus({ preventScroll: true });
                return;
            }
            if (button.dataset.action === 'placement') return openPicker(false, button);
            closeMenus();
            if (boundaries.contains(button)) {
                const edge = button.dataset.action === 'add-col-right' ? table.rows[cell.parentElement.rowIndex].cells[table.rows[0].cells.length - 1] : table.rows[table.rows.length - 1].cells[cell.cellIndex];
                savedRange = null; options.onContext(edge); show(table, edge);
            }
            restore();
            options.onAction(button.dataset.action);
            schedule();
        }
        listen(controls, 'click', activate);
        listen(boundaries, 'click', activate);
        listen(overflow, 'click', activate);
        listen(picker, 'click', event => {
            const value = event.target.closest('button')?.dataset.position;
            if (!value) return;
            if (value === 'fixed') return openPicker(true);
            closeMenus();
            restore();
            options.onPreference(value);
        });
        listen(toggle, 'click', () => {
            if (!valid()) return;
            menuOpen = !menuOpen;
            toggle.setAttribute('aria-expanded', String(menuOpen));
            controls.classList.toggle('visible', menuOpen); controls.hidden = !menuOpen;
            if (menuOpen) { placeMenu(controls, toggle); controls.querySelector('button').focus({ preventScroll: true }); }
        });
        function keyboard(event) {
            if (event.target.closest('select')) return;
            const container = picker.contains(event.target) ? picker : overflow.contains(event.target) ? overflow : controls;
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenus(); restore(true); hovering = false; schedule(); return; }
            const vertical = container !== controls || controls.dataset.vertical === 'true';
            const nextKey = vertical ? 'ArrowDown' : 'ArrowRight', previousKey = vertical ? 'ArrowUp' : 'ArrowLeft';
            if (![nextKey, previousKey, 'Home', 'End'].includes(event.key)) return;
            const buttons = [...container.querySelectorAll('button:not(:disabled):not([hidden])')];
            const index = buttons.indexOf(document.activeElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
                (index + (event.key === nextKey ? 1 : -1) + buttons.length) % buttons.length;
            event.preventDefault(); event.stopPropagation();
            buttons.forEach((button, i) => { button.tabIndex = i === next ? 0 : -1; });
            buttons[next].focus({ preventScroll: true });
            if (container !== controls || controls.getAttribute('role') === 'menu') buttons[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        listen(controls, 'keydown', keyboard);
        listen(picker, 'keydown', keyboard);
        listen(overflow, 'keydown', keyboard);
        for (const node of [controls, dock, picker, overflow]) listen(node, 'focusout', () => queueMicrotask(() => {
            if (!owns(document.activeElement)) { closeMenus(); schedule(); }
        }));
        listen(document, 'keydown', event => {
            if (event.altKey && event.key === 'F10' && valid()) {
                event.preventDefault();
                // Selection and resize updates normally render next frame. A
                // keyboard command can arrive first; hidden buttons cannot focus.
                render();
                (dock.hidden || toggle.hidden ? controls.querySelector('button:not([hidden]):not(:disabled)') : toggle)?.focus({ preventScroll: true });
            }
        });
        listen(controls, 'pointerenter', () => { hovering = true; });
        listen(controls, 'pointerleave', () => { hovering = false; schedule(); });
        listen(document, 'pointerdown', event => {
            pointerDown = owns(event.target);
            if (!pointerDown) { closeMenus(); if (!editor.contains(event.target) && !header.contains(event.target)) clear(); }
        }, true);
        listen(document, 'pointerup', () => { pointerDown = false; schedule(); }, true);
        listen(document, 'selectionchange', () => {
            if (owns(document.activeElement) || pointerDown) return;
            const node = window.getSelection()?.anchorNode;
            const selected = (node?.nodeType === 3 ? node.parentElement : node)?.closest?.('td, th');
            if (selected && editor.contains(selected) && !options.isSourceMode()) {
                options.onContext(selected);
                show(selected.closest('table'), selected);
            } else clear();
        });
        listen(document, 'focusin', event => {
            if (owns(event.target)) return;
            if (!editor.contains(event.target) && !header.contains(event.target)) clear();
            else schedule();
        });
        listen(window, 'scroll', event => { if (!owns(event.target)) schedule(); }, true);
        listen(window, 'resize', schedule);
        listen(editor, 'load', schedule, true);
        function dispose() {
            disposed = true;
            cancelAnimationFrame(frame); clearTimeout(settleTimer);
            resize.disconnect(); scrollResize.disconnect(); mutations.disconnect(); listeners.forEach(remove => remove());
            for (const hint of scrollHints.values()) hint.remove();
            scrollHints.clear();
            [controls, dock, row, picker, overflow, boundaries, gutters, ...sizes].forEach(node => node.remove());
        }
        listen(window, 'pagehide', dispose);
        request();
        return { show, clear, schedule, dispose, owns, setPreference(value) {
            preference = geometry.normalize(value);
            document.documentElement.dataset.tableToolbarPosition = preference;
            current = null; hovering = false; closeMenus(); schedule();
        } };
    }
})();
