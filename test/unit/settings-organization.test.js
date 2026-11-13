'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const manifest = require('../../package.json');
// Behavioral baseline from main before #108; presentation metadata is excluded.
const contract = require('../fixtures/settings-contract.json');
const { configurationProperties } = require('../helpers/settings.cjs');
const { renderPreferences } = require('../helpers/preferences.cjs');

test('grouping preserves every existing setting contract and contributes each key once', () => {
    const groups = manifest.contributes.configuration;
    assert.deepEqual(groups.map(group => group.id), ['editor', 'outline', 'writing', 'images', 'export', 'advanced'].map(id => 'binary-markdown.' + id));
    const keys = groups.flatMap(group => Object.keys(group.properties));
    assert.equal(keys.length, new Set(keys).size);
    assert.deepEqual([...keys].sort(), Object.keys(contract).sort());
    for (const [key, { description, enumDescriptions, enumItemLabels, order, ...behavior }] of Object.entries(configurationProperties(manifest))) {
        assert.deepEqual(behavior, contract[key], key);
        assert.ok(Number.isFinite(order), key + ': explicit display order');
    }
    for (const entries of [groups, ...groups.map(group => Object.values(group.properties))]) {
        assert.ok(entries.every((entry, i) => i === 0 || entry.order > entries[i - 1].order), 'strictly increasing order');
    }
});

test('all supported locales name every category and desktop subsection consistently', () => {
    for (const locale of ['en', 'es', 'fr', 'ja', 'ko', 'zh-cn', 'zh-tw']) {
        const strings = require('../../package.nls' + (locale === 'en' ? '' : '.' + locale) + '.json');
        const { webviewMessages } = require('../../out/locales/' + locale + '.js');
        for (const category of ['Editor', 'Outline', 'Writing', 'Images', 'Export', 'Advanced']) {
            assert.equal(webviewMessages['settings' + category], strings['config.section.' + category.toLowerCase()]);
        }
        const document = new JSDOM(renderPreferences({}, webviewMessages)).window.document;
        assert.deepEqual([...document.querySelectorAll('h3')].map(node => node.textContent), ['Tables', 'Code', 'Equations'].map(key => webviewMessages['settings' + key]));
        assert.equal(document.title, webviewMessages.settingsPreferences);
    }
});

test('desktop renders each supported preference once, with labels, fallback text, and escaped stored paths', () => {
    const storedPath = './images/"<img src=x onerror=alert(1)>&';
    const document = new JSDOM(renderPreferences({ imageDefaultDir: storedPath, editorMaxWidth: 1234, mathSourceWrap: true })).window.document;
    const controls = [...document.querySelectorAll('input, select')];
    const unsupported = new Set(['outlineDefaultOpen', 'outlineStateScope', 'outlineActiveColor', 'math.backslashDelimiters']);
    const supported = Object.keys(contract).map(key => key.replace('binary-markdown.', '')).filter(key => !key.startsWith('export.') && !unsupported.has(key));
    assert.deepEqual(controls.map(node => node.id).sort(), supported.sort());
    for (const control of controls) assert.ok(control.labels.length, control.id + ': accessible label');
    assert.equal(document.querySelector('#imageDefaultDir').value, storedPath);
    assert.equal(document.querySelectorAll('img').length, 0);
    assert.equal(document.querySelector('#editorMaxWidth').value, '1234');
    assert.equal(document.querySelector('#mathSourceWrap').checked, true);
    assert.doesNotMatch(document.body.textContent, /undefined/);
    for (const link of document.querySelectorAll('nav a')) assert.ok(document.querySelector(link.getAttribute('href')));
});
