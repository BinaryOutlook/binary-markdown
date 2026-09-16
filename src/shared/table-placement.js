(function(root) {
    'use strict';
    const positions = Object.freeze(['auto', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right', 'top-bar']);
    const normalize = value => positions.includes(value) ? value : 'auto';
    const box = (x, y, width, height) => ({ left: x, top: y, right: x + width, bottom: y + height, width, height });
    const overlaps = (a, b, gap = 0) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
    const fits = (a, b, gap = 0) => a.left >= b.left + gap && a.right <= b.right - gap && a.top >= b.top + gap && a.bottom <= b.bottom - gap;
    const clamp = (n, low, high) => Math.max(low, Math.min(n, Math.max(low, high)));

    // Pure viewport geometry. No DOM, document mutation, or preference writes.
    function choose(input) {
        const { table, bounds, horizontal, vertical } = input;
        const preference = normalize(input.preference);
        const gap = 6;
        const visible = overlaps(table, bounds);
        if (preference === 'top-bar' || (!visible && preference === 'auto')) return { placement: 'top-bar' };
        if (!visible || bounds.width <= 0 || bounds.height <= 0) return { placement: 'hidden' };
        const visibleTop = Math.max(table.top, bounds.top);
        const visibleBottom = Math.min(table.bottom, bounds.bottom);
        const candidates = positions.slice(1, 7).map(placement => {
            const side = placement === 'left' || placement === 'right';
            const size = side ? vertical : horizontal;
            let x = placement.endsWith('right') ? table.right - size.width : table.left;
            let y = placement.startsWith('bottom') ? table.bottom + gap : table.top - size.height - gap;
            if (side) {
                x = placement === 'left' ? table.left - size.width - gap : table.right + gap;
                y = (visibleTop + visibleBottom - size.height) / 2;
            }
            return { placement, vertical: side, ...box(x, y, size.width, size.height) };
        });
        if (preference !== 'auto') {
            const candidate = candidates.find(item => item.placement === preference);
            const width = Math.min(candidate.width, Math.max(1, bounds.width - gap * 2));
            const height = Math.min(candidate.height, Math.max(1, bounds.height - gap * 2));
            return { ...candidate, ...box(clamp(candidate.left, bounds.left + gap, bounds.right - width - gap),
                clamp(candidate.top, bounds.top + gap, bounds.bottom - height - gap), width, height) };
        }
        const obstacles = [table, ...(input.obstacles || [])];
        const safe = candidates.filter(candidate => fits(candidate, bounds, gap) && !obstacles.some(obstacle => overlaps(candidate, obstacle, 2)));
        const current = safe.find(candidate => candidate.placement === input.current);
        if (current) return current;
        // Returning from docking needs extra clearance, preventing boundary oscillation.
        const eligible = input.current === 'top-bar' ? safe.filter(candidate => input.allowUndock !== false &&
            fits(candidate, bounds, 16) && !(input.obstacles || []).some(obstacle => overlaps(candidate, obstacle, 10))) : safe;
        const preferSide = visibleBottom - visibleTop >= vertical.height + gap * 2;
        const cell = input.cell || table;
        const distance = candidate => Math.abs((candidate.left + candidate.right - cell.left - cell.right) / 2) +
            Math.abs((candidate.top + candidate.bottom - cell.top - cell.bottom) / 2);
        eligible.sort((a, b) => Number(b.vertical === preferSide) - Number(a.vertical === preferSide) || distance(a) - distance(b));
        return eligible[0] || { placement: 'top-bar' };
    }
    const api = { positions, normalize, box, overlaps, fits, choose };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.BinaryTablePlacement = api;
})(typeof window === 'undefined' ? globalThis : window);
