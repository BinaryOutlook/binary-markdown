'use strict';

// A true result stops key dispatch, whether or not browser default was prevented.
function createTables(dependencies) {
    function handleTableEnter(e, tableCell) {
if (tableCell) {
                dependencies.logger.log('In table cell, shiftKey:', e.shiftKey);
                if (e.shiftKey) {
                    // Shift+Enter: insert line break within cell
                    e.preventDefault();
                    e.stopPropagation();
                    dependencies.logger.log('Inserting line break in table cell');
                    dependencies.logger.log('Cell content before:', tableCell.innerHTML);

                    // Get fresh selection
                    const currentSel = window.getSelection();
                    if (!currentSel.rangeCount) {
                        dependencies.logger.log('No selection range');
                        return true;
                    }

                    const range = currentSel.getRangeAt(0);

                    // Check if cursor is at the end of the cell content
                    // If at end AND no trailing <br> exists, we need two <br>s (one for line break, one for cursor positioning)
                    // Otherwise, one <br> is sufficient
                    const isAtEnd = (() => {
                        const testRange = document.createRange();
                        testRange.selectNodeContents(tableCell);
                        testRange.setStart(range.endContainer, range.endOffset);
                        const afterContent = testRange.toString();
                        return afterContent.trim() === '';
                    })();

                    // Check if there's already a trailing <br> after cursor position
                    const hasTrailingBr = (() => {
                        if (!isAtEnd) return false;
                        // Check if the last child of the cell is a <br>
                        const lastChild = tableCell.lastChild;
                        if (lastChild && lastChild.nodeName === 'BR') {
                            return true;
                        }
                        // Also check if cursor is right before a <br> at the end
                        const nextSibling = range.endContainer.nodeType === Node.TEXT_NODE
                            ? range.endContainer.nextSibling
                            : range.endContainer.childNodes[range.endOffset];
                        if (nextSibling && nextSibling.nodeName === 'BR' && !nextSibling.nextSibling) {
                            return true;
                        }
                        return false;
                    })();

                    dependencies.logger.log('Cursor at end of cell:', isAtEnd, 'hasTrailingBr:', hasTrailingBr);

                    // Delete any selected content
                    range.deleteContents();

                    // Create and insert BR(s)
                    const br1 = document.createElement('br');
                    range.insertNode(br1);

                    if (isAtEnd && !hasTrailingBr) {
                        // At end with no trailing BR: need second BR for cursor positioning
                        const br2 = document.createElement('br');
                        br1.after(br2);
                    }

                    // Move cursor after the first BR
                    const newRange = document.createRange();
                    newRange.setStartAfter(br1);
                    newRange.setEndAfter(br1);
                    currentSel.removeAllRanges();
                    currentSel.addRange(newRange);

                    dependencies.logger.log('Cell content after:', tableCell.innerHTML);
                    dependencies.logger.log('Line break inserted');

                    // Don't call syncMarkdown immediately - let it sync on blur or other events
                    // This prevents delay when typing
                    return true;
                } else {
                    // Enter: insert new row below and move to leftmost column
                    e.preventDefault();
                    const row = tableCell.closest('tr');
                    if (row) {
                        const table = row.closest('table');
                        const colCount = row.cells.length;
                        const newRow = document.createElement('tr');

                        for (let i = 0; i < colCount; i++) {
                            const cell = document.createElement('td');
                            cell.setAttribute('contenteditable', 'true');
                            cell.innerHTML = dependencies.emptyTableCell;
                            newRow.appendChild(cell);
                        }

                        row.after(newRow);
                        // Move cursor to leftmost cell of new row
                        dependencies.activeTableCell = newRow.cells[0];
                        dependencies.setCursorToEnd(newRow.cells[0]);
                        dependencies.syncMarkdown();
                    }
                }
                return true;
            }
        return false;
    }

    function handleTableTab(e, sel) {
if (sel && sel.rangeCount) {
                let node = sel.anchorNode;
                let tableCellNode = null;
                while (node && node !== dependencies.editor) {
                    if (node.nodeType === 1 && node.tagName &&
                        (node.tagName.toLowerCase() === 'td' || node.tagName.toLowerCase() === 'th')) {
                        tableCellNode = node;
                        break;
                    }
                    node = node.parentNode;
                }

                if (tableCellNode) {
                    // Navigate between table cells
                    dependencies.activeTableCell = tableCellNode;
                    const row = tableCellNode.closest('tr');
                    const table = tableCellNode.closest('table');
                    const cellIndex = tableCellNode.cellIndex;
                    const rows = table.querySelectorAll('tr');
                    const rowIndex = Array.from(rows).indexOf(row);

                    if (e.shiftKey) {
                        // Shift+Tab: move to previous cell
                        if (cellIndex > 0) {
                            // Move to left cell
                            dependencies.activeTableCell = row.cells[cellIndex - 1];
                            dependencies.setCursorToEnd(dependencies.activeTableCell);
                        } else if (rowIndex > 0) {
                            // Move to last cell of previous row
                            const prevRow = rows[rowIndex - 1];
                            dependencies.activeTableCell = prevRow.cells[prevRow.cells.length - 1];
                            dependencies.setCursorToEnd(dependencies.activeTableCell);
                        }
                    } else {
                        // Tab: move to next cell
                        if (cellIndex < row.cells.length - 1) {
                            // Move to right cell
                            dependencies.activeTableCell = row.cells[cellIndex + 1];
                            dependencies.setCursorToEnd(dependencies.activeTableCell);
                        } else if (rowIndex < rows.length - 1) {
                            // Move to first cell of next row
                            const nextRow = rows[rowIndex + 1];
                            dependencies.activeTableCell = nextRow.cells[0];
                            dependencies.setCursorToEnd(dependencies.activeTableCell);
                        }
                    }
                    // Capture the new cell/range before a following Alt+F10.
                    // selectionchange is asynchronous and can still describe
                    // the previous cell when toolbar focus is requested.
                    dependencies.showTableToolbar(table);
                    return true;
                }
            }
        return false;
    }

    function handleTableArrows(e) {
if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const sel = window.getSelection();
            if (sel && sel.rangeCount) {
                let node = sel.anchorNode;
                let tableCellNode = null;
                while (node && node !== dependencies.editor) {
                    if (node.nodeType === 1 && node.tagName &&
                        (node.tagName.toLowerCase() === 'td' || node.tagName.toLowerCase() === 'th')) {
                        tableCellNode = node;
                        break;
                    }
                    node = node.parentNode;
                }

                if (tableCellNode) {
                    const row = tableCellNode.closest('tr');
                    const table = tableCellNode.closest('table');
                    const cellIndex = tableCellNode.cellIndex;
                    const rows = table.querySelectorAll('tr');
                    const rowIndex = Array.from(rows).indexOf(row);

                    // Get all text positions (lines) in the cell
                    // Each line is separated by <br>
                    const getLineInfo = () => {
                        const range = sel.getRangeAt(0);
                        const cursorNode = range.startContainer;
                        const cursorOffset = range.startOffset;

                        // Collect all nodes in order: text nodes and BR elements
                        const nodes = [];
                        const collectNodes = (node) => {
                            for (const child of node.childNodes) {
                                if (child.nodeType === 3) { // Text node
                                    nodes.push({ type: 'text', node: child });
                                } else if (child.nodeType === 1) { // Element
                                    if (child.tagName === 'BR') {
                                        nodes.push({ type: 'br', node: child });
                                    } else {
                                        collectNodes(child);
                                    }
                                }
                            }
                        };
                        collectNodes(tableCellNode);

                        // Count lines (BR count + 1, but empty trailing doesn't count as separate)
                        const brCount = nodes.filter(n => n.type === 'br').length;
                        const textNodes = nodes.filter(n => n.type === 'text');
                        const hasTextContent = textNodes.some(n => n.node.textContent.length > 0);

                        // If cell has only a single BR and no text, treat as single line (empty cell placeholder)
                        // But if there are multiple BRs, treat as multi-line (user intentionally created multiple lines)
                        const isSingleEmptyCell = brCount === 1 && !hasTextContent;
                        const lineCount = isSingleEmptyCell ? 1 : brCount + 1;

                        // Find which line the cursor is on
                        let currentLine = 0;
                        let foundCursor = false;
                        const brNodes = nodes.filter(n => n.type === 'br');

                        // If cursor is directly in the cell (not in a text node or BR)
                        // This needs to be checked first because it's the most reliable method
                        if (cursorNode === tableCellNode) {
                            // Count BRs before cursorOffset in childNodes
                            let brsBefore = 0;
                            for (let i = 0; i < cursorOffset && i < tableCellNode.childNodes.length; i++) {
                                if (tableCellNode.childNodes[i].nodeName === 'BR') {
                                    brsBefore++;
                                }
                            }
                            currentLine = brsBefore;
                            foundCursor = true;
                            dependencies.logger.log('getLineInfo: cursor in cell, cursorOffset =', cursorOffset, 'brsBefore =', brsBefore, 'currentLine =', currentLine);
                        }

                        // If cursor is in a child node, find which line it's on
                        if (!foundCursor) {
                            // Build a map of which line each node belongs to
                            let lineNum = 0;
                            for (let i = 0; i < nodes.length; i++) {
                                const n = nodes[i];
                                if (n.type === 'text') {
                                    if (n.node === cursorNode) {
                                        currentLine = lineNum;
                                        foundCursor = true;
                                        break;
                                    }
                                } else if (n.type === 'br') {
                                    // Check if cursor is positioned at this BR
                                    if (n.node === cursorNode) {
                                        // Cursor on BR element itself - treat as being on the line before the BR
                                        currentLine = lineNum;
                                        foundCursor = true;
                                        break;
                                    }
                                    lineNum++;
                                }
                            }
                        }

                        // If cursor is still not found, it might be after the last BR with no text after it
                        // In this case, cursor is on the last line
                        if (!foundCursor) {
                            currentLine = lineCount - 1;
                        }

                        // Clamp currentLine to valid range
                        if (currentLine < 0) currentLine = 0;
                        if (currentLine >= lineCount) currentLine = lineCount - 1;

                        const isMultiLine = lineCount > 1;
                        const isAtFirstLine = currentLine === 0;

                        // Check if the last line is empty (no text after the last BR)
                        // If so, treat the line before it as the last line for navigation purposes
                        // This allows ArrowDown to skip empty trailing lines
                        let isLastLineEmpty = false;
                        if (lineCount > 1) {
                            const childNodes = Array.from(tableCellNode.childNodes);
                            // Find the last BR
                            let lastBrIndex = -1;
                            for (let i = childNodes.length - 1; i >= 0; i--) {
                                if (childNodes[i].nodeName === 'BR') {
                                    lastBrIndex = i;
                                    break;
                                }
                            }
                            if (lastBrIndex >= 0) {
                                // Check if there's any text content after the last BR
                                let hasTextAfterLastBr = false;
                                for (let i = lastBrIndex + 1; i < childNodes.length; i++) {
                                    const node = childNodes[i];
                                    if (node.nodeType === 3 && node.textContent.trim().length > 0) {
                                        hasTextAfterLastBr = true;
                                        break;
                                    }
                                }
                                isLastLineEmpty = !hasTextAfterLastBr;
                            }
                        }

                        // For ArrowDown: if last line is empty and we're on the line before it, treat as last line
                        // For ArrowUp: don't skip empty first line - let user navigate to it
                        const isAtLastLine = currentLine >= lineCount - 1 ||
                            (isLastLineEmpty && currentLine >= lineCount - 2);

                        return { lineCount, currentLine, isMultiLine, isAtFirstLine, isAtLastLine, nodes };
                    };

                    const { lineCount, currentLine, isMultiLine, isAtFirstLine, isAtLastLine, nodes } = getLineInfo();

                    // #region agent log
                    const debugRange = sel.getRangeAt(0);
                    const childNodesInfo = Array.from(tableCellNode.childNodes).map(n => n.nodeName);
                    dependencies.logger.log('Table arrow key:', {
                        key: e.key,
                        rowIndex,
                        cellIndex,
                        lineCount,
                        currentLine,
                        isMultiLine,
                        isAtFirstLine,
                        isAtLastLine,
                        cursorNodeName: debugRange.startContainer.nodeName,
                        cursorOffset: debugRange.startOffset,
                        childNodes: childNodesInfo.join(','),
                        childNodesLength: tableCellNode.childNodes.length,
                        cursorNodeIsCell: debugRange.startContainer === tableCellNode,
                        willMoveToNextCell: !isMultiLine || isAtLastLine,
                        willMoveToPrevCell: !isMultiLine || isAtFirstLine
                    });
                    // #endregion

                    // Helper: Move cursor to specific line in cell
                    const moveCursorToLine = (targetLine) => {
                        if (targetLine < 0 || targetLine >= lineCount) return false;

                        dependencies.logger.log('moveCursorToLine: targetLine =', targetLine, 'lineCount =', lineCount);

                        // Strategy: Use cell's childNodes directly to position cursor
                        // This is more reliable than trying to find text nodes
                        const childNodes = Array.from(tableCellNode.childNodes);

                        dependencies.logger.log('moveCursorToLine: childNodes =', childNodes.map(n => n.nodeName));

                        if (targetLine === 0) {
                            // Move to start of cell (before first child or at position 0)
                            const range = document.createRange();
                            if (childNodes.length > 0 && childNodes[0].nodeType === 3) {
                                // First child is text node
                                range.setStart(childNodes[0], 0);
                            } else {
                                // Position at start of cell
                                range.setStart(tableCellNode, 0);
                            }
                            range.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(range);
                            dependencies.logger.log('moveCursorToLine: moved to line 0');
                            return true;
                        }

                        // For lines > 0, find the nth BR and position after it
                        // Line N starts after the Nth BR (0-indexed: after BR[N-1])
                        // So for targetLine, we need to find BR number targetLine (1-indexed)
                        let brCount = 0;
                        for (let i = 0; i < childNodes.length; i++) {
                            const child = childNodes[i];
                            if (child.nodeName === 'BR') {
                                brCount++;
                                dependencies.logger.log('moveCursorToLine: found BR at index', i, 'brCount now =', brCount);
                                if (brCount === targetLine) {
                                    // Position cursor after this BR (start of line targetLine)
                                    const range = document.createRange();
                                    // Check if next node is a text node
                                    if (i + 1 < childNodes.length && childNodes[i + 1].nodeType === 3) {
                                        range.setStart(childNodes[i + 1], 0);
                                        dependencies.logger.log('moveCursorToLine: positioned at text node after BR index', i);
                                    } else {
                                        // Position at index after BR in the cell
                                        // This handles empty lines (consecutive BRs)
                                        range.setStart(tableCellNode, i + 1);
                                        dependencies.logger.log('moveCursorToLine: positioned at cell index', i + 1, '(after BR at index', i, ')');
                                    }
                                    range.collapse(true);
                                    sel.removeAllRanges();
                                    sel.addRange(range);

                                    // Force focus to ensure cursor is visible
                                    tableCellNode.focus();

                                    dependencies.logger.log('moveCursorToLine: AFTER - anchorNode =', sel.anchorNode?.nodeName, 'anchorOffset =', sel.anchorOffset);
                                    return true;
                                }
                            }
                        }

                        // Fallback: just set to start of cell
                        dependencies.logger.log('moveCursorToLine: fallback to start (brCount reached', brCount, ')');
                        const range = document.createRange();
                        range.selectNodeContents(tableCellNode);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                        return true;
                    };

                    if (e.key === 'ArrowUp') {
                        // If Shift is pressed, let browser handle selection
                        if (e.shiftKey) {
                            return true;
                        }

                        e.preventDefault();

                        dependencies.logger.log('ArrowUp decision:', { isMultiLine, isAtFirstLine, willMoveUp: !isMultiLine || isAtFirstLine });

                        if (isMultiLine && !isAtFirstLine) {
                            // Move to previous line within cell
                            moveCursorToLine(currentLine - 1);
                        } else {
                            // Move to cell above
                            if (rowIndex > 0) {
                                const prevRow = rows[rowIndex - 1];
                                const targetCell = prevRow.cells[Math.min(cellIndex, prevRow.cells.length - 1)];
                                if (targetCell) {
                                    dependencies.activeTableCell = targetCell;
                                    dependencies.setCursorToLastLineStartByDOM(targetCell);
                                }
                            } else {
                                // At first row, exit table upward
                                const prevElement = table.previousElementSibling;
                                if (prevElement) {
                                    dependencies.navigateToAdjacentElement(prevElement, 'up', true);
                                } else {
                                    const p = document.createElement('p');
                                    p.innerHTML = '<br>';
                                    table.before(p);
                                    dependencies.setCursorToEnd(p);
                                }
                                dependencies.hideTableToolbar();
                                dependencies.activeTable = null;
                                dependencies.activeTableCell = null;
                                return true;
                            }
                        }
                    } else if (e.key === 'ArrowDown') {
                        // If Shift is pressed, let browser handle selection
                        if (e.shiftKey) {
                            return true;
                        }

                        e.preventDefault();

                        dependencies.logger.log('ArrowDown decision:', { isMultiLine, isAtLastLine, willMoveDown: !isMultiLine || isAtLastLine });

                        if (isMultiLine && !isAtLastLine) {
                            // Move to next line within cell
                            moveCursorToLine(currentLine + 1);
                        } else {
                            // Move to cell below
                            if (rowIndex < rows.length - 1) {
                                const nextRow = rows[rowIndex + 1];
                                const targetCell = nextRow.cells[Math.min(cellIndex, nextRow.cells.length - 1)];
                                if (targetCell) {
                                    dependencies.activeTableCell = targetCell;
                                    dependencies.setCursorToStart(targetCell);
                                }
                            } else {
                                // At last row, exit table downward
                                const nextElement = table.nextElementSibling;
                                if (nextElement) {
                                    dependencies.navigateToAdjacentElement(nextElement, 'down', true);
                                } else {
                                    // No next element, create a paragraph after table
                                    const p = document.createElement('p');
                                    p.innerHTML = '<br>';
                                    table.after(p);
                                    dependencies.setCursorToEnd(p);
                                }
                                dependencies.hideTableToolbar();
                                dependencies.activeTable = null;
                                dependencies.activeTableCell = null;
                                return true;
                            }
                        }
                    }
                    // IMPORTANT: return after table cell arrow handling to prevent
                    // the "invasion code" below from also running and overwriting cursor position
                    dependencies.revealTableCaret(dependencies.activeTableCell || tableCellNode);
                    dependencies.showTableToolbar(table);
                    return true;
                }
            }
        }
        return false;
    }

    return { handleTableEnter, handleTableTab, handleTableArrows };
}

module.exports = { createTables };
