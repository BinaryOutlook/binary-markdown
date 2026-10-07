'use strict';

// Shared caret and DOM selection helpers use explicit callbacks for outer state writes.
function createDomSelection({
    editor,
    logger,
    NAVIGATION_FLAG_RESET_DELAY,
    enterEditMode,
    enterSpecialWrapperEditMode,
    isSpecialWrapper,
    setCursorToLastLineStartByDOM,
    showTableToolbar,
    revealTableCaret,
    setNavigatingIntoBlock,
    setActiveTable,
    setActiveTableCell,
}) {
    function resetNavigationFlag() {
        setTimeout(() => { setNavigatingIntoBlock(false); }, NAVIGATION_FLAG_RESET_DELAY);
    }

    function getDeepestLastLi(listElement) {
        var items = listElement.children;
        var lastLi = null;
        for (var i = items.length - 1; i >= 0; i--) {
            if (items[i].tagName === 'LI') {
                lastLi = items[i];
                break;
            }
        }
        if (!lastLi) return null;
        // If last <li> has a nested list as last structural child, recurse into it
        for (var j = lastLi.children.length - 1; j >= 0; j--) {
            var child = lastLi.children[j];
            if (child.tagName === 'UL' || child.tagName === 'OL') {
                var deeper = getDeepestLastLi(child);
                if (deeper) return deeper;
            }
        }
        return lastLi;
    }

    function navigateToAdjacentElement(target, direction, useTimeout) {
        if (!target) return false;
        var tag = target.tagName.toLowerCase();

        if (tag === 'pre') {
            setNavigatingIntoBlock(true);
            enterEditMode(target);
            setTimeout(function() {
                var code = target.querySelector('code');
                if (code) {
                    if (direction === 'up') {
                        setCursorToLastLineStartByDOM(code);
                    } else {
                        setCursorToFirstTextNode(code);
                    }
                }
                resetNavigationFlag();
            }, 0);
            return true;
        }
        if (tag === 'div' && isSpecialWrapper(target)) {
            setNavigatingIntoBlock(true);
            setTimeout(function() {
                enterSpecialWrapperEditMode(target, direction === 'up' ? 'lastLineStart' : 'start');
                resetNavigationFlag();
            }, 0);
            return true;
        }
        if (tag === 'table') {
            var rows = target.querySelectorAll('tr');
            if (rows.length > 0) {
                var row = direction === 'up' ? rows[rows.length - 1] : rows[0];
                var cell = row.cells[0];
                if (cell) {
                    setActiveTable(target);
                    setActiveTableCell(cell);
                    if (direction === 'up') {
                        setCursorToLastLineStartByDOM(cell);
                    } else {
                        setCursorToStart(cell);
                    }
                    showTableToolbar(target);
                }
            }
            return true;
        }
        if (tag === 'blockquote') {
            if (useTimeout) {
                setTimeout(function() {
                    if (direction === 'up') {
                        setCursorToLastLineStartByDOM(target);
                    } else {
                        setCursorToFirstTextNode(target);
                    }
                }, 0);
            } else {
                if (direction === 'up') {
                    setCursorToLastLineStartByDOM(target);
                } else {
                    setCursorToFirstTextNode(target);
                }
            }
            return true;
        }
        // List elements: find the deepest last/first <li> to position cursor correctly
        if (tag === 'ul' || tag === 'ol') {
            if (direction === 'up') {
                var lastLi = getDeepestLastLi(target);
                if (lastLi) {
                    setCursorToLastLineStartByDOM(lastLi);
                } else {
                    setCursorToStart(target);
                }
            } else {
                setCursorToFirstTextNode(target);
            }
            return true;
        }
        // Normal elements (paragraph, heading, etc.)
        if (direction === 'up') {
            setCursorToLastLineStartByDOM(target);
        } else {
            setCursorToFirstTextNode(target);
        }
        return true;
    }

    function setCursorToEnd(element) {
        const range = document.createRange();
        const sel = window.getSelection();
        if (!sel) return;

        let last = element.lastChild;
        // Header resize handles are editor UI, never a text caret destination.
        while (last?.nodeType === 1 && last.classList.contains('table-col-resize-handle')) last = last.previousSibling;
        if (element.matches('td, th')) {
            while (last?.nodeType === 1 && last.matches('strong, b, em, i, s, del, u, a, code') && last.lastChild) last = last.lastChild;
        }
        if (last) {
            if (last.nodeType === 3) {
                // Text node - set cursor at end of text
                range.setStart(last, last.length);
                range.collapse(true);
            } else if (last.nodeName === 'BR') {
                // BR element - set cursor before the BR (inside the parent element)
                range.setStartBefore(last);
                range.collapse(true);
            } else {
                range.selectNodeContents(last);
                range.collapse(false);
            }
        } else {
            range.setStart(element, 0);
            range.collapse(true);
        }

        sel.removeAllRanges();
        sel.addRange(range);
        element.focus();
        revealTableCaret(element);
    }

    function scrollCursorIntoView() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        try {
            const range = sel.getRangeAt(0);
            // Try to get cursor position from range rect (no DOM modification needed)
            const rects = range.getClientRects();
            const rect = rects.length > 0 ? rects[0] : range.getBoundingClientRect();

            if (rect && (rect.height > 0 || rect.width > 0)) {
                // Use the rect to check if cursor is visible
                const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
                if (rect.top < 0 || rect.bottom > viewportHeight) {
                    // Scroll the cursor's parent element into view
                    let el = range.startContainer;
                    if (el.nodeType === 3) el = el.parentElement;
                    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
                }
            } else {
                // Collapsed range with zero-size rect: scroll parent element
                let el = range.startContainer;
                if (el.nodeType === 3) el = el.parentElement;
                if (el) el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
            }
        } catch (e) {
            logger.log('scrollCursorIntoView failed:', e);
        }
    }

    function setCursorToStart(element) {
        const range = document.createRange();
        const sel = window.getSelection();
        if (!sel) return;

        if (element.firstChild) {
            if (element.firstChild.nodeType === 3) {
                range.setStart(element.firstChild, 0);
            } else {
                range.selectNodeContents(element.firstChild);
                range.collapse(true);
            }
        } else {
            range.selectNodeContents(element);
            range.collapse(true);
        }

        sel.removeAllRanges();
        sel.addRange(range);
        element.focus();
        revealTableCaret(element);
    }

    function setCursorToFirstTextNode(el) {
        const range = document.createRange();
        const s = window.getSelection();
        const tag = el.tagName.toLowerCase();
        const targetNode = (tag === 'pre') ? (el.querySelector('code') || el) : el;

        // Find the first text node
        function findFirstTextNode(node) {
            if (node.nodeType === 3) {
                return node;
            } else if (node.nodeType === 1) {
                for (const child of node.childNodes) {
                    const result = findFirstTextNode(child);
                    if (result) return result;
                }
            }
            return null;
        }

        const textNode = findFirstTextNode(targetNode);
        if (textNode) {
            range.setStart(textNode, 0);
        } else if (targetNode.firstChild) {
            range.setStart(targetNode.firstChild, 0);
        } else {
            range.setStart(targetNode, 0);
        }

        range.collapse(true);
        s.removeAllRanges();
        s.addRange(range);
        // Scroll cursor into view
        scrollCursorIntoView();
    }

    function getSelectedListItems(range, sel) {
        const selectedItems = [];

        // Get all LI elements in the editor
        const allLis = Array.from(editor.querySelectorAll('li'));

        // Create a document fragment to compare positions
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;

        // Find the deepest LI element containing the start position
        let startLi = startContainer;
        while (startLi && startLi !== editor && startLi.nodeType !== 1) {
            startLi = startLi.parentNode;
        }
        while (startLi && startLi !== editor && startLi.tagName?.toLowerCase() !== 'li') {
            startLi = startLi.parentNode;
        }

        // Find the deepest LI element containing the end position
        let endLi = endContainer;
        while (endLi && endLi !== editor && endLi.nodeType !== 1) {
            endLi = endLi.parentNode;
        }
        while (endLi && endLi !== editor && endLi.tagName?.toLowerCase() !== 'li') {
            endLi = endLi.parentNode;
        }

        // Also find the LI element where the cursor (focus) is located
        let focusLi = null;
        if (sel && sel.focusNode) {
            focusLi = sel.focusNode;
            while (focusLi && focusLi !== editor && focusLi.nodeType !== 1) {
                focusLi = focusLi.parentNode;
            }
            while (focusLi && focusLi !== editor && focusLi.tagName?.toLowerCase() !== 'li') {
                focusLi = focusLi.parentNode;
            }
            if (focusLi === editor) focusLi = null;
        }

        logger.log('getSelectedListItems:', {
            startLi: startLi?.textContent?.substring(0, 20),
            endLi: endLi?.textContent?.substring(0, 20),
            focusLi: focusLi?.textContent?.substring(0, 20),
            isCollapsed: range.collapsed
        });

        if (!startLi || !endLi || startLi === editor || endLi === editor) {
            // If no selection range in li, but cursor is in li, return that
            if (focusLi) {
                return [focusLi];
            }
            return selectedItems;
        }

        // If start and end are the same
        if (startLi === endLi) {
            // Check if focus is in a different li (cursor moved after selection)
            if (focusLi && focusLi !== startLi && focusLi.parentNode === startLi.parentNode) {
                // Include both the selected li and the cursor li
                const startIdx = allLis.indexOf(startLi);
                const focusIdx = allLis.indexOf(focusLi);
                const minIdx = Math.min(startIdx, focusIdx);
                const maxIdx = Math.max(startIdx, focusIdx);
                const items = [];
                for (let i = minIdx; i <= maxIdx; i++) {
                    if (allLis[i].parentNode === startLi.parentNode) {
                        items.push(allLis[i]);
                    }
                }
                return items.length > 0 ? items : [startLi];
            }
            return [startLi];
        }

        // Get indices in the allLis array
        let startIndex = allLis.indexOf(startLi);
        let endIndex = allLis.indexOf(endLi);

        // Also consider focus position
        if (focusLi) {
            const focusIndex = allLis.indexOf(focusLi);
            if (focusIndex !== -1) {
                if (startIndex !== -1) startIndex = Math.min(startIndex, focusIndex);
                if (endIndex !== -1) endIndex = Math.max(endIndex, focusIndex);
            }
        }

        logger.log('getSelectedListItems indices:', { startIndex, endIndex });

        if (startIndex === -1 || endIndex === -1) {
            return selectedItems;
        }

        // Collect all LIs between start and end (inclusive)
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);

        for (let i = minIndex; i <= maxIndex; i++) {
            selectedItems.push(allLis[i]);
        }

        // Filter: only keep items that are siblings (same parent list)
        // Find the common parent list of start and end
        const startParentList = startLi.parentNode;
        const endParentList = endLi.parentNode;

        let filteredItems;
        if (startParentList === endParentList) {
            // Same parent list - only keep direct children of that list
            filteredItems = selectedItems.filter(li => li.parentNode === startParentList);
        } else {
            // Different parent lists - keep items that are not nested inside other selected items
            // But be careful: if startLi contains endLi, we want the children, not the parent
            if (startLi.contains(endLi)) {
                // Start contains end - find the direct child list of startLi that contains endLi
                let childList = endLi.parentNode;
                while (childList && childList.parentNode !== startLi) {
                    childList = childList.parentNode;
                }
                if (childList) {
                    // Get all siblings in that child list
                    filteredItems = selectedItems.filter(li => li.parentNode === childList);
                } else {
                    filteredItems = [endLi];
                }
            } else if (endLi.contains(startLi)) {
                // End contains start - similar logic
                let childList = startLi.parentNode;
                while (childList && childList.parentNode !== endLi) {
                    childList = childList.parentNode;
                }
                if (childList) {
                    filteredItems = selectedItems.filter(li => li.parentNode === childList);
                } else {
                    filteredItems = [startLi];
                }
            } else {
                // Neither contains the other - find common ancestor and filter
                filteredItems = selectedItems.filter(li => {
                    for (const otherLi of selectedItems) {
                        if (otherLi !== li && otherLi.contains(li)) {
                            return false;
                        }
                    }
                    return true;
                });
            }
        }

        logger.log('getSelectedListItems result:', {
            total: selectedItems.length,
            filtered: filteredItems.length
        });

        return filteredItems;
    }

    function getCurrentLine() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;

        let node = sel.anchorNode;
        while (node && node.parentNode !== editor) {
            node = node.parentNode;
        }
        return node;
    }

    function saveCursorState() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;

        const range = sel.getRangeAt(0);
        const anchorNode = sel.anchorNode;
        if (!anchorNode) return null;

        // Find which top-level block contains the cursor
        let block = anchorNode;
        while (block && block !== editor && block.parentNode !== editor) {
            block = block.parentNode;
        }
        if (!block || block === editor) return null;

        const blockIndex = Array.from(editor.children).indexOf(block);
        if (blockIndex === -1) return null;

        // Save block text content for text-based matching (robust against insertions above)
        const blockText = block.textContent || '';

        // Calculate text offset within the block
        try {
            const preRange = document.createRange();
            preRange.setStart(block, 0);
            preRange.setEnd(range.startContainer, range.startOffset);
            const textOffset = preRange.toString().length;
            return { blockIndex, blockText, textOffset };
        } catch (e) {
            logger.log('[Binary Markdown] saveCursorState failed:', e);
            return null;
        }
    }

    function findPositionByTextOffset(root, targetOffset) {
        let currentOffset = 0;

        function walk(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const len = node.textContent.length;
                if (currentOffset + len >= targetOffset) {
                    return { node: node, offset: targetOffset - currentOffset };
                }
                currentOffset += len;
                return null;
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.tagName === 'BR') {
                    if (currentOffset >= targetOffset) {
                        const parent = node.parentNode;
                        const idx = Array.from(parent.childNodes).indexOf(node);
                        return { node: parent, offset: idx };
                    }
                    currentOffset += 1;
                    return null;
                }
                for (const child of node.childNodes) {
                    const result = walk(child);
                    if (result) return result;
                }
            }
            return null;
        }

        const result = walk(root);
        if (!result) {
            // Fallback: end of block
            if (root.childNodes.length > 0) {
                return { node: root, offset: root.childNodes.length };
            }
            return { node: root, offset: 0 };
        }
        return result;
    }

    function restoreCursorState(state) {
        if (!state) return;

        const blocks = Array.from(editor.children);
        if (blocks.length === 0) return;

        // Try text-based matching first (robust against insertions/deletions above)
        // If multiple blocks have the same text, pick the one closest to the original blockIndex
        let block = null;
        if (state.blockText) {
            var candidates = [];
            for (let i = 0; i < blocks.length; i++) {
                if ((blocks[i].textContent || '') === state.blockText) {
                    candidates.push({ block: blocks[i], index: i });
                }
            }
            if (candidates.length === 1) {
                block = candidates[0].block;
            } else if (candidates.length > 1) {
                // Pick closest to original blockIndex
                var closest = candidates[0];
                for (let j = 1; j < candidates.length; j++) {
                    if (Math.abs(candidates[j].index - state.blockIndex) < Math.abs(closest.index - state.blockIndex)) {
                        closest = candidates[j];
                    }
                }
                block = closest.block;
            }
        }

        // Fallback: use blockIndex (same as before)
        if (!block) {
            const targetIndex = Math.min(state.blockIndex, blocks.length - 1);
            block = blocks[targetIndex];
        }

        try {
            const position = findPositionByTextOffset(block, state.textOffset);
            if (!position) return;

            const range = document.createRange();
            range.setStart(position.node, position.offset);
            range.collapse(true);

            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (e) {
            logger.log('[Binary Markdown] restoreCursorState failed:', e);
        }
    }

    function getCodePlainText(code) {
        let text = '';
        const processNode = (node) => {
            for (const child of node.childNodes) {
                if (child.nodeType === 3) {
                    // Text node
                    text += child.textContent;
                } else if (child.nodeType === 1) {
                    const tagName = child.tagName.toLowerCase();
                    if (tagName === 'br') {
                        text += '\n';
                    } else {
                        // Recurse into other elements (like highlight spans)
                        processNode(child);
                    }
                }
            }
        };
        processNode(code);
        return text;
    }

    function getTextOffsetInContainer(container, node, offset) {
        let textPos = 0;
        let found = false;

        function countFull(n) {
            if (n.nodeType === 3) { textPos += n.textContent.length; }
            else if (n.nodeType === 1 && n.tagName === 'BR') { textPos += 1; }
            else if (n.nodeType === 1) {
                for (const c of n.childNodes) countFull(c);
            }
        }

        function walk(current) {
            if (found) return;
            if (current === node) {
                if (node.nodeType === 3) {
                    textPos += offset;
                } else if (node.nodeType === 1) {
                    for (let i = 0; i < offset && i < current.childNodes.length; i++) {
                        countFull(current.childNodes[i]);
                    }
                }
                found = true;
                return;
            }
            if (current.nodeType === 3) {
                textPos += current.textContent.length;
            } else if (current.nodeType === 1 && current.tagName === 'BR') {
                textPos += 1;
            } else if (current.nodeType === 1) {
                for (const child of current.childNodes) {
                    walk(child);
                    if (found) return;
                }
            }
        }

        for (const child of container.childNodes) {
            walk(child);
            if (found) break;
        }
        return textPos;
    }

    function textOffsetToDomPosition(container, textOffset) {
        let pos = 0;
        for (let i = 0; i < container.childNodes.length; i++) {
            const child = container.childNodes[i];
            if (child.nodeType === 3) {
                const len = child.textContent.length;
                if (pos + len >= textOffset) {
                    return { node: child, offset: textOffset - pos };
                }
                pos += len;
            } else if (child.nodeType === 1 && child.tagName === 'BR') {
                if (pos === textOffset) {
                    return { node: container, offset: i };
                }
                pos += 1;
            } else if (child.nodeType === 1) {
                // Should not happen in edit-mode code blocks, but handle for safety
                for (let j = 0; j < child.childNodes.length; j++) {
                    const sub = child.childNodes[j];
                    if (sub.nodeType === 3) {
                        const len = sub.textContent.length;
                        if (pos + len >= textOffset) {
                            return { node: sub, offset: textOffset - pos };
                        }
                        pos += len;
                    }
                }
            }
        }
        // At the end
        return { node: container, offset: container.childNodes.length };
    }

    function indentLinesInContainer(container, isShiftTab) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return false;
        const range = sel.getRangeAt(0);

        // 1. Convert selection to text offsets
        const selStart = getTextOffsetInContainer(container, range.startContainer, range.startOffset);
        const selEnd = getTextOffsetInContainer(container, range.endContainer, range.endOffset);

        // 2. Get full text content
        const fullText = getCodePlainText(container);
        const lines = fullText.split('\n');

        // 3. Pre-compute original line start offsets
        const origLineStarts = [];
        let p = 0;
        for (let i = 0; i < lines.length; i++) {
            origLineStarts.push(p);
            p += lines[i].length + 1; // +1 for \n
        }

        // 4. Determine affected line range
        let startLine = 0;
        let endLine = lines.length - 1;
        for (let i = 0; i < lines.length; i++) {
            const lineEnd = origLineStarts[i] + lines[i].length;
            if (origLineStarts[i] <= selStart && selStart <= lineEnd) {
                startLine = i;
            }
            if (origLineStarts[i] <= selEnd && selEnd <= lineEnd) {
                endLine = i;
                break;
            }
        }
        // If selection end is at the very start of a line and is not the start line, exclude that line
        if (endLine > startLine && selEnd === origLineStarts[endLine]) {
            endLine--;
        }

        // 5. Apply indent/dedent and track offset adjustments
        let startAdjust = 0;
        let endAdjust = 0;

        for (let i = 0; i < lines.length; i++) {
            if (i >= startLine && i <= endLine) {
                const origLineStart = origLineStarts[i];
                if (isShiftTab) {
                    let spaces = 0;
                    while (spaces < 4 && spaces < lines[i].length && lines[i][spaces] === ' ') {
                        spaces++;
                    }
                    if (spaces > 0) {
                        lines[i] = lines[i].slice(spaces);
                        if (selStart > origLineStart + spaces) {
                            startAdjust -= spaces;
                        } else if (selStart > origLineStart) {
                            startAdjust -= (selStart - origLineStart);
                        }
                        if (selEnd > origLineStart + spaces) {
                            endAdjust -= spaces;
                        } else if (selEnd > origLineStart) {
                            endAdjust -= (selEnd - origLineStart);
                        }
                    }
                } else {
                    lines[i] = '    ' + lines[i];
                    if (selStart >= origLineStart) {
                        startAdjust += 4;
                    }
                    if (selEnd >= origLineStart) {
                        endAdjust += 4;
                    }
                }
            }
        }

        // 6. Rebuild DOM
        const newText = lines.join('\n');
        const newSelStart = Math.max(0, Math.min(selStart + startAdjust, newText.length));
        const newSelEnd = Math.max(0, Math.min(selEnd + endAdjust, newText.length));

        container.innerHTML = '';
        const newLines = newText.split('\n');
        for (let i = 0; i < newLines.length; i++) {
            container.appendChild(document.createTextNode(newLines[i]));
            if (i < newLines.length - 1) {
                container.appendChild(document.createElement('br'));
            }
        }

        // 7. Restore selection
        try {
            const startPos = textOffsetToDomPosition(container, newSelStart);
            const endPos = textOffsetToDomPosition(container, newSelEnd);
            const newRange = document.createRange();
            newRange.setStart(startPos.node, startPos.offset);
            newRange.setEnd(endPos.node, endPos.offset);
            sel.removeAllRanges();
            sel.addRange(newRange);
        } catch (err) {
            logger.log('Failed to restore selection after indentLinesInContainer:', err);
        }

        return true;
    }

    return {
        resetNavigationFlag,
        getDeepestLastLi,
        navigateToAdjacentElement,
        setCursorToEnd,
        scrollCursorIntoView,
        setCursorToStart,
        setCursorToFirstTextNode,
        getSelectedListItems,
        getCurrentLine,
        saveCursorState,
        findPositionByTextOffset,
        restoreCursorState,
        getCodePlainText,
        getTextOffsetInContainer,
        textOffsetToDomPosition,
        indentLinesInContainer,
    };
}

module.exports = { createDomSelection };
