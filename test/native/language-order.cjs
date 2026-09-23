'use strict';
const assert = require('node:assert/strict');
const { source } = require('./language-picker.cjs');
const curated = ['plaintext', 'markdown', 'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'bash', 'shell', 'json', 'yaml', 'html', 'css', 'sql', 'dockerfile', 'php', 'ruby', 'swift', 'kotlin', 'xml', 'mermaid', 'math'];
const alphabetical = ['bash', 'c', 'csharp', 'cpp', 'css', 'dockerfile', 'go', 'html', 'java', 'javascript', 'json', 'kotlin', 'markdown', 'math', 'mermaid', 'php', 'plaintext', 'python', 'ruby', 'rust', 'shell', 'sql', 'swift', 'typescript', 'xml', 'yaml'];

async function languageOrderChecks({ editor, keyboard, set, record }) {
    const ids = () => editor.evaluate(() => [...document.querySelectorAll('[role="option"]')].map(node => node.dataset.language));
    assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), source);
    await editor.evaluate(() => { window.__orderCode = document.querySelector('pre code'); });
    for (const [mode, expected] of [['default', curated], ['a-z', alphabetical], ['z-a', [...alphabetical].reverse()]]) {
        await set(mode);
        await editor.waitForFunction(mode => document.documentElement.dataset.codeLanguageOrder === mode, mode);
        await editor.locator('.code-lang-tag').click(); assert.deepEqual(await ids(), expected);
        await keyboard.insertText('java'); assert.deepEqual(await ids(), ['java', 'javascript']);
        await keyboard.press('Escape');
        assert.equal(await editor.evaluate(() => document.querySelector('[data-action="undo"]').disabled), true);
        assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), source);
    }
    await set('default'); await editor.locator('.code-lang-tag').click(); await keyboard.insertText('script');
    await keyboard.press('ArrowDown');
    await editor.evaluate(() => document.querySelector('.lang-selector-search').setSelectionRange(1, 4));
    await set('z-a');
    await editor.waitForFunction(() => document.documentElement.dataset.codeLanguageOrder === 'z-a');
    assert.deepEqual(await ids(), ['typescript', 'javascript']);
    assert.deepEqual(await editor.evaluate(() => {
        const input = document.querySelector('.lang-selector-search');
        return [input.value, input.selectionStart, input.selectionEnd, document.querySelector('[aria-selected="true"]').dataset.language];
    }), ['script', 1, 4, 'typescript']);
    assert.equal(await editor.evaluate(() => window.__orderCode === document.querySelector('pre code')), true);
    await keyboard.press('Escape');
    assert.equal(await editor.evaluate(() => document.querySelector('[data-action="undo"]').disabled), true);
    assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), source);
    record('language-order', { completeOrders: 3, relevanceBeforeOrder: true, activeQueryAndSelectionPreserved: true, originalDOMRetained: true, sourceAndUndoUnchanged: true });
}
module.exports = { source, curated, alphabetical, languageOrderChecks };
