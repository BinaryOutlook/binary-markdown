'use strict';

// Named capabilities remain live; this factory installs no listeners.
function createBlockPatterns(dependencies) {




    // Detect markdown table pattern: | col1 | col2 |
    function checkTablePattern(text) {
        // Match: | something | something | (at least 2 columns)
        // Using [|] to match pipe character without needing complex escaping
        if (!text.startsWith('|') || !text.trim().endsWith('|')) return null;

        const cells = text.split('|').filter(c => c.trim() !== '');
        if (cells.length < 2) return null;

        return cells.map(c => c.trim());
    }


    function convertToTable(cells, node) {
        const table = document.createElement('table');
        const headerRow = document.createElement('tr');

        cells.forEach(cellText => {
            const th = document.createElement('th');
            th.setAttribute('contenteditable', 'true');
            th.textContent = cellText;
            headerRow.appendChild(th);
        });

        table.appendChild(headerRow);

        // Add one empty data row
        const dataRow = document.createElement('tr');
        cells.forEach(() => {
            const td = document.createElement('td');
            td.setAttribute('contenteditable', 'true');
            td.innerHTML = dependencies.emptyTableCell;
            dataRow.appendChild(td);
        });
        table.appendChild(dataRow);

        node.replaceWith(table);

        // Add resize handles to the new table
        dependencies.addTableResizeHandles(table);

        dependencies.setCursorToEnd(dataRow.cells[0]);
        dependencies.syncMarkdown();
    }


    // ========== LIVE CONVERSION ==========

    // Check all patterns (called on Space or Enter)
    function checkAllPatterns(trigger) {
        // First check inline patterns
        if (dependencies.checkInlinePatterns(trigger)) return true;
        // Then check block patterns
        if (checkBlockPatterns(trigger)) return true;
        return false;
    }


    // Check block-level patterns (headings, lists, etc.)
    function checkBlockPatterns(trigger) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return false;

        const range = sel.getRangeAt(0);
        let node = range.startContainer;

        // Check if we're inside a code block (pre element)
        // If so, skip all block conversions - code blocks should preserve literal text
        // Use closest() for more reliable detection
        const startElement = node.nodeType === 3 ? node.parentElement : node;
        if (startElement && startElement.closest && startElement.closest('pre')) {
            dependencies.logger.log('checkBlockPatterns: Inside code block, skipping conversion');
            return false; // Don't convert patterns inside code blocks
        }

        // Check if we're inside a heading (H1-H6)
        // If so, skip all block/inline conversions (except heading-to-heading conversion)
        let currentHeadingNode = null;
        let headingNode = node;
        while (headingNode && headingNode !== dependencies.editor) {
            if (headingNode.tagName && /^H[1-6]$/i.test(headingNode.tagName)) {
                currentHeadingNode = headingNode;
                break;
            }
            headingNode = headingNode.parentNode;
        }

        // Check if we're inside a list item first (for task list conversion)
        let liNode = node;
        while (liNode && liNode !== dependencies.editor) {
            if (liNode.tagName && liNode.tagName.toUpperCase() === 'LI') {
                break;
            }
            liNode = liNode.parentNode;
        }

        // List type inter-conversion within existing list items
        // Supports: bullet ↔ ordered ↔ task (any direction)
        if (liNode && liNode.tagName && liNode.tagName.toUpperCase() === 'LI' && trigger === 'space') {
            // Get only direct text content of the li (excluding nested lists)
            let liDirectText = '';
            for (const child of liNode.childNodes) {
                if (child.nodeType === 3) { // Text node
                    liDirectText += child.textContent;
                } else if (child.nodeType === 1) { // Element node
                    const tag = child.tagName.toLowerCase();
                    // Skip nested lists
                    if (tag !== 'ul' && tag !== 'ol') {
                        liDirectText += child.textContent;
                    }
                }
            }

            // Check if current item has a direct child checkbox
            var hasCheckbox = false;
            for (const child of liNode.childNodes) {
                if (child.nodeType === 1 && child.tagName === 'INPUT' && child.type === 'checkbox') {
                    hasCheckbox = true;
                    break;
                }
            }
            const parentList = liNode.parentNode;
            const parentTag = parentList ? parentList.tagName.toLowerCase() : '';

            // Helper: collect nested lists for preservation
            const collectNestedLists = () => {
                const lists = [];
                for (const child of Array.from(liNode.childNodes)) {
                    if (child.nodeType === 1 && (child.tagName.toLowerCase() === 'ul' || child.tagName.toLowerCase() === 'ol')) {
                        lists.push(child.cloneNode(true));
                    }
                }
                return lists;
            };

            // Helper: restore nested lists after rebuilding li content
            const restoreNestedLists = (lists) => {
                for (const nested of lists) {
                    liNode.appendChild(nested);
                }
            };

            // Helper: set cursor at start of li text (after checkbox if present)
            const setCursorToLiTextStart = () => {
                const r = document.createRange();
                const s = window.getSelection();
                // Find first text node (skipping checkbox)
                for (const child of liNode.childNodes) {
                    if (child.nodeType === 3 && child.textContent.length > 0) {
                        r.setStart(child, 0);
                        r.collapse(true);
                        s.removeAllRanges();
                        s.addRange(r);
                        return;
                    }
                    if (child.nodeType === 1 && child.tagName === 'INPUT') {
                        continue; // Skip checkbox
                    }
                }
                // Fallback
                dependencies.setCursorToEnd(liNode);
            };

            // 1. Task list conversion: [ ] or [x] at beginning
            const taskInListMatch = liDirectText.match(/^\[([ xX])\] (.*)$/);
            if (taskInListMatch) {
                if (hasCheckbox) return false; // Already a task item

                const existingText = taskInListMatch[2] || '';
                const checked = taskInListMatch[1].toLowerCase() === 'x';
                const nestedLists = collectNestedLists();

                liNode.innerHTML = '';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = checked;
                liNode.appendChild(checkbox);
                let textNode = null;
                if (existingText) {
                    textNode = document.createTextNode(existingText);
                    liNode.appendChild(textNode);
                }
                restoreNestedLists(nestedLists);

                // Change parent to ul if needed (e.g. from ol)
                if (parentTag !== 'ul') {
                    dependencies.changeParentListType(liNode, 'ul');
                }

                // Set cursor after checkbox
                const range = document.createRange();
                const sel = window.getSelection();
                if (existingText && textNode) {
                    range.setStart(textNode, 0);
                } else {
                    range.setStartAfter(checkbox);
                }
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);

                dependencies.syncMarkdown();
                return true;
            }

            // 2. Bullet list conversion: - or * or + at beginning
            const bulletMatch = liDirectText.match(/^[-*+] (.*)$/);
            if (bulletMatch) {
                // Skip if already a regular bullet (ul without checkbox)
                if (parentTag === 'ul' && !hasCheckbox) return false;

                const existingText = bulletMatch[1] || '';
                const nestedLists = collectNestedLists();

                liNode.innerHTML = '';
                if (existingText) {
                    liNode.appendChild(document.createTextNode(existingText));
                } else {
                    liNode.innerHTML = '<br>';
                }
                restoreNestedLists(nestedLists);

                // Change parent to ul if needed (from ol), or just remove checkbox (already ul for task)
                if (parentTag !== 'ul') {
                    dependencies.changeParentListType(liNode, 'ul');
                }

                setCursorToLiTextStart();
                dependencies.syncMarkdown();
                return true;
            }

            // 3. Ordered list conversion: N. at beginning
            const orderedMatch = liDirectText.match(/^(\d+)\. (.*)$/);
            if (orderedMatch) {
                if (parentTag === 'ol') return false; // Already ordered

                const existingText = orderedMatch[2] || '';
                const nestedLists = collectNestedLists();

                liNode.innerHTML = '';
                if (existingText) {
                    liNode.appendChild(document.createTextNode(existingText));
                } else {
                    liNode.innerHTML = '<br>';
                }
                restoreNestedLists(nestedLists);

                dependencies.changeParentListType(liNode, 'ol');

                setCursorToLiTextStart();
                dependencies.syncMarkdown();
                return true;
            }
        }

        // Get the current block element
        while (node && node !== dependencies.editor && node.parentNode !== dependencies.editor) {
            node = node.parentNode;
        }

        if (!node || node === dependencies.editor) return false;

        const text = node.textContent || '';

        // Heading: # + space (with optional existing text)
        // Matches: "# ", "## ", ..., "# existing text", "## existing text", etc.
        // This is allowed even when inside a heading (heading-to-heading conversion)
        const headingMatch = text.match(/^(#{1,6}) (.*)$/);
        if (headingMatch && trigger === 'space') {
            const level = headingMatch[1].length;
            const existingText = headingMatch[2] || '';
            const heading = document.createElement('h' + level);
            if (existingText) {
                heading.textContent = existingText;
            } else {
                heading.innerHTML = '<br>';
            }
            // If we're inside a heading, replace that heading; otherwise replace the current node
            const targetNode = currentHeadingNode || node;
            targetNode.replaceWith(heading);
            dependencies.setCursorToEnd(heading);
            dependencies.syncMarkdown();
            return true;
        }

        // If we're inside a heading, don't allow other conversions
        if (currentHeadingNode) {
            return false;
        }

        // Task list: - [ ] + space (with optional existing text)
        // MUST be checked BEFORE unordered list to avoid matching "- " first
        const taskMatch = text.match(/^[-*+] \[([ xX])\] (.*)$/);
        if (taskMatch && trigger === 'space') {
            const existingText = taskMatch[2] || '';
            const li = document.createElement('li');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = taskMatch[1].toLowerCase() === 'x';
            li.appendChild(checkbox);
            if (existingText) {
                li.appendChild(document.createTextNode(existingText));
            }

            // Check for adjacent task list to merge with
            const nextSibling = node.nextElementSibling;
            const prevSibling = node.previousElementSibling;

            // Helper to check if element is a task list (ul with checkbox in first li)
            const isTaskList = (el) => {
                if (!el || el.tagName?.toLowerCase() !== 'ul') return false;
                const firstLi = el.querySelector('li');
                return firstLi && firstLi.querySelector('input[type="checkbox"]');
            };

            if (isTaskList(nextSibling)) {
                // Merge with next task list - prepend new item
                nextSibling.insertBefore(li, nextSibling.firstChild);
                node.remove();
            } else if (isTaskList(prevSibling)) {
                // Merge with previous task list - append new item
                prevSibling.appendChild(li);
                node.remove();
            } else {
                // Create new task list
                const ul = document.createElement('ul');
                ul.appendChild(li);
                node.replaceWith(ul);
            }
            dependencies.setCursorToEnd(li);
            dependencies.syncMarkdown();
            return true;
        }

        // Unordered list: - + space or * + space (with optional existing text)
        const ulMatch = text.match(/^[-*+] (.*)$/);
        if (ulMatch && trigger === 'space') {
            const existingText = ulMatch[1] || '';
            const li = document.createElement('li');
            if (existingText) {
                li.textContent = existingText;
            } else {
                li.innerHTML = '<br>';
            }

            // Check for adjacent ul to merge with (but not task lists)
            const nextSibling = node.nextElementSibling;
            const prevSibling = node.previousElementSibling;

            // Helper to check if element is a regular ul (not task list)
            const isRegularUl = (el) => {
                if (!el || el.tagName?.toLowerCase() !== 'ul') return false;
                const firstLi = el.querySelector('li');
                // It's a task list if first li has checkbox
                return !(firstLi && firstLi.querySelector('input[type="checkbox"]'));
            };

            if (isRegularUl(nextSibling)) {
                // Merge with next ul - prepend new item
                nextSibling.insertBefore(li, nextSibling.firstChild);
                node.remove();
            } else if (isRegularUl(prevSibling)) {
                // Merge with previous ul - append new item
                prevSibling.appendChild(li);
                node.remove();
            } else {
                // Create new ul
                const ul = document.createElement('ul');
                ul.appendChild(li);
                node.replaceWith(ul);
            }
            dependencies.setCursorToEnd(li);
            dependencies.syncMarkdown();
            return true;
        }

        // Ordered list: 1. + space (with optional existing text)
        const olMatch = text.match(/^(\d+)\. (.*)$/);
        if (olMatch && trigger === 'space') {
            const existingText = olMatch[2] || '';
            const li = document.createElement('li');
            if (existingText) {
                li.textContent = existingText;
            } else {
                li.innerHTML = '<br>';
            }

            // Check for adjacent ol to merge with
            const nextSibling = node.nextElementSibling;
            const prevSibling = node.previousElementSibling;

            if (nextSibling && nextSibling.tagName?.toLowerCase() === 'ol') {
                // Merge with next ol - prepend new item
                nextSibling.insertBefore(li, nextSibling.firstChild);
                node.remove();
            } else if (prevSibling && prevSibling.tagName?.toLowerCase() === 'ol') {
                // Merge with previous ol - append new item
                prevSibling.appendChild(li);
                node.remove();
            } else {
                // Create new ol
                const ol = document.createElement('ol');
                ol.appendChild(li);
                node.replaceWith(ol);
            }
            dependencies.setCursorToEnd(li);
            dependencies.syncMarkdown();
            return true;
        }

        // Blockquote: > + space (with optional existing text)
        const bqMatch = text.match(/^> (.*)$/);
        if (bqMatch && trigger === 'space') {
            const existingText = bqMatch[1] || '';
            const blockquote = document.createElement('blockquote');
            if (existingText) {
                blockquote.textContent = existingText;
            } else {
                blockquote.innerHTML = '<br>';
            }
            node.replaceWith(blockquote);
            dependencies.setCursorToEnd(blockquote);
            dependencies.syncMarkdown();
            return true;
        }

        // Horizontal rule: --- + space or enter
        if (/^-{3,}$/.test(text.trim()) && node.tagName && node.tagName.toUpperCase() === 'P') {
            const hr = document.createElement('hr');
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            node.replaceWith(hr);
            hr.after(p);
            dependencies.setCursorToEnd(p);
            dependencies.syncMarkdown();
            return true;
        }

        // Code block: \`\`\` + enter
        // Support both <p> and <div> tags (div is created when pressing Enter after header)
        if (/^\`\`\`/.test(text) && trigger === 'enter' && node.tagName && (node.tagName.toUpperCase() === 'P' || node.tagName.toUpperCase() === 'DIV')) {
            // Extract the language tag from the opening code fence.
            const langMatch = text.match(/^\`\`\`(\w*)/);
            const lang = langMatch ? langMatch[1].trim() : '';

            // Special handling for mermaid
            if (lang === 'mermaid') {
                const wrapper = document.createElement('div');
                wrapper.className = 'mermaid-wrapper';
                wrapper.setAttribute('data-mode', 'edit');
                wrapper.setAttribute('contenteditable', 'false');

                const pre = document.createElement('pre');
                pre.setAttribute('data-lang', 'mermaid');
                pre.setAttribute('contenteditable', 'true');

                const code = document.createElement('code');
                code.appendChild(document.createTextNode('\n'));
                pre.appendChild(code);

                const diagramDiv = document.createElement('div');
                diagramDiv.className = 'mermaid-diagram';
                diagramDiv.innerHTML = '<div class="mermaid-error">Empty diagram</div>';

                wrapper.appendChild(pre);
                wrapper.appendChild(diagramDiv);

                const p = document.createElement('p');
                p.innerHTML = '<br>';
                node.replaceWith(wrapper);
                wrapper.after(p);

                // Mark as setup
                wrapper.dataset.mermaidSetup = 'true';

                // Add click handler to enter editing mode
                wrapper.addEventListener('click', function(e) {
                    if (wrapper.getAttribute('data-mode') !== 'edit') {
                        wrapper.setAttribute('data-mode', 'edit');
                        code.focus();
                        dependencies.setCursorToEnd(code);
                    }
                });

                // Add input handler for live diagram updates
                let renderTimeout = null;
                pre.addEventListener('input', () => {
                    dependencies.logger.log('Mermaid input event fired');
                    if (renderTimeout) {
                        clearTimeout(renderTimeout);
                    }
                    renderTimeout = setTimeout(() => {
                        dependencies.logger.log('Rendering mermaid diagram after input');
                        dependencies.renderMermaidDiagram(wrapper);
                    }, 500);
                });

                // Add focusout handler
                code.addEventListener('focusout', (e) => {
                    setTimeout(() => {
                        const activeEl = document.activeElement;
                        if (!wrapper.contains(activeEl)) {
                            if (wrapper.getAttribute('data-mode') === 'edit') {
                                wrapper.setAttribute('data-mode', 'display');
                                dependencies.renderMermaidDiagram(wrapper);
                                dependencies.syncMarkdown();
                            }
                        }
                    }, 100);
                });

                // Set cursor at the start of the code element
                const range = document.createRange();
                const sel = window.getSelection();
                range.setStart(code.firstChild, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                code.focus();
                dependencies.syncMarkdown();
                return true;
            }

            // Special handling for math
            if (lang === 'math') {
                const wrapper = document.createElement('div');
                wrapper.className = 'math-wrapper';
                wrapper.setAttribute('data-mode', 'edit');
                wrapper.setAttribute('contenteditable', 'false');

                const pre = document.createElement('pre');
                pre.setAttribute('data-lang', 'math');
                pre.setAttribute('contenteditable', 'true');

                const code = document.createElement('code');
                code.appendChild(document.createTextNode('\n'));
                pre.appendChild(code);

                const displayDiv = document.createElement('div');
                displayDiv.className = 'math-display';
                displayDiv.innerHTML = '<div class="math-error">Empty expression</div>';

                wrapper.appendChild(pre);
                wrapper.appendChild(displayDiv);

                const p = document.createElement('p');
                p.innerHTML = '<br>';
                node.replaceWith(wrapper);
                wrapper.after(p);

                wrapper.dataset.mathSetup = 'true';

                wrapper.addEventListener('click', function(e) {
                    if (wrapper.getAttribute('data-mode') !== 'edit') {
                        wrapper.setAttribute('data-mode', 'edit');
                        code.focus();
                        dependencies.setCursorToEnd(code);
                    }
                });

                let renderTimeout = null;
                pre.addEventListener('input', function() {
                    if (renderTimeout) clearTimeout(renderTimeout);
                    renderTimeout = setTimeout(function() {
                        dependencies.renderMathBlock(wrapper);
                    }, 500);
                });

                code.addEventListener('focusout', function(e) {
                    setTimeout(function() {
                        if (!wrapper.contains(document.activeElement)) {
                            if (wrapper.getAttribute('data-mode') === 'edit') {
                                wrapper.setAttribute('data-mode', 'display');
                                dependencies.renderMathBlock(wrapper);
                                dependencies.syncMarkdown();
                            }
                        }
                    }, 100);
                });

                const range = document.createRange();
                const sel = window.getSelection();
                range.setStart(code.firstChild, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                code.focus();
                dependencies.syncMarkdown();
                return true;
            }

            const pre = document.createElement('pre');
            pre.setAttribute('contenteditable', 'true');
            pre.setAttribute('data-mode', 'edit'); // Start in edit mode
            if (lang) {
                pre.setAttribute('data-lang', lang);
            } else {
                pre.setAttribute('data-lang', '');
            }
            const code = document.createElement('code');
            code.setAttribute('contenteditable', 'true');
            // Use a text node with newline so cursor has somewhere to go
            code.appendChild(document.createTextNode('\n'));
            pre.appendChild(code);
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            node.replaceWith(pre);
            pre.after(p);
            // Setup code block UI (header, etc.)
            dependencies.setupCodeBlockUI(pre);
            // Set cursor at the start of the code element
            const range = document.createRange();
            const sel = window.getSelection();
            range.setStart(code.firstChild, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            code.focus();
            dependencies.syncMarkdown();
            return true;
        }

        return false;
    }

    return { checkTablePattern, convertToTable, checkAllPatterns, checkBlockPatterns };
}

module.exports = { createBlockPatterns };
