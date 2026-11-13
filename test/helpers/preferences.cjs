'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../..');
// Render the production template without starting Electron. IPC is supplied by
// each test; actual desktop storage is covered by the native Preferences check.
const source = ts.transpileModule(fs.readFileSync(path.join(root, 'electron/src/settings-manager.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const exportsObject = {};
vm.runInNewContext(source, {
    exports: exportsObject,
    require(name) {
        if (name === 'electron-store') return class Store {
            constructor({ defaults }) { this.store = { ...defaults }; }
            get(key) { return this.store[key]; }
        };
        if (name === 'electron') return {};
        if (name === './html-generator') return { getResourcePath: value => path.join(root, value) };
        return require(name);
    },
});

function renderPreferences(settings = {}, messages = {}) {
    const manager = new exportsObject.SettingsManager();
    Object.assign(manager.store.store, settings);
    return manager.generateSettingsHtml(messages);
}

module.exports = { renderPreferences };
