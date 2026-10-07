'use strict';

// Named capabilities remain live; this factory installs no listeners.
function createRender(dependencies) {


    function renderFromMarkdown(codeViews = dependencies.captureCodeViews()) {
        dependencies.closeInsertMenu(false);
        dependencies.closeLanguageSelector();
        dependencies.editorRenderRevision++;
        if (dependencies.tableControls) dependencies.tableControls.clear();
        if (dependencies.isSourceMode) dependencies.sourceEditor.value = dependencies.markdown;
        // Remove IMAGE_DIR and FORCE_RELATIVE_PATH directives before rendering (they're stored in variables)
        let markdownToRender = dependencies.removeDirectivesFromMarkdown(dependencies.markdown);
        dependencies.logger.log('[Binary Markdown] renderFromMarkdown: markdown length:', dependencies.markdown.length, 'after directive removal:', markdownToRender.length);
        const html = dependencies.markdownToHtmlFragment(markdownToRender);
        dependencies.logger.log('[Binary Markdown] renderFromMarkdown: html length:', html.length, 'first 100 chars:', html.substring(0, 100));
        dependencies.editor.innerHTML = html || '<p><br></p>';
        dependencies.visualSourceCurrent = true;
        dependencies.restoreCodeViews(codeViews);
        setupInteractiveElements();
        assignHeadingAnchors(dependencies.editor, dependencies.markdown);
        dependencies.updatePlaceholder();
        dependencies.applyPreviewReadOnly();
        if (dependencies.workspaceUi) dependencies.workspaceUi.refresh();
    }


    /**
     * Normalize block HTML for comparison (collapse whitespace differences).
     */
    function normalizeBlockHtml(html) {
        return html
            .replace(/\s+/g, ' ')
            .replace(/>\s+</g, '><')
            .replace(/\s*contenteditable="[^"]*"/g, '')  // Ignore contenteditable attr diffs
            .trim();
    }


    /**
     * Check if two block elements are semantically equal.
     */
    function blocksAreEqual(a, b) {
        if (a.tagName !== b.tagName) return false;
        // Formatting-only external changes still replace the table's retained source.
        if (a.tagName === 'TABLE' && a.dataset.tableSource !== b.dataset.tableSource) return false;
        if (a.tagName === 'HR' && b.tagName === 'HR') return true;
        if (a.getAttribute('data-lang') !== b.getAttribute('data-lang')) return false;
        if (a.className !== b.className) return false;
        return normalizeBlockHtml(a.innerHTML) === normalizeBlockHtml(b.innerHTML);
    }


    /**
     * Check if a block is in a special interactive state that should not be replaced.
     */
    function isProtectedBlock(block) {
        // Code block in edit mode
        if (block.tagName === 'PRE' && block.getAttribute('data-mode') === 'edit') {
            return true;
        }
        // Mermaid/Math block in edit mode
        if (block.classList &&
            (block.classList.contains('mermaid-wrapper') || block.classList.contains('math-wrapper')) &&
            block.getAttribute('data-mode') === 'edit') {
            return true;
        }
        return false;
    }


    /**
     * Cursor-preserving DOM update for external changes.
     * Diffs at block level and only replaces changed blocks.
     */
    function updateFromMarkdown() {
        dependencies.logger.log('[Binary Markdown] updateFromMarkdown: cursor-preserving update');

        // 1. Save cursor state
        const cursorState = dependencies.saveCursorState();
        const codeViews = dependencies.captureCodeViews();

        // 2. Generate new HTML into a temporary container
        let markdownToRender = dependencies.removeDirectivesFromMarkdown(dependencies.markdown);
        const newHtml = dependencies.markdownToHtmlFragment(markdownToRender);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newHtml || '<p><br></p>';

        // 3. Block-level diff and patch
        const oldBlocks = Array.from(dependencies.editor.children);
        const newBlocks = Array.from(tempDiv.children);
        const maxLen = Math.max(oldBlocks.length, newBlocks.length);
        let changed = false;

        for (let i = 0; i < maxLen; i++) {
            const oldBlock = oldBlocks[i];
            const newBlock = newBlocks[i];

            if (!oldBlock && newBlock) {
                // Block added
                dependencies.editor.appendChild(newBlock.cloneNode(true));
                changed = true;
            } else if (oldBlock && !newBlock) {
                // Block removed
                dependencies.editor.removeChild(oldBlock);
                changed = true;
                // Adjust index since we removed an element
                oldBlocks.splice(i, 1);
                i--;
            } else if (oldBlock && newBlock) {
                if (!blocksAreEqual(oldBlock, newBlock)) {
                    if (isProtectedBlock(oldBlock)) {
                        dependencies.logger.log('[Binary Markdown] updateFromMarkdown: skipping protected block at index', i);
                        continue;
                    }
                    const replacement = newBlock.cloneNode(true);
                    dependencies.editor.replaceChild(replacement, oldBlock);
                    changed = true;
                }
            }
        }

        if (changed) {
            // Re-setup interactive elements for the updated DOM
            dependencies.restoreCodeViews(codeViews);
            setupInteractiveElements();
            dependencies.logger.log('[Binary Markdown] updateFromMarkdown: DOM patched');
        } else {
            dependencies.logger.log('[Binary Markdown] updateFromMarkdown: no changes detected');
        }

        // 4. Restore cursor
        dependencies.restoreCursorState(cursorState);
        dependencies.updatePlaceholder();
    }


    // Convert markdown to HTML fragment (reusable for both full render and partial paste)
    function renderFrontMatter(raw) {
        return '<div class="document-aux front-matter" contenteditable="false"><details' + (dependencies.frontMatterOpen ? ' open' : '') + '>' +
            '<summary>' + dependencies.escapeHtml(dependencies.i18n.frontMatterYaml) + '</summary>' +
            '<textarea class="front-matter-source" aria-label="' + (dependencies.i18n.frontMatter || 'Front matter').replace(/"/g, '&quot;') +
            '" spellcheck="false" rows="7">' + dependencies.escapeHtml(raw) + '</textarea></details></div>';
    }


    function renderTocBlock(raw) {
        const label = dependencies.i18n.tocGenerated;
        const refreshLabel = dependencies.i18n.refreshToc || 'Refresh table of contents';
        let list = '<ul>';
        for (const line of raw.split('\n')) {
            const item = /^( *)- \[(.*)\]\(#(.*)\)$/.exec(line);
            if (!item) continue;
            const text = item[2].replace(/\\([\\[\]`*_~])/g, '$1');
            list += '<li style="margin-left:' + (item[1].length / 2) + 'em"><a href="#' +
                encodeURIComponent(item[3]) + '">' + dependencies.escapeHtml(text) + '</a></li>';
        }
        list += '</ul>';
        if (/^\[toc\]$/i.test(raw)) list += '<p class="toc-pending">' + dependencies.escapeHtml(dependencies.i18n.tocPending || 'Save or refresh to generate contents.') + '</p>';
        return '<div class="document-aux toc-block" contenteditable="false" data-toc-source="' + encodeURIComponent(raw) + '">' +
            '<div class="toc-heading"><strong>' + dependencies.escapeHtml(label) + '</strong><button class="toc-refresh" type="button" aria-label="' +
            refreshLabel.replace(/"/g, '&quot;') + '" title="' + refreshLabel.replace(/"/g, '&quot;') + '">' + dependencies.escapeHtml(dependencies.i18n.refreshLabel) + '</button></div><p class="toc-help">' + dependencies.escapeHtml(dependencies.i18n.refreshOnSave) + '</p>' + list + '</div>';
    }


    function assignHeadingAnchors(root, source) {
        if (!root.querySelector('.toc-block')) return;
        let headings;
        try { headings = dependencies.documentAux.scan(source).headings; }
        catch (_) { return; } // Keep malformed source editable; save/export report it.
        const nodes = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(h => !h.closest('.document-aux'));
        nodes.forEach((node, index) => { if (headings[index]) node.id = headings[index].id; });
    }


    function refreshManagedTocs(notify) {
        const current = dependencies.readCurrentMarkdown();
        const next = dependencies.documentAux.refreshTocs(current);
        if (next === current) return false;
        dependencies.cancelScheduledSync();
        dependencies.markdown = current;
        dependencies.undoManager.saveSnapshot();
        if (dependencies.isSourceMode) {
            const start = dependencies.sourceEditor.selectionStart, end = dependencies.sourceEditor.selectionEnd;
            dependencies.sourceEditor.value = next;
            // Keep selection on the same source text when the generated list grows.
            let prefix = 0, suffix = 0;
            while (prefix < current.length && prefix < next.length && current[prefix] === next[prefix]) prefix++;
            while (suffix < current.length - prefix && suffix < next.length - prefix && current[current.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++;
            const map = offset => offset <= prefix ? offset : offset >= current.length - suffix ? offset + next.length - current.length : prefix;
            if (dependencies.sourceEditor.setSelectionRange) dependencies.sourceEditor.setSelectionRange(map(start), map(end));
        } else {
            const parsed = dependencies.documentAux.scan(next);
            const replacements = parsed.tocs;
            if (dependencies.editor.querySelectorAll('.toc-block').length !== replacements.length) {
                dependencies.markdown = next;
                const cursor = dependencies.saveCursorState();
                renderFromMarkdown();
                if (cursor) dependencies.restoreCursorState(cursor);
            }
            dependencies.editor.querySelectorAll('.toc-block').forEach((block, index) => {
                if (!replacements[index]) return;
                const holder = document.createElement('template');
                holder.innerHTML = renderTocBlock(replacements[index].source);
                block.replaceWith(holder.content.firstElementChild);
            });
            setupDocumentAux();
        }
        dependencies.markdown = next;
        dependencies.markAsEdited();
        dependencies.visualSourceCurrent = true;
        dependencies.updateOutline();
        dependencies.updateWordCount();
        if (notify) dependencies.notifyChangeImmediate();
        return true;
    }


    function insertManagedToc() {
        try {
            const current = dependencies.readCurrentMarkdown();
            const parsed = dependencies.documentAux.scan(current);
            if (parsed.tocs.length || parsed.markers.length) { refreshManagedTocs(true); return; }
            const raw = dependencies.documentAux.generateToc(parsed.headings);
            dependencies.markdown = current;
            dependencies.undoManager.saveSnapshot();
            dependencies.cancelScheduledSync();
            if (dependencies.isSourceMode) {
                const at = Math.max(dependencies.sourceEditor.selectionStart || 0, parsed.front.raw.length);
                dependencies.sourceEditor.value = current.slice(0, at) + '\n\n' + raw + '\n\n' + current.slice(at);
                dependencies.markdown = dependencies.sourceEditor.value;
                dependencies.markAsEdited();
                dependencies.notifyChangeImmediate();
            } else {
                const holder = document.createElement('template');
                holder.innerHTML = renderTocBlock(raw);
                const block = holder.content.firstElementChild;
                const line = dependencies.getCurrentLine();
                if (line && line.parentNode === dependencies.editor && !line.classList.contains('front-matter')) {
                    if (line.tagName === 'P' && !line.textContent.trim()) line.replaceWith(block);
                    else line.after(block);
                } else {
                    const metadata = dependencies.editor.querySelector(':scope > .front-matter');
                    if (metadata) metadata.after(block); else dependencies.editor.prepend(block);
                }
                if (!block.nextSibling) { const p = document.createElement('p'); p.innerHTML = '<br>'; block.after(p); }
                setupDocumentAux();
                dependencies.syncMarkdownSync();
                dependencies.updateOutline();
            }
        } catch (error) { dependencies.showEditorToast(error.message); }
    }


    function setupDocumentAux() {
        dependencies.editor.querySelectorAll('.toc-block').forEach(block => {
            if (block.dataset.auxSetup) return;
            block.dataset.auxSetup = 'true';
            block.querySelector('.toc-refresh').addEventListener('click', e => {
                e.preventDefault(); e.stopPropagation();
                try { refreshManagedTocs(true); } catch (error) { dependencies.showEditorToast(error.message); }
            });
            block.querySelectorAll('a').forEach(a => a.addEventListener('click', e => {
                e.preventDefault(); e.stopPropagation();
                const id = decodeURIComponent(a.getAttribute('href').slice(1));
                const target = Array.from(dependencies.editor.querySelectorAll('h1,h2,h3,h4,h5,h6')).find(h => h.id === id);
                if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }));
        });
        dependencies.editor.querySelectorAll('.front-matter').forEach(block => {
            if (block.dataset.auxSetup) return;
            block.dataset.auxSetup = 'true';
            const details = block.querySelector('details');
            const input = block.querySelector('textarea');
            details.addEventListener('toggle', () => { dependencies.frontMatterOpen = details.open; });
            input.addEventListener('beforeinput', () => { dependencies.undoManager.saveSnapshotDebounced(); });
            input.addEventListener('input', e => {
                e.stopPropagation();
                dependencies.markActivelyEditing();
                dependencies.syncMarkdownSync();
            });
            input.addEventListener('keydown', e => {
                e.stopPropagation();
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); dependencies.saveCurrentDocument(); }
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) dependencies.undoManager.redo(); else dependencies.undoManager.undo();
                }
            });
        });
    }


    function setupLink(a) {
        if (a.closest('.toc-block')) return;
        // DOM-only details; keep this shared by rendered, inserted, and pasted links.
        if (!a.hasAttribute('title')) a.title = a.getAttribute('href') || '';
        if (dependencies.initializedLinks.has(a)) return;
        dependencies.initializedLinks.add(a);
        a.addEventListener('click', e => {
            e.preventDefault();
            dependencies.host.openLink(a.getAttribute('href'));
        });
    }


    function setupInteractiveElements() {
        dependencies.setupInlineMath();
        setupDocumentAux();
        // Make checkboxes work
        dependencies.editor.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                dependencies.markAsEdited(); // User has made an edit
                dependencies.syncMarkdown();
            });
        });

        // Handle link clicks
        dependencies.editor.querySelectorAll('a').forEach(setupLink);

        // Make table cells editable
        dependencies.editor.querySelectorAll('th, td').forEach(cell => {
            cell.setAttribute('contenteditable', 'true');
        });

        // Add resize handles to tables
        dependencies.editor.querySelectorAll('table').forEach(table => {
            dependencies.addTableResizeHandles(table);
        });

        // Setup code block UI for all code blocks
        setupAllCodeBlocks();
    }


    // Setup all code blocks in the editor
    function setupAllCodeBlocks() {
        dependencies.editor.querySelectorAll('pre').forEach(pre => {
            // Skip mermaid/math code blocks (they are handled by their own setup functions)
            if (pre.getAttribute('data-lang') === 'mermaid') return;
            if (pre.getAttribute('data-lang') === 'math') return;
            dependencies.setupCodeBlockUI(pre);
        });

        // Setup Mermaid diagrams
        dependencies.setupMermaidDiagrams();
        // Setup Math blocks
        dependencies.setupMathBlocks();
    }

    return { renderFromMarkdown, normalizeBlockHtml, blocksAreEqual, isProtectedBlock, updateFromMarkdown, renderFrontMatter, renderTocBlock, assignHeadingAnchors, refreshManagedTocs, insertManagedToc, setupDocumentAux, setupLink, setupInteractiveElements, setupAllCodeBlocks };
}

module.exports = { createRender };
