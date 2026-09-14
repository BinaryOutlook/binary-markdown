const { test } = require('node:test');
const assert = require('node:assert/strict');
const math = require('../../src/shared/math-syntax');

test('inline boundaries exclude currency, escapes, code, links and incomplete input', () => {
    const input = String.raw`$x^2$ and \(O(V^3)\); $20 and $30; \$x\$; $ x $; $x$2; \(unfinished`;
    assert.deepEqual(math.inline(input).map(t => t.raw), ['$x^2$', String.raw`\(O(V^3)\)`]);
    assert.deepEqual(math.inline(String.raw`\(x\)` , false), []);
    assert.deepEqual(math.inline('`$x$` ``\\(x\\)`` [a](path/\\(x\\)) <https://x/$y$>'), []);
});

test('display blocks preserve the original expression and require a closing boundary', () => {
    const lines = ['$$', '\\begin{aligned}', 'a &= b \\\\', 'c &= d', '\\end{aligned}', '$$'];
    assert.equal(math.display(lines, 0).tex, lines.slice(1, -1).join('\n'));
    assert.equal(math.display(lines, 0).raw, lines.join('\n'));
    assert.equal(math.display(['\\[x^2\\]'], 0).tex, 'x^2');
    assert.equal(math.display(['\\[x^2\\]'], 0, false), null);
    assert.equal(math.display(['$$', 'unfinished', '# Next heading'], 0), null);
});

test('Pandoc normalization changes delimiters only, including table cells and quotes', () => {
    const input = String.raw`\[
\frac{a}{b}
\]

| Cost |
| --- |
| \(O(V^3)\) |

> \[
> x=1
> \]`;
    assert.equal(math.normalizeForPandoc(input), String.raw`$$
\frac{a}{b}
$$

| Cost |
| --- |
| $O(V^3)$ |

> $$
> x=1
> $$`);
    assert.equal(math.normalizeForPandoc(input, false), input);
});

test('Pandoc normalization preserves code examples, metadata and equation contents', () => {
    const input = '---\ntitle: \\(literal\\)\n---\n\n' +
        '```markdown\n\\[\nx\n\\]\n```\n\n' +
        '    \\(code\\)\n\n`\\(code\\)` [a](path/\\(x\\))\n\n' +
        '$$\n\\text{\\(unchanged\\)}\n$$\n\n\\(unfinished';
    assert.equal(math.normalizeForPandoc(input), input);
});

test('nested list math is normalized while indented code stays literal', () => {
    const source = '- Parent\n  - Child\n\n    \\[\n    x^2\n    \\]\n\n    Inline \\(y^3\\).\n\n        \\(code\\)\n';
    assert.equal(math.normalizeForPandoc(source), source.replace('\\[', '$$$$').replace('\\]', '$$$$').replace('\\(y^3\\)', '$y^3$'));
    const fenced = '- Parent\n  ```text\n  \\(code\\)\n  ```\n  Inline \\(x\\)\n';
    assert.equal(math.normalizeForPandoc(fenced), fenced.replace('\\(x\\)', '$x$'));
});

test('an unmatched quoted delimiter cannot consume unrelated content', () => {
    const source = '> \\[\n> unfinished\n\nOutside \\(y\\).\n\n> \\]';
    assert.equal(math.normalizeForPandoc(source), source.replace('\\(y\\)', '$y$'));
});
