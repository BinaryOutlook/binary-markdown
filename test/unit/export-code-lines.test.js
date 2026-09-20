const assert = require('node:assert/strict');
const test = require('node:test');
const { logicalCodeLines, pandocCodeLines } = require('../../out/export/code-lines');

test('logical code lines preserve authored whitespace and distinguish empty from blank', () => {
    const cases = [
        ['', 0, []], ['', 1, ['']], ['one', 0, ['one']],
        ['\n', 0, ['', '']], ['\n\tλ <&>  \n\n', 0, ['', '\tλ <&>  ', '', '']],
        ['a\n\nb', 0, ['a', '', 'b']], ['x'.repeat(10000), 0, ['x'.repeat(10000)]]];
    for (const [payload, emptyCount, expected] of cases) {
        assert.deepEqual(logicalCodeLines(payload, emptyCount), expected);
        assert.equal(expected.join('\n'), payload);
    }
    assert.throws(() => logicalCodeLines('', 2), /zero or one/);
});

test('source ranges separate empty fences from one authored blank line in nested containers', () => {
    for (const prefix of ['', '> ', '  ']) {
        const column = prefix.length + 1;
        for (const count of [0, 1]) {
            const source = [prefix + '```', ...Array(count).fill(prefix), prefix + '```', ''].join('\n');
            assert.equal(pandocCodeLines('', source, ['1:1-99:1', `1:${column}-${count + 3}:1`]).length, count);
        }
    }
    assert.deepEqual(pandocCodeLines('', '```\n', ['1:1-3:1']), []);
    assert.deepEqual(pandocCodeLines('\n', '```\n\n', ['1:1-4:1']), ['']);
    assert.deepEqual(pandocCodeLines('foo\n\n', '```\nfoo\n\n', ['1:1-5:1']), ['foo', '']);
});
