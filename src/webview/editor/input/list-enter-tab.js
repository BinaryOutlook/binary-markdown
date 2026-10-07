'use strict';
// Construction defines capabilities; bootstrap controls the original initialization order.
function createListEnterTab(dependencies) {
    function handleListEnter(e, listItem, sel) {
        if (listItem && dependencies.editor.contains(listItem)) {
            const list = listItem.parentNode;
            // Check for empty item - only check direct text content, not nested lists
            const checkbox = listItem.querySelector(':scope > input[type="checkbox"]');
            const nestedListInItem = listItem.querySelector(':scope > ul, :scope > ol');
            // Get only direct text content (excluding nested lists and br)
            let directTextContent = '';
            for (const child of listItem.childNodes) {
                if (child.nodeType === 3) { // Text node
                    directTextContent += child.textContent;
                }
                else if (child.nodeType === 1) { // Element node
                    const tag = child.tagName?.toLowerCase();
                    // Exclude ul, ol, input, and br (br is used as placeholder in empty items)
                    if (tag !== 'ul' && tag !== 'ol' && tag !== 'input' && tag !== 'br') {
                        directTextContent += child.textContent;
                    }
                }
            }
            directTextContent = directTextContent.trim();
            // Item is empty if it has no text content (br is just a placeholder for empty items)
            const isEmptyItem = directTextContent === '' || (checkbox && directTextContent === '');
            if (isEmptyItem) {
                // Empty item - outdent (keep position) or exit list
                e.preventDefault();
                // Check if this is a nested list (parent list is inside a LI)
                const parentLi = list.parentNode?.tagName === 'LI' ? list.parentNode : null;
                if (parentLi) {
                    // Nested list - outdent: convert to parent level item AT SAME POSITION
                    // The empty item's own nested list AND following siblings stay at the SAME nest level
                    // Get the empty item's own nested list (children)
                    const ownNestedList = listItem.querySelector(':scope > ul, :scope > ol');
                    // Get following siblings
                    const followingSiblings = [];
                    let sibling = listItem.nextElementSibling;
                    while (sibling) {
                        followingSiblings.push(sibling);
                        sibling = sibling.nextElementSibling;
                    }
                    // Remove the empty item from nested list
                    listItem.remove();
                    // Create new LI at parent level
                    const newLi = document.createElement('li');
                    newLi.innerHTML = '<br>';
                    // Collect items to put in the new nested list under newLi:
                    // 1. Items from the empty item's own nested list (children)
                    // 2. Following siblings (stay at same nest level)
                    const itemsToNest = [];
                    // Add items from own nested list
                    if (ownNestedList) {
                        while (ownNestedList.firstChild) {
                            itemsToNest.push(ownNestedList.firstChild);
                            ownNestedList.firstChild.remove();
                        }
                        ownNestedList.remove();
                    }
                    // Add following siblings
                    for (const sib of followingSiblings) {
                        sib.remove();
                        itemsToNest.push(sib);
                    }
                    // If there are items to nest, create a nested list under newLi
                    if (itemsToNest.length > 0) {
                        const newNestedList = document.createElement(list.tagName);
                        for (const item of itemsToNest) {
                            newNestedList.appendChild(item);
                        }
                        newLi.appendChild(newNestedList);
                    }
                    // Insert new LI after parentLi (at parent level, same position visually)
                    parentLi.after(newLi);
                    // Remove nested list if empty
                    if (list.children.length === 0)
                        list.remove();
                    // Set cursor to the beginning of newLi (before any nested list)
                    const newRange = document.createRange();
                    const firstChild = newLi.firstChild;
                    if (firstChild && firstChild.nodeType === 3) {
                        newRange.setStart(firstChild, 0);
                    }
                    else if (firstChild && firstChild.tagName === 'BR') {
                        newRange.setStartBefore(firstChild);
                    }
                    else {
                        newRange.setStart(newLi, 0);
                    }
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                }
                else {
                    // Top-level empty list item - convert to paragraph AT SAME POSITION
                    // Check if this LI has nested lists (children)
                    const nestedList = listItem.querySelector(':scope > ul, :scope > ol');
                    // Get siblings after this item
                    const followingSiblings = [];
                    let sibling = listItem.nextElementSibling;
                    while (sibling) {
                        followingSiblings.push(sibling);
                        sibling = sibling.nextElementSibling;
                    }
                    // Remove the empty item
                    listItem.remove();
                    // Create blank paragraph
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';
                    // Build the structure: [remaining list] -> paragraph -> [nested list if any] -> [following siblings list if any]
                    let insertAfter = list;
                    // Insert paragraph after the list
                    list.after(p);
                    insertAfter = p;
                    // If there was a nested list, it becomes a top-level list after the paragraph
                    if (nestedList) {
                        nestedList.remove();
                        insertAfter.after(nestedList);
                        insertAfter = nestedList;
                    }
                    // If there are following siblings, create a new list for them
                    if (followingSiblings.length > 0) {
                        const newList = document.createElement(list.tagName);
                        for (const sib of followingSiblings) {
                            sib.remove();
                            newList.appendChild(sib);
                        }
                        insertAfter.after(newList);
                    }
                    // Remove list if empty
                    if (list.children.length === 0)
                        list.remove();
                    dependencies.setCursorToEnd(p);
                }
                dependencies.syncMarkdown();
            }
            else {
                // Continue list - split at cursor position
                // Text after cursor goes to new item
                // Nested lists stay with original item (NOT moved to new item)
                e.preventDefault();
                const range = sel.getRangeAt(0);
                // Find nested lists in this item (they will stay with original item)
                const nestedLists = Array.from(listItem.querySelectorAll(':scope > ul, :scope > ol'));
                // Get text content after cursor (excluding nested lists)
                const afterRange = range.cloneRange();
                // Find the end point - should be before any nested list
                let endNode = listItem;
                let endOffset = listItem.childNodes.length;
                // Adjust end to exclude nested lists
                for (let i = listItem.childNodes.length - 1; i >= 0; i--) {
                    const child = listItem.childNodes[i];
                    if (child.nodeType === 1 && (child.tagName === 'UL' || child.tagName === 'OL')) {
                        continue; // Skip nested lists
                    }
                    endNode = listItem;
                    endOffset = i + 1;
                    break;
                }
                afterRange.setStart(range.endContainer, range.endOffset);
                afterRange.setEnd(endNode, endOffset);
                // Extract content after cursor (text only)
                const afterContent = afterRange.extractContents();
                // Clean up: if listItem text part now ends with just whitespace or <br>, remove it
                // But keep nested lists in place
                for (let i = listItem.childNodes.length - 1; i >= 0; i--) {
                    const child = listItem.childNodes[i];
                    if (child.nodeType === 1 && (child.tagName === 'UL' || child.tagName === 'OL')) {
                        continue; // Keep nested lists
                    }
                    if (child.nodeType === 3 && child.textContent.trim() === '') {
                        child.remove();
                    }
                    else if (child.nodeType === 1 && child.tagName.toLowerCase() === 'br') {
                        child.remove();
                    }
                    else {
                        break;
                    }
                }
                // Create new list item
                const newLi = document.createElement('li');
                if (checkbox) {
                    // For task list, add checkbox to new item
                    const newCb = document.createElement('input');
                    newCb.type = 'checkbox';
                    newLi.appendChild(newCb);
                }
                // Append the extracted content to new item
                if (afterContent.textContent.trim() !== '') {
                    newLi.appendChild(afterContent);
                }
                else {
                    // If no content after cursor, add <br> for empty item
                    if (!checkbox) {
                        newLi.innerHTML = '<br>';
                    }
                }
                // Insert new item after current item
                // If there are nested lists, insert BEFORE them (new item becomes sibling, not parent)
                if (nestedLists.length > 0) {
                    // Insert new LI after current LI (nested lists stay with original)
                    listItem.after(newLi);
                    // Move nested lists to be children of the new LI
                    for (const nestedList of nestedLists) {
                        newLi.appendChild(nestedList);
                    }
                }
                else {
                    listItem.after(newLi);
                }
                // Set cursor to start of new item (after checkbox if present)
                if (checkbox && newLi.querySelector('input[type="checkbox"]')) {
                    // Position cursor after the checkbox
                    const cb = newLi.querySelector('input[type="checkbox"]');
                    const nextNode = cb.nextSibling;
                    const newRange = document.createRange();
                    if (nextNode) {
                        if (nextNode.nodeType === 3) {
                            newRange.setStart(nextNode, 0);
                        }
                        else {
                            newRange.setStartBefore(nextNode);
                        }
                    }
                    else {
                        newRange.setStartAfter(cb);
                    }
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                }
                else {
                    // Position cursor at start of new item content (before nested lists)
                    const firstChild = newLi.firstChild;
                    if (firstChild) {
                        const newRange = document.createRange();
                        // Skip nested lists when positioning cursor
                        if (firstChild.nodeType === 1 && (firstChild.tagName === 'UL' || firstChild.tagName === 'OL')) {
                            // First child is nested list, position cursor before it
                            newRange.setStartBefore(firstChild);
                        }
                        else if (firstChild.nodeType === 3) {
                            newRange.setStart(firstChild, 0);
                        }
                        else if (firstChild.tagName && firstChild.tagName.toLowerCase() === 'br') {
                            newRange.setStartBefore(firstChild);
                        }
                        else {
                            newRange.setStart(firstChild, 0);
                        }
                        newRange.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(newRange);
                    }
                    else {
                        dependencies.setCursorToEnd(newLi);
                    }
                }
                dependencies.syncMarkdown();
            }
            return true;
        }
        return false;
    }
    function handleMultiListTab(e, sel) {
        if (sel && sel.rangeCount) {
            const range = sel.getRangeAt(0);
            const selectedLiElements = dependencies.getSelectedListItems(range, sel);
            dependencies.logger.log('Multi-selection Tab:', {
                selectedCount: selectedLiElements.length,
                shiftKey: e.shiftKey,
                isCollapsed: sel.isCollapsed
            });
            if (selectedLiElements.length > 1) {
                // Multiple list items selected - indent/outdent all
                // Save selection before modifying DOM
                const savedRange = range.cloneRange();
                const startContainer = savedRange.startContainer;
                const startOffset = savedRange.startOffset;
                const endContainer = savedRange.endContainer;
                const endOffset = savedRange.endOffset;
                if (e.shiftKey) {
                    // Shift+Tab: outdent all selected items
                    // Process from bottom to top to maintain structure
                    for (let i = selectedLiElements.length - 1; i >= 0; i--) {
                        dependencies.outdentListItem(selectedLiElements[i]);
                    }
                }
                else {
                    // Tab: indent all selected items together
                    // Check if first item can be indented (has previous sibling)
                    const firstLi = selectedLiElements[0];
                    const prevSibling = firstLi.previousElementSibling;
                    if (!prevSibling || prevSibling.tagName.toLowerCase() !== 'li') {
                        dependencies.logger.log('Cannot indent: first selected item has no previous sibling');
                        return true; // Can't indent if first item has no previous sibling
                    }
                    // Get or create nested list in previous sibling
                    // Use querySelectorAll to get the LAST nested list (Section 16: querySelector returns only the first match)
                    const parentList = firstLi.parentNode;
                    const nestedLists = prevSibling.querySelectorAll(':scope > ul, :scope > ol');
                    let nestedList;
                    if (nestedLists.length > 0) {
                        nestedList = nestedLists[nestedLists.length - 1];
                    }
                    else {
                        nestedList = document.createElement(parentList.tagName.toLowerCase());
                        prevSibling.appendChild(nestedList);
                    }
                    // Move all selected items to the nested list
                    for (const li of selectedLiElements) {
                        nestedList.appendChild(li);
                    }
                }
                // Restore selection (cursor position)
                try {
                    const newRange = document.createRange();
                    newRange.setStart(startContainer, startOffset);
                    newRange.setEnd(endContainer, endOffset);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                }
                catch (err) {
                    dependencies.logger.log('Failed to restore selection after multi-item indent:', err);
                }
                dependencies.syncMarkdown();
                return true;
            }
        }
        return false;
    }
    function handleSingleListTab(e, liElement, sel) {
        dependencies.logger.log('In LI element, will indent/outdent');
        // #endregion
        // Save cursor position relative to the li element
        const range = sel.getRangeAt(0);
        const startContainer = range.startContainer;
        const startOffset = range.startOffset;
        // Calculate the text offset within the li (excluding nested lists)
        let textOffset = 0;
        let foundCursor = false;
        const calculateOffset = (node) => {
            if (foundCursor)
                return;
            if (node === startContainer) {
                if (node.nodeType === 3) {
                    textOffset += startOffset;
                }
                foundCursor = true;
                return;
            }
            if (node.nodeType === 3) {
                textOffset += node.textContent.length;
            }
            else if (node.nodeType === 1) {
                const tag = node.tagName.toLowerCase();
                // Skip nested lists
                if (tag !== 'ul' && tag !== 'ol') {
                    for (const child of node.childNodes) {
                        calculateOffset(child);
                        if (foundCursor)
                            return;
                    }
                }
            }
        };
        // Calculate offset within the li's direct content (not nested lists)
        for (const child of liElement.childNodes) {
            const tag = child.nodeType === 1 ? child.tagName?.toLowerCase() : '';
            if (tag !== 'ul' && tag !== 'ol') {
                calculateOffset(child);
                if (foundCursor)
                    break;
            }
        }
        if (e.shiftKey) {
            // Shift+Tab: outdent
            dependencies.outdentListItem(liElement);
        }
        else {
            // Tab: indent
            dependencies.indentListItem(liElement);
        }
        // If liElement was converted to a paragraph and removed from DOM
        // (e.g. Shift+Tab on top-level item), convertListItemToParagraph
        // already set the cursor and called syncMarkdown – nothing left to do.
        if (!liElement.isConnected) {
            return true;
        }
        // Restore cursor position using the saved text offset
        try {
            let currentOffset = 0;
            let targetNode = null;
            let targetOffset = 0;
            const findPosition = (node) => {
                if (targetNode)
                    return;
                if (node.nodeType === 3) {
                    const len = node.textContent.length;
                    if (currentOffset + len >= textOffset) {
                        targetNode = node;
                        targetOffset = textOffset - currentOffset;
                        return;
                    }
                    currentOffset += len;
                }
                else if (node.nodeType === 1) {
                    const tag = node.tagName.toLowerCase();
                    // Skip nested lists
                    if (tag !== 'ul' && tag !== 'ol') {
                        for (const child of node.childNodes) {
                            findPosition(child);
                            if (targetNode)
                                return;
                        }
                    }
                }
            };
            // Find the position within the li's direct content
            for (const child of liElement.childNodes) {
                const tag = child.nodeType === 1 ? child.tagName?.toLowerCase() : '';
                if (tag !== 'ul' && tag !== 'ol') {
                    findPosition(child);
                    if (targetNode)
                        break;
                }
            }
            if (targetNode) {
                const newRange = document.createRange();
                newRange.setStart(targetNode, targetOffset);
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
            }
            else {
                // Fallback: set cursor to end of li's text content
                dependencies.setCursorToEndOfLi(liElement);
            }
        }
        catch (err) {
            dependencies.logger.log('Failed to restore cursor after indent:', err);
            // Fallback: set cursor to end of li
            try {
                dependencies.setCursorToEndOfLi(liElement);
            }
            catch (e2) {
                // ignore
            }
        }
        dependencies.syncMarkdown();
        return true;
    }
    return {
        handleListEnter,
        handleMultiListTab,
        handleSingleListTab
    };
}
module.exports = { createListEnterTab };
