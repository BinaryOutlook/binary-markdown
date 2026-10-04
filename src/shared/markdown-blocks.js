'use strict';

const MarkdownIt = require('markdown-it/lib/index.mjs').default;
const math = require('./math-syntax');
const documentAux = require('./document-aux');

// Block structure and source layout are separate. Blank separators are source
// slices, never empty document paragraphs or hidden editable DOM nodes.
const parser = new MarkdownIt({ html: false, linkify: false, typographer: false });
// References stay literal until the editor's inline renderer supports them;
// consuming definitions here would hide user content without rendering links.
parser.block.ruler.disable('reference');
// The editor has always authored nested empty items as an indented "- ".
// Prefer that editing position over a setext underline inside a list.
const setext = require('markdown-it/lib/rules_block/lheading.mjs').default;
parser.block.ruler.at('lheading', (state, start, end, silent) => {
    if (state.parentType === 'list' && start + 1 < end &&
        /^ *- *$/.test(state.getLines(start + 1, start + 2, state.blkIndent, false))) return false;
    return setext(state, start, end, silent);
});
const list = require('markdown-it/lib/rules_block/list.mjs').default;
parser.block.ruler.at('list', (state, start, end, silent) => {
    const parent = state.parentType;
    if (silent && parent === 'paragraph' && state.listIndent >= 0 &&
        /^ *(?:[-+*]|\d+[.)]) *$/.test(state.getLines(start, start + 1, state.blkIndent, false))) {
        state.parentType = 'list';
    }
    try { return list(state, start, end, silent); }
    finally { state.parentType = parent; }
}, { alt: ['paragraph', 'reference', 'blockquote'] });
const fence = require('markdown-it/lib/rules_block/fence.mjs').default;
parser.block.ruler.at('fence', (state, start, end, silent) => {
    if (!fence(state, start, end, silent)) return false;
    if (!silent) {
        const token = state.tokens[state.tokens.length - 1];
        const count = token.content ? token.content.replace(/\n$/, '').split('\n').length : 0;
        const indent = new RegExp('^ {0,' + state.sCount[start] + '}');
        const lines = [];
        for (let i = start + 1; i <= start + count; i++) {
            // Fence indentation removes spaces, never a literal payload tab.
            lines.push(state.getLines(i, i + 1, 0, false).replace(indent, ''));
        }
        token.content = lines.join('\n') + (count ? '\n' : '');
    }
    return true;
}, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
parser.block.ruler.before('fence', 'binary_math', (state, start, end, silent) => {
    if (state.sCount[start] - state.blkIndent >= 4) return false;
    const first = state.getLines(start, start + 1, state.blkIndent, false);
    if (!/^ *(?:\$\$|\\\[)/.test(first)) return false;
    const lines = [];
    for (let i = start; i < end; i++) {
        if (i > start && state.sCount[i] < state.blkIndent && !state.isEmpty(i)) break;
        lines.push(state.getLines(i, i + 1, state.blkIndent, false));
    }
    const equation = math.display(lines, 0, state.env.backslashDelimiters !== false);
    if (!equation) return false;
    if (silent) return true;
    const token = state.push('binary_math', 'div', 0);
    token.map = [start, start + equation.end];
    token.meta = equation;
    state.line = start + equation.end;
    return true;
}, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });

parser.block.ruler.before('fence', 'binary_aux', (state, start, end, silent) => {
    const block = state.env.auxiliary.get(start);
    if (!block || state.blkIndent || state.parentType === 'blockquote') return false;
    if (silent) return true;
    const token = state.push('binary_aux', 'div', 0);
    token.map = [start, block.endLine];
    token.content = block.raw;
    state.line = block.endLine;
    return true;
}, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });

// Empty standalone anchors are navigation metadata, not arbitrary HTML.
// Require quoted id/name attributes; reject payloads and all other attributes.
function parseAnchor(line) {
    const match = /^<a\b([^<>]*)>[ \t]*<\/a[ \t]*>$/i.exec(line.trim());
    if (!match) return null;
    let rest = match[1];
    const attrs = {};
    while (rest.trim()) {
        const attribute = /^[ \t]+(id|name)[ \t]*=[ \t]*(["'])(.*?)\2/i.exec(rest);
        if (!attribute) return null;
        const name = attribute[1].toLowerCase();
        if (Object.hasOwn(attrs, name) || /[\\\x00-\x1f]/.test(attribute[3])) return null;
        const value = parser.utils.unescapeAll(attribute[3]);
        if (!value || /[\s<>\x00-\x1f]/.test(value)) return null;
        attrs[name] = value;
        rest = rest.slice(attribute[0].length);
    }
    return Object.keys(attrs).length ? attrs : null;
}

parser.block.ruler.before('paragraph', 'binary_anchor', (state, start, end, silent) => {
    // Nested containers and indented code retain their existing interpretation.
    if (state.blkIndent || state.level !== 0 || state.sCount[start] >= 4) return false;
    const anchors = [];
    let line = start;
    for (; line < end && state.sCount[line] < 4; line++) {
        const attrs = parseAnchor(state.getLines(line, line + 1, 0, false));
        if (!attrs) break;
        anchors.push(attrs);
    }
    if (!anchors.length) return false;
    if (silent) return true;
    const token = state.push('binary_anchor', 'div', 0);
    token.map = [start, line];
    token.meta = { anchors };
    state.line = line;
    return true;
}, { alt: ['paragraph'] });

function tokenTree(tokens) {
    const root = { children: [] };
    const stack = [root];
    for (const token of tokens) {
        if (token.nesting === -1) { stack.pop(); continue; }
        const node = {
            type: token.type.replace(/_open$/, ''), tag: token.tag,
            attrs: Object.fromEntries(token.attrs || []), content: token.content,
            info: token.info, markup: token.markup, map: token.map,
            hidden: token.hidden, level: token.level, meta: token.meta, children: []
        };
        stack[stack.length - 1].children.push(node);
        if (token.nesting === 1) stack.push(node);
    }
    return root.children;
}

function parse(source, options = {}) {
    source = source.replace(/\r\n?/g, '\n');
    const front = documentAux.splitFrontMatter(source);
    const body = front.body;
    const lines = body.split('\n');
    const offsets = [0];
    for (let i = 0; i < lines.length; i++) offsets.push(offsets[i] + lines[i].length + 1);
    const auxiliary = new Map();
    try {
        const scanned = documentAux.scan(body);
        for (const block of [...scanned.tocs, ...scanned.markers]) {
            const startLine = body.slice(0, block.start).split('\n').length - 1;
            const raw = body.slice(block.start, block.end);
            auxiliary.set(startLine, { raw, endLine: startLine + raw.replace(/\n$/, '').split('\n').length });
        }
    } catch (_) { /* Incomplete auxiliary syntax remains editable text. */ }
    const blocks = tokenTree(parser.parse(body, { auxiliary, backslashDelimiters: options.backslashDelimiters }));
    let previousEnd = 0;
    for (const block of blocks) {
        const start = offsets[block.map[0]];
        let endLine = block.map[1];
        // Container maps may consume separators after their last child. Keep
        // these in layout metadata, but never trim code or equation payloads.
        if (!['fence', 'code_block', 'binary_math'].includes(block.type)) {
            while (endLine > block.map[0] && !lines[endLine - 1]?.trim()) endLine--;
        }
        let end = Math.min(body.length, offsets[endLine]);
        if (body[end - 1] === '\n') end--;
        block.source = body.slice(start, end);
        block.before = body.slice(previousEnd, start);
        previousEnd = end;
    }
    let trailing = body.slice(previousEnd);
    if (front.raw.endsWith('\n') && !blocks.length) trailing = '\n' + trailing;
    if (front.raw) blocks.unshift({ type: 'front_matter', content: front.raw, source: front.raw.replace(/\n$/, ''), before: '', children: [] });
    if (front.raw && blocks.length > 1 && front.raw.endsWith('\n')) blocks[1].before = '\n' + blocks[1].before;
    return { blocks, trailing };
}

module.exports = { parse };
