'use strict';

// Offline checks for the maintained documentation and curated reports. Frozen
// upstream archives and test input documents are not rewritten or linted here.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = new Set(['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md',
    'media/export-help.md', 'archive/README.md', 'test/fixtures/manual/copy-paste.md']);
function collect(directory) {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
        const name = directory + '/' + entry.name;
        if (entry.isDirectory()) collect(name);
        else if (/\.(?:md|html|json)$/.test(name)) files.add(name);
    }
}
for (const directory of ['docs', 'reports', 'release-notes', 'archive/development']) collect(directory);
for (const entry of fs.readdirSync(path.join(root, 'test/native'))) {
    if (entry.endsWith('.md')) files.add('test/native/' + entry);
}

function prose(text) {
    let fence;
    return text.split('\n').map(line => {
        const match = /^\s*(`{3,}|~{3,})/.exec(line);
        if (match) {
            if (!fence) fence = match[1];
            else if (match[1][0] === fence[0] && match[1].length >= fence.length) fence = undefined;
            return '';
        }
        return fence ? '' : line;
    }).join('\n');
}
const anchorCache = new Map();
function anchors(file) {
    if (anchorCache.has(file)) return anchorCache.get(file);
    const body = prose(fs.readFileSync(path.join(root, file), 'utf8'));
    const result = new Set();
    const duplicates = new Map();
    for (const match of body.matchAll(/^ {0,3}#{1,6}\s+(.+?)(?:\s+#+\s*)?$/gm)) {
        const title = match[1].replace(/<[^>]+>/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
        const slug = title.toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\s-]/gu, '').replace(/\s/g, '-');
        const count = duplicates.get(slug) || 0;
        result.add(slug + (count ? '-' + count : ''));
        duplicates.set(slug, count + 1);
    }
    for (const match of body.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) result.add(match[1]);
    anchorCache.set(file, result);
    return result;
}

const privatePatterns = [
    ['personal home path', /(?:\/(?:Users|home)\/[^\s/]+|[A-Z]:[\\/]Users[\\/][^\s\\/]+)/i],
    ['private key', /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/],
    ['credential token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9_-]{20,})\b/],
    ['personal contact address', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
    ['private network address', /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/],
];
const errors = [];
let links = 0;
for (const file of [...files].sort()) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    if (file.endsWith('.json')) {
        try { JSON.parse(text); } catch { errors.push(file + ': invalid JSON'); }
    }
    text.split('\n').forEach((line, index) => {
        for (const [label, pattern] of privatePatterns) {
            // Never echo a suspected sensitive value into CI logs.
            if (pattern.test(line)) errors.push(`${file}:${index + 1}: possible ${label}`);
        }
    });
    if (!file.endsWith('.md') && !file.endsWith('.html')) continue;
    const body = prose(text).replace(/`+[^`\n]*`+/g, match => ' '.repeat(match.length));
    const matches = [...body.matchAll(/\]\((<[^>]+>|[^\s)]+)(?:\s+["'][^\n]*?["'])?\)/g),
        ...body.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gm),
        ...body.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)];
    for (const match of matches) {
        const target = match[1].replace(/^<|>$/g, '');
        if (/^(?:[a-z][\w+.-]*:|\/)/i.test(target)) continue;
        links++;
        const [name, anchor] = target.split('#');
        const line = body.slice(0, match.index).split('\n').length;
        let resolved, decodedAnchor;
        try {
            resolved = name ? path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURIComponent(name))) : file;
            decodedAnchor = anchor ? decodeURIComponent(anchor) : '';
        } catch {
            errors.push(`${file}:${line}: malformed local link encoding`);
            continue;
        }
        if (resolved.startsWith('../') || !fs.existsSync(path.join(root, resolved))) {
            errors.push(`${file}:${line}: missing local target`);
        } else if (decodedAnchor && resolved.endsWith('.md') && !anchors(resolved).has(decodedAnchor)) {
            errors.push(`${file}:${line}: missing local anchor`);
        }
    }
}
if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
} else {
    console.log(`Documentation checks passed: ${files.size} text files, ${links} local links; no common private-data patterns found.`);
}
