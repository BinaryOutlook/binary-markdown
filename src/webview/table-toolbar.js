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
        const listen = (node, type, handler, capture = false) => {
            node.addEventListener(type, handler, capture);
            listeners.push(() => node.removeEventListener(type, handler, capture));
        };
        const controls = document.createElement('div');
        controls.className = 'table-toolbar';
        controls.setAttribute('role', 'toolbar');
        controls.setAttribute('aria-label', label('tableControls', 'Table controls'));
        const items = [
            ['add-col-left', 'addColLeft', 'Insert column left', '←Col'],
            ['add-col-right', 'addColRight', 'Insert column right', 'Col→'],
            ['del-col', 'deleteCol', 'Delete column'], null,
            ['add-row-above', 'addRowAbove', 'Insert row above', '↑Row'],
            ['add-row-below', 'addRowBelow', 'Insert row below', 'Row↓'],
            ['del-row', 'deleteRow', 'Delete row'], null,
            ['align-left', 'alignLeft', 'Align left'], ['align-center', 'alignCenter', 'Align center'],
            ['align-right', 'alignRight', 'Align right'], null,
            ['placement', 'tablePlacement', 'Table toolbar position', '⋯'],
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
            controls.appendChild(button);
        }
        controls.querySelector('button').tabIndex = 0;
        document.body.appendChild(controls);
        const dock = document.createElement('div');
        dock.className = 'table-toolbar-dock';
        dock.hidden = true;
        header.insertBefore(dock, header.querySelector('.toolbar-fixed--right'));
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'table-toolbar-toggle';
        toggle.textContent = label('tableMenu', 'Table…');
        toggle.setAttribute('aria-label', label('tableControls', 'Table controls'));
        toggle.setAttribute('aria-haspopup', 'menu');
        toggle.setAttribute('aria-expanded', 'false');
        dock.appendChild(toggle);
        const picker = document.createElement('div');
        picker.className = 'table-placement-menu';
        picker.setAttribute('role', 'menu');
        picker.setAttribute('aria-label', label('tablePlacement', 'Table toolbar position'));
        picker.hidden = true;
        document.body.appendChild(picker);
        const sizes = [false, true].map(vertical => {
            const clone = controls.cloneNode(true);
            clone.className = 'table-toolbar visible table-toolbar-measure';
            clone.dataset.vertical = String(vertical);
            clone.setAttribute('aria-hidden', 'true');
            clone.inert = true;
            document.body.appendChild(clone);
            return clone;
        });
        const resize = new ResizeObserver(() => schedule());
        for (const element of new Set([editor, wrapper, header])) resize.observe(element);
        const mutations = new MutationObserver(() => schedule());
        mutations.observe(editor, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });

        function owns(node) { return controls.contains(node) || dock.contains(node) || picker.contains(node); }
        function valid() { return table && cell && editor.contains(table) && table.contains(cell) && !options.isSourceMode(); }
        function closeMenus() {
            picker.hidden = true;
            menuOpen = false;
            if (current === 'top-bar' && !toggle.hidden) controls.classList.remove('visible');
            toggle.setAttribute('aria-expanded', 'false');
            controls.querySelector('[data-action="placement"]').setAttribute('aria-expanded', 'false');
        }
        function hide() {
            closeMenus();
            controls.classList.remove('visible');
            dock.hidden = true;
        }
        function clear() {
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
            const headerRow = cell.parentElement === table.rows[0];
            controls.querySelector('[data-action="add-row-above"]').disabled = headerRow;
            controls.querySelector('[data-action="del-row"]').disabled = headerRow;
            controls.querySelector('[data-action="del-col"]').disabled = table.rows[0].cells.length <= 1;
            const selection = window.getSelection();
            if (selection.rangeCount && cell.contains(selection.anchorNode)) savedRange = selection.getRangeAt(0).cloneRange();
            schedule();
        }
        function restore() {
            if (!valid()) return;
            editor.focus({ preventScroll: true });
            const range = savedRange && cell.contains(savedRange.startContainer) ? savedRange : document.createRange();
            if (range !== savedRange) { range.selectNodeContents(cell); range.collapse(false); }
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
        function schedule() {
            if (disposed || !table) return;
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
        function render() {
            if (!valid()) return clear();
            const palette = document.querySelector('.command-palette');
            if (palette?.getClientRects().length) return hide();
            const rect = wrapper.getBoundingClientRect();
            const top = Math.max(0, rect.top, header.getBoundingClientRect().bottom);
            const bounds = geometry.box(Math.max(0, rect.left), top,
                Math.max(0, Math.min(innerWidth, rect.left + wrapper.clientWidth) - Math.max(0, rect.left)),
                Math.max(0, Math.min(innerHeight, rect.top + wrapper.clientHeight) - top));
            if (pointerDown || hovering || owns(document.activeElement) || !picker.hidden) {
                // Keep the chosen placement stable during interaction, but never
                // strand a focused menu outside a pane that has just shrunk.
                if (controls.dataset.docked !== 'true' && controls.classList.contains('visible')) {
                    controls.style.maxWidth = Math.max(1, bounds.width - 12) + 'px';
                    controls.style.maxHeight = Math.max(1, bounds.height - 12) + 'px';
                    const size = controls.getBoundingClientRect();
                    controls.style.left = Math.max(bounds.left + 6, Math.min(size.left, bounds.right - size.width - 6)) + 'px';
                    controls.style.top = Math.max(bounds.top + 6, Math.min(size.top, bounds.bottom - size.height - 6)) + 'px';
                }
                if (!picker.hidden) placeMenu(picker, controls.querySelector('[data-action="placement"]'));
                return;
            }
            const horizontal = sizes[0].getBoundingClientRect(), vertical = sizes[1].getBoundingClientRect();
            const next = geometry.choose({ preference, table: table.getBoundingClientRect(), cell: cell.getBoundingClientRect(), bounds,
                horizontal, vertical, obstacles: obstacles(bounds), current, allowUndock: settled });
            current = next.placement;
            if (current === 'hidden') return hide();
            controls.dataset.placement = current;
            controls.dataset.vertical = String(Boolean(next.vertical));
            controls.setAttribute('aria-orientation', next.vertical ? 'vertical' : 'horizontal');
            controls.setAttribute('role', 'toolbar');
            controls.querySelectorAll('button').forEach(button => button.removeAttribute('role'));
            controls.classList.add('visible');
            controls.style.maxWidth = '';
            controls.style.maxHeight = '';
            if (current === 'top-bar') {
                const fixed = [...header.querySelectorAll('.toolbar-fixed')].reduce((total, node) => total + node.getBoundingClientRect().width, 0);
                const reserve = document.documentElement.dataset.toolbarMode === 'simple' ? 12 : 296;
                const available = Math.max(28, header.clientWidth - fixed - reserve);
                dock.hidden = false;
                dock.style.maxWidth = available + 'px';
                const compact = horizontal.width > available;
                toggle.hidden = !compact;
                if (compact) {
                    document.body.appendChild(controls);
                    controls.dataset.docked = 'false';
                    controls.classList.toggle('visible', menuOpen);
                    controls.dataset.vertical = 'true';
                    controls.setAttribute('role', 'menu');
                    controls.setAttribute('aria-orientation', 'vertical');
                    controls.querySelectorAll('button').forEach(button => button.setAttribute('role', 'menuitem'));
                    if (menuOpen) placeMenu(controls, toggle);
                } else {
                    dock.appendChild(controls);
                    controls.dataset.docked = 'true';
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
            options.onLayout();
        }

        const positionLabels = {
            auto: label('tablePositionAuto', 'Automatic (recommended)'), 'top-bar': label('tablePositionTopBar', 'Always in top bar'),
            'top-left': label('tablePositionTopLeft', 'Top left'), 'top-right': label('tablePositionTopRight', 'Top right'),
            'bottom-left': label('tablePositionBottomLeft', 'Bottom left'), 'bottom-right': label('tablePositionBottomRight', 'Bottom right'),
            left: label('tablePositionLeft', 'Left side (vertical)'), right: label('tablePositionRight', 'Right side (vertical)'),
        };
        function openPicker(fixed = false) {
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
            placeMenu(picker, controls.querySelector('[data-action="placement"]'));
            picker.firstElementChild.tabIndex = 0;
            picker.firstElementChild.focus({ preventScroll: true });
        }
        for (const node of [controls, dock, picker]) {
            listen(node, 'mousedown', event => { event.preventDefault(); event.stopPropagation(); });
            listen(node, 'click', event => event.stopPropagation());
        }
        listen(controls, 'click', event => {
            const button = event.target.closest('button');
            if (!button || button.disabled || !valid()) return;
            if (button.dataset.action === 'placement') return openPicker();
            closeMenus();
            restore();
            options.onAction(button.dataset.action);
            schedule();
        });
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
            controls.classList.toggle('visible', menuOpen);
            if (menuOpen) { placeMenu(controls, toggle); controls.querySelector('button').focus({ preventScroll: true }); }
        });
        function keyboard(event) {
            const container = picker.contains(event.target) ? picker : controls;
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenus(); restore(); hovering = false; schedule(); return; }
            const vertical = container === picker || controls.dataset.vertical === 'true';
            const nextKey = vertical ? 'ArrowDown' : 'ArrowRight', previousKey = vertical ? 'ArrowUp' : 'ArrowLeft';
            if (![nextKey, previousKey, 'Home', 'End'].includes(event.key)) return;
            const buttons = [...container.querySelectorAll('button:not(:disabled)')];
            const index = buttons.indexOf(document.activeElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
                (index + (event.key === nextKey ? 1 : -1) + buttons.length) % buttons.length;
            event.preventDefault(); event.stopPropagation();
            buttons.forEach((button, i) => { button.tabIndex = i === next ? 0 : -1; });
            buttons[next].focus({ preventScroll: true });
        }
        listen(controls, 'keydown', keyboard);
        listen(picker, 'keydown', keyboard);
        for (const node of [controls, dock, picker]) listen(node, 'focusout', () => queueMicrotask(() => {
            if (!owns(document.activeElement)) { closeMenus(); schedule(); }
        }));
        listen(document, 'keydown', event => {
            if (event.altKey && event.key === 'F10' && valid()) {
                event.preventDefault();
                (dock.hidden || toggle.hidden ? controls.querySelector('button') : toggle).focus({ preventScroll: true });
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
            resize.disconnect(); mutations.disconnect(); listeners.forEach(remove => remove());
            [controls, dock, picker, ...sizes].forEach(node => node.remove());
        }
        listen(window, 'pagehide', dispose);
        return { show, clear, schedule, dispose, owns, setPreference(value) {
            preference = geometry.normalize(value);
            document.documentElement.dataset.tableToolbarPosition = preference;
            current = null; hovering = false; closeMenus(); schedule();
        } };
    }
})();
