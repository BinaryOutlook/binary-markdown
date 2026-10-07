'use strict';

// A true result stops key dispatch, whether or not browser default was prevented.
function createParagraphDelete(dependencies) {
    function handleParagraphDelete(currentLine, e, sel, tag) {
if (tag === 'p') {
                    const prevElement = currentLine.previousElementSibling;
                    const nextElement = currentLine.nextElementSibling;
                    const isEmptyParagraph = currentLine.innerHTML === '<br>' || currentLine.textContent.trim() === '';

                    // Special case: Empty paragraph with no previous element - just remove it
                    if (isEmptyParagraph && !prevElement && nextElement) {
                        e.preventDefault();
                        currentLine.remove();
                        dependencies.setCursorToStart(nextElement);
                        dependencies.syncMarkdown();
                        return true;
                    }

                    // Special case: Empty paragraph sandwiched between two lists
                    const prevIsList = prevElement && (prevElement.tagName.toLowerCase() === 'ul' || prevElement.tagName.toLowerCase() === 'ol');
                    const nextIsList = nextElement && (nextElement.tagName.toLowerCase() === 'ul' || nextElement.tagName.toLowerCase() === 'ol');

                    if (isEmptyParagraph && prevIsList && nextIsList) {
                        e.preventDefault();

                        // Requirement 5-5 (updated): Merge next list items into prev list at the same level
                        const lastItemBeforeMerge = prevElement.lastElementChild;

                        // Find the deepest last li BEFORE merging (this is the "visually previous line")
                        const findDeepestLastLi = (li) => {
                            const nestedLists = li.querySelectorAll(':scope > ul, :scope > ol');
                            const lastNestedList = nestedLists.length > 0 ? nestedLists[nestedLists.length - 1] : null;
                            if (lastNestedList && lastNestedList.lastElementChild) {
                                return findDeepestLastLi(lastNestedList.lastElementChild);
                            }
                            return li;
                        };
                        const deepestLastLi = lastItemBeforeMerge ? findDeepestLastLi(lastItemBeforeMerge) : null;

                        // Move all items from next list to prev list (same level, not nested)
                        while (nextElement.firstChild) {
                            prevElement.appendChild(nextElement.firstChild);
                        }
                        nextElement.remove();
                        currentLine.remove();

                        // Set cursor to the end of the deepest last li (visually previous line)
                        if (deepestLastLi) {
                            dependencies.setCursorToEndOfLi(deepestLastLi);
                        } else {
                            dependencies.setCursorToEnd(prevElement.lastElementChild);
                        }

                        dependencies.syncMarkdown();
                        return true;
                    }

                    if (prevElement) {
                        const prevTag = prevElement.tagName.toLowerCase();

                        // If previous element is a list, merge paragraph into last list item
                        if (prevTag === 'ul' || prevTag === 'ol') {
                            e.preventDefault();

                            const lastLi = prevElement.lastElementChild;
                            const paragraphContent = currentLine.innerHTML === '<br>' ? '' : currentLine.innerHTML;
                            const isEmptyParagraph = !paragraphContent || paragraphContent === '<br>';

                            if (lastLi) {
                                // Find the deepest last li in the list (including nested lists)
                                const findDeepestLastLi = (li) => {
                                    const nestedLists = li.querySelectorAll(':scope > ul, :scope > ol');
                                    const lastNestedList = nestedLists.length > 0 ? nestedLists[nestedLists.length - 1] : null;
                                    if (lastNestedList && lastNestedList.lastElementChild) {
                                        return findDeepestLastLi(lastNestedList.lastElementChild);
                                    }
                                    return li;
                                };
                                const deepestLastLi = findDeepestLastLi(lastLi);

                                // Use deepestLastLi for merging content (not lastLi)
                                // This ensures content is merged into the deepest nested item
                                const targetLi = deepestLastLi;

                                // Find position to insert (before any nested lists in target li)
                                let insertBeforeNode = null;
                                for (const child of targetLi.childNodes) {
                                    if (child.nodeType === 1 && (child.tagName === 'UL' || child.tagName === 'OL')) {
                                        insertBeforeNode = child;
                                        break;
                                    }
                                }

                                // Remove trailing <br> from target li if present
                                // BUT only if there's no nested list after it (the <br> represents empty content before nested list)
                                const lastChild = insertBeforeNode ? insertBeforeNode.previousSibling : targetLi.lastChild;
                                if (lastChild && lastChild.nodeType === 1 && lastChild.tagName.toLowerCase() === 'br') {
                                    // Check if there's a nested list after the <br>
                                    const nextSiblingOfBr = lastChild.nextSibling;
                                    const hasNestedListAfter = nextSiblingOfBr && nextSiblingOfBr.nodeType === 1 &&
                                        (nextSiblingOfBr.tagName === 'UL' || nextSiblingOfBr.tagName === 'OL');
                                    if (!hasNestedListAfter) {
                                        lastChild.remove();
                                    }
                                }

                                // Save cursor position BEFORE appending content
                                // Cursor should be at the end of existing text in targetLi
                                let cursorNode = null;
                                let cursorOffset = 0;

                                // Find the last text node before any nested list
                                const findLastTextPosition = (li) => {
                                    let lastTextNode = null;
                                    let lastOffset = 0;
                                    for (const child of li.childNodes) {
                                        if (child.nodeType === 1 && (child.tagName === 'UL' || child.tagName === 'OL')) {
                                            break; // Stop at nested list
                                        }
                                        if (child.nodeType === 3) { // Text node
                                            lastTextNode = child;
                                            lastOffset = child.textContent.length;
                                        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
                                            // Element node (like <strong>, <em>, etc.)
                                            const textInside = child.lastChild;
                                            if (textInside && textInside.nodeType === 3) {
                                                lastTextNode = textInside;
                                                lastOffset = textInside.textContent.length;
                                            } else if (textInside) {
                                                lastTextNode = child;
                                                lastOffset = child.childNodes.length;
                                            }
                                        }
                                    }
                                    return { node: lastTextNode, offset: lastOffset };
                                };

                                const cursorPos = findLastTextPosition(targetLi);
                                cursorNode = cursorPos.node;
                                cursorOffset = cursorPos.offset;

                                // Append paragraph content to target li (if not empty)
                                if (!isEmptyParagraph) {
                                    const tempDiv = document.createElement('div');
                                    tempDiv.innerHTML = paragraphContent;
                                    while (tempDiv.firstChild) {
                                        if (insertBeforeNode) {
                                            targetLi.insertBefore(tempDiv.firstChild, insertBeforeNode);
                                        } else {
                                            targetLi.appendChild(tempDiv.firstChild);
                                        }
                                    }
                                }

                                // Remove the paragraph
                                currentLine.remove();

                                // Check if next element is a list of the same type - merge them
                                if (nextElement && nextElement.tagName.toLowerCase() === prevTag) {
                                    // Move all items from next list to previous list
                                    while (nextElement.firstChild) {
                                        prevElement.appendChild(nextElement.firstChild);
                                    }
                                    nextElement.remove();
                                }

                                // Set cursor to the saved position (end of original text, before merged content)
                                if (cursorNode) {
                                    try {
                                        const newRange = document.createRange();
                                        newRange.setStart(cursorNode, cursorOffset);
                                        newRange.collapse(true);
                                        sel.removeAllRanges();
                                        sel.addRange(newRange);
                                    } catch (e) {
                                        // Fallback to end of targetLi
                                        dependencies.setCursorToEnd(targetLi);
                                    }
                                } else {
                                    // No text content found, set cursor to end
                                    dependencies.setCursorToEnd(targetLi);
                                }
                            }

                            dependencies.syncMarkdown();
                            return true;
                        }

                        // If previous element is a paragraph, merge into it
                        if (prevTag === 'p') {
                            e.preventDefault();

                            const prevContent = prevElement.innerHTML === '<br>' ? '' : prevElement.innerHTML;
                            const currentContent = currentLine.innerHTML === '<br>' ? '' : currentLine.innerHTML;
                            const isPrevEmpty = !prevContent || prevContent === '';
                            const isCurrentEmpty = !currentContent || currentContent === '';

                            // If current paragraph is empty, just remove it (don't merge empty into empty)
                            if (isCurrentEmpty) {
                                currentLine.remove();
                                dependencies.setCursorToEnd(prevElement);
                                dependencies.syncMarkdown();
                                return true;
                            }

                            // Mark cursor position (end of previous paragraph)
                            let cursorNode = prevElement.lastChild;
                            let cursorOffset = cursorNode && cursorNode.nodeType === 3 ? cursorNode.textContent.length : 0;

                            // Remove trailing <br> from previous paragraph
                            if (prevElement.lastChild && prevElement.lastChild.nodeType === 1 &&
                                prevElement.lastChild.tagName.toLowerCase() === 'br') {
                                prevElement.lastChild.remove();
                                cursorNode = prevElement.lastChild;
                                cursorOffset = cursorNode && cursorNode.nodeType === 3 ? cursorNode.textContent.length : 0;
                            }

                            // Append current paragraph content
                            if (currentContent) {
                                const tempDiv = document.createElement('div');
                                tempDiv.innerHTML = currentContent;
                                while (tempDiv.firstChild) {
                                    prevElement.appendChild(tempDiv.firstChild);
                                }
                            }

                            // Remove current paragraph
                            currentLine.remove();

                            // Set cursor position
                            if (cursorNode && cursorNode.nodeType === 3) {
                                const newRange = document.createRange();
                                newRange.setStart(cursorNode, cursorOffset);
                                newRange.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(newRange);
                            } else if (isPrevEmpty) {
                                // Previous paragraph was empty - cursor should be at start of merged content
                                dependencies.setCursorToStart(prevElement);
                            } else {
                                dependencies.setCursorToEnd(prevElement);
                            }

                            dependencies.syncMarkdown();
                            return true;
                        }

                        // If previous element is a code block, merge paragraph into code block's last line
                        if (prevTag === 'pre') {
                            e.preventDefault();

                            const currentContent = currentLine.innerHTML === '<br>' ? '' : currentLine.textContent;
                            const isCurrentEmpty = !currentContent || currentContent.trim() === '';

                            // If current paragraph is empty, just remove it
                            if (isCurrentEmpty) {
                                currentLine.remove();
                                // Enter edit mode and set cursor to end
                                dependencies.isNavigatingIntoBlock = true;
                                dependencies.enterEditMode(prevElement);
                                setTimeout(() => {
                                    const code = prevElement.querySelector('code');
                                    if (code) {
                                        dependencies.setCursorToEnd(code);
                                    }
                                    dependencies.resetNavigationFlag();
                                }, 0);
                                dependencies.syncMarkdown();
                                return true;
                            }

                            // Merge paragraph content into code block's last line
                            const code = prevElement.querySelector('code');
                            if (code) {
                                // Enter edit mode first
                                dependencies.isNavigatingIntoBlock = true;
                                dependencies.enterEditMode(prevElement);

                                setTimeout(() => {
                                    // Append paragraph content to code block
                                    const codeEl = prevElement.querySelector('code');
                                    if (codeEl) {
                                        // Remove trailing empty text nodes and trailing <br>
                                        while (codeEl.lastChild) {
                                            if (codeEl.lastChild.nodeType === 3 && codeEl.lastChild.textContent === '') {
                                                codeEl.lastChild.remove();
                                            } else if (codeEl.lastChild.nodeName === 'BR') {
                                                codeEl.lastChild.remove();
                                            } else {
                                                break;
                                            }
                                        }
                                        // Add exactly one <br> as line separator, then the content
                                        if (codeEl.lastChild) {
                                            codeEl.appendChild(document.createElement('br'));
                                        }
                                        codeEl.appendChild(document.createTextNode(currentContent));
                                        dependencies.setCursorToEnd(codeEl);
                                    }
                                    dependencies.resetNavigationFlag();
                                    dependencies.syncMarkdown();
                                }, 0);
                            }

                            // Remove current paragraph
                            currentLine.remove();
                            return true;
                        }

                        // If previous element is a mermaid/math wrapper, enter edit mode and set cursor to end
                        if (prevTag === 'div' && dependencies.isSpecialWrapper(prevElement)) {
                            e.preventDefault();

                            const currentContent = currentLine.innerHTML === '<br>' ? '' : currentLine.textContent;
                            const isCurrentEmpty = !currentContent || currentContent.trim() === '';

                            // If current paragraph is empty, just remove it and enter wrapper edit mode
                            if (isCurrentEmpty) {
                                currentLine.remove();
                                dependencies.enterSpecialWrapperEditMode(prevElement, 'end');
                                dependencies.syncMarkdown();
                                return true;
                            }

                            // If paragraph has content, enter wrapper edit mode and append content as new line
                            var wrapperPreSelector = prevElement.classList.contains('mermaid-wrapper')
                                ? 'pre[data-lang="mermaid"]' : 'pre[data-lang="math"]';
                            prevElement.setAttribute('data-mode', 'edit');
                            var wrapperPre = prevElement.querySelector(wrapperPreSelector);
                            if (wrapperPre) {
                                var wrapperCode = wrapperPre.querySelector('code');
                                if (wrapperCode) {
                                    setTimeout(function() {
                                        // Add the paragraph content as a new line
                                        if (wrapperCode.lastChild && wrapperCode.lastChild.nodeName !== 'BR') {
                                            wrapperCode.appendChild(document.createElement('br'));
                                        }
                                        wrapperCode.appendChild(document.createTextNode(currentContent));
                                        dependencies.setCursorToEnd(wrapperCode);
                                        dependencies.syncMarkdown();
                                    }, 0);
                                }
                            }

                            // Remove current paragraph
                            currentLine.remove();
                            return true;
                        }

                        // If previous element is a horizontal rule, just remove the paragraph (don't delete hr)
                        if (prevTag === 'hr') {
                            e.preventDefault();

                            const isCurrentEmpty = currentLine.innerHTML === '<br>' || currentLine.textContent.trim() === '';

                            if (isCurrentEmpty) {
                                // Empty paragraph after hr - just remove the paragraph
                                // and set cursor right before the hr (like arrow key navigation)
                                currentLine.remove();

                                // Set cursor right before the hr element (same as arrow key behavior)
                                const newRange = document.createRange();
                                newRange.setStartBefore(prevElement);
                                newRange.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(newRange);

                                dependencies.syncMarkdown();
                                return true;
                            }

                            // Non-empty paragraph after hr - just set cursor to start (don't merge)
                            // This prevents accidental deletion of hr
                            dependencies.setCursorToStart(currentLine);
                            dependencies.syncMarkdown();
                            return true;
                        }

                        // If previous element is a heading, blockquote, or other block element,
                        // merge paragraph content into it (similar to p+p merge)
                        if (/^h[1-6]$/.test(prevTag) || prevTag === 'blockquote' || prevTag === 'table') {
                            e.preventDefault();

                            const currentContent = currentLine.innerHTML === '<br>' ? '' : currentLine.innerHTML;
                            const isCurrentEmpty = !currentContent || currentContent === '';

                            if (isCurrentEmpty) {
                                // Empty paragraph - just remove it and move cursor to end of previous element
                                currentLine.remove();
                                dependencies.setCursorToEnd(prevElement);
                                dependencies.syncMarkdown();
                                return true;
                            }

                            // For table, just move cursor to last cell
                            if (prevTag === 'table') {
                                dependencies.setCursorToEnd(prevElement);
                                return true;
                            }

                            // For blockquote, merge paragraph content as a new line in the blockquote
                            if (prevTag === 'blockquote') {
                                // Add <br> then paragraph content to blockquote
                                const lastChild = prevElement.lastChild;
                                if (lastChild && lastChild.nodeName !== 'BR') {
                                    prevElement.appendChild(document.createElement('br'));
                                }
                                // Mark cursor position
                                const cursorMarker = document.createTextNode('');
                                prevElement.appendChild(cursorMarker);

                                // Append paragraph content
                                const tempDiv2 = document.createElement('div');
                                tempDiv2.innerHTML = currentContent;
                                while (tempDiv2.firstChild) {
                                    prevElement.appendChild(tempDiv2.firstChild);
                                }

                                currentLine.remove();

                                // Set cursor at the start of appended content
                                const newRange = document.createRange();
                                newRange.setStartAfter(cursorMarker);
                                newRange.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(newRange);
                                // Clean up empty marker
                                if (cursorMarker.parentNode) cursorMarker.remove();

                                dependencies.syncMarkdown();
                                return true;
                            }

                            // For headings: merge paragraph content into heading
                            // Mark cursor position at end of heading's current content
                            const prevContent = prevElement.innerHTML === '<br>' ? '' : prevElement.innerHTML;
                            const isPrevEmpty = !prevContent || prevContent === '';

                            // Remove trailing <br> from heading
                            if (prevElement.lastChild && prevElement.lastChild.nodeType === 1 &&
                                prevElement.lastChild.tagName.toLowerCase() === 'br') {
                                prevElement.lastChild.remove();
                            }

                            let cursorNode = prevElement.lastChild;
                            let cursorOffset = cursorNode && cursorNode.nodeType === 3 ? cursorNode.textContent.length : 0;

                            // Append current paragraph content
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = currentContent;
                            while (tempDiv.firstChild) {
                                prevElement.appendChild(tempDiv.firstChild);
                            }

                            // Remove current paragraph
                            currentLine.remove();

                            // Set cursor position
                            if (!isPrevEmpty && cursorNode && cursorNode.nodeType === 3) {
                                const newRange = document.createRange();
                                newRange.setStart(cursorNode, cursorOffset);
                                newRange.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(newRange);
                            } else if (isPrevEmpty) {
                                dependencies.setCursorToStart(prevElement);
                            } else {
                                dependencies.setCursorToEnd(prevElement);
                            }

                            dependencies.syncMarkdown();
                            return true;
                        }
                    }
                }
        return false;
    }

    return { handleParagraphDelete };
}

module.exports = { createParagraphDelete };
