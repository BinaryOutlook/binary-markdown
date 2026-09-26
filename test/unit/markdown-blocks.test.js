'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../../src/shared/markdown-blocks');

function reconstruct(parsed) {
    return parsed.blocks.map(block => block.before + block.source).join('') + parsed.trailing;
}

test('separators and final newlines are source layout, never empty blocks', () => {
    for (const source of ['', '\n\n', 'Alpha\nBeta', '\nAlpha\n\n\nBeta\n\n', '# Heading\n\nText\n', '---\ntitle: Example\n---\n\n']) {
        const parsed = parse(source);
        assert.equal(reconstruct(parsed), source);
        assert.ok(parsed.blocks.every(block => block.source.trim()));
    }
    assert.equal(parse('Alpha\nBeta\n').blocks.length, 1);
    assert.equal(parse('Alpha\n\nBeta\n').blocks.length, 2);
});

test('loose list continuation paragraphs belong to their item and retain numbering', () => {
    const source = '3. First\n\n   Continued\n\n4. Second\n\nEnd\n';
    const parsed = parse(source);
    assert.equal(reconstruct(parsed), source);
    const list = parsed.blocks[0];
    assert.equal(list.type, 'ordered_list');
    assert.equal(list.attrs.start, 3);
    assert.equal(list.children.length, 2);
    assert.equal(list.children[0].children.length, 2);
    assert.equal(parsed.blocks[1].type, 'paragraph');
});

test('legacy nested empty list items stay editable items rather than setext headings', () => {
    const parsed = parse('- Parent\n  - \n    - \n      - Child');
    const types = [];
    const visit = node => { types.push(node.type); node.children.forEach(visit); };
    parsed.blocks.forEach(visit);
    assert.equal(types.filter(type => type === 'list_item').length, 4);
    assert.ok(!types.includes('heading'));
});

test('fenced code preserves literal tabs and blank payload lines at every supported indentation', () => {
    for (const indent of ['', ' ', '  ', '   ']) {
        const source = indent + '```text\n' + indent + 'Alpha\n\tBeta\n' + indent + '\n' + indent + '```\n';
        const parsed = parse(source);
        assert.equal(reconstruct(parsed), source);
        assert.equal(parsed.blocks[0].content, 'Alpha\n\tBeta\n\n');
    }
});

test('front matter, managed TOCs and equations retain source without separator paragraphs', () => {
    const source = '---\ntitle: Example\n---\n\n[TOC]\n\n# Heading\n\n$$\nx^2\n$$\n';
    const parsed = parse(source);
    assert.equal(reconstruct(parsed), source);
    assert.deepEqual(parsed.blocks.map(block => block.type), ['front_matter', 'binary_aux', 'heading', 'binary_math']);
    assert.equal(parsed.blocks[0].content, '---\ntitle: Example\n---\n');
});

test('an unclosed fence retains its final line even without a final newline', () => {
    const source = '```text\nexample\n---\nIMAGE_DIR: still code';
    const parsed = parse(source);
    assert.equal(reconstruct(parsed), source);
    assert.equal(parsed.blocks[0].content, 'example\n---\nIMAGE_DIR: still code\n');
});

test('literal HTML and unsupported reference definitions remain visible source', () => {
    const source = '<script>alert(1)</script>\n\n[label]: target.md\n';
    const parsed = parse(source);
    assert.equal(reconstruct(parsed), source);
    assert.deepEqual(parsed.blocks.map(block => block.type), ['paragraph', 'paragraph']);
});
