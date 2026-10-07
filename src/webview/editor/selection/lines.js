'use strict';

// Line navigation uses live DOM selections and delegates shared caret actions.
function createLineNavigation({
    logger,
    setCursorToStart,
    setCursorToEnd,
    setCursorToFirstTextNode,
    scrollCursorIntoView,
}) {
    function setCursorToLastLineStartByDOM(element) {
        const sel = window.getSelection();
        const range = document.createRange();

        // Debug: show full DOM structure
        logger.log('setCursorToLastLineStartByDOM: element.innerHTML =', element.innerHTML);
        logger.log('setCursorToLastLineStartByDOM: childNodes =', Array.from(element.childNodes).map(n => n.nodeType === 3 ? 'TEXT:"' + n.textContent + '"' : n.nodeName));

        // Unified approach: collect ALL line break positions (both <br> and \n in text nodes)
        // Each entry: { type: 'br'|'newline', node, offset (for text nodes) }
        var lineBreaks = [];
        var children = element.childNodes;
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (child.nodeType === 1 && child.tagName === 'BR') {
                lineBreaks.push({ type: 'br', node: child, index: i });
            } else if (child.nodeType === 3) {
                var text = child.textContent;
                for (var j = 0; j < text.length; j++) {
                    if (text[j] === '\n') {
                        lineBreaks.push({ type: 'newline', node: child, offset: j, index: i });
                    }
                }
            }
        }

        // Detect sentinel <br> dynamically: if the last child of the element
        // is a <br> that acts as a block-closer (preceded by another <br> or
        // empty text), exclude it from lineBreaks so the cursor lands on the
        // actual last content line.
        if (lineBreaks.length > 0) {
            var lastChild = element.lastChild;
            if (lastChild && lastChild.nodeType === 1 && lastChild.tagName === 'BR') {
                var prevSib = lastChild.previousSibling;
                var isSentinelBr = false;
                if (element.getAttribute && element.getAttribute('data-trailing-br') === 'true') {
                    isSentinelBr = true;
                } else if (prevSib && prevSib.nodeType === 1 && prevSib.tagName === 'BR') {
                    isSentinelBr = true;
                } else if (prevSib && prevSib.nodeType === 3 && prevSib.textContent === '') {
                    isSentinelBr = true;
                }
                if (isSentinelBr) {
                    var lastEntry = lineBreaks[lineBreaks.length - 1];
                    if (lastEntry.type === 'br') {
                        lineBreaks.pop();
                    }
                }
            }
        }

        logger.log('setCursorToLastLineStartByDOM: lineBreaks count =', lineBreaks.length);

        if (lineBreaks.length === 0) {
            // No DOM line breaks — could be a soft-wrapped paragraph.
            // Use getBoundingClientRect to find the start of the last visual line.
            var textNodes = [];
            var tw = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
            var tn;
            while (tn = tw.nextNode()) textNodes.push(tn);

            if (textNodes.length === 0) {
                setCursorToStart(element);
                return;
            }

            // Build flat offset map: [{node, start}]
            var totalLen = 0;
            var nodeMap = [];
            for (var i = 0; i < textNodes.length; i++) {
                nodeMap.push({ node: textNodes[i], start: totalLen });
                totalLen += textNodes[i].length;
            }

            if (totalLen === 0) {
                setCursorToStart(element);
                return;
            }

            // Measure Y of the last character
            var lastEntry = nodeMap[nodeMap.length - 1];
            var lastNodeLen = lastEntry.node.length;
            var tmpR = document.createRange();
            if (lastNodeLen > 0) {
                tmpR.setStart(lastEntry.node, lastNodeLen - 1);
                tmpR.setEnd(lastEntry.node, lastNodeLen);
            } else {
                tmpR.setStart(lastEntry.node, 0);
                tmpR.collapse(true);
            }
            var lastRect = tmpR.getBoundingClientRect();

            if (lastRect.height === 0) {
                // Cannot measure — fallback to end of element
                setCursorToEnd(element);
                return;
            }

            var lastLineY = lastRect.top;

            // Measure Y of the first character
            var firstNodeLen = nodeMap[0].node.length;
            if (firstNodeLen > 0) {
                tmpR.setStart(nodeMap[0].node, 0);
                tmpR.setEnd(nodeMap[0].node, 1);
            } else {
                tmpR.setStart(nodeMap[0].node, 0);
                tmpR.collapse(true);
            }
            var firstRect = tmpR.getBoundingClientRect();

            // Single visual line — start is correct
            if (Math.abs(lastLineY - firstRect.top) < 2) {
                setCursorToStart(element);
                return;
            }

            // Multi-line soft-wrap: binary search for first offset on last visual line
            function getYAtOffset(globalOff) {
                for (var j = nodeMap.length - 1; j >= 0; j--) {
                    if (globalOff >= nodeMap[j].start) {
                        var nd = nodeMap[j].node;
                        var local = Math.min(globalOff - nodeMap[j].start, nd.length);
                        var r = document.createRange();
                        if (local < nd.length) {
                            r.setStart(nd, local);
                            r.setEnd(nd, local + 1);
                        } else if (local > 0) {
                            r.setStart(nd, local - 1);
                            r.setEnd(nd, local);
                        } else {
                            r.setStart(nd, 0);
                            r.collapse(true);
                        }
                        return r.getBoundingClientRect().top;
                    }
                }
                return 0;
            }

            var lo = 0, hi = totalLen;
            while (lo < hi) {
                var mid = (lo + hi) >> 1;
                if (getYAtOffset(mid) < lastLineY - 2) {
                    lo = mid + 1;
                } else {
                    hi = mid;
                }
            }

            // Place cursor at the found position
            for (var i = nodeMap.length - 1; i >= 0; i--) {
                if (lo >= nodeMap[i].start) {
                    var localOff = Math.min(lo - nodeMap[i].start, nodeMap[i].node.length);
                    range.setStart(nodeMap[i].node, localOff);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    scrollCursorIntoView();
                    return;
                }
            }

            setCursorToStart(element);
            return;
        }

        // Find the last line break
        var lastBreak = lineBreaks[lineBreaks.length - 1];

        // Helper: check if a sibling is real editable content (not UI elements like resize handles)
        function isEditableContent(node) {
            if (node.nodeType === 3) {
                return node.textContent.length > 0 && node.textContent !== '\n';
            }
            if (node.nodeType === 1) {
                // Skip non-editable UI elements (e.g., table resize handles)
                if (node.getAttribute && node.getAttribute('contenteditable') === 'false') return false;
                if (node.tagName === 'BR') return false;
                return true;
            }
            return false;
        }

        // Determine if there's content after the last line break (i.e., the last line is non-empty)
        var hasContentAfterLastBreak = false;
        if (lastBreak.type === 'br') {
            // Check siblings after the BR for non-empty, non-newline content
            var sib = lastBreak.node.nextSibling;
            while (sib) {
                if (isEditableContent(sib)) {
                    hasContentAfterLastBreak = true;
                    break;
                }
                sib = sib.nextSibling;
            }
        } else {
            // type === 'newline' - check if there's text after this \n
            var afterInSameNode = lastBreak.node.textContent.substring(lastBreak.offset + 1);
            if (afterInSameNode.length > 0 && afterInSameNode !== '\n') {
                hasContentAfterLastBreak = true;
            } else {
                // Check next siblings
                var sib = lastBreak.node.nextSibling;
                while (sib) {
                    if (isEditableContent(sib)) {
                        hasContentAfterLastBreak = true;
                        break;
                    }
                    sib = sib.nextSibling;
                }
            }
        }

        if (hasContentAfterLastBreak) {
            // Last line has content - position cursor at the start of the last line
            // Find the first text node with actual content after the last break
            if (lastBreak.type === 'br') {
                var target = lastBreak.node.nextSibling;
                while (target) {
                    if (target.nodeType === 3 && target.textContent.length > 0 && target.textContent !== '\n') {
                        range.setStart(target, 0);
                        logger.log('setCursorToLastLineStartByDOM: positioned at text after last BR');
                        break;
                    }
                    target = target.nextSibling;
                }
            } else {
                // \n in text node - position right after the \n
                var afterText = lastBreak.node.textContent.substring(lastBreak.offset + 1);
                if (afterText.length > 0 && afterText !== '\n') {
                    range.setStart(lastBreak.node, lastBreak.offset + 1);
                    logger.log('setCursorToLastLineStartByDOM: positioned after last \\n at offset', lastBreak.offset + 1);
                } else {
                    // Find next sibling with content
                    var target = lastBreak.node.nextSibling;
                    while (target) {
                        if (target.nodeType === 3 && target.textContent.length > 0 && target.textContent !== '\n') {
                            range.setStart(target, 0);
                            logger.log('setCursorToLastLineStartByDOM: positioned at next text node after \\n');
                            break;
                        }
                        target = target.nextSibling;
                    }
                }
            }
        } else {
            // Last line is empty (trailing line break)
            // For code blocks: position at the empty last line (after the last BR)
            // For other elements (table cells etc.): go to previous content line
            var isCodeElement = element.tagName === 'CODE' || element.closest('code');
            if (isCodeElement) {
                // Code block: position at the actual empty last line
                if (lastBreak.type === 'br') {
                    var afterBr = lastBreak.node.nextSibling;
                    if (afterBr && afterBr.nodeType === 3) {
                        range.setStart(afterBr, 0);
                        logger.log('setCursorToLastLineStartByDOM: code block - positioned at empty text node after last BR');
                    } else {
                        var brParent = lastBreak.node.parentNode;
                        var brIdx = Array.prototype.indexOf.call(brParent.childNodes, lastBreak.node);
                        range.setStart(brParent, brIdx + 1);
                        logger.log('setCursorToLastLineStartByDOM: code block - positioned after last BR using parent offset');
                    }
                } else {
                    range.setStart(lastBreak.node, lastBreak.offset + 1);
                    logger.log('setCursorToLastLineStartByDOM: code block - positioned after last \\n (empty trailing line)');
                }
            } else {
                // Non-code elements: go to previous content line (skip trailing BR)
                if (lineBreaks.length >= 2) {
                    var prevBreak = lineBreaks[lineBreaks.length - 2];
                    if (prevBreak.type === 'br') {
                        var target = prevBreak.node.nextSibling;
                        while (target && target !== lastBreak.node) {
                            if (target.nodeType === 3 && target.textContent.length > 0 && target.textContent !== '\n') {
                                range.setStart(target, 0);
                                logger.log('setCursorToLastLineStartByDOM: positioned at previous content line (before trailing BR)');
                                break;
                            }
                            target = target.nextSibling;
                        }
                    } else {
                        range.setStart(prevBreak.node, prevBreak.offset + 1);
                        logger.log('setCursorToLastLineStartByDOM: positioned after second-to-last \\n');
                    }
                } else {
                    setCursorToStart(element);
                    logger.log('setCursorToLastLineStartByDOM: single trailing break, positioned at element start');
                    return;
                }
            }
        }

        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        element.focus();

        // Scroll cursor into view
        scrollCursorIntoView();

        // Verify cursor position
        var newSel = window.getSelection();
        logger.log('setCursorToLastLineStartByDOM: AFTER - anchorNode =', newSel.anchorNode, 'anchorOffset =', newSel.anchorOffset);
    }

    // Set cursor to specific line in block
    // Handles both <br> tags and \n characters as line separators
    function setCursorToLineStart(el, targetLineIndex) {
        var tag = el.tagName.toLowerCase();
        var targetNode = (tag === 'pre') ? (el.querySelector('code') || el) : el;

        logger.log('setCursorToLineStart:', { targetLineIndex: targetLineIndex });

        if (targetLineIndex === 0) {
            setCursorToFirstTextNode(el);
            return;
        }

        var lineCount = 0;
        var walker = document.createTreeWalker(targetNode, NodeFilter.SHOW_ALL, null, false);
        var node;

        while ((node = walker.nextNode())) {
            if (node.nodeType === 1 && node.tagName === 'BR') {
                lineCount++;
                if (lineCount === targetLineIndex) {
                    var range = document.createRange();
                    var s = window.getSelection();
                    var nextNode = node.nextSibling;
                    if (nextNode && nextNode.nodeType === 3) {
                        range.setStart(nextNode, 0);
                    } else {
                        range.setStartAfter(node);
                    }
                    range.collapse(true);
                    s.removeAllRanges();
                    s.addRange(range);
                    scrollCursorIntoView();
                    return;
                }
            } else if (node.nodeType === 3) {
                var text = node.textContent;
                for (var i = 0; i < text.length; i++) {
                    if (text[i] === '\n') {
                        lineCount++;
                        if (lineCount === targetLineIndex) {
                            var range = document.createRange();
                            var s = window.getSelection();
                            range.setStart(node, i + 1);
                            range.collapse(true);
                            s.removeAllRanges();
                            s.addRange(range);
                            scrollCursorIntoView();
                            return;
                        }
                    }
                }
            }
        }

        // Fallback: if target not found, go to end
        setCursorToEnd(targetNode);
    }

    // Get current line index in block
    // Counts both <br> tags and \n characters as line separators
    function getCurrentLineInBlock(el, sel) {
        var tag = el.tagName.toLowerCase();
        var targetNode = (tag === 'pre') ? (el.querySelector('code') || el) : el;

        var brCount = targetNode.querySelectorAll('br').length;
        var text = targetNode.textContent || '';
        var newlineCount = (text.match(/\n/g) || []).length;
        // Sentinel \n correction: browser's insertLineBreak adds a trailing \n
        // at the end of content to make the new empty line cursor-able.
        if (text.endsWith('\n')) {
            newlineCount = Math.max(0, newlineCount - 1);
        }
        // Sentinel <br> correction: display-mode trailing BR (data-trailing-br)
        // or edit-mode trailing BR added by enterEditMode for visual empty line.
        // Detect dynamically by checking if last child is a BR that acts as
        // block-closer (i.e., no text content follows it).
        if (brCount > 0) {
            var lastChild = targetNode.lastChild;
            if (lastChild && lastChild.nodeType === 1 && lastChild.tagName === 'BR') {
                // Last child is <br>. Check if it's a sentinel:
                // - data-trailing-br explicitly marks it
                // - or the previous sibling is also <br> or empty text (block-closer pattern)
                var prev = lastChild.previousSibling;
                var isSentinel = (targetNode.getAttribute && targetNode.getAttribute('data-trailing-br') === 'true');
                if (!isSentinel && prev) {
                    if (prev.nodeType === 1 && prev.tagName === 'BR') {
                        // BR → BR at end: the last BR is block-closer sentinel
                        isSentinel = true;
                    } else if (prev.nodeType === 3 && prev.textContent === '') {
                        // empty text → BR at end: also sentinel
                        isSentinel = true;
                    }
                }
                if (isSentinel) {
                    brCount = Math.max(0, brCount - 1);
                }
            }
        }
        var totalLines = brCount + newlineCount + 1;

        try {
            var range = sel.getRangeAt(0);
            var startContainer = range.startContainer;
            var startOffset = range.startOffset;

            var linesBefore = 0;

            // Special case: cursor is directly in the container element (not in a text node)
            if (startContainer === targetNode || startContainer.nodeType === 1) {
                var children = Array.from(targetNode.childNodes);
                var cursorChildIndex = startOffset;

                if (startContainer !== targetNode) {
                    for (var i = 0; i < children.length; i++) {
                        if (children[i] === startContainer || children[i].contains(startContainer)) {
                            cursorChildIndex = i;
                            break;
                        }
                    }
                }

                for (var i = 0; i < cursorChildIndex && i < children.length; i++) {
                    var child = children[i];
                    if (child.nodeType === 1 && child.tagName === 'BR') {
                        linesBefore++;
                    } else if (child.nodeType === 3) {
                        linesBefore += (child.textContent.match(/\n/g) || []).length;
                    } else if (child.nodeType === 1) {
                        linesBefore += child.querySelectorAll('br').length;
                        linesBefore += (child.textContent.match(/\n/g) || []).length;
                    }
                }

                return { currentLineIndex: linesBefore, totalLines: totalLines };
            }

            // Normal case: cursor is in a text node
            var walker = document.createTreeWalker(targetNode, NodeFilter.SHOW_ALL, null, false);
            var node;
            var foundCursor = false;

            while ((node = walker.nextNode()) && !foundCursor) {
                if (node === startContainer) {
                    foundCursor = true;
                    if (node.nodeType === 3) {
                        var textBefore = node.textContent.substring(0, startOffset);
                        linesBefore += (textBefore.match(/\n/g) || []).length;
                    }
                    break;
                }
                if (node.nodeType === 1 && node.tagName === 'BR') {
                    linesBefore++;
                } else if (node.nodeType === 3) {
                    linesBefore += (node.textContent.match(/\n/g) || []).length;
                }
            }

            return { currentLineIndex: linesBefore, totalLines: totalLines };
        } catch (ex) {
            return { currentLineIndex: 0, totalLines: totalLines };
        }
    }

    return {
        setCursorToLastLineStartByDOM,
        setCursorToLineStart,
        getCurrentLineInBlock,
    };
}

module.exports = { createLineNavigation };
