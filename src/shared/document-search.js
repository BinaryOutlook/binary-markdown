/* Shared pure matching engine. In a web worker, expensive regular expressions
 * can be terminated by the view without blocking editing or losing source. */
(function(root) {
    'use strict';
    function find(input) {
        if (!input || typeof input.source !== 'string' || typeof input.query !== 'string') throw new Error('Invalid search input');
        const matches = [];
        if (!input.query) return { matches, truncated: false };
        let pattern = input.query;
        if (!input.regex) pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (input.wholeWord) pattern = '\\b(?:' + pattern + ')\\b';
        const regex = new RegExp(pattern, input.caseSensitive ? 'g' : 'gi');
        let match;
        while ((match = regex.exec(input.source)) !== null) {
            // Empty matches are navigation boundaries, not replaceable text.
            // Always advance them, including an empty match at EOF.
            if (!match[0].length) { if (regex.lastIndex >= input.source.length) break; regex.lastIndex++; continue; }
            if (matches.length === 10000) return { matches, truncated: true };
            matches.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
        }
        return { matches, truncated: false };
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { find };
    else if (typeof document === 'undefined') root.addEventListener('message', event => {
        try { root.postMessage({ id: event.data.id, ...find(event.data) }); }
        catch (_) { root.postMessage({ id: event.data.id, error: 'invalid' }); }
    });
})(typeof self === 'undefined' ? globalThis : self);
