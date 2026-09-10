'use strict';

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

module.exports = function bundleMermaid(root, vendor) {
    // The upstream prebuilt IIFE embeds older dependencies than its package
    // manifest. Bundle the ESM entry so the shipped sanitizer matches our lock.
    const result = esbuild.buildSync({
        absWorkingDir: root,
        stdin: { contents: 'import mermaid from "mermaid"; globalThis.mermaid = mermaid;', resolveDir: root },
        outfile: path.join(vendor, 'mermaid.min.js'),
        bundle: true, minify: true, format: 'iife', platform: 'browser',
        target: 'es2020', legalComments: 'eof', metafile: true,
        logLevel: 'warning',
    });
    const packages = new Map();
    for (const input of Object.keys(result.metafile.inputs)) {
        if (!input.includes('node_modules/')) continue;
        let directory = path.dirname(path.resolve(root, input));
        while (directory !== root && !fs.existsSync(path.join(directory, 'package.json'))) {
            const parent = path.dirname(directory);
            if (parent === directory) throw new Error('Cannot locate bundled package: ' + input);
            directory = parent;
        }
        const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
        packages.set(directory, manifest);
    }
    const notices = [];
    const inventory = [];
    const missing = [];
    for (const [directory, manifest] of [...packages].sort((a, b) => a[1].name.localeCompare(b[1].name))) {
        let names = fs.readdirSync(directory).filter(name =>
            /^(licen[cs]e|copying|notice)([.-]|$)/i.test(name) && fs.statSync(path.join(directory, name)).isFile());
        let files = names.map(name => path.join(directory, name));
        // Mermaid 10.9.8's npm tarball omits the repository's MIT license.
        if (!files.length && manifest.name === 'mermaid') {
            files = [path.join(root, 'LICENSES/Mermaid-MIT.txt')];
            names = ['LICENSES/Mermaid-MIT.txt'];
        }
        const repository = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url;
        if (!files.length && /^micromark(?:-|$)/.test(manifest.name) &&
            repository?.includes('github.com/micromark/micromark') && manifest.license === 'MIT') {
            files = [path.join(root, 'LICENSES/micromark-MIT.txt')];
            names = ['LICENSES/micromark-MIT.txt'];
        }
        if (!files.length) { missing.push(manifest.name); continue; }
        notices.push(manifest.name + '@' + manifest.version + '\n' +
            files.map(file => fs.readFileSync(file, 'utf8')).join('\n'));
        inventory.push({ name: manifest.name, version: manifest.version, license: manifest.license, notices: names });
    }
    if (missing.length) throw new Error('Missing licenses for bundled packages: ' + missing.join(', '));
    fs.writeFileSync(path.join(vendor, 'MERMAID-THIRD-PARTY-LICENSES.txt'), notices.join('\n\n---\n\n') + '\n');
    fs.writeFileSync(path.join(vendor, 'MERMAID-DEPENDENCIES.json'), JSON.stringify(inventory, null, 2) + '\n');
    fs.copyFileSync(path.join(root, 'LICENSES/Mermaid-MIT.txt'), path.join(vendor, 'LICENSE-mermaid'));
    console.log('  ✓ mermaid.min.js bundled with locked dependencies and ' + inventory.length + ' package notices');
};
