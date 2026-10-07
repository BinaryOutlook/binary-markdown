'use strict';

// Exercise the actual compiled VS Code HTML generator without requiring VS Code.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

module.exports = function productionWebview(root, content, generation = 7) {
    const filename = path.join(root, 'out/webviewContent.js');
    const module = { exports: {} };
    const realRequire = createRequire(filename);
    const vscode = { Uri: { file: fsPath => ({ fsPath }) } };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        exports: module.exports, module, __dirname: path.dirname(filename), Buffer, console, process: { platform: process.platform },
        require: name => name === 'vscode' ? vscode : realRequire(name)
    }, { filename });
    const html = module.exports.getWebviewContent({
        cspSource: "'self'", asWebviewUri: uri => '/vendor/' + path.basename(uri.fsPath)
    }, { fsPath: root }, content, {
        theme: 'github', fontSize: 16, toolbarMode: 'full', renderGeneration: generation,
        webviewMessages: realRequire('./locales/en.js').webviewMessages
    });
    const nonce = html.match(/<script nonce="([^"]+)"/)[1];
    const bridge = `<script nonce="${nonce}">window.__testApi={messages:[],ready:false};window.acquireVsCodeApi=()=>({postMessage:message=>window.__testApi.messages.push(message),getState:()=>undefined,setState:()=>{}});</script>`;
    return html.replace('<head>', '<head>' + bridge);
};
