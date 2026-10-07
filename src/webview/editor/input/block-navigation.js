'use strict';
// Construction defines capabilities; bootstrap controls the original initialization order.
function createBlockNavigation(dependencies) {
    function handleCodeEnter(e, preElement) {
        if (preElement && dependencies.editor.contains(preElement)) {
            e.preventDefault();
            dependencies.logger.log('Inside code block, shiftKey:', e.shiftKey);
            if (e.shiftKey) {
                // Shift+Enter: Exit code block and move to next paragraph
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                // Check if this pre is inside a mermaid-wrapper or math-wrapper
                const specialWrapper = preElement.closest('.mermaid-wrapper') || preElement.closest('.math-wrapper');
                if (specialWrapper) {
                    // For mermaid/math blocks, add paragraph after the wrapper and exit edit mode
                    dependencies.exitSpecialWrapperDisplayMode(specialWrapper);
                    specialWrapper.after(p);
                    dependencies.logger.log('Exited special wrapper block with Shift+Enter');
                }
                else {
                    // For regular code blocks, add paragraph after the pre
                    preElement.after(p);
                    dependencies.logger.log('Exited code block with Shift+Enter');
                }
                dependencies.setCursorToEnd(p);
                dependencies.syncMarkdown();
            }
            else {
                // Enter: Insert newline within code block, preserving leading whitespace
                const sel = window.getSelection();
                if (sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    // Get the current line's leading whitespace
                    let currentLineText = '';
                    let node = range.startContainer;
                    // Find the text content of the current line
                    if (node.nodeType === 3) { // Text node
                        // Get text from start of this text node to cursor
                        const textBeforeCursor = node.textContent.substring(0, range.startOffset);
                        // Find the last newline before cursor
                        const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n');
                        if (lastNewlineIndex >= 0) {
                            currentLineText = textBeforeCursor.substring(lastNewlineIndex + 1);
                        }
                        else {
                            // No newline in this text node, check previous siblings
                            currentLineText = textBeforeCursor;
                            let prevNode = node.previousSibling;
                            while (prevNode) {
                                if (prevNode.nodeType === 3) {
                                    const prevText = prevNode.textContent;
                                    const prevNewlineIndex = prevText.lastIndexOf('\n');
                                    if (prevNewlineIndex >= 0) {
                                        currentLineText = prevText.substring(prevNewlineIndex + 1) + currentLineText;
                                        break;
                                    }
                                    else {
                                        currentLineText = prevText + currentLineText;
                                    }
                                }
                                else if (prevNode.nodeName === 'BR') {
                                    break;
                                }
                                prevNode = prevNode.previousSibling;
                            }
                        }
                    }
                    // Extract leading whitespace (spaces and tabs)
                    const leadingWhitespace = currentLineText.match(/^[ \t]*/)[0];
                    // Insert line break and the leading whitespace
                    document.execCommand('insertLineBreak');
                    if (leadingWhitespace) {
                        document.execCommand('insertText', false, leadingWhitespace);
                    }
                }
                else {
                    // Fallback: just insert line break
                    document.execCommand('insertLineBreak');
                }
                // Track sentinel only when insertLineBreak was at the END of content.
                // The browser adds a sentinel \n only at the end; mid-content Enter
                // does not produce a sentinel, so registering it would miscount lines.
                const codeForSentinel = preElement.querySelector('code') || preElement;
                // Chromium can represent the final line break and visibility
                // sentinel as BR nodes; textContent would omit both of them.
                const textAfterInsert = dependencies.getCodePlainText(codeForSentinel);
                if (textAfterInsert.endsWith('\n')) {
                    const sentinelTarget = preElement.closest('.mermaid-wrapper') || preElement.closest('.math-wrapper') || preElement;
                    dependencies.codeBlocksWithSentinel.add(sentinelTarget);
                }
                dependencies.syncMarkdown();
                dependencies.logger.log('Inserted newline in code block with indent preservation');
            }
            return true;
        }
        return false;
    }
    function handleQuoteEnter(blockquoteElement, e) {
        if (blockquoteElement && dependencies.editor.contains(blockquoteElement)) {
            e.preventDefault();
            dependencies.logger.log('Inside blockquote, shiftKey:', e.shiftKey);
            if (e.shiftKey) {
                // Shift+Enter: Exit blockquote and move to next paragraph
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                blockquoteElement.after(p);
                dependencies.setCursorToEnd(p);
                dependencies.syncMarkdown();
                dependencies.logger.log('Exited blockquote with Shift+Enter');
            }
            else {
                // Enter: Insert line break within blockquote
                document.execCommand('insertLineBreak');
                dependencies.syncMarkdown();
                dependencies.logger.log('Inserted line break in blockquote');
            }
            return true;
        }
        return false;
    }
    function handleCodeQuoteTab(e, sel) {
        if (sel && sel.rangeCount) {
            let anchorEl = sel.anchorNode;
            let startEl = anchorEl && anchorEl.nodeType === 3 ? anchorEl.parentElement : anchorEl;
            const preEl = startEl?.closest?.('pre');
            if (preEl && dependencies.editor.contains(preEl)) {
                const codeEl = preEl.querySelector('code') || preEl;
                if (!sel.isCollapsed) {
                    // Multi-line selection: indent/dedent all selected lines
                    dependencies.indentLinesInContainer(codeEl, e.shiftKey);
                    dependencies.syncMarkdown();
                }
                else if (e.shiftKey) {
                    // Single-line Shift+Tab: dedent current line
                    dependencies.indentLinesInContainer(codeEl, true);
                    dependencies.syncMarkdown();
                }
                else {
                    // Single-line Tab: insert 4 spaces at cursor
                    document.execCommand('insertText', false, '    ');
                }
                return true;
            }
            const bqEl = startEl?.closest?.('blockquote');
            if (bqEl && dependencies.editor.contains(bqEl)) {
                if (!sel.isCollapsed) {
                    dependencies.indentLinesInContainer(bqEl, e.shiftKey);
                    dependencies.syncMarkdown();
                }
                else if (e.shiftKey) {
                    dependencies.indentLinesInContainer(bqEl, true);
                    dependencies.syncMarkdown();
                }
                else {
                    document.execCommand('insertText', false, '    ');
                }
                return true;
            }
        }
        return false;
    }
    function handleBlockArrows(e) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount)
                return true;
            let node = sel.anchorNode;
            let blockNode = null; // Either <pre> or <blockquote>
            // Check if we're inside a code block or blockquote
            while (node && node !== dependencies.editor) {
                if (node.nodeType === 1) {
                    const tag = node.tagName.toLowerCase();
                    if (tag === 'pre' || tag === 'blockquote') {
                        blockNode = node;
                        break;
                    }
                }
                node = node.parentNode;
            }
            // Inside a block (code or blockquote)
            if (blockNode) {
                // If Shift is pressed, let browser handle selection
                if (e.shiftKey) {
                    return true;
                }
                // Check if this block is inside a mermaid-wrapper or math-wrapper
                const specialWrapperBlock = blockNode.closest('.mermaid-wrapper') || blockNode.closest('.math-wrapper');
                // Wrapped source lines can span several visual rows.
                // Let Chromium keep the caret column while moving within those rows;
                // retain the existing block-exit behavior at the visual boundaries.
                if (blockNode.classList.contains('code-wrapped') ||
                    (specialWrapperBlock?.classList.contains('math-wrapper') && document.documentElement.dataset.mathSourceWrap === 'true')) {
                    const code = blockNode.querySelector('code') || blockNode;
                    const caret = sel.getRangeAt(0).getBoundingClientRect();
                    const bounds = code.getBoundingClientRect();
                    const lineHeight = parseFloat(getComputedStyle(code).lineHeight) || caret.height;
                    if (caret.height && ((e.key === 'ArrowUp' && caret.top >= bounds.top + lineHeight) ||
                        (e.key === 'ArrowDown' && caret.bottom <= bounds.bottom - lineHeight)))
                        return true;
                }
                const { currentLineIndex, totalLines } = dependencies.getCurrentLineInBlock(blockNode, sel);
                // #region agent log
                dependencies.logger.log('Arrow in block:', { key: e.key, currentLineIndex, totalLines, tag: blockNode.tagName, inSpecialWrapper: !!specialWrapperBlock });
                // #endregion
                if (e.key === 'ArrowUp') {
                    if (currentLineIndex === 0) {
                        // At first line, exit block upward
                        e.preventDefault();
                        if (specialWrapperBlock) {
                            // Exit special wrapper - set display mode and go to previous sibling of wrapper
                            dependencies.exitSpecialWrapperDisplayMode(specialWrapperBlock);
                            const prev = specialWrapperBlock.previousElementSibling;
                            if (prev) {
                                dependencies.navigateToAdjacentElement(prev, 'up', false);
                            }
                        }
                        else {
                            // If this is a code block in edit mode, switch to display mode
                            if (blockNode.tagName.toLowerCase() === 'pre' && blockNode.getAttribute('data-mode') === 'edit') {
                                dependencies.enterDisplayMode(blockNode);
                            }
                            const prev = blockNode.previousElementSibling;
                            if (prev) {
                                dependencies.navigateToAdjacentElement(prev, 'up', false);
                            }
                            else {
                                // No previous element, create a new paragraph
                                const newP = document.createElement('p');
                                newP.innerHTML = '<br>';
                                blockNode.parentNode.insertBefore(newP, blockNode);
                                dependencies.setCursorToEnd(newP);
                            }
                        }
                    }
                    else {
                        // Move to previous line
                        e.preventDefault();
                        dependencies.setCursorToLineStart(blockNode, currentLineIndex - 1);
                        dependencies.scrollCursorIntoView();
                    }
                    return true;
                }
                if (e.key === 'ArrowDown') {
                    if (currentLineIndex >= totalLines - 1) {
                        // At last line, exit block downward
                        dependencies.logger.log('Last line, exiting block downward');
                        e.preventDefault();
                        if (specialWrapperBlock) {
                            // Exit special wrapper - set display mode and go to next sibling of wrapper
                            dependencies.exitSpecialWrapperDisplayMode(specialWrapperBlock);
                            const next = specialWrapperBlock.nextElementSibling;
                            if (next) {
                                dependencies.navigateToAdjacentElement(next, 'down', false);
                            }
                            else {
                                // No next element, create a new paragraph
                                const newP = document.createElement('p');
                                newP.innerHTML = '<br>';
                                specialWrapperBlock.parentNode.insertBefore(newP, specialWrapperBlock.nextSibling);
                                dependencies.setCursorToEnd(newP);
                            }
                        }
                        else {
                            // If this is a code block in edit mode, switch to display mode
                            if (blockNode.tagName.toLowerCase() === 'pre' && blockNode.getAttribute('data-mode') === 'edit') {
                                dependencies.enterDisplayMode(blockNode);
                            }
                            const next = blockNode.nextElementSibling;
                            dependencies.logger.log('Next element:', next ? next.tagName : 'null');
                            if (next) {
                                dependencies.navigateToAdjacentElement(next, 'down', false);
                            }
                            else {
                                // No next element, create a new paragraph
                                dependencies.logger.log('Creating new paragraph');
                                const newP = document.createElement('p');
                                newP.innerHTML = '<br>';
                                blockNode.parentNode.insertBefore(newP, blockNode.nextSibling);
                                dependencies.setCursorToFirstTextNode(newP);
                            }
                        }
                    }
                    else {
                        // Move to next line
                        e.preventDefault();
                        dependencies.setCursorToLineStart(blockNode, currentLineIndex + 1);
                        dependencies.scrollCursorIntoView();
                    }
                    return true;
                }
                return true;
            }
            // Outside blocks - check if we should enter a code block or blockquote
            let currentElement = sel.anchorNode;
            while (currentElement && currentElement !== dependencies.editor && currentElement.nodeType !== 1) {
                currentElement = currentElement.parentNode;
            }
            if (currentElement && currentElement !== dependencies.editor) {
                // Get direct child of editor
                while (currentElement.parentNode && currentElement.parentNode !== dependencies.editor) {
                    currentElement = currentElement.parentNode;
                }
                // Helper: check if cursor is at the first visual line of the element
                // Uses getBoundingClientRect to compare cursor Y with the element's first line Y
                function isCursorAtFirstLine(element) {
                    // Empty paragraph (<p><br></p>) is always first line
                    if (element.tagName === 'P' && (element.innerHTML === '<br>' || element.textContent.trim() === '')) {
                        return true;
                    }
                    const range = sel.getRangeAt(0);
                    // Get cursor rect
                    let cursorRect = range.getBoundingClientRect();
                    // If collapsed range has no rect, insert temp span
                    if (cursorRect.height === 0) {
                        const tempSpan = document.createElement('span');
                        tempSpan.textContent = '\u200B';
                        range.insertNode(tempSpan);
                        cursorRect = tempSpan.getBoundingClientRect();
                        tempSpan.parentNode.removeChild(tempSpan);
                    }
                    // If still zero height, need extra check for lists
                    if (cursorRect.height === 0) {
                        // For ul/ol, check if cursor is actually in the first <li> (document order)
                        if (element.tagName === 'UL' || element.tagName === 'OL') {
                            var firstLi = element.querySelector('li');
                            if (firstLi) {
                                var cn = sel.anchorNode;
                                while (cn && (cn.nodeType !== 1 || cn.tagName !== 'LI'))
                                    cn = cn.parentElement;
                                return cn === firstLi;
                            }
                        }
                        return true;
                    }
                    // Get element's first line rect
                    const elemRect = element.getBoundingClientRect();
                    // Cursor is at first line if its top is close to element's top
                    // Tolerance of 2px to avoid floating-point false positives:
                    // line-height values like 25.6px can't be represented exactly in IEEE 754,
                    // so (elemRect.top + cursorRect.height) may be slightly larger than cursorRect.top
                    // for the second visual line, causing incorrect "first line" detection.
                    return cursorRect.top < elemRect.top + cursorRect.height - 2;
                }
                // Helper: check if cursor is at the last visual line of the element
                function isCursorAtLastLine(element) {
                    // Empty paragraph (<p><br></p>) is always last line
                    if (element.tagName === 'P' && (element.innerHTML === '<br>' || element.textContent.trim() === '')) {
                        return true;
                    }
                    const range = sel.getRangeAt(0);
                    let cursorRect = range.getBoundingClientRect();
                    if (cursorRect.height === 0) {
                        const tempSpan = document.createElement('span');
                        tempSpan.textContent = '\u200B';
                        range.insertNode(tempSpan);
                        cursorRect = tempSpan.getBoundingClientRect();
                        tempSpan.parentNode.removeChild(tempSpan);
                    }
                    // If still zero height, need extra check for lists
                    if (cursorRect.height === 0) {
                        // For ul/ol, check if cursor is actually in the last <li> (document order)
                        if (element.tagName === 'UL' || element.tagName === 'OL') {
                            var allLis = element.querySelectorAll('li');
                            var lastLi = allLis.length > 0 ? allLis[allLis.length - 1] : null;
                            if (lastLi) {
                                var cn = sel.anchorNode;
                                while (cn && (cn.nodeType !== 1 || cn.tagName !== 'LI'))
                                    cn = cn.parentElement;
                                return cn === lastLi;
                            }
                        }
                        return true;
                    }
                    const elemRect = element.getBoundingClientRect();
                    // Cursor is at last line if its bottom is close to element's bottom
                    // Tolerance of 2px to avoid floating-point false positives (see isCursorAtFirstLine)
                    return cursorRect.bottom > elemRect.bottom - cursorRect.height + 2;
                }
                if (e.key === 'ArrowUp') {
                    // Navigate to previous element if cursor is at the first line
                    if (!isCursorAtFirstLine(currentElement))
                        return true;
                    // If Shift is pressed, let browser handle selection
                    if (e.shiftKey) {
                        return true;
                    }
                    let prev = currentElement.previousElementSibling;
                    if (prev) {
                        e.preventDefault();
                        dependencies.navigateToAdjacentElement(prev, 'up', false);
                        return true;
                    }
                }
                else if (e.key === 'ArrowDown') {
                    // Navigate to next element if cursor is at the last line
                    if (!isCursorAtLastLine(currentElement))
                        return true;
                    // If Shift is pressed, let browser handle selection
                    if (e.shiftKey) {
                        return true;
                    }
                    let next = currentElement.nextElementSibling;
                    if (next) {
                        e.preventDefault();
                        dependencies.navigateToAdjacentElement(next, 'down', false);
                        return true;
                    }
                }
            }
        }
        return false;
    }
    function handleCodeSpecialDelete(currentLine, e, range, tag) {
        if (tag === 'pre') {
            const codeElement = currentLine.querySelector('code');
            const codeContent = codeElement ? codeElement.textContent : currentLine.textContent;
            // Check if code block is empty (only whitespace/newlines)
            const isEmpty = !codeContent || codeContent.trim() === '' || codeContent === '\n';
            dependencies.logger.log('Backspace in pre:', { isEmpty, codeContent: JSON.stringify(codeContent) });
            if (isEmpty) {
                e.preventDefault();
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                currentLine.replaceWith(p);
                dependencies.setCursorToEnd(p);
                dependencies.syncMarkdown();
                return true;
            }
            // Non-empty code block: check if cursor is at the very beginning
            // If so, prevent backspace from merging with previous element
            if (codeElement) {
                const contentRange = document.createRange();
                contentRange.selectNodeContents(codeElement);
                contentRange.setEnd(range.startContainer, range.startOffset);
                const textBeforeCursor = contentRange.toString();
                if (textBeforeCursor.length === 0) {
                    e.preventDefault();
                    return true;
                }
            }
        }
        // Convert empty mermaid/math wrapper back to paragraph
        if (tag === 'div' && dependencies.isSpecialWrapper(currentLine)) {
            const wrapperPre = currentLine.querySelector('pre[data-lang="mermaid"], pre[data-lang="math"]');
            const wrapperCode = wrapperPre ? wrapperPre.querySelector('code') : null;
            const wrapperContent = wrapperCode ? wrapperCode.textContent : '';
            const isEmpty = !wrapperContent || wrapperContent.trim() === '' || wrapperContent === '\n';
            dependencies.logger.log('Backspace in special wrapper:', { isEmpty, wrapperContent: JSON.stringify(wrapperContent), type: currentLine.className });
            if (isEmpty) {
                e.preventDefault();
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                currentLine.replaceWith(p);
                dependencies.setCursorToEnd(p);
                dependencies.syncMarkdown();
                return true;
            }
        }
        return false;
    }
    return {
        handleCodeEnter,
        handleQuoteEnter,
        handleCodeQuoteTab,
        handleBlockArrows,
        handleCodeSpecialDelete
    };
}
module.exports = { createBlockNavigation };
