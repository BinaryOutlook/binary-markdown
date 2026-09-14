/* Shared equation boundaries for the editor and export-only normalization. */
(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.BinaryMath = api;
})(typeof globalThis === 'object' ? globalThis : this, function() {
    function escaped(text, index) {
        let count = 0;
        while (index > 0 && text[--index] === '\\') count++;
        return count % 2 === 1;
    }

    // Code spans and link/image destinations are never equation input.
    function protectedEnd(text, index) {
        if (text[index] === '`' && !escaped(text, index)) {
            const run = /^`+/.exec(text.slice(index))[0];
            let end = index + run.length;
            while ((end = text.indexOf(run, end)) !== -1) {
                if (text[end - 1] !== '`' && text[end + run.length] !== '`') return end + run.length;
                end += run.length;
            }
            return index + run.length;
        }
        if (text[index] === ']' && text[index + 1] === '(' && !escaped(text, index)) {
            let depth = 1;
            for (let end = index + 2; end < text.length; end++) {
                if (escaped(text, end)) continue;
                if (text[end] === '(') depth++;
                if (text[end] === ')' && --depth === 0) return end + 1;
            }
            return text.length;
        }
        if (text[index] === '<' && /^<(?:[a-z][\w+.-]*:|\/?[a-z][\w-]*(?:\s|>))/i.test(text.slice(index))) {
            const end = text.indexOf('>', index + 1);
            if (end !== -1) return end + 1;
        }
        return index;
    }

    function inline(text, backslash = true) {
        const tokens = [];
        for (let i = 0; i < text.length; i++) {
            const skip = protectedEnd(text, i);
            if (skip > i) { i = skip - 1; continue; }
            if (escaped(text, i)) continue;
            let open, close;
            if (backslash && text.startsWith('\\(', i)) { open = '\\('; close = '\\)'; }
            else if (text[i] === '$' && text[i - 1] !== '$' && text[i + 1] !== '$' && /\S/.test(text[i + 1] || '')) {
                open = close = '$';
            } else continue;
            for (let end = i + open.length; end < text.length; end++) {
                if (text[end] === '\n' || text[end] === '\r') break;
                if (!text.startsWith(close, end) || escaped(text, end)) continue;
                if (close === '$' && (end === i + 1 || /\s/.test(text[end - 1]) || /[\d$]/.test(text[end + 1] || '') || text[end - 1] === '$')) continue;
                const tex = text.slice(i + open.length, end);
                if (!tex.trim()) break;
                tokens.push({ start: i, end: end + close.length, open, close, tex, raw: text.slice(i, end + close.length) });
                i = end + close.length - 1;
                break;
            }
        }
        return tokens;
    }

    // Display delimiters must occupy a standalone block, including the closer.
    function display(lines, index, backslash = true) {
        const match = /^( *)(\$\$|\\\[)(.*)$/.exec(lines[index]);
        if (!match || (match[2] === '\\[' && !backslash)) return null;
        const indent = match[1], open = match[2], close = open === '$$' ? '$$' : '\\]';
        const rest = match[3];
        const oneLineEnd = rest.lastIndexOf(close);
        if (oneLineEnd >= 0 && !escaped(rest, oneLineEnd) && !rest.slice(oneLineEnd + close.length).trim()) {
            const tex = rest.slice(0, oneLineEnd);
            return { start: index, end: index + 1, open, close, tex, indent, raw: lines[index].slice(indent.length), singleLine: true };
        }
        if (rest.trim()) return null;
        const body = [];
        for (let end = index + 1; end < lines.length; end++) {
            const line = lines[end];
            if (line.trim() === close) {
                return { start: index, end: end + 1, open, close, tex: body.join('\n'), indent,
                    raw: lines.slice(index, end + 1).map(line => line.startsWith(indent) ? line.slice(indent.length) : line).join('\n'), singleLine: false };
            }
            // An incomplete block must not absorb another Markdown section.
            if (line === '\u0000' || /^\s*(?:`{3,}|~{3,}|#{1,6} |\$\$\s*$|\\\[\s*$)/.test(line)) return null;
            body.push(line.startsWith(indent) ? line.slice(indent.length) : line);
        }
        return null;
    }

    // Change only equation delimiters in an export copy, retaining TeX commands.
    function normalizeForPandoc(source, backslash = true) {
        if (!backslash) return source;
        const lines = source.split('\n');
        let fence = null, frontMatter = false, quoteScope = '', listIndents = [];
        for (let i = 0; i < lines.length; i++) {
            if (i === 0 && /^\uFEFF?---\s*$/.test(lines[i])) { frontMatter = true; continue; }
            if (frontMatter) {
                if (/^(?:---|\.\.\.)\s*$/.test(lines[i])) frontMatter = false;
                continue;
            }
            const quote = /^(?: {0,3}> ?)+/.exec(lines[i]);
            const prefix = quote ? quote[0] : '';
            const content = lines[i].slice(prefix.length);
            // A list's content indentation is not an indented code block.
            // Keep real code (four more spaces) protected inside the list too.
            if (prefix !== quoteScope && !fence) { listIndents = []; quoteScope = prefix; }
            const indentation = /^ */.exec(content)[0].length;
            const list = /^( *)(?:[-+*]|\d+[.)]) +/.exec(content);
            if (!fence && content.trim()) {
                while (listIndents.length && indentation < listIndents[listIndents.length - 1]) listIndents.pop();
                if (list) listIndents.push(list[0].length);
            }
            const baseIndent = listIndents[listIndents.length - 1] || 0;
            const relative = content.slice(list ? list[0].length : Math.min(indentation, baseIndent));
            const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(relative);
            if (fence) {
                if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
                continue;
            }
            if (marker) { fence = marker[1]; continue; }
            if (/^ {4}|^\t|^ {0,3}\[[^\]]+\]:/.test(relative)) continue;
            const blockLines = prefix ? lines.slice(i).map(line => line.startsWith(prefix) ? line.slice(prefix.length) : '\u0000') : lines;
            const blockIndex = prefix ? 0 : i;
            const block = display(blockLines, blockIndex, true);
            if (block) {
                const last = i + block.end - blockIndex - 1;
                if (block.open === '\\[') {
                    lines[i] = lines[i].replace('\\[', () => '$$');
                    const end = lines[last].lastIndexOf('\\]');
                    lines[last] = lines[last].slice(0, end) + '$$' + lines[last].slice(end + 2);
                }
                i = last;
                continue;
            }
            const tokens = inline(content, true).filter(token => token.open === '\\(');
            let normalized = content;
            for (const token of tokens.reverse()) {
                // Trimming boundary whitespace affects only temporary delimiters.
                const tex = token.tex.trim();
                normalized = normalized.slice(0, token.start) + '$' + tex + '$' + normalized.slice(token.end);
            }
            lines[i] = prefix + normalized;
        }
        return lines.join('\n');
    }
    return { inline, display, normalizeForPandoc };
});
