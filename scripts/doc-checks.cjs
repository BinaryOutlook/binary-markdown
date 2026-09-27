'use strict';

const fs = require('node:fs');
const path = require('node:path');
const MarkdownIt = require('markdown-it');
const { JSDOM } = require('jsdom');

// This allowlist is the maintained-document contract, not an exhaustive scan.
// Keep it in sync with docs/documentation-standard.md and its fixture tests.
const rootFiles = ['AGENTS.md', 'README.md', 'CONTRIBUTING.md', 'CHANGELOG.md',
    'media/export-help.md', 'archive/README.md', 'test/fixtures/manual/copy-paste.md'];
const trees = ['docs', 'reports', 'release-notes', 'archive/development'];
const privatePatterns = [
    ['personal home path', /(?:\/(?:Users|home)\/[^\s/]+|[A-Z]:[\\/]Users[\\/][^\s\\/]+)/i],
    ['private key', /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/],
    ['credential token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9_-]{20,})\b/],
    ['personal contact address', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
    ['private network address', /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/],
];

function maintainedFiles(root) {
    const files = new Set(rootFiles.filter(file => fs.existsSync(path.join(root, file))));
    function collect(directory, recursive = true) {
        if (!fs.existsSync(path.join(root, directory))) return;
        for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
            const file = directory + '/' + entry.name;
            if (recursive && entry.isDirectory()) collect(file);
            else if (entry.isFile() && (recursive ? /\.(?:md|html|json)$/ : /\.md$/).test(file)) files.add(file);
        }
    }
    trees.forEach(directory => collect(directory));
    collect('test/native', false);
    return [...files].sort();
}

function htmlReferences(text, firstLine = 1) {
    // Scripts and external resources are never enabled when inspecting HTML.
    const dom = new JSDOM(text, { includeNodeLocations: true });
    const anchors = new Set();
    const links = [];
    for (const element of dom.window.document.querySelectorAll('[id], a[name], [href], [src]')) {
        if (element.hasAttribute('id')) anchors.add(element.getAttribute('id'));
        if (element.tagName === 'A' && element.hasAttribute('name')) anchors.add(element.getAttribute('name'));
        const location = dom.nodeLocation(element);
        for (const attribute of ['href', 'src']) {
            if (element.hasAttribute(attribute)) links.push({
                target: element.getAttribute(attribute),
                line: firstLine + (location?.attrs?.[attribute]?.startLine || location?.startLine || 1) - 1
            });
        }
    }
    dom.window.close();
    return { anchors, links };
}

function headingText(tokens) {
    return tokens.map(token => {
        if (token.type === 'text' || token.type === 'code_inline') return token.content;
        if (token.type === 'softbreak' || token.type === 'hardbreak') return ' ';
        return token.children ? headingText(token.children) : '';
    }).join('');
}

function markdownReferences(text) {
    const markdown = new MarkdownIt({ html: true });
    const environment = {};
    const tokens = markdown.parse(text, environment);
    const links = [];
    const anchors = new Set();
    const headingSlugs = new Set();
    // Source positions survive parsing for Markdown links. Rendered HTML then
    // supplies real IDs/HTML attributes without reading escaped code examples.
    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        const line = (token.map?.[0] || 0) + 1;
        if (token.type === 'heading_open') {
            const title = headingText(tokens[index + 1].children || []);
            const base = title.toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\s-]/gu, '').replace(/\s/g, '-');
            let slug = base, suffix = 0;
            while (headingSlugs.has(slug)) slug = base + '-' + (++suffix);
            headingSlugs.add(slug);
            anchors.add(slug);
        }
        function inline(children) {
            for (const child of children || []) {
                const attribute = child.type === 'link_open' ? 'href' : child.type === 'image' ? 'src' : undefined;
                if (attribute) {
                    links.push({ target: child.attrGet(attribute), line });
                }
                inline(child.children);
            }
        }
        inline(token.children);
    }
    // Their destinations are already collected above. Suppress only generated
    // link/image tags so author-written HTML cannot impersonate a skip marker.
    markdown.renderer.rules.link_open = () => '<span>';
    markdown.renderer.rules.link_close = () => '</span>';
    markdown.renderer.rules.image = () => '';
    const dom = new JSDOM(markdown.renderer.render(tokens, markdown.options, environment));
    for (const element of dom.window.document.querySelectorAll('[id], a[name], [href], [src]')) {
        if (element.hasAttribute('id')) anchors.add(element.getAttribute('id'));
        if (element.tagName === 'A' && element.hasAttribute('name')) anchors.add(element.getAttribute('name'));
        for (const attribute of ['href', 'src']) {
            if (element.hasAttribute(attribute)) links.push({ target: element.getAttribute(attribute) });
        }
    }
    dom.window.close();
    // Retain checks of unused reference definitions; markdown-it has already
    // excluded definitions inside code blocks. Their diagnostics are file-level.
    for (const reference of Object.values(environment.references || {})) {
        if (!links.some(link => link.target === reference.href)) links.push({ target: reference.href });
    }
    return { anchors, links };
}

function checkDocumentation(root) {
    const files = maintainedFiles(root);
    const errors = [];
    const parsed = new Map();
    let links = 0;
    function references(file) {
        if (!parsed.has(file)) {
            const text = fs.readFileSync(path.join(root, file), 'utf8');
            parsed.set(file, file.endsWith('.html') ? htmlReferences(text) : markdownReferences(text));
        }
        return parsed.get(file);
    }
    for (const file of files) {
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
        if (!/\.(?:md|html)$/.test(file)) continue;
        for (const link of references(file).links) {
            const target = link.target;
            if (/^(?:[a-z][\w+.-]*:|\/)/i.test(target)) continue;
            links++;
            const location = file + (link.line ? ':' + link.line : '');
            const hash = target.indexOf('#');
            const name = (hash < 0 ? target : target.slice(0, hash)).split('?')[0];
            const fragment = hash < 0 ? '' : target.slice(hash + 1);
            let resolved, anchor;
            try {
                const decoded = decodeURIComponent(name);
                resolved = decoded ? path.posix.normalize(path.posix.join(path.posix.dirname(file), decoded)) : file;
                anchor = decodeURIComponent(fragment);
            } catch {
                errors.push(location + ': malformed local link encoding');
                continue;
            }
            const absolute = path.resolve(root, resolved);
            const relative = path.relative(root, absolute);
            if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) || !fs.existsSync(absolute)) {
                errors.push(location + ': missing local target');
            } else if (anchor && /\.(?:md|html)$/.test(resolved) && !references(resolved).anchors.has(anchor)) {
                errors.push(location + ': missing local anchor');
            }
        }
    }
    return { files, links, errors };
}

module.exports = { maintainedFiles, markdownReferences, htmlReferences, checkDocumentation };
