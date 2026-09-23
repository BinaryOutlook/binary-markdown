/* Deterministic Markdown table layouts, shared by the editor and tests. */
(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.BinaryTableFormat = api;
})(typeof window === 'undefined' ? null : window, function() {
    'use strict';

    const normalize = value => value === 'compact' ? 'compact' : 'aligned';
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

    // Measure Markdown source, including its markup. Grapheme clusters keep
    // combining marks and joined emoji together; CJK/fullwidth glyphs use two
    // monospace columns. Actual glyph widths still depend on the source font.
    function sourceWidth(text) {
        let width = 0;
        for (const { segment } of segmenter.segment(text)) {
            if (/^[\p{Mark}\u200d\ufe0e\ufe0f]+$/u.test(segment)) continue;
            const cp = segment.codePointAt(0);
            const wide = /[\p{Emoji_Presentation}\p{Regional_Indicator}\ufe0f\u20e3]/u.test(segment) ||
                (cp >= 0x1100 && cp <= 0x115f) || cp === 0x2329 || cp === 0x232a ||
                (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
                (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) ||
                (cp >= 0xfe10 && cp <= 0xfe19) || (cp >= 0xfe30 && cp <= 0xfe6f) ||
                (cp >= 0xff01 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6) ||
                (cp >= 0x1b000 && cp <= 0x1b2ff) || (cp >= 0x20000 && cp <= 0x3fffd);
            width += wide ? 2 : 1;
        }
        return width;
    }

    function format(rows, alignments = [], style = 'aligned') {
        if (!rows.length) return '';
        const compact = normalize(style) === 'compact';
        const columnCount = rows[0].length;
        const markers = Array.from({ length: columnCount }, (_, i) =>
            alignments[i] === 'center' ? ':---:' : alignments[i] === 'right' ? '---:' : '---');
        const widths = markers.map(marker => marker.length);
        if (!compact) for (const row of rows) for (let i = 0; i < columnCount; i++) {
            widths[i] = Math.max(widths[i], sourceWidth(row[i] || ''));
        }
        const line = cells => '| ' + cells.join(' | ') + ' |\n';
        const lines = rows.map(row => line(row.map((cell, i) => {
            if (compact) return cell || ' ';
            const padding = Math.max(0, (widths[i] || 0) - sourceWidth(cell));
            const left = alignments[i] === 'right' ? padding :
                alignments[i] === 'center' ? Math.floor(padding / 2) : 0;
            return ' '.repeat(left) + cell + ' '.repeat(padding - left);
        })));
        const separators = compact ? markers : markers.map((marker, i) => {
            if (marker.startsWith(':')) return ':' + '-'.repeat(widths[i] - 2) + ':';
            if (marker.endsWith(':')) return '-'.repeat(widths[i] - 1) + ':';
            return '-'.repeat(widths[i]);
        });
        lines.splice(1, 0, line(separators));
        return lines.join('');
    }

    return { normalize, format };
});
