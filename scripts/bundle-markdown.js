'use strict';

const fs = require('fs');
const path = require('path');

module.exports = function bundleMarkdown(root, vendor) {
    const result = require('esbuild').buildSync({
        absWorkingDir: root, entryPoints: ['src/shared/markdown-blocks.js'],
        outfile: path.join(vendor, 'markdown-blocks.js'), globalName: 'BinaryMarkdownBlocks',
        bundle: true, minify: true, format: 'iife', platform: 'browser',
        target: 'es2020', legalComments: 'eof', metafile: true, logLevel: 'warning'
    });
    const packages = new Map();
    for (const input of Object.keys(result.metafile.inputs)) {
        if (!input.includes('node_modules/')) continue;
        let directory = path.dirname(path.resolve(root, input));
        let manifest;
        while (true) {
            const file = path.join(directory, 'package.json');
            if (fs.existsSync(file)) {
                manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (manifest.name) break;
            }
            const parent = path.dirname(directory);
            if (parent === directory) throw new Error('Missing package metadata for ' + input);
            directory = parent;
        }
        packages.set(directory, manifest);
    }
    const notices = [], inventory = [];
    for (const [directory, manifest] of [...packages].sort((a, b) => a[1].name.localeCompare(b[1].name))) {
        const names = fs.readdirSync(directory).filter(name => /^(licen[cs]e|copying|notice)([.-]|$)/i.test(name) && fs.statSync(path.join(directory, name)).isFile());
        if (!names.length) throw new Error('Missing bundled license for ' + manifest.name);
        notices.push(manifest.name + '@' + manifest.version + '\n' + names.map(name => fs.readFileSync(path.join(directory, name), 'utf8')).join('\n'));
        inventory.push({ name: manifest.name, version: manifest.version, license: manifest.license, notices: names });
    }
    fs.writeFileSync(path.join(vendor, 'MARKDOWN-THIRD-PARTY-LICENSES.txt'), notices.join('\n\n---\n\n') + '\n');
    fs.writeFileSync(path.join(vendor, 'MARKDOWN-DEPENDENCIES.json'), JSON.stringify(inventory, null, 2) + '\n');
    console.log('  ✓ semantic Markdown parser bundled with ' + inventory.length + ' package notices');
};
