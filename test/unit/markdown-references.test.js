'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parse, inlineReferences } = require('../../src/shared/markdown-blocks');
const reconstruct = parsed => parsed.blocks.map(block => block.before + block.source).join('') + parsed.trailing;

test('full, collapsed, shortcut, Unicode and image references share definitions and titles', () => {
    const source = '[Guide]: <https://example.com/a(b)?x=1&y=2> "A title"\n[説明]: image.png\n';
    const context = parse(source).references;
    const spans = inlineReferences('[full][guide] [Guide][] [GUIDE] ![説明][]', context);
    assert.deepEqual(spans.map(span => span.label), ['guide', 'Guide', 'GUIDE', '説明']);
    assert.equal(spans[0].title, 'A title');
    assert.equal(spans[2].href, 'https://example.com/a(b)?x=1&y=2');
    assert.equal(spans[3].image, true);
    assert.equal(spans[3].href, 'image.png');
    const images = inlineReferences('![custom][説明] ![説明][] ![説明]', context);
    assert.equal(images.length, 3);
    assert.ok(images.every(span => span.image && span.href === 'image.png' && span.label === '説明'));
});

test('definitions, duplicates, unused notes and exact boundaries survive parsing', () => {
    const source = '\nText [label] [^one] [^one].\n\n[label]: /first\n[label]: /second\n\n[^one]: First paragraph.\n\n    Another **paragraph**.\n\n[^unused]: Retain me.\n\nEnd\n\n';
    const parsed = parse(source);
    assert.equal(reconstruct(parsed), source);
    assert.equal(parsed.references.references.LABEL.href, '/first');
    assert.equal(parsed.references.notes.ONE.meta.count, 2);
    assert.equal(parsed.references.notes.ONE.children.length, 2);
    assert.equal(parsed.references.notes.UNUSED.meta.number, undefined);
});

test('code, escapes, malformed and unsafe definitions stay literal', () => {
    const source = '[a]: /safe\n\n[bad]: javascript:alert(1)\n\n```md\n[hidden]: /not-a-definition\n[^code]: not a note\n```\n';
    const parsed = parse(source);
    assert.equal(reconstruct(parsed), source);
    assert.equal(parsed.references.references.BAD, undefined);
    assert.equal(parsed.references.references.HIDDEN, undefined);
    assert.equal(parsed.references.notes.code, undefined);
    assert.deepEqual(inlineReferences('`[a] [^n]` \\[a] [unknown] [bad]', parsed.references).filter(span => !span.escaped), []);
    assert.deepEqual(inlineReferences('!`[a]` [^missing]', parsed.references).map(span => span.note), ['missing']);
});

test('escaped labels, normalized whitespace and prototype-like names resolve safely', () => {
    const context = parse('[a\\]b]: /escaped\n[a b]: /space\n[constructor]: /constructor\n[__proto__]: /proto\n').references;
    assert.deepEqual(inlineReferences('[x][a\\]b] [a\n b] [constructor] [__proto__]', context).map(span => span.href),
        ['/escaped', '/space', '/constructor', '/proto']);
});

test('footnotes use normalized labels and the first duplicate definition', () => {
    const source = 'A[^ONE] B[^one].\n\n[^one]: First.\n[^ONE]: Duplicate.\n';
    const parsed = parse(source);
    assert.equal(reconstruct(parsed), source);
    assert.equal(parsed.references.notes.ONE.content, '[^one]: First.');
    assert.equal(parsed.references.notes.ONE.meta.count, 2);
    assert.equal(parsed.blocks.at(-1).meta.duplicate, true);
});

test('unresolved full and collapsed references remain identifiable source', () => {
    const spans = inlineReferences('[text][missing] and [missing][] and [ordinary brackets]', {});
    assert.deepEqual(spans.map(span => span.raw), ['[text][missing]', '[missing][]']);
    assert.ok(spans.every(span => span.unresolved));
});

test('nested image labels cannot leak offsets into the surrounding source', () => {
    const context = parse('[x]: /x\n[image]: /image.png').references;
    assert.deepEqual(inlineReferences('![alt [x]](image.png)', context), []);
    assert.deepEqual(inlineReferences('[note [^x]](/link)', context), []);
    assert.deepEqual(inlineReferences('[![alt][image]][x]', context).map(span => span.raw), ['[![alt][image]][x]']);
});

test('note markers inside equations do not create used notes or backlink counts', () => {
    const parsed = parse('Math $[x] + [^n]$.\n\n[x]: /x\n[^n]: Unused.\n');
    assert.equal(parsed.references.notes.N.meta.number, undefined);
    assert.equal(parsed.references.notes.N.meta.count, 0);
});
