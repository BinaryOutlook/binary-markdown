const test = require('node:test');
const assert = require('node:assert/strict');
const { createBlockCodec } = require('../../src/webview/editor/codec/blocks');

function paragraph(content, dataset = {}) {
    return {
        nodeType: 1, tagName: 'P', content, dataset, innerHTML: content,
        classList: { contains: () => false },
    };
}

function fixture(overrides = {}) {
    const state = { imageDir: null, forceRelative: null, sequence: 0 };
    const editor = { childNodes: [paragraph('alpha')] };
    const document = { documentElement: { dataset: { tableSourceFormat: 'readable' } } };
    const sentinels = new WeakSet();
    const codec = createBlockCodec({
        document, editor, logger: { log() {} }, codeBlocksWithSentinel: sentinels,
        mdGetInlineMarkdown: node => node.content,
        parseInline: text => text,
        mathBackslashDelimiters: true,
        getCurrentImageDir: () => state.imageDir,
        getCurrentForceRelativePath: () => state.forceRelative,
        nextSourceBlockSequence: () => ++state.sequence,
        ...overrides,
    });
    return { codec, state, editor, document, sentinels };
}

test('block serialization keeps retained source and drops deleted predecessor separators', () => {
    const f = fixture();
    const encode = encodeURIComponent;
    const first = paragraph('alpha', {
        mdId: 'one', mdPrevious: '', mdBefore: encode(''),
        mdSource: encode('alpha'), mdCanonical: encode('alpha'),
    });
    const second = paragraph('beta gamma', {
        mdId: 'two', mdPrevious: 'one', mdBefore: encode('\n\n\n'),
        mdSource: encode('beta\ngamma'), mdCanonical: encode('beta gamma'),
        mdTrailing: encode('\n\n'),
    });
    assert.equal(f.codec.serializeMarkdownBlocks({ childNodes: [first, second] }), 'alpha\n\n\nbeta\ngamma\n\n');
    assert.equal(f.codec.serializeMarkdownBlocks({ childNodes: [second] }), 'beta\ngamma\n\n');
    second.content = 'edited';
    assert.equal(f.codec.serializeMarkdownBlocks({ childNodes: [second] }), 'edited\n\n');
});

test('document directives are read from their owner after codec construction', () => {
    const f = fixture();
    assert.equal(f.codec.htmlToMarkdown(), 'alpha\n');
    f.state.imageDir = './images';
    f.state.forceRelative = true;
    assert.equal(f.codec.htmlToMarkdown(), 'alpha\n\n---\nIMAGE_DIR: ./images\nFORCE_RELATIVE_PATH: true');
    f.state.imageDir = null;
    f.state.forceRelative = false;
    assert.equal(f.codec.htmlToMarkdown(), 'alpha\n\n---\nFORCE_RELATIVE_PATH: false');
    f.state.forceRelative = null;
    assert.equal(f.codec.htmlToMarkdown(), 'alpha\n');
});

test('code serialization reads the same live sentinel set as code editing', () => {
    const f = fixture();
    const owner = {};
    const code = { getAttribute: () => 'true' };
    assert.equal(f.codec.stripTrailingNewlines('tail\n\n', code, owner), 'tail\n');
    f.sentinels.add(owner);
    assert.equal(f.codec.stripTrailingNewlines('tail\n\n', code, owner), 'tail');
    f.sentinels.delete(owner);
    assert.equal(f.codec.stripTrailingNewlines('tail\n\n', code, owner), 'tail\n');
});

test('unchanged table source survives preference changes until cell content changes', () => {
    const formats = [];
    const f = fixture({ formatTable: (...args) => { formats.push(args); return 'formatted table\n'; } });
    const text = { nodeType: 3, textContent: 'A|B' };
    const cell = { childNodes: [text], dataset: {}, style: {} };
    const row = { querySelectorAll: () => [cell] };
    const table = { dataset: {}, querySelectorAll: () => [row] };
    f.codec.rememberTableSource(table, '| unusual source |\n');
    f.document.documentElement.dataset.tableSourceFormat = 'compact';
    assert.equal(f.codec.mdProcessTable(table), '| unusual source |\n');
    assert.equal(formats.length, 0);
    text.textContent = 'changed|cell';
    assert.equal(f.codec.mdProcessTable(table), 'formatted table\n');
    assert.deepEqual(formats, [[[['changed\\|cell']], ['left'], 'compact', [false]]]);
    assert.equal(f.codec.mdProcessTable(table), 'formatted table\n');
    assert.equal(formats.length, 1);
});

test('detached block rendering shares parser options without allocating live source identities', () => {
    const calls = [];
    const f = fixture({ parseBlocks: (...args) => {
        calls.push(args);
        return { blocks: [{ type: 'paragraph', children: [{ type: 'inline', content: 'alpha' }] }] };
    } });
    assert.equal(f.codec.markdownToHtmlFragment('alpha', true), '<p>alpha</p>');
    assert.deepEqual(calls, [['alpha', { backslashDelimiters: true }]]);
    assert.equal(f.state.sequence, 0);
});
