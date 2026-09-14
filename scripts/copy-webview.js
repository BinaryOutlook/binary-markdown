/**
 * Cross-platform script that copies webview/shared files to out/.
 * Replaces mkdir -p and cp for Windows compatibility.
 *
 * Usage: node scripts/copy-webview.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Create the directories.
fs.mkdirSync(path.join(ROOT, 'out', 'webview'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'out', 'shared'), { recursive: true });

// src/webview/*.js, *.css → out/webview/
const webviewDir = path.join(ROOT, 'src', 'webview');
for (const file of fs.readdirSync(webviewDir)) {
    if (file.endsWith('.js') || file.endsWith('.css')) {
        fs.copyFileSync(
            path.join(webviewDir, file),
            path.join(ROOT, 'out', 'webview', file)
        );
    }
}

// src/shared/*.js → out/shared/
const sharedDir = path.join(ROOT, 'src', 'shared');
for (const file of fs.readdirSync(sharedDir)) {
    if (file.endsWith('.js')) {
        fs.copyFileSync(
            path.join(sharedDir, file),
            path.join(ROOT, 'out', 'shared', file)
        );
    }
}

console.log('  ✓ webview & shared files copied to out/');
