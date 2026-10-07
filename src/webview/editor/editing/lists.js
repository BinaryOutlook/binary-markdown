'use strict';

// Named capabilities remain live; this factory installs no listeners.
function createLists(dependencies) {


    // ========== LIST TYPE CHANGE ==========

    // Change the parent list type of a given li element.
    // If the li is the only child, just swap the tag.
    // If there are siblings, split into up to 3 lists: before (original), target (new), after (original).
    // Then merge adjacent compatible lists.
    function changeParentListType(li, targetTag) {
        var parentList = li.parentNode;
        if (!parentList) return;
        var currentTag = parentList.tagName.toLowerCase();
        if (currentTag === targetTag) return; // Already correct type

        var siblings = Array.from(parentList.children);
        var liIndex = siblings.indexOf(li);

        if (siblings.length === 1) {
            // Only child — replace parent tag in-place
            var newList = document.createElement(targetTag);
            // Copy attributes if any
            for (var i = 0; i < parentList.attributes.length; i++) {
                var attr = parentList.attributes[i];
                newList.setAttribute(attr.name, attr.value);
            }
            newList.appendChild(li);
            parentList.replaceWith(newList);
        } else {
            // Multiple siblings — split into before/target/after
            var parentOfList = parentList.parentNode;
            var insertRef = parentList.nextSibling;

            // Build "after" list (items after li)
            var afterItems = siblings.slice(liIndex + 1);
            var afterList = null;
            if (afterItems.length > 0) {
                afterList = document.createElement(currentTag);
                for (var j = 0; j < afterItems.length; j++) {
                    afterList.appendChild(afterItems[j]);
                }
            }

            // Build "target" list (just the converted li)
            var targetList = document.createElement(targetTag);
            targetList.appendChild(li);

            // parentList now only contains "before" items (items before li)
            // If parentList is now empty, remove it
            if (parentList.children.length === 0) {
                parentOfList.insertBefore(targetList, insertRef);
                if (afterList) parentOfList.insertBefore(afterList, targetList.nextSibling);
                parentList.remove();
            } else {
                // Insert target and after lists after the (now shortened) parentList
                parentOfList.insertBefore(targetList, insertRef);
                if (afterList) parentOfList.insertBefore(afterList, targetList.nextSibling);
            }

            // Merge adjacent compatible lists
            mergeAdjacentLists(targetList);
        }
    }


    // Check if two list elements are compatible for merging
    // Regular ul and task ul are NOT compatible
    function areListsCompatible(a, b) {
        if (!a || !b) return false;
        if (a.tagName !== b.tagName) return false;
        // Both must be same type (ul or ol)
        if (a.tagName.toLowerCase() === 'ul') {
            // Check if one is task list and other is not
            var aHasCheckbox = a.querySelector(':scope > li > input[type="checkbox"]') !== null;
            var bHasCheckbox = b.querySelector(':scope > li > input[type="checkbox"]') !== null;
            // Only merge if both are task or both are non-task
            return aHasCheckbox === bHasCheckbox;
        }
        return true; // ol lists are always compatible with other ol
    }


    // Merge targetList with its adjacent compatible siblings
    function mergeAdjacentLists(targetList) {
        // Merge with next sibling
        var next = targetList.nextElementSibling;
        if (next && areListsCompatible(targetList, next)) {
            while (next.firstChild) {
                targetList.appendChild(next.firstChild);
            }
            next.remove();
        }

        // Merge with previous sibling
        var prev = targetList.previousElementSibling;
        if (prev && areListsCompatible(prev, targetList)) {
            while (targetList.firstChild) {
                prev.appendChild(targetList.firstChild);
            }
            targetList.remove();
        }
    }


    // ========== LIST INDENTATION ==========

    function indentListItem(li) {
        // #region agent log
        dependencies.logger.log('indentListItem called', {
            liText: li.textContent,
            parentTag: li.parentNode?.tagName,
            hasPrevSibling: !!li.previousElementSibling,
            prevSiblingTag: li.previousElementSibling?.tagName
        });
        // #endregion

        let prevSibling = li.previousElementSibling;
        if (!prevSibling || prevSibling.tagName.toLowerCase() !== 'li') {
            // No previous sibling within the same list.
            // Check if the parent list has a previous sibling list element
            // (cross-list-boundary indent: e.g., <ul><li>a</li></ul><ol><li>b</li></ol>)
            const parentList = li.parentNode;
            const prevList = parentList ? parentList.previousElementSibling : null;
            if (prevList && (prevList.tagName.toLowerCase() === 'ul' || prevList.tagName.toLowerCase() === 'ol')) {
                // Get the last li of the previous list
                const lastLiOfPrev = prevList.lastElementChild;
                if (lastLiOfPrev && lastLiOfPrev.tagName.toLowerCase() === 'li') {
                    // Move this li (and remaining siblings) into a nested list under lastLiOfPrev
                    // Use querySelectorAll to get the LAST nested list (Section 16)
                    const currentListTag = parentList.tagName.toLowerCase();
                    const crossNestedLists = lastLiOfPrev.querySelectorAll(':scope > ul, :scope > ol');
                    let nestedList;
                    if (crossNestedLists.length > 0) {
                        nestedList = crossNestedLists[crossNestedLists.length - 1];
                    } else {
                        nestedList = document.createElement(currentListTag);
                        lastLiOfPrev.appendChild(nestedList);
                    }
                    nestedList.appendChild(li);
                    // If the parent list is now empty, remove it
                    if (parentList.children.length === 0) {
                        parentList.remove();
                    }
                    dependencies.logger.log('indentListItem: Cross-list indent done');
                    return;
                }
            }
            // #region agent log
            dependencies.logger.log('indentListItem: No valid previous sibling, cannot indent');
            // #endregion
            return; // Can't indent first item or item without previous sibling
        }

        // #region agent log
        dependencies.logger.log('indentListItem: Found previous sibling, will indent');
        // #endregion

        // Check if previous sibling already has a nested list
        // Use querySelectorAll to get the LAST nested list (Section 16: querySelector returns only the first match)
        const nestedLists = prevSibling.querySelectorAll(':scope > ul, :scope > ol');
        let nestedList;
        if (nestedLists.length > 0) {
            nestedList = nestedLists[nestedLists.length - 1];
        } else {
            // Create a new nested list of the same type as parent
            const parentList = li.parentNode;
            nestedList = document.createElement(parentList.tagName.toLowerCase());
            prevSibling.appendChild(nestedList);
        }

        // Move the li into the nested list
        nestedList.appendChild(li);
        // Note: Cursor position is preserved by the caller
        // #region agent log
        dependencies.logger.log('indentListItem: Done, li moved to nested list');
        // #endregion
    }


    function outdentListItem(li) {
        dependencies.logger.log('outdentListItem called', { liText: li.textContent });
        const parentList = li.parentNode;
        const grandparentLi = parentList.parentNode;
        dependencies.logger.log('outdentListItem: structure', {
            parentListTag: parentList?.tagName,
            grandparentLiTag: grandparentLi?.tagName,
            grandparentLiIsLi: grandparentLi?.tagName?.toLowerCase() === 'li'
        });

        // Check if we're in a nested list
        if (!grandparentLi || grandparentLi.tagName.toLowerCase() !== 'li') {
            // Already at top level - convert to paragraph
            dependencies.logger.log('outdentListItem: At top level, converting to paragraph');
            convertListItemToParagraph(li);
            return;
        }

        const grandparentList = grandparentLi.parentNode;

        // Move all following siblings (within same list) to stay in the nested list
        const followingSiblings = [];
        let sibling = li.nextElementSibling;
        while (sibling) {
            followingSiblings.push(sibling);
            sibling = sibling.nextElementSibling;
        }

        // Collect trailing sibling lists after parentList in grandparentLi
        // These are ul/ol elements that come AFTER the current list under the same parent li.
        // In mixed-type lists, items in these lists are visually "below" the current item,
        // so they must be moved under the outdented item to preserve line order.
        var trailingSiblingLists = [];
        var nextOfParent = parentList.nextElementSibling;
        while (nextOfParent) {
            var nextTag = nextOfParent.tagName ? nextOfParent.tagName.toLowerCase() : '';
            if (nextTag === 'ul' || nextTag === 'ol') {
                trailingSiblingLists.push(nextOfParent);
            }
            nextOfParent = nextOfParent.nextElementSibling;
        }
        dependencies.logger.log('outdentListItem: collected', {
            followingSiblings: followingSiblings.length,
            trailingSiblingLists: trailingSiblingLists.length
        });

        // Insert li after grandparent li
        grandparentList.insertBefore(li, grandparentLi.nextElementSibling);

        // If there were following siblings, keep them nested under the moved item
        if (followingSiblings.length > 0) {
            let newNestedList = li.querySelector('ul, ol');
            if (!newNestedList) {
                newNestedList = document.createElement(parentList.tagName.toLowerCase());
                li.appendChild(newNestedList);
            }
            followingSiblings.forEach(s => newNestedList.appendChild(s));
        }

        // Move trailing sibling lists under the moved item to preserve line order
        for (var i = 0; i < trailingSiblingLists.length; i++) {
            li.appendChild(trailingSiblingLists[i]);
        }

        // Remove empty parent list
        if (parentList.children.length === 0) {
            parentList.remove();
        }

        // Note: Cursor position is preserved by the caller
    }


    function convertListItemToParagraph(li) {
        dependencies.logger.log('convertListItemToParagraph called', { liText: li.textContent });
        const parentList = li.parentNode;
        const listTagName = parentList.tagName.toLowerCase();

        // Get text content (excluding checkbox if any)
        // Also collect nested lists (ul/ol) to preserve them
        let content = '';
        var nestedLists = [];
        for (const child of li.childNodes) {
            if (child.nodeType === 3) {
                content += child.textContent;
            } else if (child.nodeType === 1) {
                var childTag = child.tagName.toLowerCase();
                if (childTag === 'ul' || childTag === 'ol') {
                    nestedLists.push(child);
                } else if (childTag !== 'input') {
                    content += child.outerHTML;
                }
            }
        }
        dependencies.logger.log('convertListItemToParagraph: content extracted', { content, nestedListCount: nestedLists.length });

        // Collect following siblings of li in the parent list.
        // They must be placed into a new list AFTER the paragraph to preserve line order.
        var followingItems = [];
        var sib = li.nextElementSibling;
        while (sib) {
            followingItems.push(sib);
            sib = sib.nextElementSibling;
        }
        for (var j = 0; j < followingItems.length; j++) {
            followingItems[j].remove();
        }

        // Create paragraph
        const p = document.createElement('p');
        p.innerHTML = content.trim() || '<br>';

        // Remove the li from the list
        li.remove();

        // Determine insertion point for the paragraph:
        // - If parentList still has children (items that preceded the target li),
        //   insert p after parentList.
        // - If parentList is now empty (li was the first or only item),
        //   insert p at parentList's position and remove parentList.
        if (parentList.children.length === 0) {
            parentList.parentNode.insertBefore(p, parentList);
            parentList.remove();
        } else {
            if (parentList.nextSibling) {
                parentList.parentNode.insertBefore(p, parentList.nextSibling);
            } else {
                parentList.parentNode.appendChild(p);
            }
        }

        // Insert elements after p in correct visual order:
        // 1. nestedLists (children of the original li – visually below li's own text)
        // 2. followingItems as a new list (siblings of li – visually after all of li's content)
        var insertAfter = p;
        for (var i = 0; i < nestedLists.length; i++) {
            if (insertAfter.nextSibling) {
                insertAfter.parentNode.insertBefore(nestedLists[i], insertAfter.nextSibling);
            } else {
                insertAfter.parentNode.appendChild(nestedLists[i]);
            }
            insertAfter = nestedLists[i];
        }

        if (followingItems.length > 0) {
            var newList = document.createElement(listTagName);
            for (var k = 0; k < followingItems.length; k++) {
                newList.appendChild(followingItems[k]);
            }
            if (insertAfter.nextSibling) {
                insertAfter.parentNode.insertBefore(newList, insertAfter.nextSibling);
            } else {
                insertAfter.parentNode.appendChild(newList);
            }
        }
        dependencies.logger.log('convertListItemToParagraph: paragraph and nested lists inserted');

        dependencies.logger.log('convertListItemToParagraph: li removed, setting cursor');

        // Set cursor to the new paragraph
        dependencies.setCursorToEnd(p);

        dependencies.syncMarkdown();
        dependencies.logger.log('convertListItemToParagraph: done');
    }


    function convertToList(type) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        let node = sel.anchorNode;
        while (node && node.parentNode !== dependencies.editor) {
            node = node.parentNode;
        }
        if (!node || node === dependencies.editor) return;

        const text = node.textContent || '';
        const nextSibling = node.nextElementSibling;

        // Check if the next sibling is the same type of list
        if (nextSibling && nextSibling.tagName.toLowerCase() === type) {
            // Merge with existing list - prepend new item
            const li = document.createElement('li');
            li.textContent = text || '';
            if (!li.textContent) li.innerHTML = '<br>';
            nextSibling.insertBefore(li, nextSibling.firstChild);
            node.remove();
            dependencies.setCursorToEnd(li);
            dependencies.syncMarkdown();
            return;
        }

        // Check if the previous sibling is the same type of list
        const prevSibling = node.previousElementSibling;
        if (prevSibling && prevSibling.tagName.toLowerCase() === type) {
            // Merge with existing list - append new item
            const li = document.createElement('li');
            li.textContent = text || '';
            if (!li.textContent) li.innerHTML = '<br>';
            prevSibling.appendChild(li);
            node.remove();
            dependencies.setCursorToEnd(li);
            dependencies.syncMarkdown();
            return;
        }

        // No adjacent list of same type - create new list
        const list = document.createElement(type);
        const li = document.createElement('li');
        li.textContent = text || '';
        if (!li.textContent) li.innerHTML = '<br>';
        list.appendChild(li);
        node.replaceWith(list);
        dependencies.setCursorToEnd(li);
        dependencies.syncMarkdown();
    }


    function convertToTaskList() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        let node = sel.anchorNode;
        while (node && node.parentNode !== dependencies.editor) {
            node = node.parentNode;
        }
        if (!node || node === dependencies.editor) return;

        const text = node.textContent || '';
        const nextSibling = node.nextElementSibling;

        // Check if the next sibling is a task list (ul with checkbox)
        if (nextSibling && nextSibling.tagName.toLowerCase() === 'ul') {
            const firstLi = nextSibling.querySelector('li');
            if (firstLi && firstLi.querySelector('input[type="checkbox"]')) {
                // Merge with existing task list - prepend new item
                const li = document.createElement('li');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                li.appendChild(checkbox);
                li.appendChild(document.createTextNode(text));
                nextSibling.insertBefore(li, nextSibling.firstChild);
                node.remove();
                dependencies.setCursorToEnd(li);
                dependencies.syncMarkdown();
                return;
            }
        }

        // Check if the previous sibling is a task list
        const prevSibling = node.previousElementSibling;
        if (prevSibling && prevSibling.tagName.toLowerCase() === 'ul') {
            const firstLi = prevSibling.querySelector('li');
            if (firstLi && firstLi.querySelector('input[type="checkbox"]')) {
                // Merge with existing task list - append new item
                const li = document.createElement('li');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                li.appendChild(checkbox);
                li.appendChild(document.createTextNode(text));
                prevSibling.appendChild(li);
                node.remove();
                dependencies.setCursorToEnd(li);
                dependencies.syncMarkdown();
                return;
            }
        }

        // No adjacent task list - create new list
        const ul = document.createElement('ul');
        const li = document.createElement('li');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        li.appendChild(checkbox);
        li.appendChild(document.createTextNode(text));
        ul.appendChild(li);
        node.replaceWith(ul);
        dependencies.setCursorToEnd(li);
        dependencies.syncMarkdown();
    }


    // Convert a single <li> element's content to the target type.
    // Handles adding/removing checkboxes and preserves nested lists.
    // Returns the new <li> element.
    function convertLiToType(sourceLi, targetType) {
        var newLi = document.createElement('li');
        var hasCheckbox = !!sourceLi.querySelector(':scope > input[type="checkbox"]');

        if (targetType === 'task' && !hasCheckbox) {
            // Add checkbox, keep all children (including nested lists)
            var checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            newLi.appendChild(checkbox);
            for (var i = 0; i < sourceLi.childNodes.length; i++) {
                newLi.appendChild(sourceLi.childNodes[i].cloneNode(true));
            }
        } else if (targetType !== 'task' && hasCheckbox) {
            // Remove checkbox, keep everything else (including nested lists)
            var skipNextSpace = false;
            for (var i = 0; i < sourceLi.childNodes.length; i++) {
                var child = sourceLi.childNodes[i];
                if (child.nodeType === 1 && child.tagName === 'INPUT') { skipNextSpace = true; continue; }
                if (skipNextSpace && child.nodeType === 3 && child.textContent === ' ') { skipNextSpace = false; continue; }
                skipNextSpace = false;
                newLi.appendChild(child.cloneNode(true));
            }
        } else {
            // No checkbox change needed - clone all children
            for (var i = 0; i < sourceLi.childNodes.length; i++) {
                newLi.appendChild(sourceLi.childNodes[i].cloneNode(true));
            }
        }

        if (!newLi.hasChildNodes() || newLi.innerHTML.trim() === '') {
            newLi.innerHTML = '<br>';
        }

        return newLi;
    }


    // Convert the list items at cursor or selection to a different list type.
    // targetType: 'ul' | 'ol' | 'task'
    // Returns true if conversion was performed, false if cursor was not in a list.
    function convertListToType(targetType) {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return false;

        // Find the closest <li> ancestor from cursor
        var node = sel.anchorNode;
        var cursorLi = null;
        while (node && node !== dependencies.editor) {
            if (node.nodeType === 1 && node.tagName === 'LI') {
                cursorLi = node;
                break;
            }
            node = node.parentNode;
        }
        if (!cursorLi) return false;

        var parentList = cursorLi.parentElement;
        if (!parentList || (parentList.tagName !== 'UL' && parentList.tagName !== 'OL')) return false;

        // Get items to convert (single cursor = 1 item, selection = multiple items)
        var range = sel.getRangeAt(0);
        var targetItems = range.collapsed
            ? [cursorLi]
            : dependencies.getSelectedListItems(range, sel);

        if (targetItems.length === 0) return false;

        // Filter to only direct children of the same parent list
        var itemsToConvert = targetItems.filter(function(li) { return li.parentNode === parentList; });
        if (itemsToConvert.length === 0) return false;

        // Check if all target items are already the target type
        var allAlreadyTarget = itemsToConvert.every(function(li) {
            var liHasCheckbox = !!li.querySelector(':scope > input[type="checkbox"]');
            var liType = parentList.tagName === 'OL' ? 'ol' : (liHasCheckbox ? 'task' : 'ul');
            return liType === targetType;
        });
        if (allAlreadyTarget) return true;

        // Determine parent tag for target type
        var targetParentTag = targetType === 'ol' ? 'OL' : 'UL';
        var currentParentTag = parentList.tagName; // 'UL' or 'OL'

        // Gather all direct <li> children of parentList in order
        var allItems = [];
        for (var i = 0; i < parentList.children.length; i++) {
            if (parentList.children[i].tagName === 'LI') {
                allItems.push(parentList.children[i]);
            }
        }
        var convertSet = new Set(itemsToConvert);

        // Find the index range of items to convert
        var firstConvertIdx = -1;
        var lastConvertIdx = -1;
        for (var i = 0; i < allItems.length; i++) {
            if (convertSet.has(allItems[i])) {
                if (firstConvertIdx === -1) firstConvertIdx = i;
                lastConvertIdx = i;
            }
        }

        if (targetParentTag === currentParentTag) {
            // CASE A: Same parent tag (ul<->task) - modify <li> items in-place
            var newCursorLi = null;
            for (var i = 0; i < itemsToConvert.length; i++) {
                var li = itemsToConvert[i];
                var newLi = convertLiToType(li, targetType);
                li.replaceWith(newLi);
                if (li === cursorLi) newCursorLi = newLi;
            }
            dependencies.setupInteractiveElements();
            dependencies.setCursorToEnd(newCursorLi || itemsToConvert[0]);
            dependencies.syncMarkdown();
            return true;
        }

        // CASE B: Different parent tag - need to split the list
        var beforeItems = allItems.slice(0, firstConvertIdx);
        var convertItems = allItems.slice(firstConvertIdx, lastConvertIdx + 1);
        var afterItems = allItems.slice(lastConvertIdx + 1);

        var fragments = [];

        // 1. Before list (keep original type)
        if (beforeItems.length > 0) {
            var beforeList = document.createElement(currentParentTag.toLowerCase());
            for (var i = 0; i < beforeItems.length; i++) {
                beforeList.appendChild(beforeItems[i]); // Move, not clone
            }
            fragments.push(beforeList);
        }

        // 2. Converted items (new type)
        var newList = document.createElement(targetParentTag.toLowerCase());
        var newCursorLi = null;
        for (var i = 0; i < convertItems.length; i++) {
            var newLi = convertLiToType(convertItems[i], targetType);
            newList.appendChild(newLi);
            if (convertItems[i] === cursorLi) newCursorLi = newLi;
        }
        fragments.push(newList);

        // 3. After list (keep original type)
        if (afterItems.length > 0) {
            var afterList = document.createElement(currentParentTag.toLowerCase());
            for (var i = 0; i < afterItems.length; i++) {
                afterList.appendChild(afterItems[i]); // Move, not clone
            }
            fragments.push(afterList);
        }

        // Replace parentList with the fragments
        var parentParent = parentList.parentNode;
        var refNode = parentList.nextSibling;
        parentList.remove();

        for (var i = 0; i < fragments.length; i++) {
            parentParent.insertBefore(fragments[i], refNode);
        }

        dependencies.setupInteractiveElements();
        dependencies.setCursorToEnd(newCursorLi || newList.firstElementChild);
        dependencies.syncMarkdown();
        return true;
    }

    return { changeParentListType, areListsCompatible, mergeAdjacentLists, indentListItem, outdentListItem, convertListItemToParagraph, convertToList, convertToTaskList, convertLiToType, convertListToType };
}

module.exports = { createLists };
