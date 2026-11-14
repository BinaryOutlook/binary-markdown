'use strict';

const MarkdownIt = require('markdown-it/lib/index.mjs').default;
const footnote = require('markdown-it-footnote');
const referenceRule = require('markdown-it/lib/rules_block/reference.mjs').default;
const { normalizeReference } = require('markdown-it/lib/common/utils.mjs');
const math = require('./math-syntax');

// Keep definitions in the block stream. The editor must never hide source in
// parser state alone, including unused and duplicate definitions.
function configure(parser) {
    parser.use(footnote);
    parser.core.ruler.disable('footnote_tail');
    parser.inline.ruler.disable('footnote_inline');
    parser.block.ruler.at('reference', (state, start, end, silent) => {
        const at = state.bMarks[start] + state.tShift[start];
        if (state.src.slice(at, at + 2) === '[^') return false;
        if (!referenceRule(state, start, end, silent)) return false;
        if (!silent) {
            const token = state.push('binary_reference', 'div', 0);
            token.map = [start, state.line];
            token.content = state.getLines(start, state.line, state.blkIndent, false).replace(/\n$/, '');
            token.meta = { label: /^ *\[((?:\\.|[^\]\\])+)\]:/.exec(token.content)?.[1] || '' };
        }
        return true;
    });
    // Select the registered rule name, not Function.name (minification changes
    // the latter). Both parser and plugin are pinned and bundled together.
    const definition = parser.block.ruler.__rules__.find(rule => rule.name === 'footnote_def').fn;
    parser.block.ruler.at('footnote_def', (state, start, end, silent) => {
        const index = state.tokens.length;
        const indent = state.blkIndent;
        if (!definition(state, start, end, silent)) return false;
        if (!silent) {
            const token = state.tokens[index];
            token.map = [start, state.line];
            token.content = state.getLines(start, state.line, indent, false).replace(/\n+$/, '');
        }
        return true;
    }, { alt: ['paragraph', 'reference'] });
}

const inline = new MarkdownIt({ html: false, linkify: false, typographer: false });
inline.inline.ruler.before('escape', 'binary_reference_escape', (state, silent) => {
    const raw = state.src.slice(state.pos, state.pos + 2);
    if (!/^\\[\\[\]]$/.test(raw)) return false;
    if (!silent) {
        state.env.spans.push({ start: state.pos, end: state.pos + 2, raw, escaped: true });
        state.push('text', '', 0).content = raw.slice(1);
    }
    state.pos += 2;
    return true;
});
// Capture recognized source spans using the same CommonMark rules as blocks.
// Code spans, escapes, nested brackets, Unicode labels and titles therefore do
// not depend on a second regular-expression definition of reference syntax.
const rules = { link: require('markdown-it/lib/rules_inline/link.mjs').default,
    image: require('markdown-it/lib/rules_inline/image.mjs').default };
for (const [name, rule] of Object.entries(rules)) {
    inline.inline.ruler.at(name, (state, silent) => {
        const start = state.pos;
        if (name === 'link' && state.env.insideLink) return false;
        if (name === 'image' ? state.src.slice(start, start + 2) !== '![' : state.src[start] !== '[') return false;
        const labelStart = start + (name === 'image' ? 2 : 1);
        const labelEnd = state.md.helpers.parseLinkLabel(state, labelStart - 1, name === 'link');
        const tokenStart = state.tokens.length;
        const spansStart = state.env.spans.length;
        if (!rule(state, silent)) {
            if (labelEnd < 0 || state.src[labelEnd + 1] !== '[') return false;
            const end = state.md.helpers.parseLinkLabel(state, labelEnd + 1);
            if (end < 0) return false;
            if (!silent) {
                const raw = state.src.slice(start, end + 1);
                state.env.spans.push({ start, end: end + 1, raw, unresolved: true });
                state.push('text', '', 0).content = raw;
            }
            state.pos = end + 1;
            return true;
        }
        if (!silent && name === 'image') state.env.spans.splice(spansStart);
        if (!silent && labelEnd >= 0 && state.src[labelEnd + 1] !== '(') {
            const raw = state.src.slice(start, state.pos);
            const text = state.src.slice(labelStart, labelEnd);
            const suffix = state.src.slice(labelEnd + 1, state.pos);
            const label = suffix.startsWith('[') && suffix !== '[]' ? suffix.slice(1, -1) : text;
            const token = state.tokens.slice(tokenStart).find(token => token.type === (name === 'image' ? 'image' : 'link_open'));
            state.env.spans.splice(spansStart);
            state.env.spans.push({ start, end: state.pos, raw, text, label, image: name === 'image',
                href: token.attrGet(name === 'image' ? 'src' : 'href'), title: token.attrGet('title') || '' });
        }
        return true;
    });
}
inline.inline.ruler.before('link', 'binary_note', (state, silent) => {
    if (silent || state.linkLevel || state.env.insideLink || state.env.inAlt) return false;
    const match = /^\[\^([^\s\[\]]+)\]/.exec(state.src.slice(state.pos, state.posMax));
    if (!match) return false;
    if (!silent) {
        state.env.spans.push({ start: state.pos, end: state.pos + match[0].length,
            raw: match[0], note: match[1] });
        const token = state.push('text', '', 0);
        token.content = match[0];
    }
    state.pos += match[0].length;
    return true;
});

function inlineSpans(source, context = {}) {
    const env = { references: context.references || Object.create(null), spans: [], insideLink: context.insideLink, inAlt: context.inAlt };
    inline.parseInline(source, env);
    return env.spans.sort((a, b) => a.start - b.start);
}

function contextFor(blocks, env) {
    const notes = Object.create(null);
    const definitions = [];
    const linkLabels = new Set();
    function visit(block) {
        if (block.type === 'binary_reference') {
            const key = normalizeReference(block.meta.label);
            block.meta.duplicate = linkLabels.has(key);
            linkLabels.add(key);
        }
        if (block.type === 'footnote_reference') {
            definitions.push(block);
            const key = normalizeReference(block.meta.label);
            if (!notes[key]) notes[key] = block;
        }
        block.children.forEach(visit);
    }
    blocks.forEach(visit);
    const noteNumbers = Object.create(null);
    const counts = Object.create(null);
    const ordered = [];
    function count(block) {
        if (block.type === 'footnote_reference') return;
        if (block.type === 'inline') {
            const equations = math.inline(block.content, env.backslashDelimiters !== false);
            for (const span of inlineSpans(block.content, env)) {
                if (!span.note) continue;
                if (equations.some(equation => equation.start <= span.start && equation.end >= span.end)) continue;
                const key = normalizeReference(span.note);
                if (!notes[key]) continue;
                if (!noteNumbers[key]) { ordered.push(key); noteNumbers[key] = ordered.length; }
                counts[key] = (counts[key] || 0) + 1;
            }
        }
        block.children.forEach(count);
    }
    blocks.forEach(count);
    // Visit each referenced note once, including notes referenced by notes.
    for (let index = 0; index < ordered.length; index++) notes[ordered[index]].children.forEach(count);
    for (const block of definitions) {
        const key = normalizeReference(block.meta.label);
        block.meta.primary = notes[key] === block;
        block.meta.duplicate = !block.meta.primary;
        block.meta.key = key;
        block.meta.number = noteNumbers[key];
        block.meta.count = counts[key] || 0;
    }
    return { references: env.references || Object.create(null), notes, noteNumbers, occurrences: Object.create(null), noteKey: normalizeReference };
}

module.exports = { configure, inlineSpans, contextFor, normalizeReference };
