'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { substituteEditorScript } = require('../../src/shared/editor-script-values');

const script = 'globalThis.values = [__SEARCH_WORKER__, __MATH_BACKSLASH__, __DEBUG_MODE__, __I18N__, __DOCUMENT_BASE_URI__, __CONTENT__];';
const values = () => ({
    __SEARCH_WORKER__: 'self.onmessage = () => {};',
    __MATH_BACKSLASH__: true,
    __DEBUG_MODE__: false,
    __I18N__: { label: 'Example' },
    __DOCUMENT_BASE_URI__: 'file:///tmp/example/',
    __CONTENT__: 'ZXhhbXBsZQ=='
});

test('editor values round trip through JavaScript with hostile strings and marker-like data', () => {
    const hostile = ['"', "'", '\\', '</script><script>globalThis.__probe = 1</script>', '$&', "$'", '$\u0060', '__CONTENT__', '__DEBUG_MODE__', '\n'].join(' ');
    const input = values();
    input.__SEARCH_WORKER__ = hostile + '__SEARCH_WORKER__';
    input.__I18N__ = { label: hostile, nested: { flag: true, value: null } };
    input.__DOCUMENT_BASE_URI__ = 'file:///tmp/example"+(globalThis.__probe=1)+"/' + hostile;
    input.__CONTENT__ = hostile + '__I18N__';
    const output = substituteEditorScript(script, input);
    const context = { __probe: 0 };
    vm.runInNewContext(output, context);
    assert.deepEqual(JSON.parse(JSON.stringify(context.values)), Object.values(input));
    assert.equal(context.__probe, 0);
    assert.ok(!output.includes('</script>'));
    assert.ok(output.includes('\\u003c/script>'));
});

test('replacement stays in one pass and preserves literal replacement tokens', () => {
    const input = values();
    input.__CONTENT__ = '__DOCUMENT_BASE_URI__ $& $\' $\u0060';
    input.__DOCUMENT_BASE_URI__ = 'file:///tmp/quoted"and\'backslash\\/';
    const context = {};
    vm.runInNewContext(substituteEditorScript('globalThis.result = __CONTENT__;', input), context);
    assert.equal(context.result, input.__CONTENT__);
});

test('missing and inherited editor values refuse substitution', () => {
    const input = values();
    delete input.__CONTENT__;
    assert.throws(() => substituteEditorScript(script, input), /Missing.*__CONTENT__/);
    assert.throws(() => substituteEditorScript('const value = __CONTENT__;', Object.create(values())), /Missing.*__CONTENT__/);
    assert.throws(() => substituteEditorScript('const value = __CONTENT__;', null), /Missing.*__CONTENT__/);
});

test('undefined and other values with no JSON encoding refuse substitution', () => {
    for (const value of [undefined, () => {}, Symbol('value'), { toJSON: () => undefined }]) {
        assert.throws(() => substituteEditorScript('const value = __CONTENT__;', { __CONTENT__: value }), /cannot be encoded.*__CONTENT__/);
    }
});
