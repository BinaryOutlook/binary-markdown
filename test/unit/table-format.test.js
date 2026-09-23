'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { format, normalize } = require('../../src/shared/table-format');

test('default output uses the observed padded table convention', () => {
    assert.equal(format([['Item', 'Value'], ['Long item', '3']]),
        '| Item      | Value |\n| --------- | ----- |\n| Long item | 3     |\n');
    for (const value of [undefined, null, '', 'invalid']) assert.equal(normalize(value), 'aligned');
});

test('compact retains legacy row spacing and fixed alignment markers', () => {
    assert.equal(format([['Name', 'Count', 'State'], ['A', '2', '']], ['left', 'right', 'center'], 'compact'),
        '| Name | Count | State |\n| --- | ---: | :---: |\n| A | 2 |   |\n');
});

test('aligned output pads right and center cells without modifying their contents', () => {
    assert.equal(format([['Name', 'Count', 'State'], ['A', '2', 'Ready']], ['left', 'right', 'center']),
        '| Name | Count | State |\n| ---- | ----: | :---: |\n| A    |     2 | Ready |\n');
});

test('CJK, combining marks and joined emoji contribute display widths without changing source', () => {
    assert.equal(format([['項目', '値'], ['長い名前', '👩‍💻'], ['e\u0301', '✅']]),
        '| 項目     | 値  |\n| -------- | --- |\n| 長い名前 | 👩‍💻  |\n| e\u0301        | ✅  |\n');
});

test('source markup is included in the width and remains verbatim', () => {
    const cells = [['Markup', 'Other'], ['**bold**', 'a\\|b'], ['[link](target)', '`code`']];
    const out = format(cells);
    assert.equal(out,
        '| Markup         | Other  |\n| -------------- | ------ |\n| **bold**       | a\\|b   |\n| [link](target) | `code` |\n');
});

test('header-only and uneven rows retain their content and a matching delimiter row', () => {
    assert.equal(format([['Only']], ['right']), '| Only |\n| ---: |\n');
    assert.equal(format([['A', 'B'], ['one'], ['two', 'three', 'extra']], [], 'compact'),
        '| A | B |\n| --- | --- |\n| one |\n| two | three | extra |\n');
    assert.equal(format([]), '');
});

test('large tables do not depend on spreading all rows into a function call', () => {
    const out = format([['Item'], ...Array.from({ length: 150000 }, () => ['a'])]);
    assert.ok(out.startsWith('| Item |\n| ---- |\n| a    |\n'));
    assert.equal(out.split('\n').length, 150003);
});
