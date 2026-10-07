'use strict';
// Construction defines capabilities; bootstrap controls the original initialization order.
function createTables(dependencies) {
    let activeTableCell, activeTable, tableControls, isTableColResizing, resizeStartX, resizeStartWidth, resizingCell, resizingTable;
    // ========== TABLE FUNCTIONALITY ==========
    function revealTableCaret(element) {
        const cell = element.closest?.('td, th');
        if (!cell || !dependencies.editor.contains(cell))
            return;
        cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        scrollTableToCaret(cell);
    }
    function scrollTableToCaret(cell, previousWidth) {
        const table = cell.closest('table');
        const selection = window.getSelection();
        if (!table || !dependencies.editor.contains(cell) || !table.clientWidth || !selection?.isCollapsed || !selection.rangeCount || !cell.contains(selection.anchorNode))
            return;
        const caret = selection.getRangeAt(0).getBoundingClientRect();
        if (!caret.height && !caret.width)
            return;
        const bounds = table.getBoundingClientRect();
        // A single unbroken cell can be wider than the pane: reveal its caret,
        // rather than repeatedly aligning the cell's other edge with the pane.
        const left = bounds.left + table.clientLeft;
        const right = left + table.clientWidth;
        // Resize correction is only for a caret newly clipped by shrinkage.
        // A caret already outside the old viewport may have been deliberately
        // scrolled away; neither shrinking nor growing should pull it back.
        if (previousWidth !== undefined && (table.clientWidth >= previousWidth ||
            caret.left < left - 1 || caret.right > left + previousWidth + 1))
            return;
        if (caret.left < left + 2)
            table.scrollLeft -= left + 2 - caret.left;
        else if (caret.right > right - 2)
            table.scrollLeft += caret.right - right + 2;
    }
    function showTableToolbar(table) {
        activeTable = table;
        tableControls.show(table, activeTableCell);
    }
    function hideTableToolbar() {
        tableControls?.clear();
    }
    function deleteTableColumn() {
        if (!activeTableCell || !activeTable)
            return;
        // Verify elements are still in DOM
        if (!dependencies.editor.contains(activeTableCell) || !dependencies.editor.contains(activeTable)) {
            dependencies.logger.log('Table elements not in DOM, skipping deleteTableColumn');
            return;
        }
        const cellIndex = activeTableCell.cellIndex;
        if (cellIndex < 0)
            return;
        const currentRow = activeTableCell.closest('tr');
        if (!currentRow)
            return;
        const rows = activeTable.querySelectorAll('tr');
        // Don't delete if only one column
        if (rows[0] && rows[0].cells.length <= 1)
            return;
        // Store rowIndex before deleting
        const rowIndex = Array.from(rows).indexOf(currentRow);
        rows.forEach(row => {
            if (row.cells[cellIndex]) {
                row.cells[cellIndex].remove();
            }
        });
        // Move activeTableCell to adjacent cell in the SAME row
        const updatedRows = activeTable.querySelectorAll('tr');
        const targetRow = updatedRows[rowIndex];
        if (targetRow && targetRow.cells.length > 0) {
            // Stay in the same row, move to left (new last column if was at end)
            const newIndex = Math.min(cellIndex, targetRow.cells.length - 1);
            if (newIndex >= 0 && targetRow.cells[newIndex]) {
                activeTableCell = targetRow.cells[newIndex];
                dependencies.setCursorToEnd(activeTableCell);
            }
        }
        dependencies.syncMarkdown();
    }
    function deleteTableRow() {
        if (!activeTableCell || !activeTable)
            return;
        // Verify elements are still in DOM
        if (!dependencies.editor.contains(activeTableCell) || !dependencies.editor.contains(activeTable)) {
            dependencies.logger.log('Table elements not in DOM, skipping deleteTableRow');
            return;
        }
        const row = activeTableCell.closest('tr');
        if (!row)
            return;
        // Don't delete header row or if only one row
        const rows = activeTable.querySelectorAll('tr');
        if (rows.length <= 1)
            return;
        if (row === rows[0])
            return; // Don't delete header
        const rowIndex = Array.from(rows).indexOf(row);
        const cellIndex = activeTableCell.cellIndex;
        if (cellIndex < 0)
            return;
        row.remove();
        // Move activeTableCell to adjacent row
        const newRows = activeTable.querySelectorAll('tr');
        if (newRows.length > 0) {
            // Try to select same column in previous row (or the row above deleted one)
            // If was last row, go to new last row
            const newRowIndex = Math.min(rowIndex, newRows.length - 1);
            // Prefer row above if not header
            const targetRowIndex = newRowIndex > 0 ? Math.max(1, rowIndex - 1) : newRowIndex;
            const newRow = newRows[targetRowIndex] || newRows[newRowIndex];
            if (newRow && newRow.cells[cellIndex]) {
                activeTableCell = newRow.cells[cellIndex];
                dependencies.setCursorToEnd(activeTableCell);
            }
            else if (newRow && newRow.cells[0]) {
                activeTableCell = newRow.cells[0];
                dependencies.setCursorToEnd(activeTableCell);
            }
        }
        dependencies.syncMarkdown();
    }
    function insertTableRowBelow() {
        if (!activeTableCell)
            return;
        // Verify activeTableCell is still in DOM
        if (!dependencies.editor.contains(activeTableCell)) {
            dependencies.logger.log('activeTableCell not in DOM, skipping insertTableRowBelow');
            return;
        }
        const row = activeTableCell.closest('tr');
        if (!row)
            return;
        const table = row.closest('table');
        if (!table || !dependencies.editor.contains(table))
            return;
        const colCount = row.cells.length;
        if (colCount === 0)
            return;
        const newRow = document.createElement('tr');
        for (let i = 0; i < colCount; i++) {
            const cell = document.createElement('td');
            cell.setAttribute('contenteditable', 'true');
            cell.innerHTML = dependencies.emptyTableCell;
            newRow.appendChild(cell);
        }
        row.after(newRow);
        // Update activeTableCell to the new row's cell at same column
        const cellIndex = activeTableCell.cellIndex;
        activeTableCell = newRow.cells[cellIndex] || newRow.cells[0];
        activeTable = table;
        dependencies.setCursorToEnd(activeTableCell);
        dependencies.syncMarkdown();
    }
    function insertTableRowAbove() {
        if (!activeTableCell)
            return;
        // Verify activeTableCell is still in DOM
        if (!dependencies.editor.contains(activeTableCell)) {
            dependencies.logger.log('activeTableCell not in DOM, skipping insertTableRowAbove');
            return;
        }
        const row = activeTableCell.closest('tr');
        if (!row)
            return;
        const table = row.closest('table');
        if (!table || !dependencies.editor.contains(table))
            return;
        // Check if current row is header row (first row)
        const rows = table.querySelectorAll('tr');
        const isHeaderRow = rows.length > 0 && row === rows[0];
        if (isHeaderRow) {
            dependencies.logger.log('Cannot insert row above header row');
            return; // Do nothing if in header row
        }
        const colCount = row.cells.length;
        if (colCount === 0)
            return;
        const newRow = document.createElement('tr');
        for (let i = 0; i < colCount; i++) {
            const cell = document.createElement('td');
            cell.setAttribute('contenteditable', 'true');
            cell.innerHTML = dependencies.emptyTableCell;
            newRow.appendChild(cell);
        }
        row.before(newRow);
        // Update activeTableCell to the new row's cell at same column
        const cellIndex = activeTableCell.cellIndex;
        activeTableCell = newRow.cells[cellIndex] || newRow.cells[0];
        activeTable = table;
        dependencies.setCursorToEnd(activeTableCell);
        dependencies.syncMarkdown();
    }
    function insertTableColumnRight() {
        if (!activeTableCell)
            return;
        // Verify activeTableCell is still in DOM
        if (!dependencies.editor.contains(activeTableCell)) {
            dependencies.logger.log('activeTableCell not in DOM, skipping insertTableColumnRight');
            return;
        }
        const table = activeTableCell.closest('table');
        if (!table || !dependencies.editor.contains(table))
            return;
        const cellIndex = activeTableCell.cellIndex;
        if (cellIndex < 0)
            return; // Invalid cell index
        const currentRow = activeTableCell.closest('tr');
        if (!currentRow)
            return;
        const rows = table.querySelectorAll('tr');
        if (rows.length === 0)
            return;
        // Store current row index for later lookup
        const currentRowIndex = Array.from(rows).indexOf(currentRow);
        let newCellInCurrentRow = null;
        rows.forEach((row, rowIndex) => {
            const isHeader = rowIndex === 0;
            const newCell = document.createElement(isHeader ? 'th' : 'td');
            newCell.setAttribute('contenteditable', 'true');
            newCell.innerHTML = isHeader ? 'Header' : dependencies.emptyTableCell;
            // Insert after current cell (to the right)
            if (cellIndex + 1 < row.cells.length) {
                row.cells[cellIndex + 1].before(newCell);
            }
            else {
                row.appendChild(newCell);
            }
            // Track the new cell in current row
            if (rowIndex === currentRowIndex) {
                newCellInCurrentRow = newCell;
            }
        });
        // Move cursor to the new column in current row
        if (newCellInCurrentRow && dependencies.editor.contains(newCellInCurrentRow)) {
            activeTableCell = newCellInCurrentRow;
            activeTable = table;
            dependencies.setCursorToEnd(newCellInCurrentRow);
        }
        // Re-add resize handles after adding column
        addTableResizeHandles(table);
        dependencies.syncMarkdown();
    }
    function insertTableColumnLeft() {
        if (!activeTableCell)
            return;
        // Verify activeTableCell is still in DOM
        if (!dependencies.editor.contains(activeTableCell)) {
            dependencies.logger.log('activeTableCell not in DOM, skipping insertTableColumnLeft');
            return;
        }
        const table = activeTableCell.closest('table');
        if (!table || !dependencies.editor.contains(table))
            return;
        const cellIndex = activeTableCell.cellIndex;
        if (cellIndex < 0)
            return; // Invalid cell index
        const currentRow = activeTableCell.closest('tr');
        if (!currentRow)
            return;
        const rows = table.querySelectorAll('tr');
        if (rows.length === 0)
            return;
        // Store current row index for later lookup
        const currentRowIndex = Array.from(rows).indexOf(currentRow);
        let newCellInCurrentRow = null;
        rows.forEach((row, rowIndex) => {
            const isHeader = rowIndex === 0;
            const newCell = document.createElement(isHeader ? 'th' : 'td');
            newCell.setAttribute('contenteditable', 'true');
            newCell.innerHTML = isHeader ? 'Header' : dependencies.emptyTableCell;
            // Insert before current cell (to the left)
            row.cells[cellIndex].before(newCell);
            // Track the new cell in current row
            if (rowIndex === currentRowIndex) {
                newCellInCurrentRow = newCell;
            }
        });
        // Move cursor to the new column in current row
        if (newCellInCurrentRow && dependencies.editor.contains(newCellInCurrentRow)) {
            activeTableCell = newCellInCurrentRow;
            activeTable = table;
            dependencies.setCursorToEnd(newCellInCurrentRow);
        }
        // Re-add resize handles after adding column
        addTableResizeHandles(table);
        dependencies.syncMarkdown();
    }
    // Set column alignment for the current column
    function setColumnAlignment(align) {
        if (!activeTableCell || !activeTable)
            return;
        // Verify elements are still in DOM
        if (!dependencies.editor.contains(activeTableCell) || !dependencies.editor.contains(activeTable)) {
            dependencies.logger.log('Table elements not in DOM, skipping setColumnAlignment');
            return;
        }
        const colIndex = activeTableCell.cellIndex;
        if (colIndex < 0)
            return;
        // Markdown column alignment applies to the header and body alike.
        const rows = activeTable.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('th, td');
            if (cells[colIndex]) {
                cells[colIndex].dataset.tableAlign = align;
                cells[colIndex].style.textAlign = align;
            }
        });
        dependencies.syncMarkdown();
    }
    // Add resize handles to all header cells in a table
    function addTableResizeHandles(table) {
        if (!table)
            return;
        const headerCells = table.querySelectorAll('th');
        headerCells.forEach((th, index) => {
            // Skip if already has a resize handle
            if (th.querySelector('.table-col-resize-handle'))
                return;
            const handle = document.createElement('div');
            handle.className = 'table-col-resize-handle';
            handle.setAttribute('contenteditable', 'false');
            handle.dataset.colIndex = index.toString();
            th.appendChild(handle);
        });
        // Don't initialize widths here - let browser handle natural widths
        // Widths will be set when user starts resizing
    }
    // Initialize column widths when starting resize (called on first resize)
    function initializeTableColumnWidths(table) {
        const headerCells = table.querySelectorAll('th');
        if (headerCells.length === 0)
            return;
        // Skip if already initialized (has fixed layout)
        if (table.style.tableLayout === 'fixed')
            return;
        // Get current natural widths before switching to fixed layout
        const widths = [];
        headerCells.forEach(th => {
            // Use offsetWidth which includes padding and border
            widths.push(Math.max(th.offsetWidth, 80)); // Ensure minimum width
        });
        // Now set table-layout: fixed and apply the widths
        table.style.tableLayout = 'fixed';
        let totalWidth = 0;
        headerCells.forEach((th, index) => {
            th.style.width = widths[index] + 'px';
            th.style.minWidth = widths[index] + 'px';
            totalWidth += widths[index];
        });
        // Set table width to sum of column widths
        table.style.width = totalWidth + 'px';
        // Also set widths for td cells in each column
        const rows = table.querySelectorAll('tr');
        rows.forEach((row, rowIndex) => {
            if (rowIndex === 0)
                return; // Skip header row
            const cells = row.querySelectorAll('td');
            cells.forEach((td, colIndex) => {
                if (widths[colIndex]) {
                    td.style.width = widths[colIndex] + 'px';
                    td.style.minWidth = widths[colIndex] + 'px';
                }
            });
        });
    }
    // Update column width for all cells in a column
    function updateColumnWidth(table, colIndex, newWidth) {
        const minWidth = 80; // Minimum column width
        const finalWidth = Math.max(minWidth, newWidth);
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('th, td');
            if (cells[colIndex]) {
                cells[colIndex].style.width = finalWidth + 'px';
                // The table is a scroll box; retain the requested width in its
                // anonymous inner table even when the visible box is narrower.
                cells[colIndex].style.minWidth = finalWidth + 'px';
            }
        });
        // Update table width to be sum of all column widths
        const headerCells = table.querySelectorAll('th');
        let totalWidth = 0;
        headerCells.forEach(th => {
            totalWidth += th.offsetWidth;
        });
        table.style.width = totalWidth + 'px';
    }
    // Handle resize start
    function handleResizeStart(e) {
        const handle = e.target.closest('.table-col-resize-handle');
        if (!handle)
            return;
        e.preventDefault();
        e.stopPropagation();
        resizingCell = handle.closest('th');
        resizingTable = handle.closest('table');
        // Initialize column widths on first resize
        if (resizingTable) {
            initializeTableColumnWidths(resizingTable);
        }
        isTableColResizing = true;
        resizeStartX = e.clientX;
        if (resizingCell) {
            resizeStartWidth = resizingCell.offsetWidth;
        }
        handle.classList.add('resizing');
        document.body.classList.add('table-resizing');
        // Add document-level listeners for drag
        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
    }
    // Handle resize drag
    function handleResizeMove(e) {
        if (!isTableColResizing || !resizingCell || !resizingTable)
            return;
        e.preventDefault();
        const deltaX = e.clientX - resizeStartX;
        const newWidth = resizeStartWidth + deltaX;
        const colIndex = parseInt(resizingCell.querySelector('.table-col-resize-handle')?.dataset.colIndex || '0');
        updateColumnWidth(resizingTable, colIndex, newWidth);
    }
    // Handle resize end
    function handleResizeEnd(e) {
        if (!isTableColResizing)
            return;
        isTableColResizing = false;
        // Remove resizing class from handle
        if (resizingCell) {
            const handle = resizingCell.querySelector('.table-col-resize-handle');
            if (handle) {
                handle.classList.remove('resizing');
            }
        }
        document.body.classList.remove('table-resizing');
        // Remove document-level listeners
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        resizingCell = null;
        resizingTable = null;
    }
    // Add resize handles to all existing tables
    function initializeAllTableResizeHandles() {
        dependencies.editor.querySelectorAll('table').forEach(table => {
            addTableResizeHandles(table);
        });
    }
    let initializeActiveTableCellDone = false;
    function initializeActiveTableCell() {
        if (initializeActiveTableCellDone)
            return;
        initializeActiveTableCellDone = true;
        (activeTableCell = null);
        (activeTable = null);
        (tableControls = window.BinaryTableToolbar.create({
            editor: dependencies.editor, header: dependencies.toolbar, messages: dependencies.i18n, icons: dependencies.LUCIDE_ICONS,
            isSourceMode: () => dependencies.isSourceMode,
            onContext(cell) { activeTableCell = cell; activeTable = cell?.closest('table') || null; },
            onReveal: revealTableCaret,
            onTableResize(table, previousWidth) {
                if (dependencies.isSourceMode || isTableColResizing || document.activeElement !== dependencies.editor)
                    return;
                const node = window.getSelection()?.anchorNode;
                const cell = (node?.nodeType === 3 ? node.parentElement : node)?.closest?.('td, th');
                // Late docking/scrollbar layout can clip a caret already revealed
                // by navigation. Correct only horizontal scroll, never focus or range.
                if (cell?.closest('table') === table)
                    scrollTableToCaret(cell, previousWidth);
            },
            onLayout: dependencies.scheduleToolbarLayout,
            onPreference(value) { dependencies.host.setTableToolbarPosition?.(value); },
            onAction(action) {
                if (!activeTableCell || !dependencies.editor.contains(activeTableCell))
                    return;
                dependencies.markdown = dependencies.readCommittedMarkdown();
                dependencies.undoManager.saveSnapshot();
                switch (action) {
                    case 'add-col-left':
                        insertTableColumnLeft();
                        break;
                    case 'add-col-right':
                        insertTableColumnRight();
                        break;
                    case 'del-col':
                        deleteTableColumn();
                        break;
                    case 'add-row-above':
                        insertTableRowAbove();
                        break;
                    case 'add-row-below':
                        insertTableRowBelow();
                        break;
                    case 'del-row':
                        deleteTableRow();
                        break;
                    case 'align-left':
                        setColumnAlignment('left');
                        break;
                    case 'align-center':
                        setColumnAlignment('center');
                        break;
                    case 'align-right':
                        setColumnAlignment('right');
                        break;
                }
                showTableToolbar(activeTable);
            }
        }));
        (isTableColResizing = false);
        (resizeStartX = 0);
        (resizeStartWidth = 0);
        (resizingCell = null);
        (resizingTable = null);
        dependencies.editor.addEventListener('mousedown', function (e) {
            const handle = e.target.closest('.table-col-resize-handle');
            if (handle) {
                handleResizeStart(e);
            }
        });
        initializeAllTableResizeHandles();
        dependencies.editor.addEventListener('focusin', function (e) {
            const cell = e.target.closest ? e.target.closest('th, td') : null;
            if (cell && dependencies.editor.contains(cell)) {
                activeTableCell = cell;
                const table = cell.closest('table');
                if (table) {
                    showTableToolbar(table);
                }
            }
        });
        dependencies.editor.addEventListener('click', function (e) {
            if (e.target.closest && e.target.closest('.front-matter'))
                return;
            const cell = e.target.closest ? e.target.closest('th, td') : null;
            if (cell && dependencies.editor.contains(cell)) {
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
                    dependencies.logger.log('Triple-click: Selected all in table cell');
                }
            }
            else {
                // Clicked outside table - hide toolbar
                hideTableToolbar();
            }
            // Handle code block edit mode exit on click outside
            const clickedPre = e.target.closest ? e.target.closest('pre') : null;
            dependencies.editor.querySelectorAll('pre[data-mode="edit"]').forEach(pre => {
                if (pre !== clickedPre) {
                    dependencies.enterDisplayMode(pre);
                }
            });
            // Handle mermaid/math wrapper edit mode exit on click outside
            const clickedSpecialWrapper = e.target.closest ? (e.target.closest('.mermaid-wrapper') || e.target.closest('.math-wrapper')) : null;
            dependencies.editor.querySelectorAll('.mermaid-wrapper[data-mode="edit"], .math-wrapper[data-mode="edit"]').forEach(wrapper => {
                if (wrapper !== clickedSpecialWrapper) {
                    dependencies.exitSpecialWrapperDisplayMode(wrapper);
                    // No syncMarkdown() here - exitSpecialWrapperDisplayMode already synced.
                }
            });
        });
    }
    return {
        revealTableCaret,
        scrollTableToCaret,
        showTableToolbar,
        hideTableToolbar,
        deleteTableColumn,
        deleteTableRow,
        insertTableRowBelow,
        insertTableRowAbove,
        insertTableColumnRight,
        insertTableColumnLeft,
        setColumnAlignment,
        addTableResizeHandles,
        initializeTableColumnWidths,
        updateColumnWidth,
        handleResizeStart,
        handleResizeMove,
        handleResizeEnd,
        initializeAllTableResizeHandles,
        get activeTableCell() { return activeTableCell; }, set activeTableCell(value) { activeTableCell = value; },
        get activeTable() { return activeTable; }, set activeTable(value) { activeTable = value; },
        get tableControls() { return tableControls; }, set tableControls(value) { tableControls = value; },
        get isTableColResizing() { return isTableColResizing; }, set isTableColResizing(value) { isTableColResizing = value; },
        get resizeStartX() { return resizeStartX; }, set resizeStartX(value) { resizeStartX = value; },
        get resizeStartWidth() { return resizeStartWidth; }, set resizeStartWidth(value) { resizeStartWidth = value; },
        get resizingCell() { return resizingCell; }, set resizingCell(value) { resizingCell = value; },
        get resizingTable() { return resizingTable; }, set resizingTable(value) { resizingTable = value; },
        initializeActiveTableCell
    };
}
module.exports = { createTables };
