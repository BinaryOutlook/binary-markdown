/**
 * Copies dependencies into the local bundle to avoid loading them from a CDN.
 * Copies files from node_modules/ to vendor/.
 *
 * Usage: node scripts/copy-vendor.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VENDOR = path.join(ROOT, 'vendor');
const NODE_MODULES = path.join(ROOT, 'node_modules');

// Create the vendor/ directory.
fs.mkdirSync(VENDOR, { recursive: true });
fs.mkdirSync(path.join(VENDOR, 'fonts'), { recursive: true });

// Files to copy.
const files = [
    { src: 'turndown/dist/turndown.js', dest: 'turndown.js' },
    { src: 'turndown-plugin-gfm/dist/turndown-plugin-gfm.js', dest: 'turndown-plugin-gfm.js' },
    { src: 'katex/dist/katex.min.js', dest: 'katex.min.js' },
    { src: 'katex/dist/katex.min.css', dest: 'katex.min.css' },
];

for (const { src, dest } of files) {
    const srcPath = path.join(NODE_MODULES, src);
    const destPath = path.join(VENDOR, dest);
    fs.copyFileSync(srcPath, destPath);
    const size = (fs.statSync(destPath).size / 1024).toFixed(1);
    console.log(`  ✓ ${dest} (${size} KB)`);
}

require('./bundle-mermaid')(ROOT, VENDOR);

// Copy only KaTeX WOFF2 fonts; omit the legacy WOFF and TTF variants.
const katexFontsDir = path.join(NODE_MODULES, 'katex/dist/fonts');
const fontFiles = fs.readdirSync(katexFontsDir).filter(f => f.endsWith('.woff2'));
let totalFontSize = 0;
for (const font of fontFiles) {
    const srcPath = path.join(katexFontsDir, font);
    const destPath = path.join(VENDOR, 'fonts', font);
    fs.copyFileSync(srcPath, destPath);
    totalFontSize += fs.statSync(destPath).size;
}
console.log(`  ✓ fonts/ (${fontFiles.length} woff2 files, ${(totalFontSize / 1024).toFixed(1)} KB)`);

// Remove WOFF and TTF references from KaTeX CSS, retaining WOFF2.
const katexCssPath = path.join(VENDOR, 'katex.min.css');
let css = fs.readFileSync(katexCssPath, 'utf8');
// Remove the additional url(...) entries for WOFF and TTF fonts.
css = css.replace(/,url\(fonts\/[^)]+\.woff\)\s*format\("woff"\)/g, '');
css = css.replace(/,url\(fonts\/[^)]+\.ttf\)\s*format\("truetype"\)/g, '');
fs.writeFileSync(katexCssPath, css);
console.log('  ✓ katex.min.css (stripped woff/ttf references)');

// Copy the MIT license files.
const licenses = [
    { pkg: 'turndown', dest: 'LICENSE-turndown' },
    { pkg: 'turndown-plugin-gfm', dest: 'LICENSE-turndown-plugin-gfm' },
    { pkg: 'katex', dest: 'LICENSE-katex' },
];
for (const { pkg, dest } of licenses) {
    const srcPath = path.join(NODE_MODULES, pkg, 'LICENSE');
    const destPath = path.join(VENDOR, dest);
    fs.copyFileSync(srcPath, destPath);
}
console.log(`  ✓ LICENSE files (${licenses.length} packages)`);

// The VSIX excludes node_modules. Ship the control library, never browser binaries.
const playwrightPackage = path.join(NODE_MODULES, 'playwright-core');
const playwrightTarget = path.join(VENDOR, 'playwright-core');
fs.rmSync(playwrightTarget, { recursive: true, force: true });
fs.cpSync(playwrightPackage, playwrightTarget, { recursive: true });
console.log('  ✓ playwright-core (browser control only; installed browser required)');

console.log('\nVendor copy complete.');
