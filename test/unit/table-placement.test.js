'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { box, fits, overlaps, choose, normalize, positions } = require('../../src/shared/table-placement');
const base = { bounds: box(0, 40, 1000, 760), table: box(200, 250, 400, 160),
    horizontal: { width: 360, height: 36 }, vertical: { width: 64, height: 290 }, preference: 'auto' };

test('one preference preserves every explicit position and normalizes only invalid input', () => {
    for (const value of positions) assert.equal(normalize(value), value);
    for (const value of [undefined, null, '', 'invalid', {}, 0]) assert.equal(normalize(value), 'auto');
});
test('short tables favor a safe horizontal corner; tall tables favor a gutter', () => {
    const short = choose(base);
    assert.equal(short.vertical, false);
    const tall = choose({ ...base, table: box(200, 120, 400, 550) });
    assert.equal(tall.vertical, true);
    assert.ok(fits(tall, base.bounds));
});
test('obstacles reject occupied positions and all blocked candidates dock', () => {
    const occupied = box(0, 40, 1000, 210);
    assert.ok(choose({ ...base, obstacles: [occupied] }).placement.startsWith('bottom'));
    assert.equal(choose({ ...base, obstacles: [base.bounds] }).placement, 'top-bar');
});
test('retain a safe current position; docking requires settled layout and extra clearance', () => {
    assert.equal(choose({ ...base, current: 'bottom-right' }).placement, 'bottom-right');
    assert.equal(choose({ ...base, current: 'top-bar', allowUndock: false }).placement, 'top-bar');
    const result = choose({ ...base, current: 'top-bar', allowUndock: true });
    assert.notEqual(result.placement, 'top-bar');
    assert.ok(fits(result, base.bounds, 16));
});
test('manual preferences retain their anchor and orientation in narrow panes', () => {
    for (const preference of positions.slice(1, 7)) {
        const input = { ...base, preference, bounds: box(180, 180, 150, 190) };
        const result = choose(input);
        assert.equal(result.placement, preference);
        assert.ok(fits(result, input.bounds));
    }
});
test('offscreen selected tables dock in automatic mode and hide in fixed mode', () => {
    const table = box(200, -300, 400, 100);
    assert.equal(choose({ ...base, table }).placement, 'top-bar');
    assert.equal(choose({ ...base, table, preference: 'right' }).placement, 'hidden');
});
test('every automatic floating result is inside the pane and avoids obstacles', () => {
    for (const width of [240, 400, 800, 1200]) for (const height of [180, 400, 800]) {
        const input = { ...base, bounds: box(0, 40, width, height), table: box(80, 200, width / 2, height / 2), obstacles: [box(0, 40, width, 45)] };
        const result = choose(input);
        if (result.placement === 'top-bar') continue;
        assert.ok(fits(result, input.bounds));
        assert.equal(overlaps(result, input.table), false);
        assert.equal(overlaps(result, input.obstacles[0]), false);
    }
});
