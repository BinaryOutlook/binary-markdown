'use strict';
const { noteId } = require('../codec/references');

function createReferences(dependencies, render) {
    const initialized = new WeakSet();
    function navigate(link, event) {
        event.preventDefault();
        event.stopPropagation();
        const id = link.getAttribute('href').slice(1);
        const target = Array.from(dependencies.editor.querySelectorAll('[id]')).find(node => node.id === id);
        if (!target) return;
        target.scrollIntoView({ block: 'center' });
        target.focus({ preventScroll: true });
    }
    function setup() {
        dependencies.editor.querySelectorAll('[data-note-navigation]').forEach(link => {
            if (initialized.has(link)) return;
            initialized.add(link);
            link.addEventListener('click', event => navigate(link, event));
            link.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') navigate(link, event);
            });
        });
        dependencies.editor.querySelectorAll('.reference-source').forEach(input => {
            if (initialized.has(input)) return;
            initialized.add(input);
            input.addEventListener('beforeinput', () => dependencies.undoManager.saveSnapshotDebounced());
            input.addEventListener('input', event => {
                event.stopPropagation();
                dependencies.markActivelyEditing();
                dependencies.syncMarkdownSync();
            });
            const refresh = () => {
                const position = Array.from(dependencies.editor.querySelectorAll('.reference-source')).indexOf(input);
                dependencies.syncMarkdownSync();
                render();
                const replacement = dependencies.editor.querySelectorAll('.reference-source')[position];
                replacement?.closest('details').querySelector('summary').focus();
            };
            input.addEventListener('change', refresh);
            input.addEventListener('keydown', event => {
                event.stopPropagation();
                if (!(event.ctrlKey || event.metaKey)) return;
                const key = event.key.toLowerCase();
                if (key === 's') { event.preventDefault(); dependencies.saveCurrentDocument(); }
                if (key === 'z') { event.preventDefault(); event.shiftKey ? dependencies.undoManager.redo() : dependencies.undoManager.undo(); }
                if (key === 'enter') { event.preventDefault(); refresh(); }
            });
        });
    }
    function insertFootnote() {
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        const element = range?.startContainer.nodeType === 1 ? range.startContainer : range?.startContainer.parentElement;
        if (dependencies.isSourceMode || !range || !dependencies.editor.contains(range.commonAncestorContainer) ||
            element?.closest('pre,.reference-definition,.math-inline,.math-wrapper,.mermaid-wrapper,.front-matter,.toc-block')) return;
        const current = dependencies.readCurrentMarkdown();
        // Include unresolved references and code examples: insertion must never
        // accidentally bind an existing user-authored marker.
        const used = new Set(Array.from(current.matchAll(/\[\^([^\]\r\n]+)\]/g), match => match[1].toUpperCase()));
        let sequence = 1;
        while (used.has('NOTE-' + sequence)) sequence++;
        const label = 'note-' + sequence;
        const marker = document.createTextNode('[^' + label + ']');
        range.collapse(false);
        range.insertNode(marker);
        dependencies.syncMarkdownSync();
        dependencies.markdown = dependencies.readCurrentMarkdown().replace(/\n*$/, '\n\n') +
            '[^' + label + ']: ' + dependencies.i18n.footnotePlaceholder + '\n';
        dependencies.markAsEdited();
        render();
        dependencies.notifyChangeImmediate();
        const block = Array.from(dependencies.editor.querySelectorAll('.footnote-definition')).find(node => node.id === noteId(label.toUpperCase()));
        if (block) {
            block.querySelector('details').open = true;
            const input = block.querySelector('textarea');
            input.focus();
            input.setSelectionRange(input.value.indexOf(':') + 2, input.value.length);
        }
    }
    return { setup, insertFootnote };
}

module.exports = { createReferences };
