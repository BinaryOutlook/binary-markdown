'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const MarkdownIt = require('markdown-it');
const { JSDOM } = require('jsdom');
const manifest = require('../../package.json');
const english = require('../../package.nls.json');

test('the editor command table matches every non-export manifest command in English', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../docs/editor-guide.md'), 'utf8');
    const dom = new JSDOM(new MarkdownIt({ html: true }).render(source));
    const heading = [...dom.window.document.querySelectorAll('h2')].find(node => node.textContent === 'Commands');
    assert.ok(heading, 'Command reference heading is present');
    let table = heading.nextElementSibling;
    while (table && table.tagName !== 'TABLE' && table.tagName !== 'H2') table = table.nextElementSibling;
    assert.equal(table?.tagName, 'TABLE', 'Command reference contains its table');
    const actual = [...table.querySelectorAll('tbody tr td:first-child')].map(cell => cell.textContent.trim()).sort();
    const label = value => /^%(.+)%$/.test(value) ? english[value.slice(1, -1)] : value;
    const expected = manifest.contributes.commands.filter(entry => !entry.command.startsWith('binary-markdown.exportTo'))
        .map(entry => `${label(entry.category)}: ${label(entry.title)}`).sort();
    assert.deepEqual(actual, expected);
    dom.window.close();
});
