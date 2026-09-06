'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const manifest = require('../package.json');

const root = path.join(__dirname, '..');
const output = path.join(root, 'dist', `${manifest.name}-${manifest.version}.vsix`);
fs.mkdirSync(path.dirname(output), { recursive: true });

// Run the locally pinned CLI through Node, including on Windows. vsce invokes
// vscode:prepublish, which assembles this project's vendored runtime assets.
const result = spawnSync(process.execPath, [
    require.resolve('@vscode/vsce/vsce'),
    'package', '--no-dependencies', '--out', output,
    // Keep installed documentation links tied to the matching release source.
    '--githubBranch', `v${manifest.version}`,
], { cwd: root, stdio: 'inherit' });

if (result.error) {
    console.error(result.error.message);
}
process.exit(result.status ?? 1);
