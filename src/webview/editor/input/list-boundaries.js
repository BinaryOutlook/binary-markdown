'use strict';

// A true result stops key dispatch, whether or not browser default was prevented.
function createListBoundaries(dependencies) {
    function handleFallbackEmptyList(cursorInParagraph, e, liElement, paragraphInLi, range) {
if (cursorInParagraph && paragraphInLi && range.startOffset === 0 && range.collapsed) {
                dependencies.logger.log('Cursor in paragraph inside li, skipping li handling');
                // Fall through to paragraph handling below
            } else if (liElement) {
                const list = liElement.parentNode;
                const textContent = liElement.textContent.trim();
                const checkbox = liElement.querySelector(':scope > input[type="checkbox"]');
                const nestedListInItem = liElement.querySelector(':scope > ul, :scope > ol');

                // Get only direct text content (excluding nested lists and br)
                let directTextContent = '';
                for (const child of liElement.childNodes) {
                    if (child.nodeType === 3) { // Text node
                        directTextContent += child.textContent;
                    } else if (child.nodeType === 1) { // Element node
                        const childTag = child.tagName?.toLowerCase();
                        // Exclude ul, ol, input, and br (br is used as placeholder in empty items)
                        if (childTag !== 'ul' && childTag !== 'ol' && childTag !== 'input' && childTag !== 'br') {
                            directTextContent += child.textContent;
                        }
                    }
                }
                directTextContent = directTextContent.trim();

                // Item is empty if it has no text content (br is just a placeholder for empty items)
                const isEmptyItem = directTextContent === '' || (checkbox && directTextContent === '');

                // Check if this is a standalone single-item list at top level
                const isTopLevel = list && list.parentNode === dependencies.editor;
                const isSingleItem = list && list.children.length === 1;
                const isStandaloneSingleList = isTopLevel && isSingleItem && !nestedListInItem;

                // Check if this is a nested list item
                const isNestedList = list && list.parentNode && list.parentNode.tagName?.toLowerCase() === 'li';

                dependencies.logger.log('Backspace on li:', {
                    directTextContent: directTextContent,
                    isEmptyItem: isEmptyItem,
                    isTopLevel: isTopLevel,
                    isSingleItem: isSingleItem,
                    hasNestedList: !!nestedListInItem,
                    isStandaloneSingleList: isStandaloneSingleList,
                    isNestedList: isNestedList,
                    startOffset: range.startOffset,
                    collapsed: range.collapsed
                });

                // Standalone single empty list item - convert to paragraph regardless of cursor position
                if (isEmptyItem && isStandaloneSingleList) {
                    e.preventDefault();
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';
                    list.replaceWith(p);
                    dependencies.setCursorToEnd(p);
                    dependencies.syncMarkdown();
                    return true;
                }

                // Top-level empty list item with nested list - convert to paragraph and preserve nested list
                if (isEmptyItem && isTopLevel && nestedListInItem && range.startOffset === 0 && range.collapsed) {
                    e.preventDefault();

                    // Get ALL nested lists in this li (there may be multiple)
                    const allNestedLists = Array.from(liElement.querySelectorAll(':scope > ul, :scope > ol'));

                    // Get following siblings in the list
                    const followingSiblings = [];
                    let sibling = liElement.nextElementSibling;
                    while (sibling) {
                        followingSiblings.push(sibling);
                        sibling = sibling.nextElementSibling;
                    }

                    // First, remove all nested lists from the li (before removing li)
                    for (const nestedList of allNestedLists) {
                        nestedList.remove();
                    }

                    // Remove the empty item
                    liElement.remove();

                    // Create paragraph
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';

                    // Insert paragraph after the list
                    list.after(p);
                    let insertAfter = p;

                    // All nested lists become sibling lists after the paragraph
                    for (const nestedList of allNestedLists) {
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

                    // Remove the original list if empty
                    if (list.children.length === 0) {
                        list.remove();
                    }

                    dependencies.setCursorToEnd(p);
                    dependencies.syncMarkdown();
                    return true;
                }

                // Empty nested list item at beginning - handle based on preceding siblings
                if (isEmptyItem && isNestedList && range.startOffset === 0 && range.collapsed) {
                    e.preventDefault();

                    const parentLi = list.parentNode;

                    // Get preceding siblings in the nested list
                    const precedingSiblings = [];
                    let prevSib = liElement.previousElementSibling;
                    while (prevSib) {
                        precedingSiblings.unshift(prevSib);
                        prevSib = prevSib.previousElementSibling;
                    }

                    // Get following siblings in the nested list
                    const followingSiblings = [];
                    let sibling = liElement.nextElementSibling;
                    while (sibling) {
                        followingSiblings.push(sibling);
                        sibling = sibling.nextElementSibling;
                    }

                    // Get the nested list from this item (if any)
                    const ownNestedList = nestedListInItem;

                    dependencies.logger.log('Empty nested list item:', {
                        precedingSiblings: precedingSiblings.length,
                        followingSiblings: followingSiblings.length,
                        hasOwnNestedList: !!ownNestedList
                    });

                    // Check if the previous sibling has a nested list (different indent level)
                    const prevItem = liElement.previousElementSibling;
                    const prevItemHasNestedList = prevItem ? prevItem.querySelector(':scope > ul, :scope > ol') !== null : false;

                    dependencies.logger.log('prevItem check:', {
                        hasPrevItem: !!prevItem,
                        prevItemHasNestedList: prevItemHasNestedList
                    });

                    // Always convert to paragraph (requirement 7-9)
                    // Empty nested list item -> convert to paragraph while maintaining indent

                    // Remove the empty item first
                    liElement.remove();

                    // Create paragraph
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';

                    if (precedingSiblings.length === 0 && followingSiblings.length === 0) {
                        // Only item in the list - replace list with paragraph
                        list.replaceWith(p);

                        // If there was own nested list, insert it after the paragraph
                        if (ownNestedList) {
                            ownNestedList.remove();
                            p.after(ownNestedList);
                        }
                    } else if (precedingSiblings.length === 0) {
                        // First item with following siblings
                        // Insert paragraph before the list
                        list.before(p);

                        // If there was own nested list, insert it after the paragraph
                        if (ownNestedList) {
                            ownNestedList.remove();
                            p.after(ownNestedList);
                        }
                    } else if (followingSiblings.length === 0) {
                        // Last item with preceding siblings (and prev has nested list)
                        // Insert paragraph after the list (but still inside parent li)
                        list.after(p);

                        // If there was own nested list, insert it after the paragraph
                        if (ownNestedList) {
                            ownNestedList.remove();
                            p.after(ownNestedList);
                        }

                        dependencies.logger.log('After paragraph insertion - parentLi innerHTML:', parentLi.innerHTML.substring(0, 200));
                    } else {
                        // Middle item with preceding siblings (and prev has nested list)
                        // Create new list for following siblings
                        const newList = document.createElement(list.tagName);
                        for (const sib of followingSiblings) {
                            newList.appendChild(sib);
                        }

                        // Insert paragraph after the original list
                        list.after(p);

                        // If there was own nested list, insert it after the paragraph
                        if (ownNestedList) {
                            ownNestedList.remove();
                            p.after(ownNestedList);
                            ownNestedList.after(newList);
                        } else {
                            p.after(newList);
                        }
                    }

                    dependencies.setCursorToEnd(p);
                    dependencies.syncMarkdown();
                    return true;
                }
            }
        return false;
    }

    function handleParagraphInsideListDelete(e, paragraphElement, sel) {
if (paragraphElement) {
                    const parentElement = paragraphElement.parentNode;
                    const parentIsLi = parentElement && parentElement.tagName?.toLowerCase() === 'li';
                    const isEmptyParagraph = paragraphElement.innerHTML === '<br>' || paragraphElement.textContent.trim() === '';

                    // Special case: Empty paragraph inside a list item (indented paragraph)
                    if (isEmptyParagraph && parentIsLi) {
                        // Check if there's a list before and after the paragraph
                        let prevSibling = paragraphElement.previousSibling;
                        while (prevSibling && prevSibling.nodeType === 3 && prevSibling.textContent.trim() === '') {
                            prevSibling = prevSibling.previousSibling;
                        }
                        let nextSibling = paragraphElement.nextSibling;
                        while (nextSibling && nextSibling.nodeType === 3 && nextSibling.textContent.trim() === '') {
                            nextSibling = nextSibling.nextSibling;
                        }

                        const prevIsList = prevSibling && prevSibling.nodeType === 1 &&
                            (prevSibling.tagName?.toLowerCase() === 'ul' || prevSibling.tagName?.toLowerCase() === 'ol');
                        const nextIsList = nextSibling && nextSibling.nodeType === 1 &&
                            (nextSibling.tagName?.toLowerCase() === 'ul' || nextSibling.tagName?.toLowerCase() === 'ol');

                        // Check if prev is text (not list) - parent li has text before paragraph
                        const prevIsText = prevSibling && (prevSibling.nodeType === 3 ||
                            (prevSibling.nodeType === 1 && prevSibling.tagName?.toLowerCase() !== 'ul' && prevSibling.tagName?.toLowerCase() !== 'ol'));

                        dependencies.logger.log('Empty paragraph in li:', {
                            prevSibling: prevSibling ? (prevSibling.nodeType === 3 ? 'TEXT: ' + prevSibling.textContent : prevSibling.tagName) : null,
                            nextSibling: nextSibling ? (nextSibling.nodeType === 3 ? 'TEXT: ' + nextSibling.textContent : nextSibling.tagName) : null,
                            prevIsList: prevIsList,
                            nextIsList: nextIsList,
                            prevIsText: prevIsText
                        });

                        if (prevIsList && nextIsList) {
                            // Case 1: List before and after - merge them
                            // Example:
                            // - dd
                            // |        ← empty paragraph
                            // - fff
                            // → merge to: - dd
                            //             - fff
                            dependencies.logger.log('Case 1: prevIsList && nextIsList - merging lists');
                            e.preventDefault();

                            const prevList = prevSibling;
                            const nextList = nextSibling;

                            // Save the last item of prev list BEFORE merging (for cursor position)
                            const lastItemBeforeMerge = prevList.lastElementChild;

                            // Move all items from next list to prev list
                            while (nextList.firstChild) {
                                prevList.appendChild(nextList.firstChild);
                            }
                            nextList.remove();
                            paragraphElement.remove();

                            // Set cursor to the last item of the original prev list (before merge)
                            if (lastItemBeforeMerge) {
                                dependencies.setCursorToEnd(lastItemBeforeMerge);
                            } else {
                                dependencies.setCursorToEnd(prevList.lastElementChild);
                            }

                            dependencies.syncMarkdown();
                            return true;
                        }

                        if (prevIsText && nextIsList) {
                            // Case 2: Text before (parent li text) and list after
                            // Example:
                            // - bbb
                            //   |      ← empty paragraph (inside li for bbb)
                            //     - dd
                            //     - fff
                            // → merge to: - bbb
                            //               - dd
                            //               - fff
                            // The next list should become a direct child of the parent li
                            dependencies.logger.log('Case 2: prevIsText && nextIsList - removing paragraph');
                            e.preventDefault();

                            const nextList = nextSibling;
                            const parentLi = parentElement;

                            // Remove the paragraph
                            paragraphElement.remove();

                            // The nextList is already a child of parentLi, just need to set cursor
                            // Set cursor to end of parent li's text content (before the list)
                            let cursorTarget = nextList.previousSibling;
                            while (cursorTarget && cursorTarget.nodeType === 3 && cursorTarget.textContent.trim() === '') {
                                cursorTarget = cursorTarget.previousSibling;
                            }

                            if (cursorTarget && cursorTarget.nodeType === 3) {
                                const newRange = document.createRange();
                                newRange.setStart(cursorTarget, cursorTarget.textContent.length);
                                newRange.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(newRange);
                            } else if (cursorTarget && cursorTarget.nodeType === 1 && cursorTarget.tagName?.toLowerCase() === 'br') {
                                // cursorTarget is a <br> element - set cursor before it
                                const newRange = document.createRange();
                                newRange.setStartBefore(cursorTarget);
                                newRange.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(newRange);
                            } else {
                                // Find text node or br in parent li
                                let found = false;
                                for (const child of parentLi.childNodes) {
                                    if (child.nodeType === 3 && child.textContent.trim() !== '') {
                                        const newRange = document.createRange();
                                        newRange.setStart(child, child.textContent.length);
                                        newRange.collapse(true);
                                        sel.removeAllRanges();
                                        sel.addRange(newRange);
                                        found = true;
                                        break;
                                    } else if (child.nodeType === 1 && child.tagName?.toLowerCase() === 'br') {
                                        const newRange = document.createRange();
                                        newRange.setStartBefore(child);
                                        newRange.collapse(true);
                                        sel.removeAllRanges();
                                        sel.addRange(newRange);
                                        found = true;
                                        break;
                                    }
                                }
                                if (!found) {
                                    dependencies.setCursorToEnd(parentLi);
                                }
                            }

                            dependencies.syncMarkdown();
                            return true;
                        }

                        if (prevIsList && !nextIsList) {
                            // Case 3: List before, no list after
                            // Remove the paragraph and set cursor to end of prev list's deepest last item
                            dependencies.logger.log('Case 3: prevIsList && !nextIsList - removing paragraph');
                            e.preventDefault();

                            const prevList = prevSibling;
                            paragraphElement.remove();

                            // Find the deepest last li in the prev list (visually the line above)
                            let deepestLastLi = prevList.lastElementChild;
                            while (deepestLastLi) {
                                const nestedLists = deepestLastLi.querySelectorAll(':scope > ul, :scope > ol');
                                const lastNestedList = nestedLists.length > 0 ? nestedLists[nestedLists.length - 1] : null;
                                if (lastNestedList && lastNestedList.lastElementChild) {
                                    deepestLastLi = lastNestedList.lastElementChild;
                                } else {
                                    break;
                                }
                            }

                            if (deepestLastLi) {
                                dependencies.setCursorToEnd(deepestLastLi);
                            }

                            dependencies.syncMarkdown();
                            return true;
                        }

                        if (prevIsText && !nextIsList && !nextSibling) {
                            // Case 4: Text before (parent li text), no list after, no next sibling
                            // This is the case where nested list was the only child and is now empty paragraph
                            // Example:
                            // - aaa
                            //   |      ← empty paragraph (inside li for aaa, no nested list after)
                            // - ccc
                            // → should become: - aaa|  (cursor at end of aaa)
                            //                  - ccc
                            dependencies.logger.log('Case 4: prevIsText && !nextIsList && !nextSibling - removing paragraph and moving to parent text');
                            e.preventDefault();

                            const parentLi = parentElement;

                            // Remove the paragraph
                            paragraphElement.remove();

                            // Set cursor to end of parent li's text content
                            let cursorTarget = null;
                            for (const child of parentLi.childNodes) {
                                if (child.nodeType === 3 && child.textContent.trim() !== '') {
                                    cursorTarget = child;
                                    break;
                                }
                            }

                            if (cursorTarget) {
                                const newRange = document.createRange();
                                newRange.setStart(cursorTarget, cursorTarget.textContent.length);
                                newRange.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(newRange);
                            } else {
                                dependencies.setCursorToEnd(parentLi);
                            }

                            dependencies.syncMarkdown();
                            return true;
                        }

                        // Default: just move cursor to previous element
                        dependencies.logger.log('Default case - moving cursor');
                        e.preventDefault();
                        if (prevSibling) {
                            if (prevSibling.nodeType === 3) {
                                const newRange = document.createRange();
                                newRange.setStart(prevSibling, prevSibling.textContent.length);
                                newRange.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(newRange);
                            } else {
                                dependencies.setCursorToEnd(prevSibling);
                            }
                        }
                        dependencies.syncMarkdown();
                        return true;
                    }
                }
        return false;
    }

    function handleRemainingListDelete(e, liElement, sel) {
if (liElement) {
                    const list = liElement.parentNode;
                    const textContent = liElement.textContent.trim();
                    const checkbox = liElement.querySelector(':scope > input[type="checkbox"]');

                    // Get only direct text content (excluding nested lists and br)
                    let directTextContent = '';
                    for (const child of liElement.childNodes) {
                        if (child.nodeType === 3) { // Text node
                            directTextContent += child.textContent;
                        } else if (child.nodeType === 1) { // Element node
                            const childTag = child.tagName?.toLowerCase();
                            // Exclude ul, ol, input, and br (br is used as placeholder in empty items)
                            if (childTag !== 'ul' && childTag !== 'ol' && childTag !== 'input' && childTag !== 'br') {
                                directTextContent += child.textContent;
                            }
                        }
                    }
                    directTextContent = directTextContent.trim();

                    // Item is empty if it has no text content (br is just a placeholder for empty items)
                    const isEmptyItem = directTextContent === '';
                    const prevLi = liElement.previousElementSibling;
                    const isFirstItem = !prevLi;
                    const isTopLevel = list && list.parentNode === dependencies.editor;
                    const prevElement = list.previousElementSibling;

                    if (isEmptyItem) {
                        e.preventDefault();
                        const p = document.createElement('p');
                        p.innerHTML = '<br>';

                        // Get preceding and following siblings
                        const precedingSiblings = [];
                        let prevSib = liElement.previousElementSibling;
                        while (prevSib) {
                            precedingSiblings.unshift(prevSib);
                            prevSib = prevSib.previousElementSibling;
                        }

                        const followingSiblings = [];
                        let nextSib = liElement.nextElementSibling;
                        while (nextSib) {
                            followingSiblings.push(nextSib);
                            nextSib = nextSib.nextElementSibling;
                        }

                        // Remove the empty item
                        liElement.remove();

                        if (precedingSiblings.length === 0 && followingSiblings.length === 0) {
                            // Only item - replace list with paragraph
                            list.replaceWith(p);
                        } else if (precedingSiblings.length === 0) {
                            // First item - insert paragraph before list
                            list.before(p);
                        } else if (followingSiblings.length === 0) {
                            // Last item - insert paragraph after list
                            list.after(p);
                        } else {
                            // Middle item - split list and insert paragraph in between
                            const newList = document.createElement(list.tagName);
                            for (const sib of followingSiblings) {
                                newList.appendChild(sib);
                            }
                            list.after(p);
                            p.after(newList);
                        }

                        // Remove list if empty
                        if (list.children.length === 0) list.remove();

                        dependencies.setCursorToEnd(p);
                        dependencies.syncMarkdown();
                    } else if (isFirstItem && isTopLevel) {
                        // First item with text at top level - convert to paragraph
                        e.preventDefault();

                        // Get nested lists from current item (to preserve them)
                        const nestedLists = Array.from(liElement.querySelectorAll(':scope > ul, :scope > ol'));

                        // Get text/inline content from current item (excluding nested lists and checkbox)
                        const contentNodes = [];
                        for (const child of liElement.childNodes) {
                            if (child.nodeType === 1 && (child.tagName === 'UL' || child.tagName === 'OL')) {
                                continue; // Skip nested lists
                            }
                            if (child.nodeType === 1 && child.tagName === 'INPUT') {
                                continue; // Skip checkbox
                            }
                            contentNodes.push(child.cloneNode(true));
                        }

                        // No previous element or previous element is paragraph/heading - convert to paragraph (don't merge)
                        if (!prevElement || prevElement.tagName.toLowerCase() === 'p' || /^h[1-6]$/.test(prevElement.tagName.toLowerCase())) {
                            // Previous element is paragraph/heading - convert list item to paragraph (don't merge)
                            // Create new paragraph with the content
                            const p = document.createElement('p');
                            for (const node of contentNodes) {
                                p.appendChild(node);
                            }
                            if (p.childNodes.length === 0) {
                                p.innerHTML = '<br>';
                            }

                            // Insert paragraph before the list
                            list.before(p);

                            // Remove current item
                            liElement.remove();

                            // If there are nested lists, insert them after the paragraph
                            let insertAfter = p;
                            for (const nestedList of nestedLists) {
                                insertAfter.after(nestedList);
                                insertAfter = nestedList;
                            }

                            // Remove list if empty
                            if (list.children.length === 0) list.remove();

                            // Set cursor to beginning of the new paragraph
                            const newRange = document.createRange();
                            if (p.firstChild) {
                                newRange.setStart(p.firstChild, 0);
                            } else {
                                newRange.setStart(p, 0);
                            }
                            newRange.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(newRange);

                            dependencies.syncMarkdown();
                        } else if (prevElement && (prevElement.tagName.toLowerCase() === 'ul' || prevElement.tagName.toLowerCase() === 'ol')) {
                            // Previous element is a list - merge into last item of that list
                            const lastLi = prevElement.lastElementChild;
                            if (lastLi) {
                                // Remove trailing <br> from last li
                                if (lastLi.lastChild && lastLi.lastChild.nodeType === 1 &&
                                    lastLi.lastChild.tagName.toLowerCase() === 'br') {
                                    lastLi.lastChild.remove();
                                }

                                // Mark cursor position
                                let cursorNode = lastLi.lastChild;
                                let cursorOffset = cursorNode && cursorNode.nodeType === 3 ? cursorNode.textContent.length : 0;

                                // Append content to last li
                                for (const node of contentNodes) {
                                    lastLi.appendChild(node);
                                }

                                // Move nested lists to last li
                                for (const nestedList of nestedLists) {
                                    lastLi.appendChild(nestedList);
                                }

                                // Remove current item
                                liElement.remove();

                                // If current list is now empty, remove it
                                if (list.children.length === 0) {
                                    list.remove();
                                } else {
                                    // Move remaining items from current list to previous list
                                    while (list.firstChild) {
                                        prevElement.appendChild(list.firstChild);
                                    }
                                    list.remove();
                                }

                                // Set cursor position
                                if (cursorNode && cursorNode.nodeType === 3) {
                                    const newRange = document.createRange();
                                    newRange.setStart(cursorNode, cursorOffset);
                                    newRange.collapse(true);
                                    sel.removeAllRanges();
                                    sel.addRange(newRange);
                                } else {
                                    dependencies.setCursorToEnd(lastLi);
                                }

                                dependencies.syncMarkdown();
                            }
                        }
                    } else if (prevLi && prevLi.tagName.toLowerCase() === 'li') {
                        // Non-first item - merge with previous item (or its deepest last nested item)
                        e.preventDefault();

                        // Get nested lists from current item (to preserve them)
                        const nestedLists = Array.from(liElement.querySelectorAll(':scope > ul, :scope > ol'));

                        // Get text content from current item (excluding nested lists)
                        const textNodes = [];
                        for (const child of liElement.childNodes) {
                            if (child.nodeType === 1 && (child.tagName === 'UL' || child.tagName === 'OL')) {
                                continue; // Skip nested lists
                            }
                            if (child.nodeType === 1 && child.tagName === 'INPUT') {
                                continue; // Skip checkbox
                            }
                            textNodes.push(child.cloneNode(true));
                        }

                        // Find the deepest last li in prevLi's nested lists
                        // This handles the case where prevLi has nested lists and we should merge into the deepest last item
                        let targetLi = prevLi;
                        let prevNestedLists = prevLi.querySelectorAll(':scope > ul, :scope > ol');
                        let lastNestedList = prevNestedLists.length > 0 ? prevNestedLists[prevNestedLists.length - 1] : null;
                        while (lastNestedList && lastNestedList.lastElementChild) {
                            targetLi = lastNestedList.lastElementChild;
                            prevNestedLists = targetLi.querySelectorAll(':scope > ul, :scope > ol');
                            lastNestedList = prevNestedLists.length > 0 ? prevNestedLists[prevNestedLists.length - 1] : null;
                        }

                        // Find position to insert in target item (before any nested lists)
                        let insertBeforeNode = null;
                        for (const child of targetLi.childNodes) {
                            if (child.nodeType === 1 && (child.tagName === 'UL' || child.tagName === 'OL')) {
                                insertBeforeNode = child;
                                break;
                            }
                        }

                        // Remove trailing <br> from target item if present
                        const targetLastChild = insertBeforeNode ? insertBeforeNode.previousSibling : targetLi.lastChild;
                        if (targetLastChild && targetLastChild.nodeType === 1 && targetLastChild.tagName.toLowerCase() === 'br') {
                            targetLastChild.remove();
                        }

                        // Mark position for cursor (end of target item's text)
                        let cursorNode = insertBeforeNode ? insertBeforeNode.previousSibling : targetLi.lastChild;
                        let cursorOffset = cursorNode && cursorNode.nodeType === 3 ? cursorNode.textContent.length : 0;

                        // Append text content from current item to target item
                        for (const node of textNodes) {
                            if (insertBeforeNode) {
                                targetLi.insertBefore(node, insertBeforeNode);
                            } else {
                                targetLi.appendChild(node);
                            }
                        }

                        // Move nested lists from current item to target item
                        for (const nestedListItem of nestedLists) {
                            targetLi.appendChild(nestedListItem);
                        }

                        // Remove current item
                        liElement.remove();

                        // Set cursor position
                        if (cursorNode && cursorNode.nodeType === 3) {
                            const newRange = document.createRange();
                            newRange.setStart(cursorNode, cursorOffset);
                            newRange.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(newRange);
                        } else {
                            dependencies.setCursorToEnd(targetLi);
                        }

                        dependencies.syncMarkdown();
                    }
                }
        return false;
    }

    return { handleFallbackEmptyList, handleParagraphInsideListDelete, handleRemainingListDelete };
}

module.exports = { createListBoundaries };
