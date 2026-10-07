'use strict';
// Keep inline rendering and serialization together so their markup contracts agree.
function createInlineCodec({ mathSyntax, mathBackslashDelimiters, resolveImagePath, inlineMathHtml, inlineMathMarkdown, wrapInlineCode, }) {
    const REGEX = {
        // parseMarkdownLine patterns
        heading: /^(#{1,6}) (.*)$/,
        hr: /^(---|\*\*\*|___)$/,
        task: /^(\s*)[-*+] \[([ xX])\] (.*)$/,
        ul: /^(\s*)[-*+] (.*)$/,
        ol: /^(\s*)(\d+)\. (.*)$/,
        quote: /^> (.*)$/,
        codeBlock: /^(\`{3,}|~{3,})(.*)$/,
        // parseInline patterns
        brTag: /&lt;br&gt;/gi,
        image: /!\[([^\]]*)\]\(([^)]+)\)/g,
        link: /\[([^\]]+)\]\(([^)]+)\)/g,
        boldItalicAsterisk: /\*\*\*(.+?)\*\*\*/g,
        boldItalicUnderscore: /(^|[^\w])___([^_]+)___([^\w]|$)/g,
        boldAsterisk: /\*\*(.+?)\*\*/g,
        boldUnderscore: /(^|[^\w])__([^_]+)__([^\w]|$)/g,
        italicAsterisk: /\*(.+?)\*/g,
        italicUnderscore: /(^|[^\w])_([^_]+)_([^\w]|$)/g,
        strikethrough: /~~(.+?)~~/g,
        inlineCode: /\`([^\`]+)\`/g
    };
    // ========== MARKDOWN TO HTML ==========
    // Recognize only paired, attribute-free underline tags. Code spans and link
    // destinations are protected before this runs; escaped tags stay literal.
    function restoreUnderlineTags(html) {
        const matches = [...html.matchAll(/&lt;(\/?)u&gt;/gi)];
        const stack = [], paired = new Set();
        for (const match of matches) {
            let escapes = 0;
            for (let at = match.index - 1; at >= 0 && html[at] === '\\'; at--)
                escapes++;
            if (escapes % 2)
                continue;
            if (!match[1])
                stack.push(match.index);
            else if (stack.length) {
                paired.add(stack.pop());
                paired.add(match.index);
            }
        }
        return html.replace(/&lt;(\/?)u&gt;/gi, (literal, closing, index) => paired.has(index) ? (closing ? '</u>' : '<u>') : literal);
    }
    function parseInline(text, allowMath = true, prose = false) {
        if (!text)
            return '';
        const equations = allowMath ? mathSyntax.inline(text, mathBackslashDelimiters) : [];
        let mathMarker = '\x00BMATH';
        while (text.includes(mathMarker))
            mathMarker += 'X';
        for (let i = equations.length - 1; i >= 0; i--) {
            const equation = equations[i];
            text = text.slice(0, equation.start) + mathMarker + i + '\x00' + text.slice(equation.end);
        }
        let html = escapeHtml(text);
        // Use placeholders to protect content from further processing
        const placeholders = [];
        let placeholderIndex = 0;
        // IMPORTANT: Process inline code FIRST to protect code content from other formatting
        // Code spans should not have their contents processed as markdown
        html = parseInlineCode(html, placeholders, () => placeholderIndex++);
        // Only prose/table breaks become HTML; code payloads are already protected.
        html = html.replace(/&lt;br\s*\/?&gt;/gi, prose ? '<br data-md-hard-break="html">' : '<br>');
        // IMPORTANT: Process images and links SECOND to protect their paths from inline formatting
        // Images MUST be processed BEFORE links (otherwise link regex matches the [alt](src) part)
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (match, alt, src) {
            const resolvedSrc = resolveImagePath(src);
            const imgHtml = '<img src="' + resolvedSrc + '" alt="' + alt + '" data-markdown-path="' + src + '" style="max-width:100%;">';
            const placeholder = '\x00IMG' + (placeholderIndex++) + '\x00';
            placeholders.push({ placeholder, html: imgHtml });
            return placeholder;
        });
        // Links (must be after images)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (match, linkText, href) {
            const linkHtml = '<a href="' + href + '">' + formatInlineText(linkText) + '</a>';
            const placeholder = '\x00LINK' + (placeholderIndex++) + '\x00';
            placeholders.push({ placeholder, html: linkHtml });
            return placeholder;
        });
        if (prose) {
            // Code and destinations are already protected by placeholders.
            // Preserve soft breaks as text; hard breaks are explicit inline nodes.
            html = html.replace(/( {2,}|\\+)\n/g, (match, marker) => {
                if (marker[0] === '\\' && marker.length % 2 === 0)
                    return match;
                const prefix = marker[0] === '\\' ? marker.slice(0, -1) : '';
                const placeholder = '\x00BREAK' + (placeholderIndex++) + '\x00';
                placeholders.push({ placeholder, html: '<br data-md-hard-break="' + (marker[0] === '\\' ? 'backslash' : 'spaces') + '">' });
                return prefix + placeholder;
            });
            // A source wrap is a space in prose. Store its authored spelling
            // with the block, while editable text keeps normal caret behavior.
            html = html.replace(/\n/g, ' ');
        }
        html = formatInlineText(html);
        // Restore placeholders with actual HTML
        for (const { placeholder, html: replacement } of placeholders) {
            html = html.replace(placeholder, () => replacement);
        }
        equations.forEach((equation, i) => {
            html = html.replace(mathMarker + i + '\x00', () => inlineMathHtml(equation));
        });
        return html;
    }
    function formatInlineText(html) {
        // Now process inline formatting (bold, italic, etc.)
        // Bold + Italic
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        // Only match ___ when not surrounded by word characters (to avoid matching in filenames)
        html = html.replace(/(^|[^\w])___([^_]+)___([^\w]|$)/g, '$1<strong><em>$2</em></strong>$3');
        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Only match __ when not surrounded by word characters
        html = html.replace(/(^|[^\w])__([^_]+)__([^\w]|$)/g, '$1<strong>$2</strong>$3');
        // Italic
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // Only match _ when not surrounded by word characters (to avoid matching in filenames like file_name_test.png)
        html = html.replace(/(^|[^\w])_([^_]+)_([^\w]|$)/g, '$1<em>$2</em>$3');
        // Strikethrough
        html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
        return restoreUnderlineTags(html);
    }
    // Parse inline code spans according to CommonMark spec
    // Opening and closing backtick strings must be exactly the same length
    // Uses placeholders to protect code content from further markdown processing
    function parseInlineCode(text, placeholders, getNextIndex) {
        let result = '';
        let i = 0;
        while (i < text.length) {
            // Check for backtick sequence
            if (text[i] === '`') {
                // Count opening backticks
                let openStart = i;
                while (i < text.length && text[i] === '`') {
                    i++;
                }
                let openLen = i - openStart;
                // Look for closing backtick sequence of the same length
                let contentStart = i;
                let found = false;
                while (i < text.length) {
                    if (text[i] === '`') {
                        // Count this backtick sequence
                        let closeStart = i;
                        while (i < text.length && text[i] === '`') {
                            i++;
                        }
                        let closeLen = i - closeStart;
                        if (closeLen === openLen) {
                            // Found matching closing sequence
                            let content = text.substring(contentStart, closeStart).replace(/\r\n?|\n/g, ' ');
                            // Strip one padding space at each edge, except for all-space payloads.
                            if (content.startsWith(' ') && content.endsWith(' ') && /[^ ]/.test(content)) {
                                content = content.slice(1, -1);
                            }
                            // Use placeholder to protect code content from further processing
                            const codeHtml = '<code>' + content + '</code>';
                            const placeholder = '\x00CODE' + getNextIndex() + '\x00';
                            placeholders.push({ placeholder, html: codeHtml });
                            result += placeholder;
                            found = true;
                            break;
                        }
                        // Not matching length, continue searching
                    }
                    else {
                        i++;
                    }
                }
                if (!found) {
                    // No matching closing sequence found, output as literal backticks
                    result += text.substring(openStart, i);
                }
            }
            else {
                result += text[i];
                i++;
            }
        }
        return result;
    }
    function escapeHtml(text) {
        // Single pass replacement using a map for better performance
        const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return text.replace(/[&<>"']/g, char => escapeMap[char]);
    }
    function collectCharStyles(node, currentStyles = new Set()) {
        const result = [];
        if (node.nodeType === 3) {
            // Text node - each character inherits current styles
            const text = node.textContent || '';
            for (const char of text) {
                result.push({
                    char: char,
                    styles: new Set(currentStyles),
                    isLink: false,
                    href: '',
                    isImage: false,
                    src: '',
                    alt: '',
                    isCode: false
                });
            }
            return result;
        }
        if (node.nodeType !== 1) {
            return result;
        }
        if (node.classList.contains('math-inline')) {
            return [{ char: inlineMathMarkdown(node), styles: new Set(currentStyles), isMath: true }];
        }
        if (node.classList.contains('math-wrapper'))
            return [];
        const tag = node.tagName.toLowerCase();
        // Handle special inline elements that need different treatment
        if (tag === 'a') {
            // Link - collect content with link info
            const href = node.getAttribute('href') || '';
            const linkStyles = new Set(currentStyles);
            for (const child of node.childNodes) {
                const childChars = collectCharStyles(child, linkStyles);
                for (const c of childChars) {
                    c.isLink = true;
                    c.href = href;
                    result.push(c);
                }
            }
            return result;
        }
        if (tag === 'img') {
            // Image - return as single special entry
            const src = node.dataset.markdownPath || node.getAttribute('src') || '';
            const alt = node.getAttribute('alt') || '';
            result.push({
                char: '',
                styles: new Set(currentStyles),
                isLink: false,
                href: '',
                isImage: true,
                src: src,
                alt: alt,
                isCode: false
            });
            return result;
        }
        if (tag === 'code' && node.parentNode.tagName.toLowerCase() !== 'pre') {
            // Inline code - collect content with code flag
            for (const child of node.childNodes) {
                const childChars = collectCharStyles(child, currentStyles);
                for (const c of childChars) {
                    c.isCode = true;
                    result.push(c);
                }
            }
            return result;
        }
        if (tag === 'br') {
            if (node.hasAttribute('data-editor-placeholder'))
                return result;
            if (currentStyles.has('underline') && node.closest('blockquote') && !node.dataset.mdHardBreak) {
                return [{ char: '\n', styles: new Set(currentStyles) }];
            }
            if (!node.previousSibling && !node.nextSibling && !node.dataset.mdHardBreak)
                return result;
            // A browser's final BR following a real break is a caret sentinel.
            if (!node.dataset.mdHardBreak && !node.nextSibling && node.previousSibling?.nodeName === 'BR')
                return result;
            const kind = node.dataset.mdHardBreak;
            return [{ char: kind === 'html' ? '<br>' : (kind === 'backslash' ? '\\\n' : '  \n'),
                    styles: new Set(), isBreak: true }];
        }
        // Skip nested lists - they are handled separately
        if (tag === 'ul' || tag === 'ol') {
            return result;
        }
        // Skip input elements (checkboxes in task lists)
        if (tag === 'input') {
            return result;
        }
        // Determine if this tag adds a style
        const newStyles = new Set(currentStyles);
        if (tag === 'strong' || tag === 'b') {
            newStyles.add('bold');
        }
        else if (tag === 'em' || tag === 'i') {
            newStyles.add('italic');
        }
        else if (tag === 'del' || tag === 's' || tag === 'strike') {
            newStyles.add('strikethrough');
        }
        else if (tag === 'u') {
            newStyles.add('underline');
        }
        // Process children with updated styles
        for (const child of node.childNodes) {
            const childChars = collectCharStyles(child, newStyles);
            result.push(...childChars);
        }
        return result;
    }
    /**
     * Group consecutive characters with the same style set.
     * @param {Array} chars - Array of character objects from collectCharStyles
     * @returns {Array<{text: string, styles: Set<string>, isLink: boolean, href: string, isImage: boolean, src: string, alt: string, isCode: boolean}>}
     */
    function groupByStyle(chars) {
        if (chars.length === 0)
            return [];
        const groups = [];
        let currentGroup = null;
        for (const c of chars) {
            // Check if this character can be merged with current group
            const canMerge = currentGroup &&
                !c.isBreak && !currentGroup.isBreak &&
                !c.isMath && !currentGroup.isMath &&
                !c.isImage && !currentGroup.isImage &&
                !c.isLink && !currentGroup.isLink &&
                !c.isCode && !currentGroup.isCode &&
                sameStyleSet(c.styles, currentGroup.styles);
            if (canMerge) {
                currentGroup.text += c.char;
            }
            else {
                // Start new group
                if (currentGroup) {
                    groups.push(currentGroup);
                }
                currentGroup = {
                    text: c.isImage ? '' : c.char,
                    styles: c.styles,
                    isLink: c.isLink,
                    href: c.href,
                    isImage: c.isImage,
                    src: c.src,
                    alt: c.alt,
                    isCode: c.isCode,
                    isMath: c.isMath,
                    isBreak: c.isBreak
                };
            }
        }
        if (currentGroup) {
            groups.push(currentGroup);
        }
        // Merge adjacent link groups with same href and styles
        const mergedGroups = [];
        for (const g of groups) {
            const prev = mergedGroups[mergedGroups.length - 1];
            if (prev && prev.isLink && g.isLink &&
                prev.href === g.href &&
                sameStyleSet(prev.styles, g.styles)) {
                prev.text += g.text;
            }
            else if (prev && prev.isCode && g.isCode &&
                sameStyleSet(prev.styles, g.styles)) {
                prev.text += g.text;
            }
            else {
                mergedGroups.push(g);
            }
        }
        return mergedGroups;
    }
    /**
     * Check if two style sets are equal.
     */
    function sameStyleSet(a, b) {
        if (a.size !== b.size)
            return false;
        for (const s of a) {
            if (!b.has(s))
                return false;
        }
        return true;
    }
    /**
     * Apply Markdown formatting to a style group.
     * @param {Object} group - A group object from groupByStyle
     * @returns {string} - Markdown formatted string
     */
    function applyMarkdownStyle(group) {
        if (group.isBreak)
            return group.text;
        if (group.isMath)
            return applyInlineStyles(group.text, group.styles);
        // Handle special cases first
        if (group.isImage) {
            return '![' + group.alt + '](' + group.src + ')';
        }
        if (group.isLink) {
            // Apply styles to link text, then wrap in link syntax
            let text = group.text;
            text = applyInlineStyles(text, group.styles);
            return '[' + text + '](' + group.href + ')';
        }
        if (group.isCode) {
            // Code doesn't get other formatting
            // Use appropriate number of backticks based on content
            return wrapInlineCode(group.text);
        }
        // Skip empty text (from empty formatting tags)
        if (!group.text) {
            return '';
        }
        return applyInlineStyles(group.text, group.styles);
    }
    /**
     * Apply inline styles (bold, italic, strikethrough) to text.
     * Order: strikethrough wraps bold wraps italic (outermost to innermost)
     * @param {string} text - The text to format
     * @param {Set<string>} styles - Set of style names
     * @returns {string} - Formatted text
     */
    function applyInlineStyles(text, styles) {
        if (!text)
            return '';
        if (styles.has('underline')) {
            const innerStyles = new Set(styles);
            innerStyles.delete('underline');
            // Every physical source line needs a balanced inline wrapper.
            return text.split('\n').map(line => line ? '<u>' + applyInlineStyles(line, innerStyles) + '</u>' : '').join('\n');
        }
        let result = text;
        // Apply in order: italic (innermost), bold, strikethrough (outermost)
        if (styles.has('italic')) {
            result = '*' + result + '*';
        }
        if (styles.has('bold')) {
            result = '**' + result + '**';
        }
        if (styles.has('strikethrough')) {
            result = '~~' + result + '~~';
        }
        return result;
    }
    /**
     * Get normalized inline Markdown from a DOM node.
     * This function normalizes redundant formatting tags to produce minimal Markdown.
     * @param {Node} node - The DOM node to process
     * @returns {string} - Normalized Markdown string
     */
    function mdGetInlineMarkdown(node) {
        // 1. Collect character-level style information
        const chars = collectCharStyles(node);
        // 2. Filter out empty entries (but keep images)
        const filtered = chars.filter(c => c.char !== '' || c.isImage);
        const boundarySpace = c => c && !c.isBreak && !c.isCode && !c.isMath && !c.isImage && /^\s+$/.test(c.char);
        while (boundarySpace(filtered[0]))
            filtered.shift();
        while (boundarySpace(filtered[filtered.length - 1]))
            filtered.pop();
        // 3. Group consecutive characters with same styles
        const groups = groupByStyle(filtered);
        // 4. Generate minimal Markdown
        const result = groups.map(g => applyMarkdownStyle(g)).join('');
        return result;
    }
    return {
        REGEX,
        parseInline,
        escapeHtml,
        mdGetInlineMarkdown,
    };
}
// Construction defines capabilities; bootstrap controls the original initialization order.
function createInlineController(dependencies) {
    let REGEX, parseInline, escapeHtml, mdGetInlineMarkdown;
    function resolveImagePath(src) {
        if (!src)
            return '';
        // If already absolute URL or data URL, return as-is
        if (src.startsWith('http://') || src.startsWith('https://') ||
            src.startsWith('data:') || src.startsWith('vscode-resource:') ||
            src.startsWith('vscode-webview:')) {
            return src;
        }
        // If absolute file path (starts with /)
        if (src.startsWith('/')) {
            if (dependencies.documentBaseUri && dependencies.documentBaseUri.startsWith('file://')) {
                // Electron: use file:// protocol directly
                return 'file://' + src;
            }
            // VSCode webview: use vscode-resource URI
            return 'https://file+.vscode-resource.vscode-cdn.net' + src;
        }
        // Resolve relative path against document base URI
        if (dependencies.documentBaseUri) {
            // Remove trailing slash from base and leading ./ from src
            // The authored path is already escaped by parseInline; escape the host URI too.
            const base = escapeHtml(dependencies.documentBaseUri.replace(/\/$/, ''));
            const path = src.replace(/^\.\//, '');
            return base + '/' + path;
        }
        return src;
    }
    let initializeREGEXDone = false;
    function initializeREGEX() {
        if (initializeREGEXDone)
            return;
        initializeREGEXDone = true;
        ({ REGEX, parseInline, escapeHtml, mdGetInlineMarkdown } = createInlineCodec({
            mathSyntax: dependencies.mathSyntax, mathBackslashDelimiters: dependencies.mathBackslashDelimiters, resolveImagePath: (...args) => resolveImagePath(...args),
            inlineMathHtml: (...args) => dependencies.inlineMathHtml(...args), inlineMathMarkdown: (...args) => dependencies.inlineMathMarkdown(...args),
            wrapInlineCode: (...args) => dependencies.wrapInlineCode(...args)
        }));
    }
    return {
        resolveImagePath,
        get REGEX() { return REGEX; }, set REGEX(value) { REGEX = value; },
        get parseInline() { return parseInline; }, set parseInline(value) { parseInline = value; },
        get escapeHtml() { return escapeHtml; }, set escapeHtml(value) { escapeHtml = value; },
        get mdGetInlineMarkdown() { return mdGetInlineMarkdown; }, set mdGetInlineMarkdown(value) { mdGetInlineMarkdown = value; },
        initializeREGEX
    };
}
module.exports = { createInlineCodec, createInlineController };
