'use strict';
// Construction defines capabilities; bootstrap controls the original initialization order.
function createDispatch(dependencies) {
    function handleMathDelimiterEnter(e) {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            const line = dependencies.getCurrentLine();
            const delimiter = line && line.tagName === 'P' ? line.textContent.trim() : '';
            if (delimiter === '$$' || (dependencies.mathBackslashDelimiters && delimiter === '\\[')) {
                e.preventDefault();
                dependencies.undoManager.saveSnapshot();
                const close = delimiter === '$$' ? '$$' : '\\]';
                const template = document.createElement('template');
                template.innerHTML = dependencies.mathBlockHtml({ open: delimiter, close, tex: '', raw: delimiter + '\n\n' + close });
                const wrapper = template.content.firstElementChild;
                line.replaceWith(wrapper);
                dependencies.setupMathBlocks();
                dependencies.enterSpecialWrapperEditMode(wrapper, 'start');
                dependencies.syncMarkdown();
                return true;
            }
        }
        return false;
    }
    function handleContextSelectAll(e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount)
                return true;
            let anchorNode = sel.anchorNode;
            let startElement = anchorNode.nodeType === 3 ? anchorNode.parentElement : anchorNode;
            // Check if inside table cell
            const tableCell = startElement.closest('td, th');
            if (tableCell) {
                e.preventDefault();
                e.stopPropagation();
                const range = document.createRange();
                range.selectNodeContents(tableCell);
                sel.removeAllRanges();
                sel.addRange(range);
                dependencies.logger.log('Cmd+A: Selected all in table cell');
                return true;
            }
            // Check if inside code block (pre > code)
            const codeElement = startElement.closest('pre code');
            const preElement = startElement.closest('pre');
            if (codeElement) {
                e.preventDefault();
                e.stopPropagation();
                const range = document.createRange();
                range.selectNodeContents(codeElement);
                sel.removeAllRanges();
                sel.addRange(range);
                dependencies.logger.log('Cmd+A: Selected all in code element');
                return true;
            }
            else if (preElement) {
                e.preventDefault();
                e.stopPropagation();
                const range = document.createRange();
                range.selectNodeContents(preElement);
                sel.removeAllRanges();
                sel.addRange(range);
                dependencies.logger.log('Cmd+A: Selected all in pre element');
                return true;
            }
            // Check if inside blockquote
            const blockquoteElement = startElement.closest('blockquote');
            if (blockquoteElement) {
                e.preventDefault();
                e.stopPropagation();
                const range = document.createRange();
                range.selectNodeContents(blockquoteElement);
                sel.removeAllRanges();
                sel.addRange(range);
                dependencies.logger.log('Cmd+A: Selected all in blockquote');
                return true;
            }
            // Not in special context - let default behavior (select all) happen
            return true;
        }
        return false;
    }
    function handleKeydown(e) {
        if (e.target.closest && e.target.closest('.front-matter'))
            return;
        dependencies.logger.log('Editor keydown:', e.key);
        if (dependencies.isSourceMode)
            return;
        if (handleMathDelimiterEnter(e))
            return;
        // Mark as actively editing for non-navigation keys
        if (!e.key.startsWith('Arrow') && !['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape', 'Tab'].includes(e.key)) {
            dependencies.markActivelyEditing();
        }
        // Backspace key - handle nested list items
        // Case: Cursor at beginning of non-empty li that is the first child of a nested list
        // Action: Merge with parent li's content
        if (e.key === 'Backspace') {
            dependencies.undoManager.saveSnapshot();
            dependencies.logger.log('Backspace key pressed');
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount)
                return;
            const range = sel.getRangeAt(0);
            // Handle selection deletion (e.g., triple-click then backspace, or partial text selection)
            if (dependencies.handleEarlyListBackspace(e, range, sel))
                return;
            // Only handle collapsed selection from here
            // Find the <li> element if cursor is inside a list
        }
        // Cmd+A / Ctrl+A - select all within current context (table cell, blockquote, code block)
        if (handleContextSelectAll(e))
            return;
        // Enter key - check patterns and handle special cases
        if (e.key === 'Enter') {
            dependencies.undoManager.saveSnapshot();
            dependencies.logger.log('Enter key detected:', {
                shiftKey: e.shiftKey,
                isComposing: e.isComposing,
                keyCode: e.keyCode
            });
            // Skip if IME is composing (for Japanese/Chinese input)
            // But allow Shift+Enter even during composition for explicit line breaks
            if ((e.isComposing || e.keyCode === 229) && !e.shiftKey) {
                dependencies.logger.log('Skipping - IME composing');
                return;
            }
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount)
                return;
            // Use closest() for more reliable element detection
            let anchorNode = sel.anchorNode;
            let startElement = anchorNode.nodeType === 3 ? anchorNode.parentElement : anchorNode;
            // Detect special elements (with null check)
            const preElement = startElement?.closest?.('pre');
            const blockquoteElement = startElement?.closest?.('blockquote');
            const tableCell = startElement?.closest?.('td, th');
            const listItem = startElement?.closest?.('li');
            if (dependencies.handlePlainShiftEnter(blockquoteElement, e, listItem, preElement, sel, startElement, tableCell))
                return;
            dependencies.logger.log('Enter pressed, detected:', {
                pre: !!preElement,
                blockquote: !!blockquoteElement,
                tableCell: !!tableCell,
                listItem: !!listItem,
                startElement: startElement?.tagName,
                shiftKey: e.shiftKey
            });
            // Handle Shift+Enter inside inline elements (strong, em, del, code)
            // Close the inline element first, then insert line break
            if (dependencies.handleInlineShiftEnter(e, preElement, sel, startElement))
                return;
            // Handle table cell Enter/Shift+Enter
            if (dependencies.handleTableEnter(e, tableCell))
                return;
            // Check if we're inside a code block (pre element)
            if (dependencies.handleCodeEnter(e, preElement))
                return;
            // Check if we're inside a blockquote
            if (dependencies.handleQuoteEnter(blockquoteElement, e))
                return;
            // Handle list item continuation (using closest() for proper nested list detection)
            if (dependencies.handleListEnter(e, listItem, sel))
                return;
            // First check for pattern conversions (---, \`\`\`, inline patterns)
            // Use setTimeout to let the default behavior happen first for inline patterns
            if (dependencies.handleProseEnter(e, sel))
                return;
            // Handle heading: Enter at the start of heading inserts empty paragraph before
            // Check for markdown table pattern: | col1 | col2 |
            // Check for horizontal rule: ---
            // Check for code block: \`\`\`
            // Support both <p> and <div> tags (div is created when pressing Enter after header)
            // Check inline patterns before Enter
            // A prose paragraph is a semantic block. Do not encode its boundary
            // by creating a second, empty paragraph or by a lone source newline.
        }
        // Space key - check for inline escape first, then all conversions
        // Skip all conversions if inside a code block
        if (dependencies.handleSpacePatterns(e))
            return;
        // Tab key - table cell navigation or list indent
        if (e.key === 'Tab') {
            // #region agent log
            dependencies.logger.log('Tab key pressed', { shiftKey: e.shiftKey });
            // #endregion
            e.preventDefault(); // Always prevent default Tab behavior
            // Check if in a table cell first
            const sel = window.getSelection();
            if (dependencies.handleTableTab(e, sel))
                return;
            dependencies.undoManager.saveSnapshot();
            // Check if inside a code block or blockquote
            if (dependencies.handleCodeQuoteTab(e, sel))
                return;
            // Check for multi-line selection in list items (or cursor in list)
            if (dependencies.handleMultiListTab(e, sel))
                return;
            // Find the LI element by traversing up from the selection
            let liElement = null;
            if (sel && sel.rangeCount) {
                let node = sel.anchorNode;
                while (node && node !== dependencies.editor) {
                    if (node.nodeType === 1 && node.tagName && node.tagName.toLowerCase() === 'li') {
                        liElement = node;
                        break;
                    }
                    node = node.parentNode;
                }
            }
            // #region agent log
            dependencies.logger.log('Found LI element:', { hasLi: !!liElement, tagName: liElement?.tagName });
            // #endregion
            if (liElement) {
                // #region agent log
                if (dependencies.handleSingleListTab(e, liElement, sel))
                    return;
                // #endregion
                // Save cursor position relative to the li element
                // Calculate the text offset within the li (excluding nested lists)
                // Calculate offset within the li's direct content (not nested lists)
                // If liElement was converted to a paragraph and removed from DOM
                // (e.g. Shift+Tab on top-level item), convertListItemToParagraph
                // already set the cursor and called syncMarkdown – nothing left to do.
                // Restore cursor position using the saved text offset
            }
            else {
                // Check if selection spans multiple block elements
                if (dependencies.handleGeneralTab(e))
                    return;
            }
            return;
        }
        // Arrow keys for table cell navigation
        if (dependencies.handleTableArrows(e))
            return;
        // Arrow keys for code block and blockquote navigation
        if (dependencies.handleBlockArrows(e))
            return;
        // ========================================
        // State Machine Based Backspace Handler
        // ========================================
        /**
         * Get editor context for backspace handling
         * Collects all necessary information about cursor position and surrounding elements
         */
        /**
         * Detect backspace state from context
         */
        /**
         * Find the visually previous element (deepest last li in nested structure)
         */
        /**
         * Find the deepest last li in a nested structure
         */
        /**
         * Set cursor to end of element, handling br and nested lists
         */
        /**
         * Find last text node in element
         */
        // ========================================
        // Backspace Action Handlers
        // ========================================
        /**
         * Handle empty li - convert to paragraph
         * Unified handler for both nested and top-level empty li
         */
        /**
         * Handle empty paragraph inside li
         * Simply: remove paragraph and move cursor to end of visually previous element
         */
        /**
         * Handle non-empty li at start - merge with previous element
         */
        /**
         * Main backspace handler for list elements
         */
        // Backspace at beginning
        if (e.key === 'Backspace') {
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount)
                return;
            const range = sel.getRangeAt(0);
            // Selection deletion is handled in the early Backspace handler (around line 4083)
            // This handler only deals with collapsed selection
            if (!range.collapsed)
                return;
            // Try state machine handler first
            if (dependencies.handleBackspaceOnList(e, sel, range)) {
                return;
            }
            const currentLine = dependencies.getCurrentLine();
            if (!currentLine)
                return;
            const tag = currentLine.tagName ? currentLine.tagName.toLowerCase() : '';
            // Check if cursor is inside a paragraph first (before checking li)
            // This is important for handling paragraphs inside list items
            let cursorInParagraph = false;
            let paragraphInLi = null;
            let pCheckNode = sel.anchorNode;
            while (pCheckNode && pCheckNode !== dependencies.editor) {
                if (pCheckNode.nodeType === 1 && pCheckNode.tagName?.toLowerCase() === 'p') {
                    // Check if this paragraph is inside a li
                    let parentNode = pCheckNode.parentNode;
                    while (parentNode && parentNode !== dependencies.editor) {
                        if (parentNode.tagName?.toLowerCase() === 'li') {
                            cursorInParagraph = true;
                            paragraphInLi = pCheckNode;
                            break;
                        }
                        parentNode = parentNode.parentNode;
                    }
                    break;
                }
                pCheckNode = pCheckNode.parentNode;
            }
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
            // If cursor is in a paragraph inside a li, skip the li empty item handling
            // and let the paragraph handling code below deal with it
            if (dependencies.handleFallbackEmptyList(cursorInParagraph, e, liElement, paragraphInLi, range))
                return;
            // Other Backspace handling requires cursor at beginning
            if (range.startOffset === 0 && range.collapsed) {
                // Check if cursor is inside a paragraph (even if nested inside li)
                let paragraphElement = null;
                let pNode = sel.anchorNode;
                while (pNode && pNode !== dependencies.editor) {
                    if (pNode.nodeType === 1 && pNode.tagName?.toLowerCase() === 'p') {
                        paragraphElement = pNode;
                        break;
                    }
                    pNode = pNode.parentNode;
                }
                // Handle paragraph inside list item
                if (dependencies.handleParagraphInsideListDelete(e, paragraphElement, sel))
                    return;
                // Handle paragraph at beginning - merge with previous element
                if (dependencies.handleParagraphDelete(currentLine, e, sel, tag))
                    return;
                // Convert empty code block back to paragraph, or block backspace at start of non-empty code block
                if (dependencies.handleCodeSpecialDelete(currentLine, e, range, tag))
                    return;
                // Convert empty mermaid/math wrapper back to paragraph
                // Convert heading/blockquote back to paragraph
                if (dependencies.handleHeadingQuoteDelete(currentLine, e, range, tag))
                    return;
                // Handle blockquote - only convert to paragraph if at the very beginning
                // Handle list item at beginning of line (for non-standalone cases)
                if (dependencies.handleRemainingListDelete(e, liElement, sel))
                    return;
            }
        }
    }
    let initializeControlsDone = false;
    function initializeControls() {
        if (initializeControlsDone)
            return;
        initializeControlsDone = true;
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Tab' && document.activeElement === dependencies.editor) {
                // #region agent log
                dependencies.logger.log('Document captured Tab key - preventing default (no stopPropagation)');
                // #endregion
                e.preventDefault();
                // Do NOT call stopPropagation - let the event reach the editor's keydown handler
            }
            // Disable browser native undo/redo in live preview mode
            var isMod = e.ctrlKey || e.metaKey;
            if (isMod && !dependencies.isSourceMode && (e.key === 'z' || e.key === 'Z' || e.key === 'y')) {
                e.preventDefault();
            }
        }, true);
        dependencies.editor.addEventListener('keydown', handleKeydown);
        dependencies.editor.addEventListener('beforeinput', function (e) {
            if (e.target.closest && e.target.closest('.front-matter'))
                return;
            if (dependencies.isSourceMode)
                return;
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount)
                return;
            const range = sel.getRangeAt(0);
            // Only handle when there's a selection (not collapsed)
            if (range.collapsed)
                return;
            // Check if this is a triple-click style selection (selection includes element boundaries)
            // Triple-click typically selects from start of element to start of next element
            const startContainer = range.startContainer;
            const endContainer = range.endContainer;
            // Detect triple-click selection patterns:
            // 1. startContainer is an element (not text node) with offset 0
            // 2. endContainer is different from startContainer
            // 3. Selection spans across element boundaries
            const isTripleClickSelection = ((startContainer.nodeType === 1 && range.startOffset === 0) ||
                (endContainer.nodeType === 1 && range.endOffset === 0) ||
                (startContainer !== endContainer &&
                    (startContainer.nodeType === 1 || endContainer.nodeType === 1)));
            if (!isTripleClickSelection)
                return;
            // Find the li element that contains the selection start
            let liElement = null;
            let node = startContainer;
            while (node && node !== dependencies.editor) {
                if (node.nodeType === 1 && node.tagName.toLowerCase() === 'li') {
                    liElement = node;
                    break;
                }
                node = node.parentNode;
            }
            if (!liElement)
                return;
            // Handle insertText (typing characters)
            if (e.inputType === 'insertText' || e.inputType === 'insertReplacementText') {
                dependencies.logger.log('BeforeInput: Triple-click selection detected in li, handling insertText');
                e.preventDefault();
                // Get nested list and checkbox before deletion
                const nestedList = liElement.querySelector(':scope > ul, :scope > ol');
                const checkbox = liElement.querySelector(':scope > input[type="checkbox"]');
                // Clear the li content but preserve structure
                // Remove all direct text and inline elements, keep nested list and checkbox
                const nodesToRemove = [];
                for (const child of liElement.childNodes) {
                    if (child.nodeType === 3) {
                        nodesToRemove.push(child);
                    }
                    else if (child.nodeType === 1) {
                        const tag = child.tagName?.toLowerCase();
                        if (tag !== 'ul' && tag !== 'ol' && tag !== 'input') {
                            nodesToRemove.push(child);
                        }
                    }
                }
                nodesToRemove.forEach(n => n.remove());
                // Insert the new text
                const textNode = document.createTextNode(e.data || '');
                if (checkbox) {
                    checkbox.after(textNode);
                }
                else if (nestedList) {
                    liElement.insertBefore(textNode, nestedList);
                }
                else {
                    liElement.appendChild(textNode);
                }
                // Set cursor after the inserted text
                const newRange = document.createRange();
                newRange.setStartAfter(textNode);
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
                dependencies.syncMarkdownSync();
                return;
            }
            // Handle deleteContentBackward/Forward (backspace/delete with selection)
            if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') {
                dependencies.logger.log('BeforeInput: Triple-click selection detected in li, handling delete');
                e.preventDefault();
                // Get nested list and checkbox before deletion
                const nestedList = liElement.querySelector(':scope > ul, :scope > ol');
                const checkbox = liElement.querySelector(':scope > input[type="checkbox"]');
                // Clear the li content but preserve structure
                const nodesToRemove = [];
                for (const child of liElement.childNodes) {
                    if (child.nodeType === 3) {
                        nodesToRemove.push(child);
                    }
                    else if (child.nodeType === 1) {
                        const tag = child.tagName?.toLowerCase();
                        if (tag !== 'ul' && tag !== 'ol' && tag !== 'input') {
                            nodesToRemove.push(child);
                        }
                    }
                }
                nodesToRemove.forEach(n => n.remove());
                // Add a br if li is now empty (no text, no nested list)
                let hasContent = false;
                for (const child of liElement.childNodes) {
                    if (child.nodeType === 3 && child.textContent.trim()) {
                        hasContent = true;
                        break;
                    }
                    if (child.nodeType === 1 && child.tagName?.toLowerCase() !== 'input') {
                        hasContent = true;
                        break;
                    }
                }
                if (!hasContent) {
                    const br = document.createElement('br');
                    if (checkbox) {
                        checkbox.after(br);
                    }
                    else {
                        liElement.appendChild(br);
                    }
                }
                // Set cursor in the li
                const newRange = document.createRange();
                if (checkbox && checkbox.nextSibling) {
                    newRange.setStartBefore(checkbox.nextSibling);
                }
                else if (liElement.firstChild) {
                    newRange.setStart(liElement, 0);
                }
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
                dependencies.syncMarkdownSync();
                return;
            }
        });
        dependencies.editor.addEventListener('input', function (e) {
            if (e.target.closest && e.target.closest('.front-matter'))
                return;
            if (dependencies.isSourceMode)
                return;
            dependencies.markActivelyEditing();
            dependencies.markAsEdited(); // User has made an edit
            dependencies.undoManager.saveSnapshotDebounced();
            // Normalize <div> to <p>: Chromium's contenteditable sometimes creates <div>
            // despite defaultParagraphSeparator('p'), especially after tables or other block elements.
            var divChildren = dependencies.editor.querySelectorAll(':scope > div:not(.mermaid-wrapper):not(.math-wrapper):not(.find-replace-container)');
            if (divChildren.length > 0) {
                // Save cursor position
                var sel = window.getSelection();
                var savedRange = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0).cloneRange() : null;
                var cursorInDiv = false;
                var cursorDiv = null;
                if (savedRange) {
                    var cursorNode = savedRange.startContainer;
                    while (cursorNode && cursorNode !== dependencies.editor) {
                        if (cursorNode.nodeType === 1 && cursorNode.tagName === 'DIV' && cursorNode.parentNode === dependencies.editor) {
                            cursorDiv = cursorNode;
                            cursorInDiv = true;
                            break;
                        }
                        cursorNode = cursorNode.parentNode;
                    }
                }
                for (var i = 0; i < divChildren.length; i++) {
                    var div = divChildren[i];
                    // Skip divs that are part of known structures
                    if (div.classList.length > 0)
                        continue;
                    var p = document.createElement('p');
                    while (div.firstChild) {
                        p.appendChild(div.firstChild);
                    }
                    div.replaceWith(p);
                    // If cursor was in this div, restore it in the new <p>
                    if (cursorInDiv && div === cursorDiv && savedRange && sel) {
                        try {
                            sel.removeAllRanges();
                            sel.addRange(savedRange);
                        }
                        catch (ex) {
                            // Range may be invalid if nodes moved
                        }
                    }
                }
            }
            // Debounced sync - only updates markdown after user stops typing
            dependencies.debouncedSync();
            dependencies.updatePlaceholder();
        });
    }
    return {
        handleMathDelimiterEnter,
        handleContextSelectAll,
        handleKeydown,
        initializeControls
    };
}
module.exports = { createDispatch };
