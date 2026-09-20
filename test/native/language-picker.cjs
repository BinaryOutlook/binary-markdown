'use strict';
const assert = require('node:assert/strict');
const body = '  const value = 1;\n\t// β\n\n';
const source = '# Languages\n\n```custom-lang\n' + body + '\n```\n\nEnd marker.\n';

async function languagePickerChecks({ editor, keyboard, save, record, capture = async () => {} }) {
    await editor.evaluate(() => document.getElementById('closeSidebar').click());
    const before = await editor.evaluate(() => window.htmlToMarkdown());
    assert.equal(before, source);
    for (const [query, id] of [['JS', 'javascript'], ['C++', 'cpp'], ['C#', 'csharp'], ['markdown', 'markdown']]) {
        await editor.locator('.code-lang-tag').click();
        assert.equal(await editor.evaluate(() => document.activeElement.getAttribute('role')), 'combobox');
        await keyboard.insertText(query);
        await editor.waitForFunction(id => document.querySelector('.lang-selector-item[aria-selected="true"]')?.dataset.language === id, id);
        await capture('language-' + id);
        await keyboard.press('Escape');
        assert.equal(await editor.evaluate(() => document.querySelector('.lang-selector')), null);
        assert.equal(await editor.evaluate(() => document.activeElement.className), 'code-lang-tag');
        assert.equal(await editor.evaluate(() => document.querySelector('[data-action="undo"]').disabled), true);
        assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), before);
    }
    record('language-search-cancel', { aliases: ['JS', 'C++', 'C#', 'markdown'], autofocus: true, unknownPreserved: true, sourceAndUndoUnchanged: true });
    await editor.locator('.code-lang-tag').click(); await keyboard.insertText('no-such-language');
    assert.equal(await editor.evaluate(() => document.querySelector('.lang-selector-empty').hidden), false);
    await keyboard.press('Enter');
    assert.equal(await editor.evaluate(() => Boolean(document.querySelector('.lang-selector'))), true);
    await keyboard.press('Escape');
    await editor.locator('.code-lang-tag').click(); await keyboard.insertText('cpp'); await keyboard.press('Enter');
    const changed = source.replace('```custom-lang', '```cpp');
    assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), changed);
    await save(changed);
    await editor.locator('[data-action="undo"]').click();
    assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), before);
    assert.equal(await editor.evaluate(() => document.querySelector('[data-action="undo"]').disabled), true);
    await editor.locator('[data-action="redo"]').click();
    assert.equal(await editor.evaluate(() => window.htmlToMarkdown()), changed);
    await save(changed);
    record('language-choice', { language: 'cpp', whitespacePreserved: true, nativeSave: true, oneStepUndo: true, redo: true });
    return changed;
}

module.exports = { source, body, languagePickerChecks };
