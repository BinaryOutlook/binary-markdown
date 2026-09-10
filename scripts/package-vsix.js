'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createHash } = require('crypto');
const { buildIdentity, assertReleaseIdentity } = require('./build-identity');
const manifest = require('../package.json');

const root = path.join(__dirname, '..');
const options = process.argv.slice(2);
if (options.some(value => value !== '--release')) throw new Error('Usage: npm run package -- [--release]');
const identity = buildIdentity(root);
if (options.includes('--release')) assertReleaseIdentity(identity);
fs.writeFileSync(path.join(root, 'build-info.json'), JSON.stringify(identity, null, 2) + '\n');
const output = path.join(root, 'dist', `${manifest.name}-${manifest.version}.vsix`);
fs.mkdirSync(path.dirname(output), { recursive: true });

// Run the locally pinned CLI through Node, including on Windows. vsce invokes
// vscode:prepublish, which assembles this project's vendored runtime assets.
const result = spawnSync(process.execPath, [
    require.resolve('@vscode/vsce/vsce'),
    'package', '--no-dependencies', '--out', output,
    // Development builds identify their actual source rather than a version tag.
    '--githubBranch', identity.sourceCommit || 'main',
    ...(identity.repository ? [
        '--baseContentUrl', identity.repository + '/blob/' + (identity.sourceCommit || 'main'),
        '--baseImagesUrl', identity.repository + '/raw/' + (identity.sourceCommit || 'main'),
    ] : []),
], { cwd: root, stdio: 'inherit' });

if (result.error) {
    console.error(result.error.message);
}
if (result.status === 0 && !result.error) {
    const digest = createHash('sha256').update(fs.readFileSync(output)).digest('hex');
    fs.writeFileSync(output + '.sha256', digest + '  ' + path.basename(output) + '\n');
    fs.writeFileSync(output + '.build-info.json', JSON.stringify({ ...identity, sha256: digest, artifact: path.basename(output) }, null, 2) + '\n');
    console.log('Source: ' + (identity.sourceCommit || 'unknown') + '; local changes: ' + String(identity.dirty));
    console.log('SHA-256: ' + digest);
}
process.exit(result.status ?? 1);
