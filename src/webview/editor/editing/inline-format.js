'use strict';

// Named capabilities remain live; this factory installs no listeners.
function createInlineFormat(dependencies) {


    // Check inline patterns (bold, italic, etc.) - called on Space or Enter only
    function checkInlinePatterns(trigger) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return false;

        const range = sel.getRangeAt(0);
        if (!range.collapsed) return false;

        let node = range.startContainer;
        if (node.nodeType !== 3) return false; // Must be text node

        // Check if we're inside a code block (pre element) or inline code (code element)
        // If so, skip all inline conversions - code should preserve literal text
        // Use closest() for more reliable detection
        const startElement = node.parentElement;
        if (startElement && startElement.closest && startElement.closest('pre, code')) {
            dependencies.logger.log('checkInlinePatterns: Inside code block or inline code, skipping conversion');
            return false; // Don't convert patterns inside code blocks or inline code
        }

        // Check if we're inside a heading (H1-H6)
        // If so, skip all inline conversions
        if (startElement && startElement.closest && startElement.closest('h1, h2, h3, h4, h5, h6')) {
            // Already inside a heading - don't convert to inline elements
            return false;
        }

        const text = node.textContent;
        const offset = range.startOffset;
        // Check text before the trigger character (space/enter adds a char, so check before that)
        const checkOffset = trigger === 'space' ? offset - 1 : offset;
        if (checkOffset < 0) return false;

        const beforeCursor = text.substring(0, checkOffset);

        const equation = dependencies.mathSyntax.inline(beforeCursor, dependencies.mathBackslashDelimiters)[0];
        if (equation) {
            const template = document.createElement('template');
            template.innerHTML = dependencies.inlineMathHtml(equation);
            const span = template.content.firstElementChild;
            const replacement = document.createRange();
            replacement.setStart(node, equation.start); replacement.setEnd(node, equation.end);
            replacement.deleteContents(); replacement.insertNode(span);
            const after = span.nextSibling;
            if (after && after.nodeType === 3) range.setStart(after, Math.min(after.textContent.length, offset - equation.end));
            else range.setStartAfter(span);
            range.collapse(true); sel.removeAllRanges(); sel.addRange(range);
            dependencies.setupInlineMath(); dependencies.syncMarkdown();
            return true;
        }

        // Inline code \`text\` + space/enter (FIRST - to protect content from other formatting)
        // Must be processed before bold/italic/strikethrough to prevent `**text**` from becoming bold
        const codeMatch = beforeCursor.match(/\`([^\`]+)\`/);
        if (codeMatch) {
            replaceInlinePatternAnywhere(node, codeMatch, 'code', checkOffset, trigger === 'space');
            return true;
        }

        // Bold **text** + space/enter (anywhere in text)
        const boldMatch = beforeCursor.match(/\*\*([^*]+)\*\*/);
        if (boldMatch) {
            replaceInlinePatternAnywhere(node, boldMatch, 'strong', checkOffset, trigger === 'space');
            return true;
        }

        // Italic *text* + space/enter (but not **text**)
        const italicMatch = beforeCursor.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
        if (italicMatch) {
            replaceInlinePatternAnywhere(node, italicMatch, 'em', checkOffset, trigger === 'space');
            return true;
        }

        // Strikethrough ~~text~~ + space/enter
        const strikeMatch = beforeCursor.match(/~~([^~]+)~~/);
        if (strikeMatch) {
            replaceInlinePatternAnywhere(node, strikeMatch, 'del', checkOffset, trigger === 'space');
            return true;
        }

        return false;
    }


    function replaceInlinePatternAnywhere(textNode, match, tagName, cursorOffset, hasSpaceAfter) {
        const fullMatch = match[0];
        const innerText = match[1];
        const matchIndex = match.index; // Where the match starts in the string

        const text = textNode.textContent;
        const before = text.substring(0, matchIndex);
        // Get text between the pattern and cursor (excluding the trigger space if present)
        const after = text.substring(matchIndex + fullMatch.length, cursorOffset);
        // Get remaining text after cursor (and after the trigger space if present)
        const remaining = text.substring(hasSpaceAfter ? cursorOffset + 1 : cursorOffset);

        const parent = textNode.parentNode;

        // Create new nodes
        if (before) {
            const beforeNode = document.createTextNode(before);
            parent.insertBefore(beforeNode, textNode);
        }

        const element = document.createElement(tagName);
        element.textContent = innerText;
        parent.insertBefore(element, textNode);

        // Create text node after the element with remaining text (no extra space - space was already consumed as trigger)
        const afterContent = after + remaining;

        // Use zero-width space to ensure cursor is positioned outside the inline element
        // This prevents the browser from placing the cursor inside the inline element
        const ZWSP = '\u200B';
        const afterNode = document.createTextNode(ZWSP + afterContent);
        parent.insertBefore(afterNode, textNode);

        parent.removeChild(textNode);

        // Set cursor after the zero-width space (position 1)
        const newRange = document.createRange();
        const sel = window.getSelection();
        newRange.setStart(afterNode, 1); // After the ZWSP
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        dependencies.syncMarkdown();
    }


    // ========== INLINE ELEMENT ESCAPE ==========

    // Check if cursor is inside an inline element and user typed ending marker + space
    // Returns true if escape was performed
    function checkInlineEscape() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return false;

        const range = sel.getRangeAt(0);
        if (!range.collapsed) return false;

        // Check if we're inside a code block (pre element)
        // If so, skip all inline escape - code blocks should preserve literal text
        let node = range.startContainer;
        const startElement = node.nodeType === 3 ? node.parentElement : node;
        if (startElement && startElement.closest && startElement.closest('pre')) {
            dependencies.logger.log('checkInlineEscape: Inside code block, skipping');
            return false;
        }

        // Find the inline element we might be inside
        let inlineElement = null;
        let markerInfo = null;

        // Check if we're in a text node inside an inline element
        while (node && node !== dependencies.editor) {
            if (node.nodeType === 1) {
                const tag = node.tagName.toLowerCase();
                if (tag === 'strong' || tag === 'b') {
                    inlineElement = node;
                    markerInfo = { marker: '**', tag: tag };
                    break;
                } else if (tag === 'em' || tag === 'i') {
                    inlineElement = node;
                    markerInfo = { marker: '*', tag: tag };
                    break;
                } else if (tag === 'del' || tag === 's') {
                    inlineElement = node;
                    markerInfo = { marker: '~~', tag: tag };
                    break;
                } else if (tag === 'code') {
                    // Only inline code, not code inside pre
                    if (!node.closest('pre')) {
                        inlineElement = node;
                        markerInfo = { marker: '\`', tag: tag };
                        break;
                    }
                }
            }
            node = node.parentNode;
        }

        if (!inlineElement || !markerInfo) return false;

        // Get text content and check if it ends with the marker + space
        const textNode = range.startContainer;
        if (textNode.nodeType !== 3) return false;

        const text = textNode.textContent;
        const offset = range.startOffset;

        // Check if text before cursor ends with marker + space (space was just typed)
        const beforeCursor = text.substring(0, offset);
        const expectedEnding = markerInfo.marker + ' ';

        if (!beforeCursor.endsWith(expectedEnding)) return false;

        // Remove the marker + space from the text
        const newText = beforeCursor.slice(0, -expectedEnding.length) + text.substring(offset);
        textNode.textContent = newText;

        // Move cursor outside the inline element (after it)
        const parent = inlineElement.parentNode;

        // Create a space text node after the inline element
        const spaceNode = document.createTextNode(' ');
        if (inlineElement.nextSibling) {
            parent.insertBefore(spaceNode, inlineElement.nextSibling);
        } else {
            parent.appendChild(spaceNode);
        }

        // Set cursor after the space
        const newRange = document.createRange();
        newRange.setStart(spaceNode, 1);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        dependencies.syncMarkdown();
        return true;
    }


    // ========== INLINE FORMATTING ==========

    /**
     * Toggle strikethrough formatting manually.
     * This is needed because execCommand('strikeThrough') uses <strike> tag,
     * but our Markdown conversion uses <del> tag.
     */
    function toggleStrikethrough(range, sel) {
        const strikethroughTags = ['del', 's', 'strike'];

        // Check if all selected content is wrapped in strikethrough tags
        const fragment = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);

        dependencies.logger.log('toggleStrikethrough - selection HTML:', tempDiv.innerHTML);

        // First check: look at the cloned content
        let strikethroughStatus = checkStrikethroughStatus(tempDiv, strikethroughTags);

        dependencies.logger.log('toggleStrikethrough - from cloned content - hasAny:', strikethroughStatus.hasAny, 'isAll:', strikethroughStatus.isAll);

        // Second check: if the cloned content has no strikethrough tags,
        // also check if the selection is INSIDE a strikethrough tag in the actual DOM
        // (cloneContents doesn't include parent tags that wrap the selection)
        if (!strikethroughStatus.hasAny) {
            const isInsideStrikethrough = isRangeInsideStrikethroughTag(range, strikethroughTags);
            dependencies.logger.log('toggleStrikethrough - isRangeInsideStrikethroughTag:', isInsideStrikethrough);
            if (isInsideStrikethrough) {
                strikethroughStatus = { hasAny: true, isAll: true };
            }
        }

        dependencies.logger.log('toggleStrikethrough - final hasAnyStrikethrough:', strikethroughStatus.hasAny, 'isAllStrikethrough:', strikethroughStatus.isAll);

        // If any text is in strikethrough, remove it (toggle off)
        // Only add strikethrough if NO text is currently in strikethrough
        if (strikethroughStatus.hasAny) {
            // Remove strikethrough - unwrap the tags
            dependencies.logger.log('toggleStrikethrough - removing strikethrough');
            unwrapStrikethroughInRange(range, sel, strikethroughTags);
        } else {
            // Add strikethrough - wrap with <del> tag
            dependencies.logger.log('toggleStrikethrough - adding strikethrough');
            wrapRangeWithTag(range, sel, 'del');
        }
    }


    /**
     * Check if the selection range is inside a strikethrough tag in the actual DOM
     */
    function isRangeInsideStrikethroughTag(range, tagNames) {
        // Check start container's ancestors
        let node = range.startContainer;
        while (node && node !== dependencies.editor) {
            if (node.nodeType === 1 && tagNames.includes(node.tagName.toLowerCase())) {
                return true;
            }
            node = node.parentElement;
        }

        // Check end container's ancestors (in case selection spans multiple elements)
        node = range.endContainer;
        while (node && node !== dependencies.editor) {
            if (node.nodeType === 1 && tagNames.includes(node.tagName.toLowerCase())) {
                return true;
            }
            node = node.parentElement;
        }

        return false;
    }


    /**
     * Check strikethrough status of text content
     * Returns { hasAny: boolean, isAll: boolean }
     * - hasAny: true if any text is inside strikethrough tags
     * - isAll: true if all text is inside strikethrough tags
     */
    function checkStrikethroughStatus(container, tagNames) {
        // If container is empty, return false for both
        if (!container.textContent || container.textContent.trim() === '') {
            dependencies.logger.log('checkStrikethroughStatus - empty container');
            return { hasAny: false, isAll: false };
        }

        // Check if the container itself is a strikethrough tag
        if (container.nodeType === 1 && tagNames.includes(container.tagName.toLowerCase())) {
            dependencies.logger.log('checkStrikethroughStatus - container is strikethrough tag');
            return { hasAny: true, isAll: true };
        }

        // Get all text nodes
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
        let textNode;
        let textNodesChecked = 0;
        let textNodesInStrikethrough = 0;

        while ((textNode = walker.nextNode())) {
            // Skip empty text nodes
            if (!textNode.textContent || textNode.textContent.trim() === '') {
                continue;
            }

            textNodesChecked++;

            // Check if this text node is inside a strikethrough tag
            let parent = textNode.parentElement;
            let isInStrikethrough = false;

            while (parent && parent !== container) {
                if (tagNames.includes(parent.tagName.toLowerCase())) {
                    isInStrikethrough = true;
                    break;
                }
                parent = parent.parentElement;
            }

            dependencies.logger.log('checkStrikethroughStatus - text node:', textNode.textContent.substring(0, 20), 'isInStrikethrough:', isInStrikethrough);

            if (isInStrikethrough) {
                textNodesInStrikethrough++;
            }
        }

        const hasAny = textNodesInStrikethrough > 0;
        const isAll = textNodesChecked > 0 && textNodesInStrikethrough === textNodesChecked;

        dependencies.logger.log('checkStrikethroughStatus - checked:', textNodesChecked, 'inStrikethrough:', textNodesInStrikethrough, 'hasAny:', hasAny, 'isAll:', isAll);
        return { hasAny, isAll };
    }


    /**
     * Unwrap strikethrough tags from the selected range
     */
    function unwrapStrikethroughInRange(range, sel, tagNames) {
        // Get the common ancestor
        const commonAncestor = range.commonAncestorContainer;
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;
        const startOffset = range.startOffset;
        const endOffset = range.endOffset;

        // Find all strikethrough elements that intersect with the selection
        const elementsToUnwrap = [];

        // Helper to check if an element intersects with the range
        function intersectsRange(element) {
            const elemRange = document.createRange();
            elemRange.selectNodeContents(element);

            // Check if ranges intersect
            const startsBeforeEnd = range.compareBoundaryPoints(Range.START_TO_END, elemRange) >= 0;
            const endsAfterStart = range.compareBoundaryPoints(Range.END_TO_START, elemRange) <= 0;

            return startsBeforeEnd && endsAfterStart;
        }

        // Find the container to search in
        let searchContainer = commonAncestor;
        if (searchContainer.nodeType === 3) {
            searchContainer = searchContainer.parentElement;
        }

        // Also check parent elements
        let parent = searchContainer;
        while (parent && parent !== dependencies.editor) {
            if (tagNames.includes(parent.tagName?.toLowerCase())) {
                elementsToUnwrap.push(parent);
            }
            parent = parent.parentElement;
        }

        // Find all strikethrough elements within the search container
        for (const tagName of tagNames) {
            const elements = searchContainer.querySelectorAll(tagName);
            for (const elem of elements) {
                if (intersectsRange(elem) && !elementsToUnwrap.includes(elem)) {
                    elementsToUnwrap.push(elem);
                }
            }
        }

        // Sort elements by depth (deepest first) to avoid issues when unwrapping
        elementsToUnwrap.sort((a, b) => {
            let depthA = 0, depthB = 0;
            let p = a;
            while (p) { depthA++; p = p.parentElement; }
            p = b;
            while (p) { depthB++; p = p.parentElement; }
            return depthB - depthA;
        });

        // Unwrap each element
        for (const elem of elementsToUnwrap) {
            // Move all children out of the element
            const parent = elem.parentNode;
            if (!parent) continue;

            while (elem.firstChild) {
                parent.insertBefore(elem.firstChild, elem);
            }
            parent.removeChild(elem);
        }

        // Normalize the text nodes
        if (searchContainer.normalize) {
            searchContainer.normalize();
        }

        dependencies.syncMarkdown();
    }


    /**
     * Wrap the selected range with a tag
     */
    function wrapRangeWithTag(range, sel, tagName) {
        // Extract the selected content
        const fragment = range.extractContents();

        // Create the wrapper element
        const wrapper = document.createElement(tagName);
        wrapper.appendChild(fragment);

        // Insert the wrapped content
        range.insertNode(wrapper);

        // Select the wrapped content
        const newRange = document.createRange();
        newRange.selectNodeContents(wrapper);
        sel.removeAllRanges();
        sel.addRange(newRange);

        dependencies.syncMarkdown();
    }


    function toggleUnderline() {
        const selection = window.getSelection();
        const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
        if (dependencies.isSourceMode || !dependencies.editorRange(range)) return;
        const protectedSelector = 'pre, code, .math-inline, .math-wrapper, .mermaid-wrapper, .front-matter, .toc-block';
        const element = node => node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        const protectedContent = element(range.startContainer).closest(protectedSelector) ||
            element(range.endContainer).closest(protectedSelector) ||
            (!range.collapsed && [...dependencies.editor.querySelectorAll(protectedSelector)].some(node => range.intersectsNode(node)));
        if (protectedContent) { dependencies.showEditorToast(dependencies.i18n.underlineUnavailable); return; }
        const formatsSelection = !range.collapsed;
        if (formatsSelection) {
            dependencies.markdown = dependencies.readCurrentMarkdown();
            dependencies.undoManager.saveSnapshot();
        }
        document.execCommand('underline');
        // A caret-only toggle affects subsequent typing; it is not a document edit.
        if (formatsSelection) dependencies.syncMarkdownSync();
    }


    // Apply inline formatting (bold, italic, strikethrough) with proper handling
    // for blockquotes and table cells where line breaks should be preserved
    function applyInlineFormat(tagName) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);

        // Check if selection is collapsed (no text selected)
        if (range.collapsed) {
            // No selection - just use execCommand for toggle behavior
            document.execCommand(tagName === 'strong' ? 'bold' : tagName === 'em' ? 'italic' : 'strikeThrough');
            return;
        }

        // For strikethrough, we need manual handling because execCommand('strikeThrough')
        // uses <strike> tag but our Markdown conversion uses <del> tag
        if (tagName === 'del') {
            toggleStrikethrough(range, sel);
            return;
        }

        // Check if we're inside a blockquote or table cell
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;
        const startElement = startContainer.nodeType === 3 ? startContainer.parentElement : startContainer;
        const endElement = endContainer.nodeType === 3 ? endContainer.parentElement : endContainer;

        const blockquote = startElement?.closest('blockquote');
        const tableCell = startElement?.closest('td, th');

        // If not in blockquote or table cell, use standard execCommand
        if (!blockquote && !tableCell) {
            document.execCommand(tagName === 'strong' ? 'bold' : tagName === 'em' ? 'italic' : 'strikeThrough');
            return;
        }

        // Get the selected content
        const fragment = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);

        // Check if selection contains line breaks (newlines in text or <br> elements)
        const hasLineBreaks = tempDiv.innerHTML.includes('<br>') ||
                              tempDiv.textContent.includes('\n') ||
                              tempDiv.querySelectorAll('br').length > 0;

        if (!hasLineBreaks) {
            // Single line - use standard execCommand
            document.execCommand(tagName === 'strong' ? 'bold' : tagName === 'em' ? 'italic' : 'strikeThrough');
            return;
        }

        // Multiple lines - need to apply formatting to each line separately
        // Strategy: Split by line breaks, wrap each non-empty segment, rejoin

        // Delete the selected content first
        range.deleteContents();

        // Process the content and apply formatting to each line
        const result = document.createDocumentFragment();

        function processNode(node, isFirst) {
            if (node.nodeType === 3) {
                // Text node - split by newlines
                const text = node.textContent || '';
                const parts = text.split('\n');

                for (let i = 0; i < parts.length; i++) {
                    if (i > 0) {
                        // Add newline character (will be rendered as line break in blockquote)
                        result.appendChild(document.createTextNode('\n'));
                    }

                    const part = parts[i];
                    if (part.length > 0) {
                        // Wrap non-empty text in formatting tag
                        const wrapper = document.createElement(tagName);
                        wrapper.textContent = part;
                        result.appendChild(wrapper);
                    }
                }
            } else if (node.nodeType === 1) {
                const tag = node.tagName.toLowerCase();

                if (tag === 'br') {
                    // Line break - add it and mark that next content is a new line
                    result.appendChild(document.createElement('br'));
                } else if (tag === tagName ||
                           (tagName === 'strong' && tag === 'b') ||
                           (tagName === 'em' && tag === 'i') ||
                           (tagName === 'del' && (tag === 's' || tag === 'strike'))) {
                    // Already has this formatting - just add the content
                    for (const child of node.childNodes) {
                        processNode(child, false);
                    }
                } else {
                    // Other element - process children
                    for (const child of node.childNodes) {
                        processNode(child, false);
                    }
                }
            }
        }

        // Process all nodes in the temp div
        for (const child of tempDiv.childNodes) {
            processNode(child, result.childNodes.length === 0);
        }

        // Insert the processed content
        range.insertNode(result);

        // Collapse selection to end
        sel.collapseToEnd();
    }

    return { checkInlinePatterns, replaceInlinePatternAnywhere, checkInlineEscape, toggleStrikethrough, isRangeInsideStrikethroughTag, checkStrikethroughStatus, unwrapStrikethroughInRange, wrapRangeWithTag, toggleUnderline, applyInlineFormat };
}

module.exports = { createInlineFormat };
