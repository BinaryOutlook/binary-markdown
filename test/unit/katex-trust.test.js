const { test } = require('node:test');
const assert = require('node:assert/strict');
const katex = require('katex');

test('math rendering ignores inherited trust options', () => {
    const source = String.raw`\href{javascript:alert(1)}{link}`;
    const inherited = Object.create({ trust: true });
    const untrusted = katex.renderToString(source, inherited);
    assert.equal(untrusted, katex.renderToString(source));
    assert.doesNotMatch(untrusted, /href="javascript:/);
    // The control demonstrates that this expression exercises trust handling.
    assert.match(katex.renderToString(source, { trust: true }), /href="javascript:/);
});
