'use strict';

// Executed inside either host's editor to check complete, non-overlapping actions.
function toolbarGeometry() {
    const toolbar = document.getElementById('toolbar');
    const inner = document.getElementById('toolbarInner');
    const menu = document.getElementById('toolbarOverflow');
    const bounds = toolbar.getBoundingClientRect();
    const rects = [];
    const clipped = [];
    for (const button of toolbar.querySelectorAll('button')) {
        if (menu.contains(button) || button.closest('.table-toolbar, .table-toolbar-dock') || !button.getClientRects().length) continue;
        const rect = button.getBoundingClientRect();
        const area = inner.contains(button) ? inner.getBoundingClientRect() : bounds;
        if (rect.left < area.left - 1 || rect.right > area.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1) clipped.push(button.dataset.action || button.id);
        rects.push({ action: button.dataset.action || button.id, left: rect.left, right: rect.right });
    }
    const overlaps = rects.slice(1).filter((rect, i) => rect.left < rects[i].right - 1).map(rect => rect.action);
    return { clipped, overlaps, visible: rects.map(rect => rect.action), overflow: [...menu.querySelectorAll('button')].map(button => button.dataset.action), width: bounds.width };
}

module.exports = { toolbarGeometry };
