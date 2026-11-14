'use strict';

const escape = text => String(text).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const encoded = value => escape(encodeURIComponent(value));
const noteId = label => 'bm-note-' + Array.from(label).map(char => char.codePointAt(0).toString(16)).join('-');

function renderInline(reference, context, parseText, resolveImage, labels) {
    if (reference.escaped) return '<span class="reference-escape" data-reference-escape="' + encoded(reference.raw) + '">' + escape(reference.raw.slice(1)) + '</span>';
    if (reference.unresolved) return '<span class="reference-unresolved" title="' + escape(labels.referenceUnresolved) + '">' + escape(reference.raw) + '</span>';
    if (reference.note) {
        const key = context?.noteKey?.(reference.note);
        if (!context?.notes[key]) {
            return '<span class="reference-unresolved" title="' + escape(labels.referenceUnresolved) + '">' + escape(reference.raw) + '</span>';
        }
        const number = context.noteNumbers[key];
        const id = noteId(key);
        let referenceId = '';
        if (!context.notePreview) {
            const occurrence = (context.occurrences[key] || 0) + 1;
            context.occurrences[key] = occurrence;
            referenceId = ' id="' + id + '-ref-' + occurrence + '"';
        }
        return '<sup class="footnote-ref" data-note-source="' + encoded(reference.raw) + '" contenteditable="false">' +
            '<a' + referenceId + ' href="#' + id + '" data-note-navigation="true" aria-label="' +
            escape(labels.footnote + ' ' + (number || reference.note)) + '">' + escape(number || reference.note) + '</a></sup>';
    }
    const text = parseText(reference.text);
    const meta = encoded(JSON.stringify({ ...reference, html: text }));
    const title = reference.title ? ' title="' + escape(reference.title) + '"' : '';
    if (reference.image) {
        // Alt text is text, not active HTML. The browser decodes entities once.
        const template = document.createElement('template');
        template.innerHTML = text;
        return '<img data-reference="' + meta + '" src="' + escape(resolveImage(reference.href)) +
            '" data-markdown-path="' + escape(reference.href) + '" alt="' + escape(template.content.textContent) + '"' + title + '>';
    }
    return '<a data-reference="' + meta + '" href="' + escape(reference.href) + '"' + title + '>' + text + '</a>';
}

function readInline(node, readChildren) {
    if (!node.dataset) return null;
    if (node.dataset.referenceEscape) return (node.textContent || '').replace(/[\\[\]]/g, '\\$&');
    if (node.dataset.noteSource !== undefined) return decodeURIComponent(node.dataset.noteSource);
    if (!node.dataset.reference) return null;
    let reference;
    try { reference = JSON.parse(decodeURIComponent(node.dataset.reference)); }
    catch (_) { return null; }
    if (!reference || !['raw', 'label', 'html', 'href'].every(key => typeof reference[key] === 'string')) return null;
    const title = node.getAttribute('title') || '';
    const titleSource = title ? ' "' + title.replace(/[\\"]/g, '\\$&') + '"' : '';
    if (reference.image) {
        const template = document.createElement('template');
        template.innerHTML = reference.html;
        if (node.dataset.markdownPath !== reference.href) return '![' + node.alt.replace(/[\\[\]]/g, '\\$&') + '](' + node.dataset.markdownPath + titleSource + ')';
        if (node.alt === template.content.textContent) return reference.raw;
        return '![' + node.alt.replace(/[\\[\]]/g, '\\$&') + '][' + reference.label + ']';
    }
    const contents = document.createElement('span');
    for (const child of node.childNodes) contents.appendChild(child.cloneNode(true));
    if (node.innerHTML === reference.html && node.getAttribute('href') === reference.href) return reference.raw;
    // Newly typed literal brackets must not terminate the authored link label.
    // Keep code and retained nested references on their own serialization path.
    const walker = document.createTreeWalker(contents, 4);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        if (!text.parentElement.closest('code,[data-reference],[data-reference-escape],.math-inline'))
            text.textContent = text.textContent.replace(/[\\[\]]/g, '\\$&');
    }
    if (node.getAttribute('href') !== reference.href) return '[' + readChildren(contents) + '](' + node.getAttribute('href') + titleSource + ')';
    return '[' + readChildren(contents) + '][' + reference.label + ']';
}

function renderDefinition(block, body, exportCode, labels) {
    const isNote = block.type === 'footnote_reference';
    if (exportCode && !isNote) return '';
    if (exportCode && (!block.meta.primary || !block.meta.number)) return '';
    const label = isNote ? labels.footnote + ' ' + (block.meta.number || block.meta.label) : labels.referenceDefinition + ' [' + block.meta.label + ']';
    let preview = '';
    if (isNote) {
        const id = noteId(block.meta.key);
        const backlinks = block.meta.primary ? Array.from({ length: block.meta.count }, (_, index) =>
            '<a class="footnote-backlink" data-note-navigation="true" href="#' + id + '-ref-' + (index + 1) +
            '" aria-label="' + escape(labels.footnoteBack + ' ' + (index + 1)) + '">↩︎' + (index + 1) + '</a>').join(' ') : '';
        preview = '<div class="footnote-body">' + body + '</div><div class="footnote-backlinks">' + backlinks + '</div>';
    }
    const id = isNote && block.meta.primary ? ' id="' + noteId(block.meta.key) + '"' : '';
    if (exportCode) return '<section class="footnote-definition"' + id + '><strong>' + escape(label) + '</strong>' + preview + '</section>';
    return '<div class="reference-definition' + (isNote ? ' footnote-definition' : '') + '" contenteditable="false"' + id +
        ' tabindex="-1">' + preview + (block.meta.duplicate ? '<p class="reference-diagnostic">' + escape(labels.referenceDuplicate) + '</p>' : '') +
        '<details><summary>' + escape(label + ' — ' + labels.editDefinition) + '</summary>' +
        '<textarea class="reference-source" spellcheck="false" rows="3" aria-label="' + escape(label) + '">' +
        escape(block.content) + '</textarea></details></div>';
}

module.exports = { renderInline, readInline, renderDefinition, noteId };
