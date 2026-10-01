const test = require('node:test');
const assert = require('node:assert/strict');
const { find } = require('../../src/shared/document-search');
test('source matches retain exact offsets with Markdown and literal regex characters', () => {
    const source = '---\ntitle: Alpha\n---\n\n**Alpha** [a+b](url) Alpha\n';
    assert.deepEqual(find({ source, query: 'a+b' }).matches, [{ start: source.indexOf('a+b'), end: source.indexOf('a+b') + 3, text: 'a+b' }]);
    assert.equal(find({ source, query: 'alpha', caseSensitive: true }).matches.length, 0);
    assert.equal(find({ source, query: 'alpha' }).matches.length, 3);
});
test('whole-word applies to the entire regular expression and zero-width matches always advance', () => {
    assert.equal(find({ source: 'alpha alphabet beta betamax', query: 'alpha|beta', regex: true, wholeWord: true }).matches.length, 2);
    assert.deepEqual(find({ source: 'abc', query: '(?:)', regex: true }).matches, []);
    assert.deepEqual(find({ source: 'abc', query: '$', regex: true }).matches, []);
    assert.throws(() => find({ source: 'abc', query: '[', regex: true }), SyntaxError);
});
test('the matching ceiling is explicit and never falsely reports a complete result', () => {
    const result = find({ source: 'x'.repeat(10001), query: 'x' });
    assert.equal(result.matches.length, 10000); assert.equal(result.truncated, true);
    assert.equal(find({ source: 'x'.repeat(10000), query: 'x' }).truncated, false);
});
