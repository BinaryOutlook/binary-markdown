'use strict';
// Construction defines capabilities; bootstrap controls the original initialization order.
function createListSelectionDelete(dependencies) {
    function handleEarlyListBackspace(e, range, sel) {
        if (!range.collapsed) {
            dependencies.logger.log('Backspace with selection (early handler) - range:', {
                startContainer: range.startContainer.nodeName,
                startOffset: range.startOffset,
                endContainer: range.endContainer.nodeName,
                endOffset: range.endOffset
            });
            // Find the li element that contains the selection start
            let liElement = null;
            let node = range.startContainer;
            while (node && node !== dependencies.editor) {
                if (node.nodeType === 1 && node.tagName.toLowerCase() === 'li') {
                    liElement = node;
                    break;
                }
                node = node.parentNode;
            }
            if (liElement) {
                dependencies.logger.log('Backspace with selection - li found, handling');
                e.preventDefault();
                // Before deleteContents, collect endLi and all <li> elements in between
                let endLi = null;
                let endNode = range.endContainer;
                while (endNode && endNode !== dependencies.editor) {
                    if (endNode.nodeType === 1 && endNode.tagName.toLowerCase() === 'li') {
                        endLi = endNode;
                        break;
                    }
                    endNode = endNode.parentNode;
                }
                // Collect all <li> elements between startLi and endLi (exclusive of startLi)
                const affectedLis = [];
                if (endLi && endLi !== liElement) {
                    const allLis = Array.from(dependencies.editor.querySelectorAll('li'));
                    const startIdx = allLis.indexOf(liElement);
                    const endIdx = allLis.indexOf(endLi);
                    if (startIdx !== -1 && endIdx !== -1) {
                        const minIdx = Math.min(startIdx, endIdx);
                        const maxIdx = Math.max(startIdx, endIdx);
                        for (let i = minIdx + 1; i <= maxIdx; i++) {
                            affectedLis.push(allLis[i]);
                        }
                    }
                }
                // Get nested list before deletion
                const nestedList = liElement.querySelector(':scope > ul, :scope > ol');
                const checkbox = liElement.querySelector(':scope > input[type="checkbox"]');
                // Save cursor position before deletion - after deleteContents,
                // the range collapses to the start of the deleted region
                range.deleteContents();
                // Clean up empty <li> elements that were in the selection (excluding startLi)
                for (const affectedLi of affectedLis) {
                    if (!affectedLi.isConnected)
                        continue;
                    // Check if this li is now empty (no direct text content)
                    let hasContent = false;
                    for (const child of affectedLi.childNodes) {
                        if (child.nodeType === 3 && child.textContent.trim()) {
                            hasContent = true;
                            break;
                        }
                        if (child.nodeType === 1) {
                            const tag = child.tagName?.toLowerCase();
                            if (tag === 'ul' || tag === 'ol' || tag === 'br' || tag === 'input')
                                continue;
                            if (child.textContent.trim()) {
                                hasContent = true;
                                break;
                            }
                        }
                    }
                    if (!hasContent) {
                        const parentList = affectedLi.parentNode;
                        // Promote nested list children to parent list before removing
                        const nestedLists = Array.from(affectedLi.querySelectorAll(':scope > ul, :scope > ol'));
                        for (const nl of nestedLists) {
                            while (nl.firstChild) {
                                parentList.insertBefore(nl.firstChild, affectedLi);
                            }
                            nl.remove();
                        }
                        affectedLi.remove();
                        // Clean up empty parent list
                        if (parentList && parentList.isConnected &&
                            (parentList.tagName?.toLowerCase() === 'ul' || parentList.tagName?.toLowerCase() === 'ol') &&
                            parentList.children.length === 0) {
                            parentList.remove();
                        }
                    }
                }
                // After deleteContents, the selection range is collapsed at the deletion point.
                // We preserve this cursor position for partial text deletions.
                const cursorRange = sel.getRangeAt(0);
                // Check if li is now empty (only has br, checkbox, or nested list)
                let hasDirectText = false;
                for (const child of liElement.childNodes) {
                    if (child.nodeType === 3 && child.textContent.trim()) {
                        hasDirectText = true;
                        break;
                    }
                    if (child.nodeType === 1) {
                        const tag = child.tagName?.toLowerCase();
                        if (tag !== 'br' && tag !== 'input' && tag !== 'ul' && tag !== 'ol') {
                            if (child.textContent.trim()) {
                                hasDirectText = true;
                                break;
                            }
                        }
                    }
                }
                // If no direct text content, ensure there's a <br> for cursor positioning
                if (!hasDirectText) {
                    // Remove any existing empty text nodes
                    const emptyTextNodes = [];
                    for (const child of liElement.childNodes) {
                        if (child.nodeType === 3 && !child.textContent.trim()) {
                            emptyTextNodes.push(child);
                        }
                    }
                    emptyTextNodes.forEach(n => n.remove());
                    // Check if there's already a <br>
                    let hasBr = false;
                    for (const child of liElement.childNodes) {
                        if (child.nodeType === 1 && child.tagName?.toLowerCase() === 'br') {
                            hasBr = true;
                            break;
                        }
                    }
                    // Add <br> if needed, after checkbox if present
                    if (!hasBr) {
                        const br = document.createElement('br');
                        if (checkbox) {
                            checkbox.after(br);
                        }
                        else if (nestedList) {
                            liElement.insertBefore(br, nestedList);
                        }
                        else {
                            liElement.insertBefore(br, liElement.firstChild);
                        }
                    }
                    // Only reposition cursor when li is empty (need to place at br)
                    const newRange = document.createRange();
                    const brInLi = liElement.querySelector(':scope > br');
                    if (brInLi) {
                        newRange.setStartBefore(brInLi);
                    }
                    else {
                        newRange.setStart(liElement, checkbox ? 1 : 0);
                    }
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                }
                // When hasDirectText is true, the cursor stays at the deletion point
                // (where deleteContents left it) - no need to reposition
                dependencies.syncMarkdownSync();
                dependencies.logger.log('Handled selection deletion in list item (early handler)');
                return true;
            }
            // Not in a list item, let browser handle it
            return true;
        }
        // Only handle collapsed selection from here
        // Find the <li> element if cursor is inside a list
        let liElement = null;
        let node = sel.anchorNode;
        while (node && node !== dependencies.editor) {
            if (node.tagName && node.tagName.toLowerCase() === 'li') {
                liElement = node;
                break;
            }
            node = node.parentNode;
        }
        if (liElement) {
            const list = liElement.parentNode;
            const nestedListInItem = liElement.querySelector(':scope > ul, :scope > ol');
            const isNestedList = list && list.parentNode && list.parentNode.tagName && list.parentNode.tagName.toLowerCase() === 'li';
            // Get only direct text content (excluding nested lists and br)
            let directTextContent = '';
            for (const child of liElement.childNodes) {
                if (child.nodeType === 3) {
                    directTextContent += child.textContent;
                }
                else if (child.nodeType === 1) {
                    const childTag = child.tagName ? child.tagName.toLowerCase() : '';
                    if (childTag !== 'ul' && childTag !== 'ol' && childTag !== 'input' && childTag !== 'br') {
                        directTextContent += child.textContent;
                    }
                }
            }
            directTextContent = directTextContent.trim();
            const isEmptyItem = directTextContent === '';
            // Check if cursor is at the beginning of the li
            const isAtBeginning = (() => {
                // Get the first text position in the li (excluding nested lists)
                let firstTextNode = null;
                const walker = document.createTreeWalker(liElement, NodeFilter.SHOW_TEXT, {
                    acceptNode: (node) => {
                        // Skip text nodes inside nested lists
                        let parent = node.parentNode;
                        while (parent && parent !== liElement) {
                            if (parent.tagName && (parent.tagName.toLowerCase() === 'ul' || parent.tagName.toLowerCase() === 'ol')) {
                                return NodeFilter.FILTER_REJECT;
                            }
                            parent = parent.parentNode;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                });
                firstTextNode = walker.nextNode();
                // Case: cursor is on the li element itself (e.g. before checkbox)
                if (range.startContainer === liElement) {
                    if (range.startOffset === 0)
                        return true;
                    // offset 1 with checkbox as first child = cursor just after checkbox = beginning of text
                    var childAtOffset = liElement.childNodes[range.startOffset];
                    var childBefore = liElement.childNodes[range.startOffset - 1];
                    if (childBefore && childBefore.nodeType === 1 && childBefore.tagName === 'INPUT' &&
                        childBefore.type === 'checkbox') {
                        return true;
                    }
                }
                if (!firstTextNode) {
                    // No text node, check if cursor is at position 0 of the li
                    return range.startContainer === liElement && range.startOffset === 0;
                }
                // Check if cursor is at the beginning of the first text node
                return range.startContainer === firstTextNode && range.startOffset === 0;
            })();
            dependencies.logger.log('Backspace on li:', {
                isNestedList: isNestedList,
                hasNestedList: !!nestedListInItem,
                isAtBeginning: isAtBeginning,
                isEmptyItem: isEmptyItem,
                liHTML: liElement.innerHTML.substring(0, 100)
            });
            // Case 1: Cursor at beginning of NON-EMPTY li, li is in a nested list, and li is the first child
            // Check if there's a previous sibling list (e.g. ol before ul in mixed nested lists)
            // If so, merge with the last li of that sibling list instead of parent li
            // Note: Empty li items are handled by the existing logic (convert to paragraph)
            if (isAtBeginning && isNestedList && !liElement.previousElementSibling && !isEmptyItem) {
                const parentLi = list.parentNode;
                // Check for previous sibling list within the same parent li
                const prevSiblingList = list.previousElementSibling;
                const hasPrevSiblingList = prevSiblingList && prevSiblingList.tagName &&
                    (prevSiblingList.tagName.toLowerCase() === 'ul' || prevSiblingList.tagName.toLowerCase() === 'ol');
                if (hasPrevSiblingList && prevSiblingList.lastElementChild) {
                    // Case 1a: Merge with last li of the previous sibling list
                    dependencies.logger.log('At beginning of first nested li (non-empty) - merging with previous sibling list last li');
                    e.preventDefault();
                    // Drill down to the deepest last li (visually the line just above)
                    var targetLi = prevSiblingList.lastElementChild;
                    var deepNestedList = targetLi ? targetLi.querySelector(':scope > ul, :scope > ol') : null;
                    while (deepNestedList && deepNestedList.lastElementChild) {
                        targetLi = deepNestedList.lastElementChild;
                        deepNestedList = targetLi.querySelector(':scope > ul, :scope > ol');
                    }
                    // Get content of current li (excluding nested list and checkbox)
                    const currentContent = [];
                    for (const child of Array.from(liElement.childNodes)) {
                        if (child.nodeType === 1 && (child.tagName.toLowerCase() === 'ul' || child.tagName.toLowerCase() === 'ol')) {
                            continue; // Skip nested lists
                        }
                        if (child.nodeType === 1 && child.tagName === 'INPUT' && child.type === 'checkbox') {
                            continue; // Skip checkbox
                        }
                        currentContent.push(child);
                    }
                    // Save the nested list from current li if any
                    const savedNestedList = nestedListInItem;
                    if (savedNestedList) {
                        savedNestedList.remove();
                    }
                    // Find position in targetLi (before any nested lists)
                    let insertBeforeNode = null;
                    for (const child of targetLi.childNodes) {
                        if (child.nodeType === 1 && (child.tagName === 'UL' || child.tagName === 'OL')) {
                            insertBeforeNode = child;
                            break;
                        }
                    }
                    // Remove trailing <br> from target li
                    const targetLastChild = insertBeforeNode ? insertBeforeNode.previousSibling : targetLi.lastChild;
                    if (targetLastChild && targetLastChild.nodeType === 1 && targetLastChild.tagName.toLowerCase() === 'br') {
                        targetLastChild.remove();
                    }
                    // Mark cursor position (end of target li's text)
                    let cursorNode = insertBeforeNode ? insertBeforeNode.previousSibling : targetLi.lastChild;
                    let cursorOffset = cursorNode && cursorNode.nodeType === 3 ? cursorNode.textContent.length : 0;
                    // Append content from current li to target li
                    for (const child of currentContent) {
                        if (insertBeforeNode) {
                            targetLi.insertBefore(child, insertBeforeNode);
                        }
                        else {
                            targetLi.appendChild(child);
                        }
                    }
                    // Move nested lists from current li to target li
                    if (savedNestedList) {
                        targetLi.appendChild(savedNestedList);
                    }
                    // Remove current li
                    liElement.remove();
                    // If current list is now empty, remove it
                    if (list.children.length === 0) {
                        list.remove();
                    }
                    // Set cursor position
                    if (cursorNode && cursorNode.nodeType === 3 && cursorNode.isConnected) {
                        const newRange = document.createRange();
                        newRange.setStart(cursorNode, cursorOffset);
                        newRange.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(newRange);
                    }
                    else {
                        dependencies.setCursorToEnd(targetLi);
                    }
                    dependencies.syncMarkdownSync();
                    return true;
                }
                else if (parentLi && parentLi.tagName && parentLi.tagName.toLowerCase() === 'li') {
                    // Case 1b: Original behavior - merge with parent li's content
                    dependencies.logger.log('At beginning of first nested li (non-empty) - merging with parentLi');
                    dependencies.logger.log('parentLi.innerHTML BEFORE:', parentLi.innerHTML);
                    e.preventDefault();
                    // Get content of current li (excluding nested list and checkbox)
                    const currentContent = [];
                    for (const child of Array.from(liElement.childNodes)) {
                        if (child.nodeType === 1 && (child.tagName.toLowerCase() === 'ul' || child.tagName.toLowerCase() === 'ol')) {
                            continue; // Skip nested lists
                        }
                        if (child.nodeType === 1 && child.tagName === 'INPUT' && child.type === 'checkbox') {
                            continue; // Skip checkbox
                        }
                        currentContent.push(child);
                    }
                    // Strip leading whitespace from first text node (task list items have
                    // a formatting space " b" after the checkbox that should not appear
                    // in the merged text)
                    if (currentContent.length > 0 && currentContent[0].nodeType === 3) {
                        currentContent[0].textContent = currentContent[0].textContent.replace(/^\s+/, '');
                        if (!currentContent[0].textContent) {
                            currentContent.shift();
                        }
                    }
                    // Save the nested list from current li if any
                    const savedNestedList = nestedListInItem;
                    if (savedNestedList) {
                        savedNestedList.remove();
                    }
                    // Find the position to insert content in parentLi (before the nested list)
                    const parentNestedList = parentLi.querySelector(':scope > ul, :scope > ol');
                    // Remove the <br> from parentLi if it exists (it's a placeholder for empty li)
                    const parentBr = parentLi.querySelector(':scope > br');
                    if (parentBr && parentNestedList && parentBr.nextSibling === parentNestedList) {
                        parentBr.remove();
                    }
                    // Insert current li's content into parentLi (before the nested list)
                    for (const child of currentContent) {
                        if (parentNestedList) {
                            parentNestedList.before(child);
                        }
                        else {
                            parentLi.appendChild(child);
                        }
                    }
                    // Remove the current li
                    liElement.remove();
                    // If the list is now empty, remove it
                    if (list.children.length === 0) {
                        list.remove();
                    }
                    // If there was a nested list in current li, insert it before the remaining siblings.
                    // b was the first item, so its children (c) must come BEFORE d, e, ...
                    if (savedNestedList) {
                        const existingNestedList = parentLi.querySelector(':scope > ul, :scope > ol');
                        if (existingNestedList) {
                            if (savedNestedList.tagName === existingNestedList.tagName) {
                                // Same list type: merge items at the BEGINNING (before d)
                                const firstExistingChild = existingNestedList.firstChild;
                                while (savedNestedList.firstChild) {
                                    existingNestedList.insertBefore(savedNestedList.firstChild, firstExistingChild);
                                }
                            }
                            else {
                                // Different list type: insert savedNestedList itself before existingNestedList
                                // (preserves list type of c, keeps visual order c before d)
                                existingNestedList.parentNode.insertBefore(savedNestedList, existingNestedList);
                            }
                        }
                        else {
                            parentLi.appendChild(savedNestedList);
                        }
                    }
                    // Set cursor at the end of parentLi's original text (before the merged content)
                    // This is the correct position - at the junction point between original and merged content
                    const newSel = window.getSelection();
                    const newRange = document.createRange();
                    // Find the last text node in parentLi that is NOT inside a nested list
                    // and is BEFORE the merged content
                    const findCursorPosition = () => {
                        // We need to find the text position just before where we inserted content
                        // The content was inserted before parentNestedList (if exists) or at the end
                        // Get all text nodes in parentLi (excluding nested lists)
                        const textNodes = [];
                        const walker = document.createTreeWalker(parentLi, NodeFilter.SHOW_TEXT);
                        let textNode;
                        while (textNode = walker.nextNode()) {
                            // Skip text nodes inside nested lists
                            let parent = textNode.parentNode;
                            let inNestedList = false;
                            while (parent && parent !== parentLi) {
                                if (parent.tagName && (parent.tagName.toLowerCase() === 'ul' || parent.tagName.toLowerCase() === 'ol')) {
                                    inNestedList = true;
                                    break;
                                }
                                parent = parent.parentNode;
                            }
                            if (!inNestedList) {
                                textNodes.push(textNode);
                            }
                        }
                        if (textNodes.length === 0) {
                            // No text nodes in parentLi - this shouldn't happen after merge
                            // but if it does, return null to use fallback
                            return null;
                        }
                        // If we moved content, find the position just before the first moved content
                        if (currentContent.length > 0) {
                            const firstMovedContent = currentContent[0];
                            // Find the text node that ends just before the first moved content
                            for (let i = 0; i < textNodes.length; i++) {
                                const tn = textNodes[i];
                                // Check if this text node is part of the moved content
                                let isMovedContent = false;
                                for (const mc of currentContent) {
                                    if (mc === tn || (mc.contains && mc.contains(tn))) {
                                        isMovedContent = true;
                                        break;
                                    }
                                }
                                if (isMovedContent) {
                                    // The previous text node (if any) is where we should place cursor
                                    if (i > 0) {
                                        const prevTextNode = textNodes[i - 1];
                                        return { node: prevTextNode, offset: prevTextNode.length };
                                    }
                                    else {
                                        // No previous text node - parent li was empty before merge
                                        // Set cursor at the beginning of the first moved content
                                        if (firstMovedContent.nodeType === 3) {
                                            return { node: firstMovedContent, offset: 0 };
                                        }
                                        else {
                                            // Find first text node in moved content
                                            const firstTextInMoved = firstMovedContent.nodeType === 3
                                                ? firstMovedContent
                                                : firstMovedContent.querySelector ?
                                                    (function () {
                                                        const w = document.createTreeWalker(firstMovedContent, NodeFilter.SHOW_TEXT);
                                                        return w.nextNode();
                                                    })() : null;
                                            if (firstTextInMoved) {
                                                return { node: firstTextInMoved, offset: 0 };
                                            }
                                            return null;
                                        }
                                    }
                                }
                            }
                        }
                        // Fallback: cursor at end of last text node
                        const lastText = textNodes[textNodes.length - 1];
                        return { node: lastText, offset: lastText.length };
                    };
                    const cursorPos = findCursorPosition();
                    if (cursorPos && cursorPos.node) {
                        newRange.setStart(cursorPos.node, cursorPos.offset);
                        newRange.collapse(true);
                        newSel.removeAllRanges();
                        newSel.addRange(newRange);
                    }
                    else {
                        // Fallback: use setCursorToEnd
                        dependencies.setCursorToEnd(parentLi);
                    }
                    dependencies.logger.log('parentLi.innerHTML FINAL:', parentLi.innerHTML);
                    dependencies.logger.log('editor.innerHTML FINAL:', dependencies.editor.innerHTML);
                    // Merge adjacent text nodes so "a" + "b" → "ab"
                    // (browser auto-updates live Range objects on normalize)
                    parentLi.normalize();
                    dependencies.syncMarkdown();
                    return true;
                }
            }
        }
        return false;
    }
    return {
        handleEarlyListBackspace
    };
}
module.exports = { createListSelectionDelete };
