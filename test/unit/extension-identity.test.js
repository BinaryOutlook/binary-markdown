'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const manifest = require('../../package.json');
const upstream = require('../../archive/upstream-any-markdown/package.json');

test('the compiled extension activates alongside upstream registrations and wires every declared command', () => {
    const commands = new Map(upstream.contributes.commands.map(entry => [entry.command, () => {}]));
    const editors = new Set(upstream.contributes.customEditors.map(entry => entry.viewType));
    const addedCommands = [];
    const addedEditors = [];
    const configurationReads = [];
    const disposable = { dispose() {} };
    const vscode = {
        workspace: {
            getConfiguration(section) {
                configurationReads.push(section);
                return { get: (_key, fallback) => fallback };
            },
        },
        env: { language: 'en' },
        commands: {
            registerCommand(id, callback) {
                assert.equal(commands.has(id), false, `Command collision: ${id}`);
                commands.set(id, callback);
                addedCommands.push(id);
                return disposable;
            },
        },
        window: {
            registerCustomEditorProvider(id) {
                assert.equal(editors.has(id), false, `Editor collision: ${id}`);
                editors.add(id);
                addedEditors.push(id);
                return disposable;
            },
        },
    };
    const compiled = fs.readFileSync(path.join(__dirname, '../../out/extension.js'), 'utf8');
    const exports = {};
    vm.runInNewContext(compiled, {
        exports,
        console: { log() {} },
        require(id) {
            if (id === 'vscode') return vscode;
            if (id === './editorProvider') return { BinaryMarkdownEditorProvider: class {} };
            if (id === './i18n/messages') return { initLocale() {}, t: key => key };
            throw new Error(`Unexpected activation dependency: ${id}`);
        },
    });
    exports.activate({ subscriptions: [] });
    assert.deepEqual(addedCommands.sort(), manifest.contributes.commands.map(entry => entry.command).sort());
    assert.deepEqual(addedEditors, ['binary-markdown.editor']);
    assert.deepEqual(configurationReads, ['binary-markdown']);
});

test('menus and shortcuts resolve to declared commands and stay scoped to the optional Binary editor', () => {
    const commands = new Set(manifest.contributes.commands.map(entry => entry.command));
    for (const menu of Object.values(manifest.contributes.menus)) {
        for (const item of menu) assert.ok(commands.has(item.command), item.command);
    }
    for (const binding of manifest.contributes.keybindings) {
        assert.ok(commands.has(binding.command), binding.command);
        assert.equal(binding.when, "activeCustomEditorId == 'binary-markdown.editor'");
    }
    assert.equal(manifest.contributes.customEditors[0].priority, 'option');
    assert.equal(manifest.contributes.configurationDefaults?.['workbench.editorAssociations'], undefined);
});

test('settings retain their defaults without sharing any upstream keys', () => {
    const current = manifest.contributes.configuration.properties;
    const original = upstream.contributes.configuration.properties;
    // Presentation text may be translated independently of the setting's behavior.
    const behavior = ({ description, enumDescriptions, ...schema }) => schema;
    for (const [oldKey, schema] of Object.entries(original)) {
        assert.equal(oldKey in current, false);
        assert.deepEqual(behavior(current[oldKey.replace('any-markdown.', 'binary-markdown.')]), behavior(schema));
    }
    assert.equal(current['binary-markdown.outlineStateScope'].default, 'file');
    assert.equal(current['binary-markdown.outlineDefaultOpen'].default, true);
    assert.notEqual(`${manifest.publisher}.${manifest.name}`.toLowerCase(), `${upstream.publisher}.${upstream.name}`.toLowerCase());
});
