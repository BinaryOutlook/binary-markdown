'use strict';

// Load the actual Electron generator without requiring the Electron application.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

module.exports = function electronWebview(root, content, overrides = {}) {
    const filename = path.join(root, 'electron/src/html-generator.ts');
    const realRequire = createRequire(filename);
    const module = { exports: {} };
    const source = realRequire('typescript').transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: realRequire('typescript').ModuleKind.CommonJS }
    }).outputText;
    vm.runInNewContext(source, {
        exports: module.exports, module, require: realRequire, Buffer,
        __dirname: path.join(root, 'electron/out'),
        process: { platform: process.platform, resourcesPath: '' },
        console: { log() {}, error() {} }
    }, { filename });
    const html = module.exports.generateEditorHtml(content, {
        theme: 'github', fontSize: 16, toolbarMode: 'full', documentBaseUri: '',
        enableDebugLogging: false,
        webviewMessages: realRequire('../../out/locales/en.js').webviewMessages, ...overrides
    });
    const bridge = fs.readFileSync(path.join(root, 'src/shared/test-host-bridge.js'), 'utf8');
    // Browser tests serve the same vendor bytes over localhost. Keep the generated
    // runtime and inline-script boundaries intact; only adapt resource delivery/CSP.
    return html.replace(/file:\/\/[^"<>]+\/vendor\//g, '/vendor/')
        .replace("script-src 'unsafe-inline' file:", "script-src 'unsafe-inline' 'self' file:")
        .replace("style-src 'unsafe-inline' file:", "style-src 'unsafe-inline' 'self' file:")
        .replace("font-src file: data:", "font-src 'self' file: data:")
        .replace('<head>', '<head><script>' + bridge + '</script>');
};
