'use strict';

// A true result stops key dispatch, whether or not browser default was prevented.
function createParagraphFormat(dependencies) {
    function handlePlainShiftEnter(blockquoteElement, e, listItem, preElement, sel, startElement, tableCell) {
if (e.shiftKey && !preElement && !blockquoteElement && !tableCell && !listItem &&
                !startElement.closest('strong, em, del, code')) {
                e.preventDefault();
                const range = sel.getRangeAt(0);
                range.deleteContents();
                const br = document.createElement('br');
                br.dataset.mdHardBreak = 'spaces';
                range.insertNode(br);
                if (!br.nextSibling || (br.nextSibling.nodeType === 3 && !br.nextSibling.textContent && !br.nextSibling.nextSibling)) {
                    const placeholder = document.createElement('br');
                    placeholder.dataset.editorPlaceholder = 'true';
                    br.after(placeholder);
                }
                range.setStartAfter(br); range.collapse(true);
                sel.removeAllRanges(); sel.addRange(range);
                dependencies.syncMarkdown();
                return true;
            }
        return false;
    }

    function handleInlineShiftEnter(e, preElement, sel, startElement) {
if (e.shiftKey) {
                const inlineElement = startElement.closest('strong, em, del, code:not(pre code)');
                if (inlineElement && !preElement) {
                    e.preventDefault();
                    dependencies.logger.log('Shift+Enter in inline element:', inlineElement.tagName);

                    // Move cursor to after the inline element
                    const range = sel.getRangeAt(0);

                    // Get text after cursor within the inline element
                    const textAfter = range.cloneRange();
                    textAfter.selectNodeContents(inlineElement);
                    textAfter.setStart(range.endContainer, range.endOffset);
                    const afterContent = textAfter.cloneContents();

                    // Remove text after cursor from inline element
                    textAfter.deleteContents();

                    // Create a new range after the inline element
                    const newRange = document.createRange();
                    newRange.setStartAfter(inlineElement);
                    newRange.collapse(true);

                    // Insert line break after inline element
                    const br = document.createElement('br');
                    newRange.insertNode(br);

                    // If there was content after cursor, insert it after the br
                    if (afterContent.textContent) {
                        const textNode = document.createTextNode(afterContent.textContent);
                        br.after(textNode);
                    }

                    // Move cursor after the br
                    const cursorRange = document.createRange();
                    cursorRange.setStartAfter(br);
                    cursorRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(cursorRange);

                    dependencies.syncMarkdown();
                    return true;
                }
            }
        return false;
    }

    function handleProseEnter(e, sel) {
const currentLine = dependencies.getCurrentLine();
            if (!currentLine) return true;

            const tag = currentLine.tagName ? currentLine.tagName.toLowerCase() : '';
            const text = currentLine.textContent || '';

            // Handle heading: Enter at the start of heading inserts empty paragraph before
            if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
                const range = sel.getRangeAt(0);
                // Check if cursor is at the very beginning of the heading
                const contentRange = document.createRange();
                contentRange.selectNodeContents(currentLine);
                contentRange.setEnd(range.startContainer, range.startOffset);
                const textBeforeCursor = contentRange.toString();

                if (textBeforeCursor.length === 0 && range.collapsed) {
                    // Cursor is at the start of heading - insert empty paragraph before
                    e.preventDefault();
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';
                    currentLine.before(p);
                    // Keep cursor at the start of the heading (not the new paragraph)
                    dependencies.setCursorToStart(currentLine);
                    dependencies.syncMarkdown();
                    dependencies.logger.log('Inserted paragraph before heading');
                    return true;
                }
            }

            // Check for markdown table pattern: | col1 | col2 |
            const tableCells = dependencies.checkTablePattern(text);
            if (tableCells && (tag === 'p' || tag === 'div')) {
                e.preventDefault();
                dependencies.convertToTable(tableCells, currentLine);
                return true;
            }

            // Check for horizontal rule: ---
            const trimmedText = text.trim();
            dependencies.logger.log('Checking HR pattern:', { text: text, trimmed: trimmedText, tag: tag, match: /^-{3,}$/.test(trimmedText) });
            if (/^-{3,}$/.test(trimmedText) && (tag === 'p' || tag === 'div')) {
                e.preventDefault();
                // Directly convert to HR here
                const hr = document.createElement('hr');
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                currentLine.replaceWith(hr);
                hr.after(p);
                dependencies.setCursorToEnd(p);
                dependencies.syncMarkdown();
                dependencies.logger.log('HR inserted');
                return true;
            }

            // Check for code block: \`\`\`
            // Support both <p> and <div> tags (div is created when pressing Enter after header)
            if (/^\`\`\`/.test(text) && (tag === 'p' || tag === 'div')) {
                e.preventDefault();
                dependencies.checkAllPatterns('enter');
                return true;
            }

            // Check inline patterns before Enter
            if (dependencies.checkInlinePatterns('enter')) {
                e.preventDefault();
                return true;
            }

            // A prose paragraph is a semantic block. Do not encode its boundary
            // by creating a second, empty paragraph or by a lone source newline.
            e.preventDefault();
            const previousBlock = dependencies.getCurrentLine();
            document.execCommand('defaultParagraphSeparator', false, 'p');
            document.execCommand('insertParagraph');
            const nextBlock = dependencies.getCurrentLine();
            if (nextBlock && nextBlock !== previousBlock) {
                for (const attribute of Array.from(nextBlock.attributes)) {
                    // The last fragment inherits the original outgoing source
                    // boundary; its text is newly authored, never a source copy.
                    if (attribute.name.startsWith('data-md-') && !['data-md-id', 'data-md-trailing'].includes(attribute.name)) {
                        nextBlock.removeAttribute(attribute.name);
                    }
                }
            }
            dependencies.syncMarkdown();
        return false;
    }

    function handleSpacePatterns(e) {
if (e.key === ' ') {
            dependencies.undoManager.saveSnapshot();
            // Check if inside code block or inline code - if so, skip all conversions
            const sel = window.getSelection();
            if (sel && sel.rangeCount) {
                const range = sel.getRangeAt(0);
                const node = range.startContainer;
                const startElement = node.nodeType === 3 ? node.parentElement : node;
                if (startElement && startElement.closest && startElement.closest('pre, code')) {
                    dependencies.logger.log('Space key: Inside code block or inline code, skipping all conversions');
                    return true; // Don't process any conversions in code blocks or inline code
                }
            }

            setTimeout(() => {
                // First check if we should escape from an inline element
                if (dependencies.checkInlineEscape()) return;
                // Then check for pattern conversions
                dependencies.checkAllPatterns('space');
            }, 0);
        }
        return false;
    }

    function handleGeneralTab(e) {
const selCheck = window.getSelection();
                if (selCheck && selCheck.rangeCount && !selCheck.isCollapsed) {
                    const rangeCheck = selCheck.getRangeAt(0);
                    let startBlock = rangeCheck.startContainer;
                    while (startBlock && startBlock !== dependencies.editor && startBlock.parentNode !== dependencies.editor) {
                        startBlock = startBlock.parentNode;
                    }
                    let endBlock = rangeCheck.endContainer;
                    while (endBlock && endBlock !== dependencies.editor && endBlock.parentNode !== dependencies.editor) {
                        endBlock = endBlock.parentNode;
                    }
                    if (startBlock !== endBlock && startBlock && endBlock) {
                        // Selection spans multiple blocks - apply Tab/Shift+Tab to each block
                        // Collect all block elements in the range
                        var blocks = [];
                        var current = startBlock;
                        while (current) {
                            blocks.push(current);
                            if (current === endBlock) break;
                            current = current.nextElementSibling;
                        }

                        // Save selection range endpoints
                        var savedStartContainer = rangeCheck.startContainer;
                        var savedStartOffset = rangeCheck.startOffset;
                        var savedEndContainer = rangeCheck.endContainer;
                        var savedEndOffset = rangeCheck.endOffset;

                        for (var bi = 0; bi < blocks.length; bi++) {
                            var block = blocks[bi];
                            if (e.shiftKey) {
                                // Shift+Tab: remove up to 4 leading spaces from block
                                var firstText = null;
                                // Find the first text node in the block
                                var tw = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null, false);
                                firstText = tw.nextNode();
                                if (firstText && firstText.textContent) {
                                    var txt = firstText.textContent;
                                    var spCount = 0;
                                    while (spCount < 4 && spCount < txt.length && txt[spCount] === ' ') {
                                        spCount++;
                                    }
                                    if (spCount > 0) {
                                        firstText.textContent = txt.slice(spCount);
                                        // Adjust saved selection offsets if they reference this text node
                                        if (savedStartContainer === firstText) {
                                            savedStartOffset = Math.max(0, savedStartOffset - spCount);
                                        }
                                        if (savedEndContainer === firstText) {
                                            savedEndOffset = Math.max(0, savedEndOffset - spCount);
                                        }
                                    }
                                }
                            } else {
                                // Tab: insert 4 spaces at start of block
                                var firstText2 = null;
                                var tw2 = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null, false);
                                firstText2 = tw2.nextNode();
                                if (firstText2) {
                                    firstText2.textContent = '    ' + firstText2.textContent;
                                    // Adjust saved selection offsets if they reference this text node
                                    if (savedStartContainer === firstText2) {
                                        savedStartOffset += 4;
                                    }
                                    if (savedEndContainer === firstText2) {
                                        savedEndOffset += 4;
                                    }
                                } else {
                                    // No text node - prepend a text node with spaces
                                    var spaceNode = document.createTextNode('    ');
                                    block.insertBefore(spaceNode, block.firstChild);
                                }
                            }
                        }

                        // Restore selection
                        try {
                            var newRange = document.createRange();
                            newRange.setStart(savedStartContainer, savedStartOffset);
                            newRange.setEnd(savedEndContainer, savedEndOffset);
                            selCheck.removeAllRanges();
                            selCheck.addRange(newRange);
                        } catch (err) {
                            dependencies.logger.log('Failed to restore selection after multi-block Tab:', err);
                        }

                        dependencies.syncMarkdown();
                        return true;
                    }
                }

                if (e.shiftKey) {
                    // Shift+Tab: remove up to 4 leading spaces from current line
                    const sel2 = window.getSelection();
                    if (!sel2 || !sel2.rangeCount) { return true; }
                    const range2 = sel2.getRangeAt(0);
                    let curNode = range2.startContainer;
                    let curOffset = range2.startOffset;

                    // When cursor is at an element node (e.g. <code> after <br>),
                    // resolve to the actual text node for the current line.
                    if (curNode.nodeType === 1) {
                        const children = curNode.childNodes;
                        if (curOffset < children.length) {
                            const child = children[curOffset];
                            if (child.nodeType === 3) {
                                // Cursor is right before a text node
                                curNode = child;
                                curOffset = 0;
                            } else if (child.nodeName === 'BR' && curOffset + 1 < children.length && children[curOffset + 1].nodeType === 3) {
                                // Cursor is at a <br>, next sibling is text
                                curNode = children[curOffset + 1];
                                curOffset = 0;
                            }
                        }
                        // If offset points past all children, try the last text node
                        if (curNode.nodeType === 1 && curOffset > 0 && curOffset <= children.length) {
                            const prev = children[curOffset - 1];
                            if (prev && prev.nodeType === 3) {
                                curNode = prev;
                                curOffset = prev.textContent.length;
                            }
                        }
                    }

                    // Find the text node containing the current line start
                    // The cursor is in a text node: find the line start within it
                    // (lines are separated by <br> or \n within text nodes)
                    if (curNode.nodeType === 3) {
                        const text = curNode.textContent;
                        // Find start of current line by looking backwards for \n
                        let lineStart = text.lastIndexOf('\n', curOffset - 1) + 1;
                        // Count leading spaces from line start (up to 4)
                        let spaces = 0;
                        while (spaces < 4 && lineStart + spaces < text.length && text[lineStart + spaces] === ' ') {
                            spaces++;
                        }
                        if (spaces > 0) {
                            curNode.textContent = text.slice(0, lineStart) + text.slice(lineStart + spaces);
                            // Adjust cursor position
                            const newOffset = Math.max(lineStart, curOffset - spaces);
                            const newRange = document.createRange();
                            newRange.setStart(curNode, newOffset);
                            newRange.collapse(true);
                            sel2.removeAllRanges();
                            sel2.addRange(newRange);
                            dependencies.syncMarkdown();
                        }
                    }
                } else {
                    // Tab: insert 4 spaces
                    document.execCommand('insertText', false, '    ');
                }
        return true;
    }

    function handleHeadingQuoteDelete(currentLine, e, range, tag) {
if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
                    e.preventDefault();
                    const p = document.createElement('p');
                    p.innerHTML = currentLine.innerHTML || '<br>';
                    currentLine.replaceWith(p);
                    dependencies.setCursorToStart(p);
                    dependencies.syncMarkdown();
                    return true;
                }

                // Handle blockquote - only convert to paragraph if at the very beginning
                if (tag === 'blockquote') {
                    // Check if cursor is truly at the beginning of the blockquote
                    // (not just at offset 0 of some node in the middle)
                    const contentRange = document.createRange();
                    contentRange.selectNodeContents(currentLine);
                    contentRange.setEnd(range.startContainer, range.startOffset);
                    const textBeforeCursor = contentRange.toString();

                    dependencies.logger.log('Backspace in blockquote:', { textBeforeCursor, length: textBeforeCursor.length });

                    if (textBeforeCursor.length === 0) {
                        // Truly at the beginning - convert to paragraph(s)
                        e.preventDefault();

                        // Split blockquote content by <br> and \n into individual paragraphs
                        // Blockquote content may use \n text nodes (from markdownToHtmlFragment)
                        // or <br> elements (from insertLineBreak on Enter)
                        const childNodes = Array.from(currentLine.childNodes);
                        const lines = [];
                        let currentFragment = document.createDocumentFragment();

                        for (const node of childNodes) {
                            if (node.nodeName === 'BR' && !node.hasAttribute?.('data-trailing-br')) {
                                lines.push(currentFragment);
                                currentFragment = document.createDocumentFragment();
                            } else if (node.nodeType === 3 && node.textContent.includes('\n')) {
                                // Text node containing \n - split it
                                const parts = node.textContent.split('\n');
                                for (let i = 0; i < parts.length; i++) {
                                    if (i > 0) {
                                        lines.push(currentFragment);
                                        currentFragment = document.createDocumentFragment();
                                    }
                                    if (parts[i] !== '') {
                                        currentFragment.appendChild(document.createTextNode(parts[i]));
                                    }
                                }
                            } else {
                                currentFragment.appendChild(node.cloneNode(true));
                            }
                        }
                        lines.push(currentFragment);

                        // Create <p> elements for each line
                        const paragraphs = [];
                        for (const fragment of lines) {
                            const p = document.createElement('p');
                            if (fragment.childNodes.length === 0 || (fragment.childNodes.length === 1 && fragment.firstChild.nodeType === 3 && fragment.firstChild.textContent === '')) {
                                p.innerHTML = '<br>';
                            } else {
                                p.appendChild(fragment);
                            }
                            paragraphs.push(p);
                        }

                        // Replace blockquote with paragraphs
                        const firstP = paragraphs[0];
                        currentLine.replaceWith(...paragraphs);
                        dependencies.setCursorToStart(firstP);
                        dependencies.syncMarkdown();
                    }
                    // Otherwise, let default backspace behavior handle it (delete previous char/br)
                    return true;
                }
        return false;
    }

    return { handlePlainShiftEnter, handleInlineShiftEnter, handleProseEnter, handleSpacePatterns, handleGeneralTab, handleHeadingQuoteDelete };
}

module.exports = { createParagraphFormat };
