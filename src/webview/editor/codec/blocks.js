/**
 * Shared block parsing, rendering, serialization and retained-source metadata.
 * Construction binds capabilities without rendering or modifying the document.
 * Sequence/directive owners stay outside the codec; the sentinel set is shared.
 */
function createBlockCodec({ document, editor, logger, REGEX, emptyTableCell, mathBackslashDelimiters, codeBlocksWithSentinel, parseInline, escapeHtml, renderFrontMatter, renderTocBlock, mathBlockHtml, inlineMathMarkdown, mathBlockMarkdown, mdGetInlineMarkdown, parseBlocks, formatTable, nextSourceBlockSequence, getCurrentImageDir, getCurrentForceRelativePath }) {
    function parseMarkdownLine(text, allowMath = true) {
        const parseLineInline = value => parseInline(value, allowMath);
        // Heading
        const headingMatch = text.match(REGEX.heading);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const content = parseLineInline(headingMatch[2]);
            return { tag: 'h' + level, html: content, consumed: true };
        }
        // Horizontal rule
        if (REGEX.hr.test(text.trim())) {
            return { tag: 'hr', html: '', consumed: true };
        }
        // Task list (check first before unordered list)
        const taskMatch = text.match(REGEX.task);
        if (taskMatch) {
            const indent = taskMatch[1].length;
            const checked = taskMatch[2].toLowerCase() === 'x' ? 'checked' : '';
            const taskContent = parseLineInline(taskMatch[3]);
            // Use <br> for empty task items to make them visible and editable
            return { tag: 'li', listType: 'ul', html: '<input type="checkbox"' + (checked ? ' checked' : '') + '>' + (taskContent || '<br>'), consumed: true, indent: indent };
        }
        // Unordered list (with indentation support)
        const ulMatch = text.match(REGEX.ul);
        if (ulMatch) {
            const indent = ulMatch[1].length;
            const content = parseLineInline(ulMatch[2]);
            // Use <br> for empty list items to make them visible and editable
            return { tag: 'li', listType: 'ul', html: content || '<br>', consumed: true, indent: indent };
        }
        // Ordered list (with indentation support)
        const olMatch = text.match(REGEX.ol);
        if (olMatch) {
            const indent = olMatch[1].length;
            const content = parseLineInline(olMatch[3]);
            // Use <br> for empty list items to make them visible and editable
            return { tag: 'li', listType: 'ol', html: content || '<br>', consumed: true, indent: indent };
        }
        // Blockquote
        const quoteMatch = text.match(REGEX.quote);
        if (quoteMatch) {
            return { tag: 'blockquote', html: parseLineInline(quoteMatch[1]), consumed: true };
        }
        // Code block start (3+ backticks or tildes)
        const codeBlockMatch = text.match(REGEX.codeBlock);
        if (codeBlockMatch) {
            const fenceLen = codeBlockMatch[1].length;
            const fenceChar = codeBlockMatch[1][0];
            return { tag: 'pre', html: '', codeBlock: true, lang: (codeBlockMatch[2] || '').trim(), consumed: true, fenceLength: fenceLen, fenceChar: fenceChar };
        }
        // Regular paragraph
        return { tag: 'p', html: parseLineInline(text), consumed: false };
    }
    function renderMarkdownBlock(block, exportCode = false, parent = null, index = 0) {
        const children = () => block.children.map((child, i) => renderMarkdownBlock(child, exportCode, block, i)).join('');
        if (block.type === 'front_matter')
            return renderFrontMatter(block.content);
        if (block.type === 'binary_aux')
            return renderTocBlock(block.content);
        if (block.type === 'binary_math')
            return mathBlockHtml(block.meta);
        if (block.type === 'inline')
            return parseInline(block.content, true, true);
        if (block.type === 'paragraph') {
            const text = block.children.find(child => child.type === 'inline')?.content || '';
            // Keep the established quote line-editing contract for a simple
            // quote. Quotes containing several blocks keep those blocks.
            if (parent?.type === 'blockquote' && parent.level === 0 && parent.children.length === 1)
                return parseInline(text);
            if (parent?.type === 'list_item' && index === 0) {
                const task = /^\[([ xX])\] +(.*)$/s.exec(text);
                if (task)
                    return '<input type="checkbox"' + (task[1].toLowerCase() === 'x' ? ' checked' : '') + '>' + (parseInline(task[2], true, true) || '<br>');
                return parseInline(text, true, true) || '<br>';
            }
            return '<p>' + children() + '</p>';
        }
        if (block.type === 'fence' || block.type === 'code_block') {
            const lang = (block.info || '').trim();
            const payload = block.content.replace(/\n$/, '');
            const trailing = payload.endsWith('\n');
            const codeHtml = payload ? escapeHtml(payload).replace(/\n/g, '<br>') + (trailing ? '<br>' : '') : '<br>';
            const trailingAttr = trailing ? ' data-trailing-br="true"' : '';
            if (lang === 'math') {
                const fence = block.markup || '\`\`\`';
                return mathBlockHtml({ tex: payload, raw: block.source || fence + lang + '\n' + block.content + fence,
                    open: fence + lang, close: fence, singleLine: false });
            }
            if (lang === 'mermaid') {
                return '<div class="mermaid-wrapper" data-mode="display" contenteditable="false">' +
                    '<pre data-lang="mermaid" contenteditable="true"><code' + trailingAttr + '>' + codeHtml + '</code></pre>' +
                    '<div class="mermaid-diagram"></div></div>';
            }
            const count = block.content ? block.content.split('\n').length - 1 : 0;
            return '<pre data-lang="' + escapeHtml(lang).replace(/"/g, '&quot;') + '"' +
                (exportCode ? ' data-export-code-lines="' + count + '"' : '') +
                ' data-mode="display"><code contenteditable="false"' + trailingAttr + '>' + codeHtml + '</code></pre>';
        }
        if (block.type === 'hr')
            return '<hr>';
        if (block.type === 'list_item') {
            const needsCaret = !block.children.length || ['bullet_list', 'ordered_list'].includes(block.children[0].type);
            return '<li>' + (needsCaret ? '<br>' : '') + children() + '</li>';
        }
        if (block.type === 'bullet_list' || block.type === 'ordered_list') {
            const tag = block.type === 'ordered_list' ? 'ol' : 'ul';
            const start = block.attrs.start !== undefined ? ' start="' + Number(block.attrs.start) + '"' : '';
            const loose = block.children.some(item => item.children.some(child => child.type === 'paragraph' && !child.hidden));
            return '<' + tag + start + (loose ? ' data-md-loose="true"' : '') + '>' + children() + '</' + tag + '>';
        }
        if (block.type === 'th' || block.type === 'td') {
            const alignment = /text-align:(left|center|right)/.exec(block.attrs.style || '')?.[1];
            return '<' + block.tag + (alignment ? ' style="text-align:' + alignment + '"' : '') +
                (alignment ? ' data-table-align="' + alignment + '"' : '') +
                ' contenteditable="true">' + (children() || emptyTableCell) + '</' + block.tag + '>';
        }
        if (block.type === 'table') {
            const html = '<table>' + children() + '</table>';
            if (exportCode || block.source === undefined)
                return html;
            const template = document.createElement('template');
            template.innerHTML = html;
            const table = template.content.firstElementChild;
            rememberTableSource(table, block.source + '\n');
            return table.outerHTML;
        }
        if (['heading', 'blockquote', 'thead', 'tbody', 'tr'].includes(block.type)) {
            return '<' + block.tag + '>' + children() + '</' + block.tag + '>';
        }
        return children();
    }
    function markdownToHtmlFragment(markdownText, exportCode = false) {
        const parsed = parseBlocks(markdownText, { backslashDelimiters: mathBackslashDelimiters });
        if (exportCode)
            return parsed.blocks.map(block => renderMarkdownBlock(block, true)).join('');
        let previousId = '';
        return parsed.blocks.map((block, index) => {
            const template = document.createElement('template');
            template.innerHTML = renderMarkdownBlock(block);
            const element = template.content.firstElementChild;
            if (!element)
                return '';
            const id = String(nextSourceBlockSequence());
            element.dataset.mdId = id;
            element.dataset.mdPrevious = previousId;
            element.dataset.mdBefore = encodeURIComponent(block.before);
            element.dataset.mdSource = encodeURIComponent(block.source);
            element.dataset.mdCanonical = encodeURIComponent(mdProcessNode(element).replace(/\n$/, ''));
            if (index === parsed.blocks.length - 1)
                element.dataset.mdTrailing = encodeURIComponent(parsed.trailing || '\n');
            previousId = id;
            return element.outerHTML;
        }).join('');
    }
    function getCodeFence(content) {
        // Find the longest sequence of backticks in the content
        const backtickMatches = content.match(/\`+/g);
        let maxBackticks = 0;
        if (backtickMatches) {
            for (const match of backtickMatches) {
                if (match.length > maxBackticks) {
                    maxBackticks = match.length;
                }
            }
        }
        // Use at least 3 backticks, or one more than the longest sequence found
        const fenceLength = Math.max(3, maxBackticks + 1);
        return '\`'.repeat(fenceLength);
    }
    function wrapInlineCode(content) {
        // Find the longest sequence of backticks in the content
        const backtickMatches = content.match(/`+/g);
        let maxBackticks = 0;
        if (backtickMatches) {
            for (const match of backtickMatches) {
                if (match.length > maxBackticks) {
                    maxBackticks = match.length;
                }
            }
        }
        if (maxBackticks === 0) {
            // Protect meaningful edge spaces from code-span padding normalization.
            const needsPadding = content.startsWith(' ') && content.endsWith(' ') && /[^ ]/.test(content);
            return '`' + (needsPadding ? ' ' + content + ' ' : content) + '`';
        }
        // Use at least 2 more backticks than the longest sequence found
        // This ensures the fence won't be confused with content
        // e.g., content with ``` needs ````` (5) to wrap safely
        const fence = '`'.repeat(maxBackticks + 2);
        // Add spaces around content (CommonMark rule for backtick-containing content)
        return fence + ' ' + content + ' ' + fence;
    }
    function stripTrailingNewlines(content, code, sentinelOwner) {
        if (code && code.getAttribute('data-trailing-br') === 'true') {
            if (content.endsWith('\n'))
                content = content.slice(0, -1);
        }
        if (sentinelOwner && codeBlocksWithSentinel.has(sentinelOwner)) {
            if (content.endsWith('\n'))
                content = content.slice(0, -1);
        }
        return content;
    }
    function mdProcessNode(node, listPrefix = '') {
        if (node.nodeType === 3) {
            return node.textContent;
        }
        if (node.nodeType !== 1)
            return '';
        if (node.classList.contains('math-inline'))
            return inlineMathMarkdown(node);
        const tag = node.tagName.toLowerCase();
        if (node.classList.contains('toc-block'))
            return decodeURIComponent(node.dataset.tocSource) + '\n';
        if (node.classList.contains('front-matter')) {
            const raw = node.querySelector('textarea').value;
            return raw && node.nextSibling && !raw.endsWith('\n') ? raw + '\n' : raw;
        }
        switch (tag) {
            case 'h1': return '# ' + mdGetInlineMarkdown(node) + '\n';
            case 'h2': return '## ' + mdGetInlineMarkdown(node) + '\n';
            case 'h3': return '### ' + mdGetInlineMarkdown(node) + '\n';
            case 'h4': return '#### ' + mdGetInlineMarkdown(node) + '\n';
            case 'h5': return '##### ' + mdGetInlineMarkdown(node) + '\n';
            case 'h6': return '###### ' + mdGetInlineMarkdown(node) + '\n';
            case 'p':
                const pContent = mdGetInlineMarkdown(node);
                // Empty paragraphs provide caret positions, not source lines.
                if (!pContent || pContent === '' || node.innerHTML === '<br>') {
                    return '\n';
                }
                // Sibling separators are added by serializeMarkdownBlocks.
                return pContent + '\n';
            case 'div':
                if (node.classList.contains('math-wrapper'))
                    return mathBlockMarkdown(node);
                // Check if this is a mermaid wrapper
                if (node.classList.contains('mermaid-wrapper') || node.classList.contains('math-wrapper')) {
                    const wrapperLang = node.classList.contains('mermaid-wrapper') ? 'mermaid' : 'math';
                    const pre = node.querySelector('pre[data-lang="' + wrapperLang + '"]');
                    if (pre) {
                        const code = pre.querySelector('code');
                        let wrapperContent = '';
                        if (code) {
                            // Recursively process all nodes to handle <br> elements
                            const processCodeNode = (n) => {
                                for (const child of n.childNodes) {
                                    if (child.nodeType === 3) {
                                        wrapperContent += child.textContent;
                                    }
                                    else if (child.nodeType === 1) {
                                        const tagName = child.tagName.toLowerCase();
                                        if (tagName === 'br') {
                                            wrapperContent += '\n';
                                        }
                                        else {
                                            processCodeNode(child);
                                        }
                                    }
                                }
                            };
                            processCodeNode(code);
                        }
                        wrapperContent = stripTrailingNewlines(wrapperContent, code, node);
                        // Always add \n for fence format.
                        wrapperContent += '\n';
                        // Determine fence length: if content contains triple backticks, use more backticks
                        const wrapperFence = getCodeFence(wrapperContent);
                        return wrapperFence + wrapperLang + '\n' + wrapperContent + wrapperFence + '\n';
                    }
                }
                // Browser may create div elements - treat as paragraph if it has content
                const divContent = mdGetInlineMarkdown(node);
                if (!divContent || divContent === '' || node.innerHTML === '<br>') {
                    return '\n';
                }
                // Sibling separators are added by serializeMarkdownBlocks.
                return divContent + '\n';
            case 'br': return '';
            case 'hr': return '---\n';
            case 'blockquote':
                // Handle multi-line blockquotes - each line needs > prefix
                return mdProcessBlockquote(node);
            case 'pre':
                const code = node.querySelector('code');
                const lang = node.dataset.lang || '';
                // Get code content, converting <br> back to newlines
                // Handle both plain text and highlighted code (with span elements)
                let codeContent = '';
                if (code) {
                    // Recursively process all nodes to handle <br> elements and spans
                    const processCodeNode = (n) => {
                        for (const child of n.childNodes) {
                            if (child.nodeType === 3) {
                                // Text node
                                codeContent += child.textContent;
                            }
                            else if (child.nodeType === 1) {
                                const tagName = child.tagName.toLowerCase();
                                if (tagName === 'br') {
                                    // <br> element
                                    codeContent += '\n';
                                }
                                else {
                                    // Other elements (like highlight spans) - recurse
                                    processCodeNode(child);
                                }
                            }
                        }
                    };
                    processCodeNode(code);
                }
                else {
                    codeContent = node.textContent;
                }
                // Check if this is an empty code block (only a placeholder <br>)
                // Empty code blocks have a single <br> for cursor placement (9A-22),
                // which processCodeNode converts to "\n". This is NOT real content.
                const isEmptyCodeBlock = code && code.childNodes.length === 1 &&
                    code.firstChild.nodeType === 1 &&
                    code.firstChild.tagName.toLowerCase() === 'br';
                if (isEmptyCodeBlock) {
                    codeContent = '\n';
                }
                else {
                    codeContent = stripTrailingNewlines(codeContent, code, node);
                    // Always add \n for fence format.
                    codeContent += '\n';
                }
                // Determine fence length: if content contains triple backticks, use more backticks
                const fence = getCodeFence(codeContent);
                return fence + lang + '\n' + codeContent + fence + '\n';
            case 'ul':
                let ulContent = '';
                for (const li of node.children) {
                    if (li.tagName.toLowerCase() === 'li') {
                        if (ulContent && node.dataset.mdLoose === 'true')
                            ulContent += '\n';
                        ulContent += mdProcessListItem(li, listPrefix, '-');
                    }
                }
                return ulContent;
            case 'ol':
                let olContent = '';
                let num = node.hasAttribute('start') ? Number(node.getAttribute('start')) : 1;
                for (const li of node.children) {
                    if (li.tagName.toLowerCase() === 'li') {
                        if (olContent && node.dataset.mdLoose === 'true')
                            olContent += '\n';
                        olContent += mdProcessListItem(li, listPrefix, num + '.');
                        num++;
                    }
                }
                return olContent;
            case 'li':
                // Handle <li> directly when it's not inside a <ul>/<ol> in the selection
                // This happens when copying partial list selections
                logger.log('Processing standalone li element');
                return mdProcessListItem(node, listPrefix, '-');
            case 'strong':
            case 'b':
            case 'em':
            case 'i':
            case 'del':
            case 's':
            case 'strike':
            case 'u':
            case 'code':
            case 'a':
                // Use mdGetInlineMarkdown to properly normalize nested inline elements
                return mdGetInlineMarkdown(node);
            case 'img':
                // Use markdown path if available, otherwise use src
                const imgSrc = node.dataset.markdownPath || node.getAttribute('src') || '';
                return '![' + (node.getAttribute('alt') || '') + '](' + imgSrc + ')';
            case 'table':
                return mdProcessTable(node);
            case 'tr':
            case 'th':
            case 'td':
            case 'thead':
            case 'tbody':
                // These are handled by mdProcessTable
                return '';
            default:
                let result = '';
                for (const child of node.childNodes) {
                    result += mdProcessNode(child, listPrefix);
                }
                return result;
        }
    }
    function mdProcessListItem(li, indent, marker) {
        const checkbox = li.querySelector(':scope > input[type="checkbox"]');
        const continuation = indent + ' '.repeat(marker.length + 1);
        const segments = [];
        let inline = document.createElement('span');
        function flushInline() {
            if (!inline.childNodes.length)
                return;
            segments.push({ text: mdGetInlineMarkdown(inline), kind: 'inline' });
            inline = document.createElement('span');
        }
        for (const child of li.childNodes) {
            if (child === checkbox)
                continue;
            const block = child.nodeType === 1 && (/^(P|DIV|UL|OL|PRE|BLOCKQUOTE|TABLE|H[1-6]|HR)$/.test(child.tagName));
            if (!block) {
                inline.appendChild(child.cloneNode(true));
                continue;
            }
            flushInline();
            if (child.tagName === 'UL' || child.tagName === 'OL') {
                // A non-1 ordered marker cannot interrupt the preceding paragraph.
                const needsBlankLine = child.tagName === 'OL' && child.hasAttribute('start') && Number(child.getAttribute('start')) !== 1;
                segments.push({ text: mdProcessNode(child, continuation).replace(/\n$/, ''), kind: 'list', needsBlankLine });
            }
            else {
                segments.push({ text: mdProcessNode(child).replace(/\n$/, ''), kind: 'block' });
            }
        }
        flushInline();
        const first = segments[0]?.kind !== 'list' ? segments.shift()?.text || '' : '';
        const prefix = marker + ' ' + (checkbox ? '[' + (checkbox.checked ? 'x' : ' ') + '] ' : '');
        let result = indent + prefix + first.split('\n').join('\n' + continuation);
        for (const segment of segments) {
            if (segment.kind === 'list')
                result += (segment.needsBlankLine ? '\n\n' : '\n') + segment.text;
            else
                result += '\n\n' + continuation + segment.text.split('\n').join('\n' + continuation);
        }
        return result + '\n';
    }
    function mdGetTextContent(node) {
        return node.textContent.trim();
    }
    function mdProcessBlockquote(bq) {
        if (Array.from(bq.children).some(child => /^(P|DIV|H[1-6]|UL|OL|PRE|BLOCKQUOTE|TABLE)$/.test(child.tagName))) {
            return serializeMarkdownBlocks(bq, false).replace(/\n$/, '').split('\n').map(line => '> ' + line).join('\n') + '\n';
        }
        // Process blockquote content and add > to each line
        // IMPORTANT: Preserve empty lines as "> " in markdown
        // Handle both <br> elements AND actual newline characters in text
        let lines = [];
        const codeLines = new Set();
        let currentLine = '';
        function processBlockquoteContent(node) {
            if (node.nodeType === 1 && node.classList.contains('math-inline')) {
                currentLine += inlineMathMarkdown(node);
                return;
            }
            if (node.nodeType === 1 && node.classList.contains('math-wrapper')) {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = '';
                }
                lines.push(...mathBlockMarkdown(node).replace(/\n$/, '').split('\n'));
                return;
            }
            if (node.nodeType === 1 && (node.tagName === 'PRE' || node.classList.contains('mermaid-wrapper'))) {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = '';
                }
                // Serialize the block, not its toolbar/inline code children.
                // Code whitespace must survive the quote's prose normalization.
                for (const line of mdProcessNode(node).replace(/\n$/, '').split('\n')) {
                    codeLines.add(lines.length);
                    lines.push(line);
                }
                return;
            }
            if (node.nodeType === 3) {
                // Text node - check for newline characters
                const text = node.textContent || '';
                if (text.includes('\n')) {
                    // Split by newlines and process each part
                    const parts = text.split('\n');
                    for (let i = 0; i < parts.length; i++) {
                        currentLine += parts[i];
                        if (i < parts.length - 1) {
                            // Not the last part, so there was a newline here
                            lines.push(currentLine);
                            currentLine = '';
                        }
                    }
                }
                else {
                    currentLine += text;
                }
            }
            else if (node.nodeType === 1) {
                const tag = node.tagName.toLowerCase();
                if (tag === 'br') {
                    // Line break - push current line (even if empty) and start new line
                    lines.push(currentLine);
                    currentLine = '';
                }
                else if (tag === 'div' || tag === 'p') {
                    // Block elements created by browser for line breaks
                    // Push current line first (even if empty, to preserve structure)
                    if (lines.length > 0 || currentLine !== '') {
                        lines.push(currentLine);
                        currentLine = '';
                    }
                    // Process the div/p content
                    for (const child of node.childNodes) {
                        processBlockquoteContent(child);
                    }
                    // After processing div/p, push the line
                    lines.push(currentLine);
                    currentLine = '';
                }
                else if (['strong', 'b', 'em', 'i', 'del', 's', 'strike', 'u', 'code', 'a', 'img'].includes(tag)) {
                    // Inline elements - process them
                    const content = mdProcessNode(node);
                    if (tag === 'u' || node.querySelector('u')) {
                        const parts = content.split('\n');
                        parts.forEach((part, index) => {
                            currentLine += part;
                            if (index < parts.length - 1) {
                                lines.push(currentLine);
                                currentLine = '';
                            }
                        });
                    }
                    else
                        currentLine += content;
                }
                else {
                    // Other elements - process children
                    for (const child of node.childNodes) {
                        processBlockquoteContent(child);
                    }
                }
            }
        }
        for (const child of bq.childNodes) {
            processBlockquoteContent(child);
        }
        // Add the last line only if it has content or if there are already lines
        // This prevents double empty lines when blockquote only contains <br>
        if (currentLine !== '' || lines.length === 0) {
            lines.push(currentLine);
        }
        // Keep trailing empty lines - they are intentional user content
        // Only remove if the blockquote is completely empty
        if (lines.length === 1 && lines[0].trim() === '') {
            return '> \n';
        }
        // Build markdown with > prefix for each line (including empty lines)
        return lines.map((line, index) => '> ' + (codeLines.has(index) ? line : line.trim())).join('\n') + '\n';
    }
    function readTableData(table) {
        const rows = table.querySelectorAll('tr');
        if (rows.length === 0)
            return { contents: [], alignments: [], explicitLeft: [] };
        // The block parser splits table columns before inline parsing, so
        // pipes need escaping even inside code spans and link destinations.
        function escapePipeInCell(text) {
            return text.replace(/\|/g, '\\|');
        }
        // Process cell content with table delimiter escaping.
        function processCellContent(cell) {
            let cellText = '';
            for (const child of cell.childNodes) {
                if (child.nodeType === 3) {
                    // Text node - escape pipe characters
                    cellText += escapePipeInCell(child.textContent);
                }
                else if (child.nodeType === 1) {
                    const tag = child.tagName.toLowerCase();
                    if (tag === 'br') {
                        if (!child.hasAttribute('data-table-placeholder'))
                            cellText += '<br>';
                    }
                    else if (tag === 'code') {
                        cellText += escapePipeInCell(wrapInlineCode(child.textContent));
                    }
                    else {
                        // Other inline elements (strong, em, a, img, etc.)
                        // Recursively process each inline element.
                        cellText += processCellNode(child);
                    }
                }
            }
            return cellText;
        }
        // Recursively process a node, escaping table delimiters.
        function processCellNode(node) {
            if (node.nodeType === 3) {
                return escapePipeInCell(node.textContent);
            }
            if (node.nodeType !== 1)
                return '';
            if (node.classList.contains('math-inline'))
                return escapePipeInCell(inlineMathMarkdown(node));
            const tag = node.tagName.toLowerCase();
            if (tag === 'code') {
                return escapePipeInCell(wrapInlineCode(node.textContent));
            }
            if (tag === 'br') {
                return node.hasAttribute('data-table-placeholder') ? '' : '<br>';
            }
            // For other elements, process children and wrap with appropriate markdown
            let innerContent = '';
            for (const child of node.childNodes) {
                innerContent += processCellNode(child);
            }
            // Apply markdown formatting based on tag
            if (tag === 'strong' || tag === 'b') {
                return '**' + innerContent + '**';
            }
            else if (tag === 'em' || tag === 'i') {
                return '*' + innerContent + '*';
            }
            else if (tag === 'del' || tag === 's' || tag === 'strike') {
                return '~~' + innerContent + '~~';
            }
            else if (tag === 'u') {
                return '<u>' + innerContent + '</u>';
            }
            else if (tag === 'a') {
                const href = node.getAttribute('href') || '';
                return '[' + innerContent + '](' + escapePipeInCell(href) + ')';
            }
            else if (tag === 'img') {
                const src = node.dataset.markdownPath || node.getAttribute('src') || '';
                const alt = node.getAttribute('alt') || '';
                return '![' + escapePipeInCell(alt) + '](' + escapePipeInCell(src) + ')';
            }
            return innerContent;
        }
        const headers = Array.from(rows[0].querySelectorAll('th, td'));
        const firstDataCells = rows[1]?.querySelectorAll('td');
        const alignments = headers.map((cell, i) => firstDataCells?.[i]?.style.textAlign || cell.dataset.tableAlign || cell.style.textAlign || 'left');
        const contents = Array.from(rows, row => Array.from(row.querySelectorAll('th, td'), cell => processCellContent(cell).trim()));
        // An explicit left marker also controls header alignment. Keep it
        // distinct from a column with no authored alignment.
        const explicitLeft = headers.map((cell, i) => alignments[i] === 'left' &&
            (cell.dataset.tableAlign === 'left' || cell.style.textAlign === 'left'));
        return { contents, alignments, explicitLeft };
    }
    function rememberTableSource(table, source, state = JSON.stringify(readTableData(table))) {
        table.dataset.tableSource = source;
        table.dataset.tableState = state;
    }
    function mdProcessTable(table) {
        const data = readTableData(table);
        const state = JSON.stringify(data);
        if (table.dataset.tableState === state && table.dataset.tableSource !== undefined) {
            return table.dataset.tableSource;
        }
        const source = formatTable(data.contents, data.alignments, document.documentElement.dataset.tableSourceFormat, data.explicitLeft);
        // This is now the table's latest output. Later edits elsewhere, including
        // after a format preference change, must not reformat it again.
        rememberTableSource(table, source, state);
        return source;
    }
    function serializeMarkdownBlocks(container, preserveLayout = true, visit = null) {
        let result = '', previous = null;
        for (const child of container.childNodes) {
            if (child.nodeType === 3 && !child.textContent.trim())
                continue;
            const canonical = mdProcessNode(child).replace(/\n$/, '');
            // Empty editing positions are caret scaffolding, not Markdown blocks.
            if (!canonical.trim())
                continue;
            const data = child.dataset || {};
            const unchanged = preserveLayout && data.mdCanonical !== undefined && decodeURIComponent(data.mdCanonical) === canonical;
            const content = unchanged ? decodeURIComponent(data.mdSource) : canonical;
            const sameBoundary = preserveLayout && data.mdBefore !== undefined &&
                (!previous || previous.dataset?.mdId) && data.mdPrevious === (previous?.dataset?.mdId || '');
            result += sameBoundary ? decodeURIComponent(data.mdBefore) : previous ? '\n\n' : '';
            if (visit)
                visit(child, result, content);
            result += content;
            previous = child;
        }
        const tail = preserveLayout && previous?.dataset?.mdTrailing;
        return result + (tail ? decodeURIComponent(tail) : '\n');
    }
    function clipboardHtml(container) {
        const copy = container.cloneNode(true);
        // A partial selection must never copy the unselected source carried
        // by its surrounding block. Keep only semantic editing attributes.
        for (const node of copy.querySelectorAll('*')) {
            node.removeAttribute('data-table-source');
            node.removeAttribute('data-table-state');
            for (const name of ['id', 'previous', 'before', 'source', 'canonical', 'trailing']) {
                node.removeAttribute('data-md-' + name);
            }
        }
        return copy.innerHTML;
    }
    function serializeMarkdownFragment(container) {
        const blocks = document.createElement('div');
        let inline = null;
        for (const child of container.childNodes) {
            const isBlock = child.nodeType === 1 && /^(P|DIV|H[1-6]|UL|OL|LI|PRE|BLOCKQUOTE|TABLE|HR)$/.test(child.tagName);
            if (isBlock) {
                inline = null;
                blocks.appendChild(child.cloneNode(true));
            }
            else {
                if (!inline) {
                    inline = document.createElement('p');
                    blocks.appendChild(inline);
                }
                inline.appendChild(child.cloneNode(true));
            }
        }
        return serializeMarkdownBlocks(blocks, false).trim();
    }
    function htmlToMarkdown() {
        let md = serializeMarkdownBlocks(editor);
        // Remove zero-width spaces (used for cursor positioning in contenteditable)
        md = md.replace(/\u200B/g, '');
        // Append directives in a single block if any are set
        // Format:
        // ---
        // IMAGE_DIR: <path>
        // FORCE_RELATIVE_PATH: <true|false>
        let directives = '';
        if (getCurrentImageDir()) {
            directives += 'IMAGE_DIR: ' + getCurrentImageDir() + '\n';
        }
        if (getCurrentForceRelativePath() !== null) {
            directives += 'FORCE_RELATIVE_PATH: ' + getCurrentForceRelativePath() + '\n';
        }
        if (directives) {
            md += '\n---\n' + directives.trimEnd();
        }
        return md;
    }
    return {
        parseMarkdownLine,
        renderMarkdownBlock,
        markdownToHtmlFragment,
        getCodeFence,
        wrapInlineCode,
        stripTrailingNewlines,
        mdProcessNode,
        mdProcessListItem,
        mdGetTextContent,
        mdProcessBlockquote,
        readTableData,
        rememberTableSource,
        mdProcessTable,
        serializeMarkdownBlocks,
        clipboardHtml,
        serializeMarkdownFragment,
        htmlToMarkdown,
    };
}
// Construction defines capabilities; bootstrap controls the original initialization order.
function createBlocksController(dependencies) {
    let parseMarkdownLine, renderMarkdownBlock, markdownToHtmlFragment, getCodeFence, wrapInlineCode, stripTrailingNewlines, mdProcessNode, mdProcessListItem, mdGetTextContent, mdProcessBlockquote, readTableData, rememberTableSource, mdProcessTable, serializeMarkdownBlocks, clipboardHtml, serializeMarkdownFragment, htmlToMarkdown;
    let initializeParseMarkdownLineDone = false;
    function initializeParseMarkdownLine() {
        if (initializeParseMarkdownLineDone)
            return;
        initializeParseMarkdownLineDone = true;
        ({ parseMarkdownLine, renderMarkdownBlock, markdownToHtmlFragment, getCodeFence, wrapInlineCode, stripTrailingNewlines, mdProcessNode, mdProcessListItem, mdGetTextContent, mdProcessBlockquote, readTableData, rememberTableSource, mdProcessTable, serializeMarkdownBlocks, clipboardHtml, serializeMarkdownFragment, htmlToMarkdown } = createBlockCodec({
            document, editor: dependencies.editor, logger: dependencies.logger, REGEX: dependencies.REGEX, emptyTableCell: dependencies.emptyTableCell, mathBackslashDelimiters: dependencies.mathBackslashDelimiters, codeBlocksWithSentinel: dependencies.codeBlocksWithSentinel, parseInline: dependencies.parseInline, escapeHtml: dependencies.escapeHtml,
            renderFrontMatter: (...args) => dependencies.renderFrontMatter(...args), renderTocBlock: (...args) => dependencies.renderTocBlock(...args),
            mathBlockHtml: (...args) => dependencies.mathBlockHtml(...args), inlineMathMarkdown: (...args) => dependencies.inlineMathMarkdown(...args),
            mathBlockMarkdown: (...args) => dependencies.mathBlockMarkdown(...args), mdGetInlineMarkdown: dependencies.mdGetInlineMarkdown,
            parseBlocks: (...args) => window.BinaryMarkdownBlocks.parse(...args), formatTable: (...args) => dependencies.tableFormat.format(...args),
            nextSourceBlockSequence: () => ++dependencies.sourceBlockSequence, getCurrentImageDir: () => dependencies.currentImageDir,
            getCurrentForceRelativePath: () => dependencies.currentForceRelativePath
        }));
    }
    return {
        get parseMarkdownLine() { return parseMarkdownLine; }, set parseMarkdownLine(value) { parseMarkdownLine = value; },
        get renderMarkdownBlock() { return renderMarkdownBlock; }, set renderMarkdownBlock(value) { renderMarkdownBlock = value; },
        get markdownToHtmlFragment() { return markdownToHtmlFragment; }, set markdownToHtmlFragment(value) { markdownToHtmlFragment = value; },
        get getCodeFence() { return getCodeFence; }, set getCodeFence(value) { getCodeFence = value; },
        get wrapInlineCode() { return wrapInlineCode; }, set wrapInlineCode(value) { wrapInlineCode = value; },
        get stripTrailingNewlines() { return stripTrailingNewlines; }, set stripTrailingNewlines(value) { stripTrailingNewlines = value; },
        get mdProcessNode() { return mdProcessNode; }, set mdProcessNode(value) { mdProcessNode = value; },
        get mdProcessListItem() { return mdProcessListItem; }, set mdProcessListItem(value) { mdProcessListItem = value; },
        get mdGetTextContent() { return mdGetTextContent; }, set mdGetTextContent(value) { mdGetTextContent = value; },
        get mdProcessBlockquote() { return mdProcessBlockquote; }, set mdProcessBlockquote(value) { mdProcessBlockquote = value; },
        get readTableData() { return readTableData; }, set readTableData(value) { readTableData = value; },
        get rememberTableSource() { return rememberTableSource; }, set rememberTableSource(value) { rememberTableSource = value; },
        get mdProcessTable() { return mdProcessTable; }, set mdProcessTable(value) { mdProcessTable = value; },
        get serializeMarkdownBlocks() { return serializeMarkdownBlocks; }, set serializeMarkdownBlocks(value) { serializeMarkdownBlocks = value; },
        get clipboardHtml() { return clipboardHtml; }, set clipboardHtml(value) { clipboardHtml = value; },
        get serializeMarkdownFragment() { return serializeMarkdownFragment; }, set serializeMarkdownFragment(value) { serializeMarkdownFragment = value; },
        get htmlToMarkdown() { return htmlToMarkdown; }, set htmlToMarkdown(value) { htmlToMarkdown = value; },
        initializeParseMarkdownLine
    };
}
module.exports = { createBlockCodec, createBlocksController };
