/**
 * Clipboard image, HTML, inline and block insertion from the editor paste route.
 * Construction binds named capabilities; the owner installs the paste listener.
 * Document mode and history are accessed when the event is handled.
 */
function createPaste({ editor, logger, getSourceMode, saveSnapshot, markAsEdited, saveImageAndInsert, syncMarkdown, syncMarkdownSync, setupLink, parseInline, markdownToHtmlFragment, setupInteractiveElements, }) {
    function handlePaste(e) {
        if (e.target.closest && e.target.closest('.front-matter'))
            return;
        if (getSourceMode())
            return;
        saveSnapshot();
        markAsEdited();
        logger.log('Paste event triggered');
        // Check for image files first
        const items = e.clipboardData?.items;
        if (items) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    e.preventDefault();
                    logger.log('Image found in paste event');
                    const file = item.getAsFile();
                    if (file) {
                        logger.log('Pasting image from clipboard:', file.type);
                        const reader = new FileReader();
                        reader.onload = function (event) {
                            const dataUrl = event.target.result;
                            saveImageAndInsert(dataUrl);
                            logger.log('Image sent to extension for saving');
                        };
                        reader.readAsDataURL(file);
                    }
                    return; // Stop processing - image handled
                }
            }
        }
        // No image - handle as text/html paste
        e.preventDefault();
        // Check for internal copy (has our custom marker)
        const internalMd = e.clipboardData.getData('text/x-binary-markdown');
        const html = e.clipboardData.getData('text/html');
        const text = e.clipboardData.getData('text/plain');
        logger.log('Internal MD:', internalMd ? 'yes' : 'no');
        logger.log('HTML length:', html ? html.length : 0);
        let pastedMd = '';
        // Priority: internal markdown > external HTML > plain text
        if (internalMd) {
            // Internal copy - use the markdown directly (same format as htmlToMarkdown)
            pastedMd = internalMd;
            logger.log('Using internal markdown');
        }
        else if (html && typeof TurndownService !== 'undefined') {
            // External HTML - convert via Turndown
            try {
                const turndownService = new TurndownService({
                    headingStyle: 'atx',
                    codeBlockStyle: 'fenced',
                    emDelimiter: '*',
                    bulletListMarker: '-'
                });
                if (typeof turndownPluginGfm !== 'undefined') {
                    turndownService.use(turndownPluginGfm.gfm);
                }
                // Override GFM tableCell rule to:
                // 1. Escape pipe characters in cell content (prevents table structure breakage)
                // 2. Convert newlines to <br> (table cells must be single-line in markdown)
                turndownService.addRule('tableCellEscapePipe', {
                    filter: ['th', 'td'],
                    replacement: function (content, node) {
                        var index = Array.prototype.indexOf.call(node.parentNode.childNodes, node);
                        var prefix = ' ';
                        if (index === 0)
                            prefix = '| ';
                        // Convert newlines to <br> (table cells must stay on one line)
                        content = content.replace(/\n/g, '<br>');
                        // Collapse multiple <br> into single
                        content = content.replace(/(<br>)+/g, '<br>');
                        // Trim leading/trailing <br>
                        content = content.replace(/^(<br>)+/, '').replace(/(<br>)+$/, '');
                        // Escape pipe characters in cell content
                        content = content.replace(/\|/g, '\\|');
                        return prefix + content + ' |';
                    }
                });
                // Custom rule: Remove empty span tags and Apple-converted-space spans
                turndownService.addRule('cleanupSpans', {
                    filter: function (node) {
                        if (node.nodeName !== 'SPAN')
                            return false;
                        // Apple-converted-space spans contain only &nbsp;
                        if (node.classList && node.classList.contains('Apple-converted-space')) {
                            return true;
                        }
                        // Empty styling spans (no meaningful content)
                        const hasOnlyStyleAttr = node.attributes.length === 1 &&
                            node.hasAttribute('style');
                        const hasNoContent = !node.textContent || node.textContent.trim() === '';
                        return hasOnlyStyleAttr && hasNoContent;
                    },
                    replacement: function (content, node, options) {
                        // For Apple-converted-space, return a single space
                        if (node.classList && node.classList.contains('Apple-converted-space')) {
                            return ' ';
                        }
                        return content;
                    }
                });
                // Retain the supported underline wrapper, without source attributes.
                turndownService.addRule('underline', {
                    filter: 'u',
                    replacement: function (content) { return content ? '<u>' + content + '</u>' : ''; }
                });
                // Custom rule: CSS style-based bold recognition
                // Handles <span style="font-weight: bold"> etc. from Google Docs, web pages
                turndownService.addRule('styledBold', {
                    filter: function (node) {
                        if (node.nodeName !== 'SPAN')
                            return false;
                        const fw = node.style.fontWeight;
                        return fw === 'bold' || fw === 'bolder' || (parseInt(fw) >= 700);
                    },
                    replacement: function (content) {
                        content = content.trim();
                        if (!content)
                            return '';
                        return '**' + content + '**';
                    }
                });
                // Custom rule: CSS style-based italic recognition
                turndownService.addRule('styledItalic', {
                    filter: function (node) {
                        if (node.nodeName !== 'SPAN')
                            return false;
                        const fs = node.style.fontStyle;
                        return fs === 'italic' || fs === 'oblique';
                    },
                    replacement: function (content) {
                        content = content.trim();
                        if (!content)
                            return '';
                        return '*' + content + '*';
                    }
                });
                // Custom rule: CSS style-based strikethrough recognition
                turndownService.addRule('styledStrikethrough', {
                    filter: function (node) {
                        if (node.nodeName !== 'SPAN')
                            return false;
                        const td = node.style.textDecoration || node.style.textDecorationLine || '';
                        return td.includes('line-through');
                    },
                    replacement: function (content) {
                        content = content.trim();
                        if (!content)
                            return '';
                        return '~~' + content + '~~';
                    }
                });
                // Custom rule: Robust fenced code block with language extraction
                // Handles Shiki-styled code blocks (language= attribute instead of class=)
                // and code blocks with indented whitespace before <code>
                turndownService.addRule('fencedCodeWithLang', {
                    filter: function (node) {
                        return node.nodeName === 'PRE' && node.querySelector('code');
                    },
                    replacement: function (content, node) {
                        var code = node.querySelector('code');
                        var cls = code.className || '';
                        // Extract language from: class="language-xxx", language="xxx" attr, or data-lang="xxx"
                        var lang = (cls.match(/language-(\S+)/) || [null, ''])[1];
                        if (!lang)
                            lang = code.getAttribute('language') || node.getAttribute('language') || '';
                        if (!lang)
                            lang = node.getAttribute('data-lang') || '';
                        // Clean language: remove non-alphanumeric suffixes like "theme={null}"
                        lang = lang.split(/\s+/)[0] || '';
                        // Filter out non-language class names
                        if (['hljs', 'nohighlight', 'shiki'].indexOf(lang) !== -1)
                            lang = '';
                        var text = code.textContent || '';
                        return '\n\n```' + lang + '\n' + text.replace(/\n$/, '') + '\n```\n\n';
                    }
                });
                // Custom rule: Normalize link content
                // When <a> tags contain block elements (div, span) or newlines,
                // Turndown produces multi-line markdown links like:
                //   [\n  How Claude Code works\n  ](/docs/en/...)
                // This rule collapses whitespace/newlines into a single-line link.
                turndownService.addRule('normalizeLink', {
                    filter: function (node) {
                        return node.nodeName === 'A' && node.getAttribute('href');
                    },
                    replacement: function (content, node) {
                        var href = node.getAttribute('href');
                        if (href)
                            href = href.replace(/([()])/g, '\\$1');
                        var title = node.getAttribute('title');
                        if (title)
                            title = ' "' + title.replace(/"/g, '\\"') + '"';
                        else
                            title = '';
                        // Collapse multi-line link text (e.g. <a><div>text</div></a>)
                        content = content.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
                        if (!content)
                            return '';
                        return '[' + content + '](' + href + title + ')';
                    }
                });
                // Custom rule: Compact list items (remove blank lines between items)
                // Turndown's default listItem rule produces "loose" lists with blank lines
                // when <li> contains <p> elements (common in web pages, Google Docs).
                // Override to always produce "tight" lists without blank lines.
                turndownService.addRule('compactListItem', {
                    filter: 'li',
                    replacement: function (content, node, options) {
                        content = content
                            .replace(/^\n+/, '') // remove leading newlines
                            .replace(/\n+$/, ''); // remove trailing newlines
                        // Indent nested content (only internal newlines, not trailing)
                        content = content.replace(/\n/gm, '\n    ');
                        var prefix = options.bulletListMarker + ' ';
                        var parent = node.parentNode;
                        if (parent.nodeName === 'OL') {
                            var start = parent.getAttribute('start');
                            var index = Array.prototype.indexOf.call(parent.children, node);
                            prefix = (start ? Number(start) + index : index + 1) + '. ';
                        }
                        return (prefix + content + (node.nextSibling ? '\n' : ''));
                    }
                });
                pastedMd = turndownService.turndown(html);
                // Post-process: Un-escape Markdown block-level syntax markers
                // Turndown escapes characters like -, +, #, > at line starts to prevent
                // Markdown interpretation (preserving original HTML paragraph semantics).
                // Since we're pasting into a Markdown editor, we want these interpreted as Markdown.
                pastedMd = pastedMd.replace(/^\\([-+*]) /gm, '$1 '); // list markers: \- , \+ , \*
                pastedMd = pastedMd.replace(/^\\(#{1,6}) /gm, '$1 '); // headings: \# , \## , etc.
                pastedMd = pastedMd.replace(/^\\(>) ?/gm, '$1 '); // blockquote: \>
                pastedMd = pastedMd.replace(/^(\d+)\\(\. )/gm, '$1$2'); // ordered list: 1\.
                pastedMd = pastedMd.replace(/^\\(~~~)/gm, '$1'); // code fence: \~~~
                // Post-process: Remove blank lines between consecutive list items
                // Safety net for edge cases where the custom listItem rule doesn't catch all cases
                var prevPastedMd;
                do {
                    prevPastedMd = pastedMd;
                    pastedMd = pastedMd.replace(/(^[ \t]*(?:[-*+]|\d+\.)\s+.*)\n{2,}([ \t]*(?:[-*+]|\d+\.)\s)/gm, '$1\n$2');
                } while (pastedMd !== prevPastedMd);
                logger.log('Converted external HTML to markdown via Turndown');
            }
            catch (err) {
                logger.error('Turndown error:', err);
                pastedMd = text || '';
            }
        }
        else {
            pastedMd = text || '';
            logger.log('Using plain text');
        }
        if (!pastedMd) {
            logger.log('No content to paste');
            return;
        }
        logger.log('Pasted markdown (raw):', pastedMd.substring(0, 100));
        // Check if cursor is inside a list item (for special handling)
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) {
            logger.log('No selection for paste');
            return;
        }
        const range = sel.getRangeAt(0);
        // Find if we're inside a list item
        let pasteTargetLi = null;
        let tempNode = range.startContainer;
        while (tempNode && tempNode !== editor) {
            if (tempNode.nodeType === Node.ELEMENT_NODE && tempNode.tagName === 'LI') {
                pasteTargetLi = tempNode;
                break;
            }
            tempNode = tempNode.parentNode;
        }
        // When pasting into a list item, trim leading/trailing newlines from the pasted content
        // This prevents paragraph text (which includes trailing newline when triple-clicked)
        // from being treated as block content
        if (pasteTargetLi) {
            const originalMd = pastedMd;
            // Trim leading and trailing newlines (but preserve internal structure)
            pastedMd = pastedMd.replace(/^\n+/, '').replace(/\n+$/, '');
            if (originalMd !== pastedMd) {
                logger.log('Trimmed newlines for list paste:', originalMd.length, '->', pastedMd.length);
            }
        }
        logger.log('Pasted markdown:', pastedMd.substring(0, 100));
        // Determine if pasted content is inline or block
        // Block patterns: starts with #, -, *, +, >, digit., \`\`\`, |, or contains newlines
        const blockPatterns = /^(#{1,6}\s|[-*+]\s|\d+\.\s|>\s?|\`\`\`|\|)/;
        const isBlockPaste = pastedMd.includes('\n') || blockPatterns.test(pastedMd.trim());
        const isInlinePaste = !isBlockPaste;
        logger.log('Is inline paste:', isInlinePaste, 'Block pattern match:', blockPatterns.test(pastedMd.trim()));
        // Debug: Log cursor position DOM structure
        logger.log('Paste cursor position:', {
            startContainer: range.startContainer,
            startContainerTag: range.startContainer.nodeName,
            startContainerParent: range.startContainer.parentNode ? range.startContainer.parentNode.nodeName : null,
            startOffset: range.startOffset
        });
        // Check if we're inside a code block (pre > code) or blockquote
        let cursorNode = range.startContainer;
        let codeElement = null;
        let blockquoteElement = null;
        let preElement = null;
        while (cursorNode && cursorNode !== editor) {
            if (cursorNode.nodeType === Node.ELEMENT_NODE) {
                const tagName = cursorNode.tagName.toUpperCase();
                if (tagName === 'CODE' && cursorNode.parentNode && cursorNode.parentNode.tagName && cursorNode.parentNode.tagName.toUpperCase() === 'PRE') {
                    codeElement = cursorNode;
                    preElement = cursorNode.parentNode;
                }
                if (tagName === 'PRE') {
                    preElement = cursorNode;
                }
                if (tagName === 'BLOCKQUOTE') {
                    blockquoteElement = cursorNode;
                }
            }
            cursorNode = cursorNode.parentNode;
        }
        // Handle paste inside code block - insert as plain text
        if (codeElement || preElement) {
            logger.log('Paste inside code block');
            const textToPaste = e.clipboardData.getData('text/plain') || '';
            if (textToPaste) {
                range.deleteContents();
                const textNode = document.createTextNode(textToPaste);
                range.insertNode(textNode);
                // Move cursor to end of inserted text
                range.setStartAfter(textNode);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                syncMarkdownSync();
                logger.log('Code block paste completed');
            }
            return;
        }
        // Handle paste inside blockquote - insert as plain text (preserving line breaks as <br>)
        if (blockquoteElement) {
            logger.log('Paste inside blockquote');
            const textToPaste = e.clipboardData.getData('text/plain') || '';
            if (textToPaste) {
                range.deleteContents();
                // Split by newlines and insert with <br> tags
                const lines = textToPaste.split('\n');
                const frag = document.createDocumentFragment();
                lines.forEach((line, index) => {
                    if (index > 0) {
                        frag.appendChild(document.createElement('br'));
                    }
                    if (line) {
                        frag.appendChild(document.createTextNode(line));
                    }
                });
                range.insertNode(frag);
                // Move cursor to end of inserted content
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
                syncMarkdownSync();
                logger.log('Blockquote paste completed');
            }
            return;
        }
        // Handle paste inside table cell - insert as plain text (preserving line breaks as <br>)
        const tableCellElement = (() => {
            let node = range.startContainer;
            while (node && node !== editor) {
                if (node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'TD' || node.tagName === 'TH')) {
                    return node;
                }
                node = node.parentNode;
            }
            return null;
        })();
        if (tableCellElement) {
            logger.log('Paste inside table cell');
            const textToPaste = e.clipboardData.getData('text/plain') || '';
            if (textToPaste) {
                range.deleteContents();
                // Split by newlines and insert with <br> tags
                const lines = textToPaste.split('\n');
                const frag = document.createDocumentFragment();
                lines.forEach((line, index) => {
                    if (index > 0) {
                        frag.appendChild(document.createElement('br'));
                    }
                    if (line) {
                        frag.appendChild(document.createTextNode(line));
                    }
                });
                range.insertNode(frag);
                // Move cursor to end of inserted content
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
                syncMarkdownSync();
                logger.log('Table cell paste completed');
            }
            return;
        }
        // URL auto-link on paste
        // If clipboard contains a URL (not from internal copy), auto-create a link
        if (!internalMd) {
            const plainText = (text || '').trim();
            const urlRegex = /^https?:\/\/[^\s]+$/;
            if (plainText && !plainText.includes('\n') && urlRegex.test(plainText)) {
                const selectedText = range.toString();
                if (selectedText && !selectedText.includes('\n')) {
                    // Case 2: Text is selected + URL in clipboard → wrap selected text as link
                    logger.log('URL paste: wrapping selected text as link:', selectedText, '->', plainText);
                    const a = document.createElement('a');
                    a.href = plainText;
                    a.textContent = selectedText;
                    setupLink(a);
                    range.deleteContents();
                    range.insertNode(a);
                    // Move cursor after the link
                    const newRange = document.createRange();
                    newRange.setStartAfter(a);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                    syncMarkdown();
                    return;
                }
                else if (!selectedText || selectedText.trim() === '') {
                    // Case 1: No selection + URL paste → auto-create link with URL as text
                    logger.log('URL paste: auto-linking URL:', plainText);
                    const a = document.createElement('a');
                    a.href = plainText;
                    a.textContent = plainText;
                    setupLink(a);
                    range.deleteContents();
                    range.insertNode(a);
                    // Move cursor after the link
                    const newRange = document.createRange();
                    newRange.setStartAfter(a);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                    syncMarkdown();
                    return;
                }
                // If selection spans multiple lines, fall through to normal paste
            }
        }
        // Detect triple-click selection pattern for paste
        // Triple-click typically selects from start of element to start of next element
        const isTripleClickSelection = ((range.startContainer.nodeType === 1 && range.startOffset === 0) ||
            (range.endContainer.nodeType === 1 && range.endOffset === 0) ||
            (range.startContainer !== range.endContainer &&
                (range.startContainer.nodeType === 1 || range.endContainer.nodeType === 1)));
        // Handle triple-click selection in list item for paste
        if (isTripleClickSelection && pasteTargetLi && !range.collapsed) {
            logger.log('Paste: Triple-click selection detected in li');
            // Get nested list and checkbox before deletion
            const nestedList = pasteTargetLi.querySelector(':scope > ul, :scope > ol');
            const checkbox = pasteTargetLi.querySelector(':scope > input[type="checkbox"]');
            // Clear the li content but preserve structure
            const nodesToRemove = [];
            for (const child of pasteTargetLi.childNodes) {
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
            // Set range to insert position
            const newRange = document.createRange();
            if (checkbox) {
                newRange.setStartAfter(checkbox);
            }
            else if (nestedList) {
                newRange.setStart(pasteTargetLi, 0);
            }
            else {
                newRange.setStart(pasteTargetLi, 0);
            }
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
            range.setStart(newRange.startContainer, newRange.startOffset);
            range.collapse(true);
        }
        else {
            range.deleteContents();
        }
        if (isInlinePaste) {
            // INLINE PASTE: Insert directly at cursor using DOM API
            // Parse the inline markdown to HTML and insert
            const tempSpan = document.createElement('span');
            tempSpan.innerHTML = parseInline(pastedMd);
            // Insert all child nodes
            const frag = document.createDocumentFragment();
            while (tempSpan.firstChild) {
                frag.appendChild(tempSpan.firstChild);
            }
            // If cursor is inside a <br> tag, replace the <br> with the content
            // This happens when pasting into an empty heading like "## "
            if (range.startContainer.nodeName === 'BR') {
                const brElement = range.startContainer;
                const parent = brElement.parentNode;
                if (parent) {
                    parent.replaceChild(frag, brElement);
                    logger.log('Replaced <br> with pasted content');
                }
            }
            else {
                range.insertNode(frag);
            }
            // Debug: Log DOM after insert
            let parentBlock = range.startContainer;
            while (parentBlock && parentBlock !== editor && parentBlock.parentNode !== editor) {
                parentBlock = parentBlock.parentNode;
            }
            logger.log('After insert - parent block:', parentBlock ? parentBlock.outerHTML.substring(0, 200) : 'null');
            // Move cursor to end of inserted content
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
            // Sync to markdown (this updates the internal state)
            syncMarkdownSync();
            // Ensure editor stays focused
            editor.focus();
            logger.log('Inline paste completed via DOM');
        }
        else {
            // BLOCK PASTE: Insert as block element(s) using DOM manipulation
            // Convert pasted markdown to HTML first to check what we're pasting
            const pastedHtml = markdownToHtmlFragment(pastedMd);
            logger.log('Block paste - pastedHtml:', pastedHtml.substring(0, 200));
            // Create a temporary container to parse the HTML
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = pastedHtml;
            // Get all the new block elements
            const newElements = Array.from(tempContainer.children);
            logger.log('Block paste - newElements count:', newElements.length);
            if (newElements.length === 0) {
                logger.log('Block paste - no elements to insert');
                return;
            }
            // Check if pasted content is a list (ul or ol)
            const pastedIsList = newElements.length === 1 &&
                (newElements[0].tagName === 'UL' || newElements[0].tagName === 'OL');
            // Check if cursor is inside a list item
            let listItemElement = null;
            let parentListElement = null;
            let tempNode = range.startContainer;
            while (tempNode && tempNode !== editor) {
                if (tempNode.nodeType === Node.ELEMENT_NODE) {
                    if (tempNode.tagName === 'LI' && !listItemElement) {
                        listItemElement = tempNode;
                    }
                    if ((tempNode.tagName === 'UL' || tempNode.tagName === 'OL') && !parentListElement) {
                        parentListElement = tempNode;
                    }
                }
                tempNode = tempNode.parentNode;
            }
            logger.log('Block paste - listItemElement:', listItemElement ? 'found' : 'null');
            logger.log('Block paste - parentListElement:', parentListElement ? parentListElement.tagName : 'null');
            logger.log('Block paste - pastedIsList:', pastedIsList);
            // Track the last inserted element for cursor positioning
            let lastInsertedElement = null;
            // Special handling: Pasting list into list item
            if (listItemElement && parentListElement && pastedIsList) {
                const pastedList = newElements[0];
                const pastedListItems = Array.from(pastedList.children).filter(el => el.tagName === 'LI');
                // Check if current list item is empty (only whitespace or <br>)
                const liText = listItemElement.textContent || '';
                const isEmptyLi = liText.trim() === '' ||
                    (listItemElement.childNodes.length === 1 && listItemElement.firstChild.nodeName === 'BR');
                logger.log('Block paste - isEmptyLi:', isEmptyLi);
                logger.log('Block paste - pastedListItems count:', pastedListItems.length);
                if (isEmptyLi) {
                    // Pattern 1: Empty list item - replace with pasted list items
                    // The pasted items should be inserted at the same level as the empty li
                    const nextSibling = listItemElement.nextSibling;
                    const parentList = listItemElement.parentNode;
                    // Remove the empty list item
                    parentList.removeChild(listItemElement);
                    // Insert pasted list items at the same position
                    pastedListItems.forEach(li => {
                        const clonedLi = li.cloneNode(true);
                        if (nextSibling) {
                            parentList.insertBefore(clonedLi, nextSibling);
                        }
                        else {
                            parentList.appendChild(clonedLi);
                        }
                        lastInsertedElement = clonedLi;
                    });
                    logger.log('Block paste - replaced empty li with pasted list items');
                }
                else {
                    // Pattern 2: Non-empty list item - insert pasted items after current li
                    let insertAfterLi = listItemElement;
                    const parentList = listItemElement.parentNode;
                    pastedListItems.forEach(li => {
                        const clonedLi = li.cloneNode(true);
                        if (insertAfterLi.nextSibling) {
                            parentList.insertBefore(clonedLi, insertAfterLi.nextSibling);
                        }
                        else {
                            parentList.appendChild(clonedLi);
                        }
                        insertAfterLi = clonedLi;
                        lastInsertedElement = clonedLi;
                    });
                    logger.log('Block paste - inserted pasted list items after current li');
                }
            }
            else {
                // Standard block paste behavior (non-list or pasting into non-list)
                // Find the current block element
                let blockElement = range.startContainer;
                while (blockElement && blockElement.nodeType !== Node.ELEMENT_NODE) {
                    blockElement = blockElement.parentNode;
                }
                while (blockElement && blockElement !== editor && blockElement.parentNode !== editor) {
                    blockElement = blockElement.parentNode;
                }
                const isEmptyBlock = blockElement && (!blockElement.textContent || blockElement.textContent.trim() === '');
                logger.log('Block paste - isEmptyBlock:', isEmptyBlock);
                logger.log('Block paste - blockElement:', blockElement ? blockElement.tagName : 'null');
                if (isEmptyBlock && blockElement) {
                    // Replace empty block with pasted content
                    const parent = blockElement.parentNode;
                    const nextSibling = blockElement.nextSibling;
                    // Remove the empty block
                    parent.removeChild(blockElement);
                    // Insert all new elements
                    newElements.forEach(el => {
                        if (nextSibling) {
                            parent.insertBefore(el, nextSibling);
                        }
                        else {
                            parent.appendChild(el);
                        }
                        lastInsertedElement = el;
                    });
                }
                else if (blockElement) {
                    // Insert after current block
                    let insertAfter = blockElement;
                    newElements.forEach(el => {
                        if (insertAfter.nextSibling) {
                            insertAfter.parentNode.insertBefore(el, insertAfter.nextSibling);
                        }
                        else {
                            insertAfter.parentNode.appendChild(el);
                        }
                        insertAfter = el;
                        lastInsertedElement = el;
                    });
                }
                else {
                    // No block element found, append to editor
                    newElements.forEach(el => {
                        editor.appendChild(el);
                        lastInsertedElement = el;
                    });
                }
            }
            // Setup interactive elements for the newly inserted content
            setupInteractiveElements();
            // Move cursor to end of last inserted element
            if (lastInsertedElement) {
                const newRange = document.createRange();
                // Find the deepest last text node or element
                let cursorTarget = lastInsertedElement;
                while (cursorTarget.lastChild) {
                    cursorTarget = cursorTarget.lastChild;
                }
                // If it's a text node, position at end
                if (cursorTarget.nodeType === Node.TEXT_NODE) {
                    newRange.setStart(cursorTarget, cursorTarget.length);
                    newRange.setEnd(cursorTarget, cursorTarget.length);
                }
                else {
                    // Element node - position after it
                    newRange.selectNodeContents(cursorTarget);
                    newRange.collapse(false);
                }
                sel.removeAllRanges();
                sel.addRange(newRange);
                logger.log('Block paste - cursor positioned at:', cursorTarget.nodeName);
            }
            // Sync to markdown
            syncMarkdownSync();
            // Ensure editor stays focused
            editor.focus();
            logger.log('Block paste completed via DOM manipulation');
        }
    }
    return { handlePaste };
}
// Construction defines capabilities; bootstrap controls the original initialization order.
function createPasteController(dependencies) {
    let handlePaste;
    let initializeHandlePasteDone = false;
    function initializeHandlePaste() {
        if (initializeHandlePasteDone)
            return;
        initializeHandlePasteDone = true;
        ({ handlePaste } = createPaste({
            editor: dependencies.editor, logger: dependencies.logger, getSourceMode: () => dependencies.isSourceMode,
            saveSnapshot: () => dependencies.undoManager.saveSnapshot(),
            markAsEdited: (...args) => dependencies.markAsEdited(...args),
            saveImageAndInsert: (...args) => dependencies.host.saveImageAndInsert(...args),
            syncMarkdown: (...args) => dependencies.syncMarkdown(...args),
            syncMarkdownSync: (...args) => dependencies.syncMarkdownSync(...args),
            setupLink: (...args) => dependencies.setupLink(...args),
            parseInline: (...args) => dependencies.parseInline(...args),
            markdownToHtmlFragment: (...args) => dependencies.markdownToHtmlFragment(...args),
            setupInteractiveElements: (...args) => dependencies.setupInteractiveElements(...args)
        }));
        dependencies.editor.addEventListener('paste', handlePaste);
    }
    return {
        get handlePaste() { return handlePaste; }, set handlePaste(value) { handlePaste = value; },
        initializeHandlePaste
    };
}
module.exports = { createPaste, createPasteController };
