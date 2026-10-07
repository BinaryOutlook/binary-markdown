'use strict';
// Construction defines capabilities; bootstrap controls the original initialization order.
function createListBackspace(dependencies) {
    function getBackspaceContext(sel, range) {
        const context = {
            // Basic cursor info
            sel: sel,
            range: range,
            isAtStart: range.startOffset === 0 && range.collapsed,
            // Element references
            liElement: null,
            list: null,
            paragraphElement: null,
            parentLi: null, // Parent li if in nested structure
            // Li state
            isInLi: false,
            isEmptyLi: false,
            hasNestedList: false,
            nestedLists: [],
            // Paragraph state
            isInParagraph: false,
            isEmptyParagraph: false,
            paragraphInLi: false,
            // Sibling info
            precedingSiblings: [],
            followingSiblings: [],
            // For paragraph in li
            prevSiblingInLi: null,
            nextSiblingInLi: null,
            prevIsList: false,
            nextIsList: false,
            prevIsText: false,
            prevIsBr: false
        };
        // Find paragraph element
        let pNode = sel.anchorNode;
        while (pNode && pNode !== dependencies.editor) {
            if (pNode.nodeType === 1 && pNode.tagName?.toLowerCase() === 'p') {
                context.paragraphElement = pNode;
                context.isInParagraph = true;
                context.isEmptyParagraph = pNode.innerHTML === '<br>' || pNode.textContent.trim() === '';
                // Check if paragraph is inside li
                let parent = pNode.parentNode;
                while (parent && parent !== dependencies.editor) {
                    if (parent.tagName?.toLowerCase() === 'li') {
                        context.paragraphInLi = true;
                        context.parentLi = parent;
                        break;
                    }
                    parent = parent.parentNode;
                }
                break;
            }
            pNode = pNode.parentNode;
        }
        // Find li element
        let node = sel.anchorNode;
        while (node && node !== dependencies.editor) {
            if (node.tagName?.toLowerCase() === 'li') {
                context.liElement = node;
                context.isInLi = true;
                context.list = node.parentNode;
                // Check if nested (for parentLi reference)
                if (context.list && context.list.parentNode?.tagName?.toLowerCase() === 'li') {
                    context.parentLi = context.list.parentNode;
                }
                // Get nested lists
                context.nestedLists = Array.from(node.querySelectorAll(':scope > ul, :scope > ol'));
                context.hasNestedList = context.nestedLists.length > 0;
                // Calculate if empty (direct text content only)
                let directText = '';
                for (const child of node.childNodes) {
                    if (child.nodeType === 3) {
                        directText += child.textContent;
                    }
                    else if (child.nodeType === 1) {
                        const tag = child.tagName?.toLowerCase();
                        if (tag !== 'ul' && tag !== 'ol' && tag !== 'input' && tag !== 'br' && tag !== 'p') {
                            directText += child.textContent;
                        }
                    }
                }
                context.isEmptyLi = directText.trim() === '';
                // Get siblings
                let sib = node.previousElementSibling;
                while (sib) {
                    context.precedingSiblings.unshift(sib);
                    sib = sib.previousElementSibling;
                }
                sib = node.nextElementSibling;
                while (sib) {
                    context.followingSiblings.push(sib);
                    sib = sib.nextElementSibling;
                }
                break;
            }
            node = node.parentNode;
        }
        // If in paragraph inside li, get sibling info
        if (context.paragraphInLi && context.paragraphElement) {
            let prev = context.paragraphElement.previousSibling;
            while (prev && prev.nodeType === 3 && prev.textContent.trim() === '') {
                prev = prev.previousSibling;
            }
            context.prevSiblingInLi = prev;
            let next = context.paragraphElement.nextSibling;
            while (next && next.nodeType === 3 && next.textContent.trim() === '') {
                next = next.nextSibling;
            }
            context.nextSiblingInLi = next;
            if (prev) {
                const prevTag = prev.tagName?.toLowerCase();
                context.prevIsList = prevTag === 'ul' || prevTag === 'ol';
                context.prevIsBr = prevTag === 'br';
                context.prevIsText = prev.nodeType === 3 || (prev.nodeType === 1 && !context.prevIsList);
            }
            if (next) {
                const nextTag = next.tagName?.toLowerCase();
                context.nextIsList = nextTag === 'ul' || nextTag === 'ol';
            }
        }
        return context;
    }
    /**
     * Detect backspace state from context
     */
    function detectBackspaceState(context) {
        // Must be at start of element
        if (!context.isAtStart) {
            return 'DEFAULT';
        }
        // Priority 1: Empty paragraph inside li
        if (context.isInParagraph && context.paragraphInLi && context.isEmptyParagraph) {
            dependencies.logger.log('[detectBackspaceState] returning EMPTY_PARAGRAPH_IN_LI');
            return 'EMPTY_PARAGRAPH_IN_LI';
        }
        // Priority 2: Empty li (not in paragraph) - unified, no nested/toplevel distinction
        if (context.isInLi && context.isEmptyLi && !context.isInParagraph) {
            dependencies.logger.log('[detectBackspaceState] returning EMPTY_LI');
            return 'EMPTY_LI';
        }
        // Priority 3: Non-empty li at start
        if (context.isInLi && !context.isEmptyLi && !context.isInParagraph) {
            dependencies.logger.log('[detectBackspaceState] returning NONEMPTY_LI_START');
            return 'NONEMPTY_LI_START';
        }
        dependencies.logger.log('[detectBackspaceState] returning DEFAULT, context:', JSON.stringify({
            isInParagraph: context.isInParagraph,
            paragraphInLi: context.paragraphInLi,
            isEmptyParagraph: context.isEmptyParagraph,
            isInLi: context.isInLi,
            isEmptyLi: context.isEmptyLi,
            isAtStart: context.isAtStart
        }));
        return 'DEFAULT';
    }
    /**
     * Find the visually previous element (deepest last li in nested structure)
     */
    function findVisuallyPreviousElement(element) {
        // If element has previous sibling
        const prevSibling = element.previousElementSibling;
        if (prevSibling) {
            // If previous sibling is a li with nested list, go to deepest last
            if (prevSibling.tagName?.toLowerCase() === 'li') {
                return findDeepestLastLi(prevSibling);
            }
            return prevSibling;
        }
        // No previous sibling - go to parent
        const parent = element.parentNode;
        if (parent?.tagName?.toLowerCase() === 'ul' || parent?.tagName?.toLowerCase() === 'ol') {
            const grandParent = parent.parentNode;
            if (grandParent?.tagName?.toLowerCase() === 'li') {
                // Return the parent li (the text part before the nested list)
                return grandParent;
            }
        }
        return null;
    }
    /**
     * Find the deepest last li in a nested structure
     */
    function findDeepestLastLi(li) {
        // Find the LAST child list (not first) - an li may have multiple
        // sibling lists of different types (ul, task-ul, ol) as direct children
        const nestedLists = li.querySelectorAll(':scope > ul, :scope > ol');
        const lastNestedList = nestedLists.length > 0 ? nestedLists[nestedLists.length - 1] : null;
        if (lastNestedList && lastNestedList.lastElementChild) {
            return findDeepestLastLi(lastNestedList.lastElementChild);
        }
        return li;
    }
    /**
     * Set cursor to end of element, handling br and nested lists
     */
    function setCursorToEndOfLi(li) {
        var sel = window.getSelection();
        // Find the last text position before any nested list
        let targetNode = null;
        let targetOffset = 0;
        for (const child of li.childNodes) {
            if (child.nodeType === 1) {
                const tag = child.tagName?.toLowerCase();
                if (tag === 'ul' || tag === 'ol') {
                    break; // Stop at nested list
                }
                if (tag === 'br') {
                    // Set cursor before br
                    const range = document.createRange();
                    range.setStartBefore(child);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    return;
                }
                // For other elements, try to find text inside
                const lastText = findLastTextNode(child);
                if (lastText) {
                    targetNode = lastText;
                    targetOffset = lastText.textContent.length;
                }
            }
            else if (child.nodeType === 3) {
                targetNode = child;
                targetOffset = child.textContent.length;
            }
        }
        if (targetNode) {
            const range = document.createRange();
            range.setStart(targetNode, targetOffset);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
        else {
            // Fallback: set cursor at the start of li (before any nested list)
            // Find the first nested list or set cursor at start of li
            const range = document.createRange();
            let insertPoint = 0;
            for (let i = 0; i < li.childNodes.length; i++) {
                const child = li.childNodes[i];
                if (child.nodeType === 1) {
                    const tag = child.tagName?.toLowerCase();
                    if (tag === 'ul' || tag === 'ol') {
                        insertPoint = i;
                        break;
                    }
                }
                insertPoint = i + 1;
            }
            range.setStart(li, Math.min(insertPoint, li.childNodes.length));
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
    /**
     * Find last text node in element
     */
    function findLastTextNode(element) {
        if (element.nodeType === 3)
            return element;
        for (let i = element.childNodes.length - 1; i >= 0; i--) {
            const result = findLastTextNode(element.childNodes[i]);
            if (result)
                return result;
        }
        return null;
    }
    // ========================================
    // Backspace Action Handlers
    // ========================================
    /**
     * Handle empty li - convert to paragraph
     * Unified handler for both nested and top-level empty li
     */
    function handleEmptyLi(context) {
        const { liElement, list, nestedLists, precedingSiblings, followingSiblings, sel } = context;
        dependencies.logger.log('[handleEmptyLi] precedingSiblings:', precedingSiblings.length, 'followingSiblings:', followingSiblings.length, 'nestedLists:', nestedLists.length);
        // Remove nested lists from li first (save them for later)
        const savedNestedLists = [];
        for (const nl of nestedLists) {
            nl.remove();
            savedNestedLists.push(nl);
        }
        // Remove the li
        liElement.remove();
        // Create paragraph
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        // Insert paragraph based on position
        if (list.children.length === 0) {
            // List is now empty - replace it with paragraph
            list.replaceWith(p);
        }
        else if (precedingSiblings.length === 0) {
            // First item - insert paragraph before list
            list.before(p);
        }
        else if (followingSiblings.length === 0) {
            // Last item - insert paragraph after list
            list.after(p);
        }
        else {
            // Middle item - split list
            const newList = document.createElement(list.tagName);
            for (const fs of followingSiblings) {
                newList.appendChild(fs);
            }
            list.after(p);
            p.after(newList);
        }
        // Always insert saved nested lists after paragraph (as independent lists)
        // The nesting/merging will happen on the 2nd Backspace
        let insertAfter = p;
        for (const nl of savedNestedLists) {
            insertAfter.after(nl);
            insertAfter = nl;
        }
        dependencies.setCursorToEnd(p);
        return true;
    }
    /**
     * Handle empty paragraph inside li
     * Simply: remove paragraph and move cursor to end of visually previous element
     */
    function handleEmptyParagraphInLi(context) {
        const { paragraphElement, parentLi, prevSiblingInLi, sel } = context;
        dependencies.logger.log('[handleEmptyParagraphInLi] prevSiblingInLi:', prevSiblingInLi?.tagName, prevSiblingInLi?.innerHTML?.substring(0, 50));
        // Find the visually previous element (where cursor should go)
        let cursorTarget = null;
        if (prevSiblingInLi) {
            // There's something before the paragraph in this li
            const prevTag = prevSiblingInLi.tagName?.toLowerCase();
            dependencies.logger.log('[handleEmptyParagraphInLi] prevTag:', prevTag);
            if (prevTag === 'ul' || prevTag === 'ol') {
                // Previous is a list - go to deepest last li
                const deepestLi = findDeepestLastLi(prevSiblingInLi.lastElementChild);
                dependencies.logger.log('[handleEmptyParagraphInLi] deepestLi:', deepestLi?.innerHTML?.substring(0, 50));
                if (deepestLi) {
                    // Remove the paragraph first
                    paragraphElement.remove();
                    // Set cursor to end of deepest li
                    setCursorToEndOfLi(deepestLi);
                    dependencies.logger.log('[handleEmptyParagraphInLi] cursor set to deepestLi');
                    return true;
                }
            }
            // Previous is text, br, or other element
            cursorTarget = prevSiblingInLi;
        }
        else {
            // Nothing before paragraph - find visual previous (parent li's text part)
            // The visual previous is the text content of the parent li itself
            // Look for text node or br before any nested list in parent li
            for (const child of parentLi.childNodes) {
                if (child === paragraphElement)
                    break;
                if (child.nodeType === 3 && child.textContent.trim() !== '') {
                    cursorTarget = child;
                }
                else if (child.nodeType === 1) {
                    const tag = child.tagName?.toLowerCase();
                    if (tag === 'br') {
                        cursorTarget = child;
                    }
                    else if (tag !== 'ul' && tag !== 'ol' && tag !== 'p') {
                        cursorTarget = child;
                    }
                }
            }
            // If still no target, try parent li's previous sibling
            if (!cursorTarget) {
                const visualPrev = findVisuallyPreviousElement(parentLi);
                if (visualPrev) {
                    paragraphElement.remove();
                    if (visualPrev.tagName?.toLowerCase() === 'li') {
                        setCursorToEndOfLi(visualPrev);
                    }
                    else {
                        dependencies.setCursorToEnd(visualPrev);
                    }
                    return true;
                }
            }
        }
        // Remove the paragraph
        paragraphElement.remove();
        // Set cursor to the target
        if (cursorTarget) {
            if (cursorTarget.nodeType === 3) {
                // Text node
                const range = document.createRange();
                range.setStart(cursorTarget, cursorTarget.textContent.length);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            else if (cursorTarget.tagName?.toLowerCase() === 'br') {
                // BR element
                const range = document.createRange();
                range.setStartBefore(cursorTarget);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            else if (cursorTarget.tagName?.toLowerCase() === 'li') {
                setCursorToEndOfLi(cursorTarget);
            }
            else {
                dependencies.setCursorToEnd(cursorTarget);
            }
        }
        else {
            // Fallback to parent li
            dependencies.setCursorToEnd(parentLi);
        }
        return true;
    }
    /**
     * Handle non-empty li at start - merge with previous element
     */
    function handleNonEmptyLiStart(context) {
        const { liElement, list, precedingSiblings, sel } = context;
        // Find visual previous element
        const visualPrev = findVisuallyPreviousElement(liElement);
        if (!visualPrev) {
            // No previous element - convert to paragraph
            const p = document.createElement('p');
            // Move li content to paragraph (skip checkbox)
            while (liElement.firstChild) {
                const child = liElement.firstChild;
                if (child.tagName?.toLowerCase() === 'ul' || child.tagName?.toLowerCase() === 'ol') {
                    break; // Don't move nested lists
                }
                if (child.nodeType === 1 && child.tagName === 'INPUT' && child.type === 'checkbox') {
                    child.remove();
                    continue;
                }
                p.appendChild(child);
            }
            // Get nested lists
            const nestedLists = Array.from(liElement.querySelectorAll(':scope > ul, :scope > ol'));
            liElement.remove();
            if (list.children.length === 0) {
                list.replaceWith(p);
            }
            else {
                list.before(p);
            }
            // Insert nested lists after paragraph
            let insertAfter = p;
            for (const nl of nestedLists) {
                insertAfter.after(nl);
                insertAfter = nl;
            }
            dependencies.setCursorToStart(p);
            return true;
        }
        // Merge into previous element
        if (visualPrev.tagName?.toLowerCase() === 'li') {
            // Save cursor position (end of prev li text)
            let cursorNode = null;
            let cursorOffset = 0;
            for (const child of visualPrev.childNodes) {
                if (child.nodeType === 1 && (child.tagName === 'UL' || child.tagName === 'OL')) {
                    break;
                }
                if (child.nodeType === 3) {
                    cursorNode = child;
                    cursorOffset = child.textContent.length;
                }
                else if (child.nodeType === 1 && child.tagName !== 'BR') {
                    const lastText = findLastTextNode(child);
                    if (lastText) {
                        cursorNode = lastText;
                        cursorOffset = lastText.textContent.length;
                    }
                }
            }
            // Remove trailing br from prev li
            const lastChild = visualPrev.lastChild;
            if (lastChild?.tagName?.toLowerCase() === 'br') {
                const nextOfBr = lastChild.nextSibling;
                if (!nextOfBr || (nextOfBr.tagName !== 'UL' && nextOfBr.tagName !== 'OL')) {
                    lastChild.remove();
                }
            }
            // Find insert position (before nested list)
            let insertBefore = null;
            for (const child of visualPrev.childNodes) {
                if (child.nodeType === 1 && (child.tagName === 'UL' || child.tagName === 'OL')) {
                    insertBefore = child;
                    break;
                }
            }
            // Move content from current li to prev li (skip checkbox)
            const nodesToMove = [];
            for (const child of liElement.childNodes) {
                if (child.tagName?.toLowerCase() === 'ul' || child.tagName?.toLowerCase() === 'ol') {
                    break;
                }
                if (child.nodeType === 1 && child.tagName === 'INPUT' && child.type === 'checkbox') {
                    continue;
                }
                nodesToMove.push(child);
            }
            // Strip leading whitespace from first text node (task list items have
            // a formatting space " b" after the checkbox that should not appear in merged text)
            if (nodesToMove.length > 0 && nodesToMove[0].nodeType === 3) {
                nodesToMove[0].textContent = nodesToMove[0].textContent.replace(/^\s+/, '');
                if (!nodesToMove[0].textContent) {
                    nodesToMove.shift();
                }
            }
            // Save first moved node for cursor positioning when prev li was empty
            const firstMovedNode = nodesToMove.length > 0 ? nodesToMove[0] : null;
            for (const node of nodesToMove) {
                if (insertBefore) {
                    visualPrev.insertBefore(node, insertBefore);
                }
                else {
                    visualPrev.appendChild(node);
                }
            }
            // Handle nested lists from current li - MUST save before removing li
            const nestedLists = Array.from(liElement.querySelectorAll(':scope > ul, :scope > ol'));
            // Remove nested lists from li first (to preserve them)
            for (const nl of nestedLists) {
                nl.remove();
            }
            liElement.remove();
            // If list is now empty, remove it
            if (list.children.length === 0) {
                list.remove();
            }
            // Add nested lists to visualPrev
            // b was the first item, so its children (nestedLists) must come BEFORE
            // any existing sibling content already in visualPrev.
            if (nestedLists.length > 0) {
                // Check if visualPrev already has a nested list
                const existingNestedList = visualPrev.querySelector(':scope > ul, :scope > ol');
                if (existingNestedList) {
                    for (const nl of nestedLists) {
                        if (nl.tagName === existingNestedList.tagName) {
                            // Same list type: insert items at the BEGINNING (before existing children)
                            const firstExistingChild = existingNestedList.firstChild;
                            while (nl.firstChild) {
                                existingNestedList.insertBefore(nl.firstChild, firstExistingChild);
                            }
                        }
                        else {
                            // Different list type: insert the whole sub-list before existingNestedList
                            existingNestedList.parentNode.insertBefore(nl, existingNestedList);
                        }
                    }
                }
                else {
                    // Add nested lists as children of visualPrev
                    for (const nl of nestedLists) {
                        visualPrev.appendChild(nl);
                    }
                }
            }
            // Set cursor
            if (cursorNode) {
                // Previous li had text - place cursor at end of that text (= boundary)
                try {
                    const range = document.createRange();
                    range.setStart(cursorNode, cursorOffset);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                catch (e) {
                    dependencies.setCursorToEnd(visualPrev);
                }
            }
            else if (firstMovedNode) {
                // Previous li was empty - place cursor at start of moved content
                try {
                    const range = document.createRange();
                    if (firstMovedNode.nodeType === 3) {
                        range.setStart(firstMovedNode, 0);
                    }
                    else {
                        range.setStartBefore(firstMovedNode);
                    }
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                catch (e) {
                    dependencies.setCursorToStart(visualPrev);
                }
            }
            else {
                dependencies.setCursorToEnd(visualPrev);
            }
            // Merge adjacent text nodes so "a" + "b" → "ab"
            // (browser auto-updates live Range objects on normalize)
            visualPrev.normalize();
            return true;
        }
        return false;
    }
    /**
     * Main backspace handler for list elements
     */
    function handleBackspaceOnList(e, sel, range) {
        const context = getBackspaceContext(sel, range);
        const state = detectBackspaceState(context);
        dependencies.logger.log('Backspace state:', state, context);
        let handled = false;
        switch (state) {
            case 'EMPTY_LI':
                handled = handleEmptyLi(context);
                break;
            case 'EMPTY_PARAGRAPH_IN_LI':
                handled = handleEmptyParagraphInLi(context);
                break;
            case 'NONEMPTY_LI_START':
                handled = handleNonEmptyLiStart(context);
                break;
            default:
                return false;
        }
        if (handled) {
            e.preventDefault();
            dependencies.syncMarkdown();
            return true;
        }
        return false;
    }
    return {
        handleBackspaceOnList,
        setCursorToEndOfLi
    };
}
module.exports = { createListBackspace };
