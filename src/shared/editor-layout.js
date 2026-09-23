(function(root) {
    'use strict';
    const widthModes = Object.freeze(['default', 'full', 'custom']);
    const alignments = Object.freeze(['left', 'center', 'right']);
    const normalizeAlignment = value => alignments.includes(value) ? value : 'center';
    const defaultWidth = 860;
    const minWidth = 320;
    const maxWidth = 4000;
    const normalizeWidthMode = value => widthModes.includes(value) ? value : 'default';
    const isValidWidth = value => Number.isInteger(value) && value >= minWidth && value <= maxWidth;
    const normalizeMaxWidth = value => isValidWidth(value) ? value : defaultWidth;
    const api = { alignments, normalizeAlignment, widthModes, defaultWidth, minWidth, maxWidth, normalizeWidthMode, isValidWidth, normalizeMaxWidth };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.BinaryEditorLayout = api;
})(typeof window === 'undefined' ? globalThis : window);
