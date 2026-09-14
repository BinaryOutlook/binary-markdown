/* Shared source operations. No DOM, YAML reformatting or export dependencies. */
(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.documentAux = api;
})(typeof globalThis === 'object' ? globalThis : this, function() {
    const START = '<!-- binary-markdown:toc:start -->';
    const END = '<!-- binary-markdown:toc:end -->';

    function sourceLines(source) {
        const lines = [];
        const pattern = /([^\r\n]*)(\r\n|\r|\n|$)/g;
        let match;
        while ((match = pattern.exec(source)) && match[0]) {
            lines.push({ text: match[1], start: match.index, end: pattern.lastIndex });
        }
        return lines;
    }

    function splitFrontMatter(source) {
        const lines = sourceLines(source);
        if (!lines.length || lines[0].text.replace(/^\uFEFF/, '') !== '---') return { raw: '', body: source };
        for (let i = 1; i < lines.length; i++) {
            if (!/^(?:---|\.\.\.)[ \t]*$/.test(lines[i].text)) continue;
            const content = source.slice(lines[0].end, lines[i].start);
            // Preserve mapping-shaped metadata, including malformed YAML values.
            // A plain paragraph between two thematic rules is not metadata.
            if (!/^\s*[^\s#][^\r\n]*?:/m.test(content) && content.split(/\r?\n/).some(line => line.trim() && !/^\s*#/.test(line))) break;
            return { raw: source.slice(0, lines[i].end), body: source.slice(lines[i].end) };
        }
        return { raw: '', body: source };
    }

    function headingText(source) {
        return source
            .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
            .replace(/(`+)([\s\S]*?)\1/g, '$2')
            .replace(/\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*/g, (_, a, b, c) => a || b || c)
            .replace(/(^|[^\w])_{1,3}([^_]+)_{1,3}(?=[^\w]|$)/g, '$1$2')
            .replace(/~~(.+?)~~/g, '$1')
            .replace(/\\([\\`*_[\]{}()#+.!~>-])/g, '$1');
    }

    function headingSlug(label) {
        return label.toLowerCase().trim().replace(/[^\p{L}\p{N}_\s-]/gu, '').replace(/\s+/g, '-') || 'section';
    }

    function scan(source) {
        const front = splitFrontMatter(source);
        const lines = sourceLines(source);
        const headings = [], tocs = [], markers = [];
        const used = new Set();
        let fence, open;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.start < front.raw.length) continue;
            const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line.text);
            if (fence) {
                if (match && match[1][0] === fence.char && match[1].length >= fence.length && !match[2].trim()) fence = undefined;
                continue;
            }
            if (match) { fence = { char: match[1][0], length: match[1].length }; continue; }
            if (line.text === START) {
                if (open) throw new Error('Nested TOC markers. Repair the TOC boundaries in source mode before saving or exporting.');
                open = line;
                continue;
            }
            if (line.text === END) {
                if (!open) throw new Error('Unmatched TOC end marker. Repair the TOC boundaries in source mode.');
                tocs.push({ start: open.start, end: line.start + line.text.length, source: source.slice(open.start, line.start + line.text.length) });
                open = undefined;
                continue;
            }
            if (open) continue;
            if (/^\[toc\]$/i.test(line.text)) { markers.push({ start: line.start, end: line.start + line.text.length }); continue; }
            // Match the visual editor's ATX heading grammar. Excludes fences,
            // front matter, generated contents, quoted and indented examples.
            const heading = /^(#{1,6})\s+(.+)$/.exec(line.text);
            if (!heading) continue;
            const label = headingText(heading[2]);
            const base = headingSlug(label);
            let id = base, suffix = 1;
            while (used.has(id)) id = base + '-' + suffix++;
            used.add(id);
            headings.push({ level: heading[1].length, label, id, start: line.start });
        }
        if (open) throw new Error('Unclosed TOC block. Restore its end marker in source mode before saving or exporting.');
        return { front, headings, tocs, markers };
    }

    function generateToc(headings, eol = '\n') {
        const lines = [START, '**Contents**', ''];
        const levels = [];
        for (const h of headings) {
            while (levels.length && levels[levels.length - 1] >= h.level) levels.pop();
            const depth = levels.length;
            levels.push(h.level);
            const label = h.label.replace(/[\\[\]`*_~]/g, '\\$&');
            lines.push('  '.repeat(depth) + '- [' + label + '](#' + h.id + ')');
        }
        if (headings.length) lines.push('');
        lines.push(END);
        return lines.join(eol);
    }

    function refreshTocs(source) {
        const parsed = scan(source);
        if (!parsed.tocs.length && !parsed.markers.length) return source;
        const eol = /\r\n/.test(source) ? '\r\n' : '\n';
        const generated = generateToc(parsed.headings, eol);
        for (const block of [...parsed.tocs, ...parsed.markers].sort((a, b) => b.start - a.start)) {
            source = source.slice(0, block.start) + generated + source.slice(block.end);
        }
        return source;
    }

    function assertFreshToc(source) {
        if (refreshTocs(source) !== source) throw new Error('The table of contents is out of date. Save the document to refresh it, then export again.');
    }

    return { START, END, sourceLines, splitFrontMatter, headingText, headingSlug, scan, generateToc, refreshTocs, assertFreshToc };
});
