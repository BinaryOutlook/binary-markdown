'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../../package.json');

const root = path.join(__dirname, '../..');
const properties = manifest.contributes.configuration.properties;
const translationFiles = () => fs.readdirSync(root).filter(name => /^package\.nls(?:\.[\w-]+)?\.json$/.test(name)).sort();
const readTranslations = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));

function settingsStrings() {
    return Object.values(properties).flatMap(schema => [schema.description, ...(schema.enumDescriptions || [])]);
}

test('every settings description and option explanation uses a manifest translation key', () => {
    for (const text of settingsStrings()) {
        assert.match(text, /^%[\w.]+%$/, `Hard-coded or missing settings text: ${text}`);
    }
    for (const setting of ['language', 'toolbarMode', 'outlineStateScope']) {
        const schema = properties[`binary-markdown.${setting}`];
        assert.equal(schema.enumDescriptions?.length, schema.enum.length, `${setting}: explain every option`);
    }
});

test('manifest translations cover every supported editor language with English as the default', () => {
    const expected = properties['binary-markdown.language'].enum
        .filter(locale => locale !== 'default')
        .map(locale => locale === 'en' ? 'package.nls.json' : `package.nls.${locale.toLowerCase()}.json`)
        .sort();
    assert.deepEqual(translationFiles(), expected);
});

test('all manifest translations resolve every settings key without empty or stale entries', () => {
    const expectedKeys = [...new Set(settingsStrings().map(text => text.slice(1, -1)))].sort();
    // Read the English fallback explicitly so a missing collection cannot pass vacuously.
    const fallback = readTranslations('package.nls.json');
    assert.deepEqual(Object.keys(fallback).sort(), expectedKeys);

    for (const filename of translationFiles()) {
        const translations = readTranslations(filename);
        assert.deepEqual(Object.keys(translations).sort(), expectedKeys, `${filename}: missing or unused keys`);
        for (const key of expectedKeys) {
            assert.equal(typeof translations[key], 'string', `${filename}: ${key}`);
            assert.ok(translations[key].trim(), `${filename}: empty ${key}`);
            assert.doesNotMatch(translations[key], /%[\w.]+%/, `${filename}: unresolved ${key}`);
        }
    }
});
