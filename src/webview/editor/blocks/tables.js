'use strict';

// Named capabilities remain live; this factory installs no listeners.
function createTables(dependencies) {


    // ========== TABLE FUNCTIONALITY ==========

    function revealTableCaret(element) {
        const cell = element.closest?.('td, th');
        if (!cell || !dependencies.editor.contains(cell)) return;
        cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        scrollTableToCaret(cell);
    }


    function scrollTableToCaret(cell, previousWidth) {
        const table = cell.closest('table');
        const selection = window.getSelection();
        if (!table || !dependencies.editor.contains(cell) || !table.clientWidth || !selection?.isCollapsed || !selection.rangeCount || !cell.contains(selection.anchorNode)) return;
        const caret = selection.getRangeAt(0).getBoundingClientRect();
        if (!caret.height && !caret.width) return;
        const bounds = table.getBoundingClientRect();
        // A single unbroken cell can be wider than the pane: reveal its caret,
        // rather than repeatedly aligning the cell's other edge with the pane.
        const left = bounds.left + table.clientLeft;
        const right = left + table.clientWidth;
        // Resize correction is only for a caret newly clipped by shrinkage.
        // A caret already outside the old viewport may have been deliberately
        // scrolled away; neither shrinking nor growing should pull it back.
        if (previousWidth !== undefined && (table.clientWidth >= previousWidth ||
            caret.left < left - 1 || caret.right > left + previousWidth + 1)) return;
        if (caret.left < left + 2) table.scrollLeft -= left + 2 - caret.left;
        else if (caret.right > right - 2) table.scrollLeft += caret.right - right + 2;
    }

    function showTableToolbar(table) {
        dependencies.activeTable = table;
        dependencies.tableControls.show(table, dependencies.activeTableCell);
    }

    function hideTableToolbar() {
        dependencies.tableControls?.clear();
    }


    function deleteTableColumn() {
        if (!dependencies.activeTableCell || !dependencies.activeTable) return;

        // Verify elements are still in DOM
        if (!dependencies.editor.contains(dependencies.activeTableCell) || !dependencies.editor.contains(dependencies.activeTable)) {
            dependencies.logger.log('Table elements not in DOM, skipping deleteTableColumn');
            return;
        }

        const cellIndex = dependencies.activeTableCell.cellIndex;
        if (cellIndex < 0) return;

        const currentRow = dependencies.activeTableCell.closest('tr');
        if (!currentRow) return;

        const rows = dependencies.activeTable.querySelectorAll('tr');

        // Don't delete if only one column
        if (rows[0] && rows[0].cells.length <= 1) return;

        // Store rowIndex before deleting
        const rowIndex = Array.from(rows).indexOf(currentRow);

        rows.forEach(row => {
            if (row.cells[cellIndex]) {
                row.cells[cellIndex].remove();
            }
        });

        // Move activeTableCell to adjacent cell in the SAME row
        const updatedRows = dependencies.activeTable.querySelectorAll('tr');
        const targetRow = updatedRows[rowIndex];
        if (targetRow && targetRow.cells.length > 0) {
            // Stay in the same row, move to left (new last column if was at end)
            const newIndex = Math.min(cellIndex, targetRow.cells.length - 1);
            if (newIndex >= 0 && targetRow.cells[newIndex]) {
                dependencies.activeTableCell = targetRow.cells[newIndex];
                dependencies.setCursorToEnd(dependencies.activeTableCell);
            }
        }

        dependencies.syncMarkdown();
    }


    function deleteTableRow() {
        if (!dependencies.activeTableCell || !dependencies.activeTable) return;

        // Verify elements are still in DOM
        if (!dependencies.editor.contains(dependencies.activeTableCell) || !dependencies.editor.contains(dependencies.activeTable)) {
            dependencies.logger.log('Table elements not in DOM, skipping deleteTableRow');
            return;
        }

        const row = dependencies.activeTableCell.closest('tr');
        if (!row) return;

        // Don't delete header row or if only one row
        const rows = dependencies.activeTable.querySelectorAll('tr');
        if (rows.length <= 1) return;
        if (row === rows[0]) return; // Don't delete header

        const rowIndex = Array.from(rows).indexOf(row);
        const cellIndex = dependencies.activeTableCell.cellIndex;
        if (cellIndex < 0) return;

        row.remove();

        // Move activeTableCell to adjacent row
        const newRows = dependencies.activeTable.querySelectorAll('tr');
        if (newRows.length > 0) {
            // Try to select same column in previous row (or the row above deleted one)
            // If was last row, go to new last row
            const newRowIndex = Math.min(rowIndex, newRows.length - 1);
            // Prefer row above if not header
            const targetRowIndex = newRowIndex > 0 ? Math.max(1, rowIndex - 1) : newRowIndex;
            const newRow = newRows[targetRowIndex] || newRows[newRowIndex];

            if (newRow && newRow.cells[cellIndex]) {
                dependencies.activeTableCell = newRow.cells[cellIndex];
                dependencies.setCursorToEnd(dependencies.activeTableCell);
            } else if (newRow && newRow.cells[0]) {
                dependencies.activeTableCell = newRow.cells[0];
                dependencies.setCursorToEnd(dependencies.activeTableCell);
            }
        }

        dependencies.syncMarkdown();
    }


    function insertTableRowBelow() {
        if (!dependencies.activeTableCell) return;

        // Verify activeTableCell is still in DOM
        if (!dependencies.editor.contains(dependencies.activeTableCell)) {
            dependencies.logger.log('activeTableCell not in DOM, skipping insertTableRowBelow');
            return;
        }

        const row = dependencies.activeTableCell.closest('tr');
        if (!row) return;

        const table = row.closest('table');
        if (!table || !dependencies.editor.contains(table)) return;

        const colCount = row.cells.length;
        if (colCount === 0) return;

        const newRow = document.createElement('tr');

        for (let i = 0; i < colCount; i++) {
            const cell = document.createElement('td');
            cell.setAttribute('contenteditable', 'true');
            cell.innerHTML = dependencies.emptyTableCell;
            newRow.appendChild(cell);
        }

        row.after(newRow);
        // Update activeTableCell to the new row's cell at same column
        const cellIndex = dependencies.activeTableCell.cellIndex;
        dependencies.activeTableCell = newRow.cells[cellIndex] || newRow.cells[0];
        dependencies.activeTable = table;
        dependencies.setCursorToEnd(dependencies.activeTableCell);
        dependencies.syncMarkdown();
    }


    function insertTableRowAbove() {
        if (!dependencies.activeTableCell) return;

        // Verify activeTableCell is still in DOM
        if (!dependencies.editor.contains(dependencies.activeTableCell)) {
            dependencies.logger.log('activeTableCell not in DOM, skipping insertTableRowAbove');
            return;
        }

        const row = dependencies.activeTableCell.closest('tr');
        if (!row) return;

        const table = row.closest('table');
        if (!table || !dependencies.editor.contains(table)) return;

        // Check if current row is header row (first row)
        const rows = table.querySelectorAll('tr');
        const isHeaderRow = rows.length > 0 && row === rows[0];

        if (isHeaderRow) {
            dependencies.logger.log('Cannot insert row above header row');
            return; // Do nothing if in header row
        }

        const colCount = row.cells.length;
        if (colCount === 0) return;

        const newRow = document.createElement('tr');

        for (let i = 0; i < colCount; i++) {
            const cell = document.createElement('td');
            cell.setAttribute('contenteditable', 'true');
            cell.innerHTML = dependencies.emptyTableCell;
            newRow.appendChild(cell);
        }

        row.before(newRow);
        // Update activeTableCell to the new row's cell at same column
        const cellIndex = dependencies.activeTableCell.cellIndex;
        dependencies.activeTableCell = newRow.cells[cellIndex] || newRow.cells[0];
        dependencies.activeTable = table;
        dependencies.setCursorToEnd(dependencies.activeTableCell);
        dependencies.syncMarkdown();
    }


    function insertTableColumnRight() {
        if (!dependencies.activeTableCell) return;

        // Verify activeTableCell is still in DOM
        if (!dependencies.editor.contains(dependencies.activeTableCell)) {
            dependencies.logger.log('activeTableCell not in DOM, skipping insertTableColumnRight');
            return;
        }

        const table = dependencies.activeTableCell.closest('table');
        if (!table || !dependencies.editor.contains(table)) return;

        const cellIndex = dependencies.activeTableCell.cellIndex;
        if (cellIndex < 0) return; // Invalid cell index

        const currentRow = dependencies.activeTableCell.closest('tr');
        if (!currentRow) return;

        const rows = table.querySelectorAll('tr');
        if (rows.length === 0) return;

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
            } else {
                row.appendChild(newCell);
            }

            // Track the new cell in current row
            if (rowIndex === currentRowIndex) {
                newCellInCurrentRow = newCell;
            }
        });

        // Move cursor to the new column in current row
        if (newCellInCurrentRow && dependencies.editor.contains(newCellInCurrentRow)) {
            dependencies.activeTableCell = newCellInCurrentRow;
            dependencies.activeTable = table;
            dependencies.setCursorToEnd(newCellInCurrentRow);
        }

        // Re-add resize handles after adding column
        addTableResizeHandles(table);

        dependencies.syncMarkdown();
    }


    function insertTableColumnLeft() {
        if (!dependencies.activeTableCell) return;

        // Verify activeTableCell is still in DOM
        if (!dependencies.editor.contains(dependencies.activeTableCell)) {
            dependencies.logger.log('activeTableCell not in DOM, skipping insertTableColumnLeft');
            return;
        }

        const table = dependencies.activeTableCell.closest('table');
        if (!table || !dependencies.editor.contains(table)) return;

        const cellIndex = dependencies.activeTableCell.cellIndex;
        if (cellIndex < 0) return; // Invalid cell index

        const currentRow = dependencies.activeTableCell.closest('tr');
        if (!currentRow) return;

        const rows = table.querySelectorAll('tr');
        if (rows.length === 0) return;

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
            dependencies.activeTableCell = newCellInCurrentRow;
            dependencies.activeTable = table;
            dependencies.setCursorToEnd(newCellInCurrentRow);
        }

        // Re-add resize handles after adding column
        addTableResizeHandles(table);

        dependencies.syncMarkdown();
    }


    // Set column alignment for the current column
    function setColumnAlignment(align) {
        if (!dependencies.activeTableCell || !dependencies.activeTable) return;

        // Verify elements are still in DOM
        if (!dependencies.editor.contains(dependencies.activeTableCell) || !dependencies.editor.contains(dependencies.activeTable)) {
            dependencies.logger.log('Table elements not in DOM, skipping setColumnAlignment');
            return;
        }

        const colIndex = dependencies.activeTableCell.cellIndex;
        if (colIndex < 0) return;

        // Markdown column alignment applies to the header and body alike.
        const rows = dependencies.activeTable.querySelectorAll('tr');
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
        if (!table) return;

        const headerCells = table.querySelectorAll('th');
        headerCells.forEach((th, index) => {
            // Skip if already has a resize handle
            if (th.querySelector('.table-col-resize-handle')) return;

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
        if (headerCells.length === 0) return;

        // Skip if already initialized (has fixed layout)
        if (table.style.tableLayout === 'fixed') return;

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
            if (rowIndex === 0) return; // Skip header row
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
        if (!handle) return;

        e.preventDefault();
        e.stopPropagation();

        dependencies.resizingCell = handle.closest('th');
        dependencies.resizingTable = handle.closest('table');

        // Initialize column widths on first resize
        if (dependencies.resizingTable) {
            initializeTableColumnWidths(dependencies.resizingTable);
        }

        dependencies.isTableColResizing = true;
        dependencies.resizeStartX = e.clientX;

        if (dependencies.resizingCell) {
            dependencies.resizeStartWidth = dependencies.resizingCell.offsetWidth;
        }

        handle.classList.add('resizing');
        document.body.classList.add('table-resizing');

        // Add document-level listeners for drag
        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
    }


    // Handle resize drag
    function handleResizeMove(e) {
        if (!dependencies.isTableColResizing || !dependencies.resizingCell || !dependencies.resizingTable) return;

        e.preventDefault();

        const deltaX = e.clientX - dependencies.resizeStartX;
        const newWidth = dependencies.resizeStartWidth + deltaX;
        const colIndex = parseInt(dependencies.resizingCell.querySelector('.table-col-resize-handle')?.dataset.colIndex || '0');

        updateColumnWidth(dependencies.resizingTable, colIndex, newWidth);
    }


    // Handle resize end
    function handleResizeEnd(e) {
        if (!dependencies.isTableColResizing) return;

        dependencies.isTableColResizing = false;

        // Remove resizing class from handle
        if (dependencies.resizingCell) {
            const handle = dependencies.resizingCell.querySelector('.table-col-resize-handle');
            if (handle) {
                handle.classList.remove('resizing');
            }
        }

        document.body.classList.remove('table-resizing');

        // Remove document-level listeners
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);

        dependencies.resizingCell = null;
        dependencies.resizingTable = null;
    }


    // Add resize handles to all existing tables
    function initializeAllTableResizeHandles() {
        dependencies.editor.querySelectorAll('table').forEach(table => {
            addTableResizeHandles(table);
        });
    }

    return { revealTableCaret, scrollTableToCaret, showTableToolbar, hideTableToolbar, deleteTableColumn, deleteTableRow, insertTableRowBelow, insertTableRowAbove, insertTableColumnRight, insertTableColumnLeft, setColumnAlignment, addTableResizeHandles, initializeTableColumnWidths, updateColumnWidth, handleResizeStart, handleResizeMove, handleResizeEnd, initializeAllTableResizeHandles };
}

module.exports = { createTables };
