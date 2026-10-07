'use strict';

// Named capabilities remain live; this factory installs no listeners.
function createCommands(dependencies) {


    // Shared action dispatcher used by both toolbar and command palette
    function dispatchToolbarAction(action) {
        switch (action) {
            case 'bold':
                dependencies.applyInlineFormat('strong');
                dependencies.syncMarkdown();
                break;
            case 'italic':
                dependencies.applyInlineFormat('em');
                dependencies.syncMarkdown();
                break;
            case 'underline':
                dependencies.toggleUnderline();
                break;
            case 'strikethrough':
                dependencies.applyInlineFormat('del');
                dependencies.syncMarkdown();
                break;
            case 'code':
                var codeSel = window.getSelection();
                if (codeSel.toString()) {
                    document.execCommand('insertHTML', false, '<code>' + dependencies.escapeHtml(codeSel.toString()) + '</code>');
                    dependencies.syncMarkdown();
                }
                break;
            case 'heading1':
            case 'heading2':
            case 'heading3':
            case 'heading4':
            case 'heading5':
            case 'heading6':
                var headingLevel = action.replace('heading', '');
                var headingLine = dependencies.getCurrentLine();
                if (headingLine) {
                    var h = document.createElement('h' + headingLevel);
                    h.innerHTML = headingLine.innerHTML || '<br>';
                    headingLine.replaceWith(h);
                    dependencies.setCursorToEnd(h);
                    dependencies.syncMarkdown();
                }
                break;
            case 'ul':
                if (!dependencies.convertListToType('ul')) {
                    dependencies.convertToList('ul');
                }
                break;
            case 'ol':
                if (!dependencies.convertListToType('ol')) {
                    dependencies.convertToList('ol');
                }
                break;
            case 'task':
                if (!dependencies.convertListToType('task')) {
                    dependencies.convertToTaskList();
                }
                break;
            case 'quote':
                var bq = document.createElement('blockquote');
                bq.innerHTML = '<br>';
                var currentLine3 = dependencies.getCurrentLine();
                if (currentLine3) {
                    currentLine3.after(bq);
                } else {
                    dependencies.editor.appendChild(bq);
                }
                dependencies.setCursorToEnd(bq);
                dependencies.syncMarkdown();
                break;
            case 'codeblock': {
                var pre = document.createElement('pre');
                pre.setAttribute('data-lang', '');
                pre.setAttribute('data-mode', 'display');
                var codeEl = document.createElement('code');
                codeEl.setAttribute('contenteditable', 'false');
                pre.appendChild(codeEl);
                var currentLine4 = dependencies.getCurrentLine();
                if (currentLine4) {
                    var lineText = currentLine4.textContent?.trim() || '';
                    if (lineText === '' || currentLine4.innerHTML === '<br>') {
                        currentLine4.replaceWith(pre);
                    } else {
                        currentLine4.after(pre);
                    }
                } else {
                    dependencies.editor.appendChild(pre);
                }
                dependencies.setupCodeBlockUI(pre);
                dependencies.enterEditMode(pre);
                dependencies.syncMarkdown();
                break;
            }
            case 'mermaid':
            case 'math': {
                var preM = document.createElement('pre');
                preM.setAttribute('data-lang', action);
                preM.setAttribute('data-mode', 'display');
                var codeElM = document.createElement('code');
                codeElM.innerHTML = '<br>';
                preM.appendChild(codeElM);
                var currentLineM = dependencies.getCurrentLine();
                if (currentLineM) {
                    var lineTextM = currentLineM.textContent?.trim() || '';
                    if (lineTextM === '' || currentLineM.innerHTML === '<br>') {
                        currentLineM.replaceWith(preM);
                    } else {
                        currentLineM.after(preM);
                    }
                } else {
                    dependencies.editor.appendChild(preM);
                }
                var nextSibM = preM.nextSibling;
                var parentElM = preM.parentNode;
                dependencies.convertToSpecialBlock(preM, action);
                var wrapperM = nextSibM ? nextSibM.previousSibling : parentElM.lastChild;
                if (wrapperM && dependencies.isSpecialWrapper(wrapperM)) {
                    if (action === 'math') {
                        wrapperM.dataset.mathOpen = '$$';
                        wrapperM.dataset.mathClose = '$$';
                        dependencies.syncMarkdown();
                    }
                    dependencies.enterSpecialWrapperEditMode(wrapperM, 'start');
                }
                break;
            }
            case 'inlineMath': {
                const selection = window.getSelection();
                const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
                if (!dependencies.editorRange(range)) break;
                const tex = selection.toString() || 'x';
                const equation = { open: '$', close: '$', tex, raw: '$' + tex + '$' };
                const template = document.createElement('template');
                template.innerHTML = dependencies.inlineMathHtml(equation);
                const span = template.content.firstElementChild;
                // insertHTML strips this noneditable span inside lists/cells.
                // Retain the same math node and source attributes in every context.
                range.deleteContents(); range.insertNode(span);
                range.setStartAfter(span); range.collapse(true);
                selection.removeAllRanges(); selection.addRange(range);
                dependencies.setupInlineMath(); dependencies.syncMarkdownSync();
                dependencies.editInlineMath(span);
                break;
            }
            case 'link':
            case 'image':
                dependencies.requestHostInsertion(action);
                break;
            case 'toc':
                dependencies.insertManagedToc();
                break;
            case 'table':
                var tableHtml = '<table><tr><th>Header 1</th><th>Header 2</th></tr><tr><td>Cell</td><td>Cell</td></tr></table>';
                document.execCommand('insertHTML', false, tableHtml);
                dependencies.syncMarkdown();
                break;
            case 'hr':
                var hr = document.createElement('hr');
                var p = document.createElement('p');
                p.innerHTML = '<br>';
                var currentLine5 = dependencies.getCurrentLine();
                if (currentLine5) {
                    currentLine5.after(hr);
                    hr.after(p);
                } else {
                    dependencies.editor.appendChild(hr);
                    dependencies.editor.appendChild(p);
                }
                dependencies.setCursorToEnd(p);
                dependencies.syncMarkdown();
                break;
        }
    }


    function executeCommandPaletteAction(action) {
        if ((action === 'viewUndo' && !dependencies.undoManager.canUndo) || (action === 'viewRedo' && !dependencies.undoManager.canRedo)) return;
        // Close palette
        dependencies.commandPalette.style.display = 'none';
        dependencies.commandPaletteVisible = false;
        for (const id of ['formatButton', 'allActionsButton']) document.getElementById(id)?.setAttribute('aria-expanded', 'false');
        dependencies.stopCommandPaletteOutsideClicks();
        window.removeEventListener('resize', dependencies.commandPaletteRepositionHandler);
        dependencies.editor.removeEventListener('scroll', dependencies.commandPaletteRepositionHandler);

        // Remove custom highlight
        if (CSS.highlights) CSS.highlights.delete('command-palette-selection');

        // Restore editor focus and selection without scrolling
        dependencies.editor.focus({ preventScroll: true });
        if (dependencies.commandPaletteSavedRange) {
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(dependencies.commandPaletteSavedRange);
            dependencies.commandPaletteSavedRange = null;
        }

        executeEditorCommand(action);
    }


    function executeEditorCommand(action) {
        const views = {
            viewUndo: () => dependencies.undoManager.undo(), viewRedo: () => dependencies.undoManager.redo(),
            viewInsert: () => dependencies.openInsertMenu(false), viewContextual: () => document.getElementById('contextToolbarToggle')?.click(),
            viewVisual: () => dependencies.setEditorMode('visual'), viewSource: () => dependencies.setEditorMode('source'), viewSplit: () => dependencies.setEditorMode('split'),
            viewOutline: dependencies.openSidebar, viewFind: () => dependencies.openSearchBox(false), viewReplace: () => dependencies.openSearchBox(true),
            viewExport: () => document.getElementById('exportButton')?.click(),
        };
        if (views[action]) { views[action](); return; }
        // Save undo snapshot before action
        if (!['link', 'image', 'underline'].includes(action)) {
            dependencies.undoManager.saveSnapshot();
            dependencies.markAsEdited();
        }

        // Dispatch via shared function (same as toolbar)
        dispatchToolbarAction(action);
        if (dependencies.insertActions.includes(action) && !['link', 'image', 'toc'].includes(action)) dependencies.syncMarkdownSync();
    }


    // ========== SHORTCUT HELPER FUNCTIONS ==========

    function convertToHeading(level) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        let node = sel.anchorNode;
        while (node && node.parentNode !== dependencies.editor) {
            node = node.parentNode;
        }
        if (!node || node === dependencies.editor) return;

        const text = node.textContent || '';
        const heading = document.createElement('h' + level);
        heading.textContent = text || '';
        if (!heading.textContent) heading.innerHTML = '<br>';
        node.replaceWith(heading);
        dependencies.setCursorToEnd(heading);
        dependencies.syncMarkdown();
    }


    function convertToParagraph() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        let node = sel.anchorNode;
        while (node && node.parentNode !== dependencies.editor) {
            node = node.parentNode;
        }
        if (!node || node === dependencies.editor) return;

        const text = node.textContent || '';
        const p = document.createElement('p');
        p.textContent = text || '';
        if (!p.textContent) p.innerHTML = '<br>';
        node.replaceWith(p);
        dependencies.setCursorToEnd(p);
        dependencies.syncMarkdown();
    }


    function convertToBlockquote() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        let node = sel.anchorNode;
        while (node && node.parentNode !== dependencies.editor) {
            node = node.parentNode;
        }
        if (!node || node === dependencies.editor) return;

        const text = node.textContent || '';
        const blockquote = document.createElement('blockquote');
        blockquote.textContent = text || '';
        if (!blockquote.textContent) blockquote.innerHTML = '<br>';
        node.replaceWith(blockquote);
        dependencies.setCursorToEnd(blockquote);
        dependencies.syncMarkdown();
    }


    function convertToCodeBlock() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        let node = sel.anchorNode;
        while (node && node.parentNode !== dependencies.editor) {
            node = node.parentNode;
        }
        if (!node || node === dependencies.editor) return;

        const text = node.textContent || '';
        const pre = document.createElement('pre');
        pre.setAttribute('data-lang', '');
        const code = document.createElement('code');
        code.textContent = text || '';
        if (!code.textContent) code.innerHTML = '<br>';
        pre.appendChild(code);
        node.replaceWith(pre);
        dependencies.setCursorToEnd(code);
        dependencies.syncMarkdown();
    }


    function insertHorizontalRule() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        let node = sel.anchorNode;
        while (node && node.parentNode !== dependencies.editor) {
            node = node.parentNode;
        }

        const hr = document.createElement('hr');
        const p = document.createElement('p');
        p.innerHTML = '<br>';

        if (node && node !== dependencies.editor) {
            node.after(hr);
            hr.after(p);
        } else {
            dependencies.editor.appendChild(hr);
            dependencies.editor.appendChild(p);
        }
        dependencies.setCursorToEnd(p);
        dependencies.syncMarkdown();
    }


    function wrapWithInlineCode() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        const selectedText = range.toString();

        if (selectedText) {
            const code = document.createElement('code');
            code.textContent = selectedText;
            range.deleteContents();
            range.insertNode(code);

            // Move cursor after the code element
            const newRange = document.createRange();
            newRange.setStartAfter(code);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
        } else {
            // Insert empty code element
            const code = document.createElement('code');
            code.innerHTML = '&nbsp;';
            range.insertNode(code);
            dependencies.setCursorToEnd(code);
        }
        dependencies.syncMarkdown();
    }


    function insertLink() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        const selectedText = range.toString() || 'link';

        const a = document.createElement('a');
        a.href = '#';
        a.textContent = selectedText;
        dependencies.setupLink(a);

        range.deleteContents();
        range.insertNode(a);

        // Move cursor after the link
        const newRange = document.createRange();
        newRange.setStartAfter(a);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        dependencies.syncMarkdown();
    }

    return { dispatchToolbarAction, executeCommandPaletteAction, executeEditorCommand, convertToHeading, convertToParagraph, convertToBlockquote, convertToCodeBlock, insertHorizontalRule, wrapWithInlineCode, insertLink };
}

module.exports = { createCommands };
