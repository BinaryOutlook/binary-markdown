'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');

const markers = ['__SEARCH_WORKER__', '__MATH_BACKSLASH__', '__DEBUG_MODE__', '__I18N__', '__DOCUMENT_BASE_URI__', '__CONTENT__'];
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

function bundleEditor(root) {
    const outfile = path.join(root, 'out/webview/editor.js');
    const result = esbuild.buildSync({
        absWorkingDir: root, entryPoints: ['src/webview/editor.js'], outfile,
        bundle: true, format: 'iife', platform: 'browser', target: 'es2022',
        minify: false, charset: 'utf8', legalComments: 'inline', keepNames: true,
        metafile: true, logLevel: 'warning'
    });
    const runtime = fs.readFileSync(outfile);
    for (const marker of markers) {
        const count = runtime.toString('utf8').split(marker).length - 1;
        if (count !== 1) throw new Error(`Editor runtime needs exactly one ${marker}; found ${count}.`);
    }
    const inputs = Object.keys(result.metafile.inputs).sort().map(file => ({
        file: file.replace(/\\/g, '/'), sha256: digest(fs.readFileSync(path.join(root, file)))
    }));
    fs.writeFileSync(path.join(root, 'out/webview/editor.bundle.json'), JSON.stringify({
        format: 1, runtimeSha256: digest(runtime), inputs
    }, null, 2) + '\n');
    console.log(`  ✓ editor.js bundled from ${inputs.length} source modules`);
}

function readEditorRuntime(root) {
    const directory = path.join(root, 'out/webview');
    const receiptPath = path.join(directory, 'editor.bundle.json');
    if (!fs.existsSync(receiptPath)) throw new Error('Compile the editor before building browser fixtures: npm run compile.');
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    for (const input of receipt.inputs) {
        if (digest(fs.readFileSync(path.join(root, input.file))) !== input.sha256) {
            throw new Error(`Editor bundle is stale after ${input.file}; run npm run compile.`);
        }
    }
    const runtime = fs.readFileSync(path.join(directory, 'editor.js'));
    if (digest(runtime) !== receipt.runtimeSha256) throw new Error('Editor bundle changed; run npm run compile.');
    return runtime.toString('utf8');
}

if (require.main === module) bundleEditor(path.resolve(__dirname, '..'));
module.exports = { bundleEditor, readEditorRuntime, markers };
