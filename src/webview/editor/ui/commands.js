'use strict';
// Construction defines capabilities; bootstrap controls the original initialization order.
function createCommands(dependencies) {
    let savedToolbarRange, pendingHostInsert, hostInsertSequence;
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
                }
                else {
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
                    }
                    else {
                        currentLine4.after(pre);
                    }
                }
                else {
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
                    }
                    else {
                        currentLineM.after(preM);
                    }
                }
                else {
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
                if (!dependencies.editorRange(range))
                    break;
                const tex = selection.toString() || 'x';
                const equation = { open: '$', close: '$', tex, raw: '$' + tex + '$' };
                const template = document.createElement('template');
                template.innerHTML = dependencies.inlineMathHtml(equation);
                const span = template.content.firstElementChild;
                // insertHTML strips this noneditable span inside lists/cells.
                // Retain the same math node and source attributes in every context.
                range.deleteContents();
                range.insertNode(span);
                range.setStartAfter(span);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                dependencies.setupInlineMath();
                dependencies.syncMarkdownSync();
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
                }
                else {
                    dependencies.editor.appendChild(hr);
                    dependencies.editor.appendChild(p);
                }
                dependencies.setCursorToEnd(p);
                dependencies.syncMarkdown();
                break;
        }
    }
    function executeCommandPaletteAction(action) {
        if ((action === 'viewUndo' && !dependencies.undoManager.canUndo) || (action === 'viewRedo' && !dependencies.undoManager.canRedo))
            return;
        // Close palette
        dependencies.commandPalette.style.display = 'none';
        dependencies.commandPaletteVisible = false;
        for (const id of ['formatButton', 'allActionsButton'])
            document.getElementById(id)?.setAttribute('aria-expanded', 'false');
        dependencies.stopCommandPaletteOutsideClicks();
        window.removeEventListener('resize', dependencies.commandPaletteRepositionHandler);
        dependencies.editor.removeEventListener('scroll', dependencies.commandPaletteRepositionHandler);
        // Remove custom highlight
        if (CSS.highlights)
            CSS.highlights.delete('command-palette-selection');
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
        if (views[action]) {
            views[action]();
            return;
        }
        // Save undo snapshot before action
        if (!['link', 'image', 'underline'].includes(action)) {
            dependencies.undoManager.saveSnapshot();
            dependencies.markAsEdited();
        }
        // Dispatch via shared function (same as toolbar)
        dispatchToolbarAction(action);
        if (dependencies.insertActions.includes(action) && !['link', 'image', 'toc'].includes(action))
            dependencies.syncMarkdownSync();
    }
    // ========== SHORTCUT HELPER FUNCTIONS ==========
    function convertToHeading(level) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount)
            return;
        let node = sel.anchorNode;
        while (node && node.parentNode !== dependencies.editor) {
            node = node.parentNode;
        }
        if (!node || node === dependencies.editor)
            return;
        const text = node.textContent || '';
        const heading = document.createElement('h' + level);
        heading.textContent = text || '';
        if (!heading.textContent)
            heading.innerHTML = '<br>';
        node.replaceWith(heading);
        dependencies.setCursorToEnd(heading);
        dependencies.syncMarkdown();
    }
    function convertToParagraph() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount)
            return;
        let node = sel.anchorNode;
        while (node && node.parentNode !== dependencies.editor) {
            node = node.parentNode;
        }
        if (!node || node === dependencies.editor)
            return;
        const text = node.textContent || '';
        const p = document.createElement('p');
        p.textContent = text || '';
        if (!p.textContent)
            p.innerHTML = '<br>';
        node.replaceWith(p);
        dependencies.setCursorToEnd(p);
        dependencies.syncMarkdown();
    }
    function convertToBlockquote() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount)
            return;
        let node = sel.anchorNode;
        while (node && node.parentNode !== dependencies.editor) {
            node = node.parentNode;
        }
        if (!node || node === dependencies.editor)
            return;
        const text = node.textContent || '';
        const blockquote = document.createElement('blockquote');
        blockquote.textContent = text || '';
        if (!blockquote.textContent)
            blockquote.innerHTML = '<br>';
        node.replaceWith(blockquote);
        dependencies.setCursorToEnd(blockquote);
        dependencies.syncMarkdown();
    }
    function convertToCodeBlock() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount)
            return;
        let node = sel.anchorNode;
        while (node && node.parentNode !== dependencies.editor) {
            node = node.parentNode;
        }
        if (!node || node === dependencies.editor)
            return;
        const text = node.textContent || '';
        const pre = document.createElement('pre');
        pre.setAttribute('data-lang', '');
        const code = document.createElement('code');
        code.textContent = text || '';
        if (!code.textContent)
            code.innerHTML = '<br>';
        pre.appendChild(code);
        node.replaceWith(pre);
        dependencies.setCursorToEnd(code);
        dependencies.syncMarkdown();
    }
    function insertHorizontalRule() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount)
            return;
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
        }
        else {
            dependencies.editor.appendChild(hr);
            dependencies.editor.appendChild(p);
        }
        dependencies.setCursorToEnd(p);
        dependencies.syncMarkdown();
    }
    function wrapWithInlineCode() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount)
            return;
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
        }
        else {
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
        if (!sel || !sel.rangeCount)
            return;
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
    let initializeSavedToolbarRangeDone = false;
    function initializeSavedToolbarRange() {
        if (initializeSavedToolbarRangeDone)
            return;
        initializeSavedToolbarRangeDone = true;
        (savedToolbarRange = null);
        (pendingHostInsert = null);
        (hostInsertSequence = 0);
    }
    let initializeControls1Done = false;
    function initializeControls1() {
        if (initializeControls1Done)
            return;
        initializeControls1Done = true;
        document.addEventListener('keydown', async function (e) {
            const isMod = e.ctrlKey || e.metaKey;
            // Handle paste shortcut for Kiro only
            // Kiro's paste event doesn't include image data, so we need to use Clipboard API
            // VSCode/Cursor paste event works normally, so skip this for them
            const isKiro = navigator.userAgent.includes('Kiro');
            if (isMod && e.key === 'v' && isKiro) {
                dependencies.logger.log('Cmd/Ctrl+V keydown detected (Kiro)');
                if (navigator.clipboard && navigator.clipboard.read) {
                    try {
                        const items = await navigator.clipboard.read();
                        for (const item of items) {
                            for (const type of item.types) {
                                if (type.startsWith('image/')) {
                                    dependencies.logger.log('Found image in clipboard via Clipboard API (Kiro):', type);
                                    e.preventDefault();
                                    const blob = await item.getType(type);
                                    const reader = new FileReader();
                                    reader.onload = function (event) {
                                        const dataUrl = event.target.result;
                                        dependencies.host.saveImageAndInsert(dataUrl);
                                        dependencies.logger.log('Image sent to extension for saving (Kiro)');
                                    };
                                    reader.readAsDataURL(blob);
                                    return;
                                }
                            }
                        }
                        // No image found - let native paste event handle text
                        dependencies.logger.log('No image in clipboard, falling through to native paste (Kiro)');
                    }
                    catch (err) {
                        dependencies.logger.log('Clipboard API read failed (Kiro):', err.message);
                    }
                }
            }
            // Undo (Ctrl+Z / Cmd+Z)
            if (isMod && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                e.stopPropagation();
                dependencies.undoManager.undo();
                return;
            }
            // Redo (Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y)
            if (isMod && ((e.shiftKey && e.key.toLowerCase() === 'z') || (!e.shiftKey && e.key === 'y'))) {
                e.preventDefault();
                e.stopPropagation();
                dependencies.undoManager.redo();
                return;
            }
            // Save snapshot before structural shortcuts (not for save/find/select-all/undo/redo/copy/cut/paste/modifier-only)
            if (isMod && !dependencies.isSourceMode && e.key !== 's' && e.key !== 'f' && e.key !== 'h' && e.key !== 'l' && e.key !== 'a'
                && e.key !== 'z' && e.key !== 'Z' && e.key !== 'y' && e.key !== 'v' && e.key !== 'c' && e.key !== 'x'
                && e.key !== '/'
                && e.key.toLowerCase() !== 'u'
                && e.key !== 'Meta' && e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt') {
                dependencies.undoManager.saveSnapshot();
            }
            // Save
            if (isMod && e.key === 's') {
                e.preventDefault();
                e.stopPropagation();
                dependencies.saveCurrentDocument();
                return;
            }
            // Bold (Ctrl+B)
            if (isMod && !e.shiftKey && e.key === 'b') {
                e.preventDefault();
                e.stopPropagation();
                dependencies.applyInlineFormat('strong');
                dependencies.syncMarkdown();
                return;
            }
            // Italic (Ctrl+I)
            if (isMod && !e.shiftKey && e.key === 'i') {
                e.preventDefault();
                e.stopPropagation();
                dependencies.applyInlineFormat('em');
                dependencies.syncMarkdown();
                return;
            }
            // Underline (Ctrl+U / Cmd+U)
            if (isMod && !e.shiftKey && e.key.toLowerCase() === 'u') {
                e.preventDefault();
                e.stopPropagation();
                dependencies.toggleUnderline();
                return;
            }
            // Strikethrough (Ctrl+Shift+S)
            if (isMod && e.shiftKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                e.stopPropagation();
                dependencies.applyInlineFormat('del');
                dependencies.syncMarkdown();
                return;
            }
            // Heading shortcuts (Ctrl+1 to Ctrl+6)
            if (isMod && !e.shiftKey && e.key >= '1' && e.key <= '6') {
                e.preventDefault();
                e.stopPropagation();
                const level = parseInt(e.key);
                convertToHeading(level);
                return;
            }
            // Paragraph (Ctrl+0)
            if (isMod && !e.shiftKey && e.key === '0') {
                e.preventDefault();
                e.stopPropagation();
                convertToParagraph();
                return;
            }
            // Unordered list (Ctrl+Shift+U)
            if (isMod && e.shiftKey && e.key === 'U') {
                e.preventDefault();
                e.stopPropagation();
                if (!dependencies.convertListToType('ul')) {
                    dependencies.convertToList('ul');
                }
                return;
            }
            // Ordered list (Ctrl+Shift+O)
            if (isMod && e.shiftKey && e.key === 'O') {
                e.preventDefault();
                e.stopPropagation();
                if (!dependencies.convertListToType('ol')) {
                    dependencies.convertToList('ol');
                }
                return;
            }
            // Task list (Ctrl+Shift+X)
            if (isMod && e.shiftKey && e.key === 'X') {
                e.preventDefault();
                e.stopPropagation();
                if (!dependencies.convertListToType('task')) {
                    dependencies.convertToTaskList();
                }
                return;
            }
            // Blockquote (Ctrl+Shift+Q)
            if (isMod && e.shiftKey && e.key === 'Q') {
                e.preventDefault();
                e.stopPropagation();
                convertToBlockquote();
                return;
            }
            // Code block (Ctrl+Shift+K)
            if (isMod && e.shiftKey && e.key === 'K') {
                e.preventDefault();
                e.stopPropagation();
                convertToCodeBlock();
                return;
            }
            // Table (Ctrl+T)
            if (isMod && !e.shiftKey && e.key === 't') {
                e.preventDefault();
                e.stopPropagation();
                insertTable();
                return;
            }
            // Horizontal rule (Ctrl+Shift+-)
            if (isMod && e.shiftKey && (e.key === '-' || e.key === '_')) {
                e.preventDefault();
                e.stopPropagation();
                insertHorizontalRule();
                return;
            }
            // Command Palette (Ctrl+/ or Cmd+/)
            if (isMod && !e.shiftKey && e.key === '/') {
                e.preventDefault();
                e.stopPropagation();
                if (dependencies.commandPaletteVisible) {
                    dependencies.closeCommandPalette();
                }
                else {
                    dependencies.openCommandPalette();
                }
                return;
            }
            // Inline code (Ctrl+\`)
            if (isMod && !e.shiftKey && e.key === '\`') {
                e.preventDefault();
                e.stopPropagation();
                wrapWithInlineCode();
                return;
            }
            // Link (Ctrl+K)
            if (isMod && !e.shiftKey && e.key === 'k') {
                e.preventDefault();
                e.stopPropagation();
                insertLink();
                return;
            }
            // Image (Ctrl+Shift+I)
            if (isMod && e.shiftKey && e.key === 'I') {
                e.preventDefault();
                e.stopPropagation();
                // Trigger image insertion via toolbar
                dependencies.toolbar.querySelector('[data-action="image"]')?.click();
                return;
            }
            // Send selection to chat (Cmd+L / Ctrl+L)
            if (isMod && e.key === 'l') {
                var chatSel = window.getSelection();
                if (!chatSel || chatSel.isCollapsed || !chatSel.rangeCount)
                    return;
                e.preventDefault();
                e.stopPropagation();
                var chatRange = chatSel.getRangeAt(0);
                // Walk up to find direct children of editor
                function findEditorChild(node) {
                    while (node && node.parentNode !== dependencies.editor) {
                        node = node.parentNode;
                    }
                    return node;
                }
                // Find the nearest li or tr ancestor (sub-block element)
                function findSubBlockEl(node) {
                    while (node && node !== dependencies.editor) {
                        var tag = node.tagName && node.tagName.toLowerCase();
                        if (tag === 'li' || tag === 'tr')
                            return node;
                        node = node.parentNode;
                    }
                    return null;
                }
                // Count total li elements in a list recursively
                function countLisInList(listEl) {
                    var count = 0;
                    for (var i = 0; i < listEl.children.length; i++) {
                        var li = listEl.children[i];
                        if (!li.tagName || li.tagName.toLowerCase() !== 'li')
                            continue;
                        count++;
                        for (var j = 0; j < li.children.length; j++) {
                            var child = li.children[j];
                            var ct = child.tagName && child.tagName.toLowerCase();
                            if (ct === 'ul' || ct === 'ol')
                                count += countLisInList(child);
                        }
                    }
                    return count;
                }
                // Get 0-indexed line offset of targetLi within a list block
                // Each li = 1 markdown line; nested lis follow their parent
                function getListLineOffset(listEl, targetLi) {
                    const sourceLocation = getSourceListItemLocation(listEl, targetLi);
                    if (sourceLocation)
                        return sourceLocation.offset;
                    var offset = 0;
                    var found = false;
                    function walk(ulOrOl) {
                        if (found)
                            return;
                        for (var i = 0; i < ulOrOl.children.length; i++) {
                            if (found)
                                return;
                            var li = ulOrOl.children[i];
                            if (!li.tagName || li.tagName.toLowerCase() !== 'li')
                                continue;
                            if (li === targetLi) {
                                found = true;
                                return;
                            }
                            if (li.contains(targetLi)) {
                                offset++; // this li's own line
                                for (var j = 0; j < li.children.length; j++) {
                                    if (found)
                                        return;
                                    var child = li.children[j];
                                    var ct = child.tagName && child.tagName.toLowerCase();
                                    if (ct === 'ul' || ct === 'ol')
                                        walk(child);
                                }
                                return;
                            }
                            // li not related to target — count it + all descendants
                            offset++;
                            for (var j = 0; j < li.children.length; j++) {
                                var child = li.children[j];
                                var ct = child.tagName && child.tagName.toLowerCase();
                                if (ct === 'ul' || ct === 'ol')
                                    offset += countLisInList(child);
                            }
                        }
                    }
                    walk(listEl);
                    return found ? offset : 0;
                }
                // Get line count for a single li (1 for itself + nested lis)
                function getLiLineCount(li) {
                    const sourceLocation = getSourceListItemLocation(findEditorChild(li), li);
                    if (sourceLocation)
                        return sourceLocation.count;
                    var count = 1;
                    for (var j = 0; j < li.children.length; j++) {
                        var child = li.children[j];
                        var ct = child.tagName && child.tagName.toLowerCase();
                        if (ct === 'ul' || ct === 'ol')
                            count += countLisInList(child);
                    }
                    return count;
                }
                function getSourceListItemLocation(listEl, targetLi) {
                    const content = sourceLocations.get(listEl)?.content;
                    if (!content)
                        return null;
                    const items = [];
                    const visit = block => {
                        if (block.type === 'list_item')
                            items.push(block);
                        block.children.forEach(visit);
                    };
                    window.BinaryMarkdownBlocks.parse(content).blocks.forEach(visit);
                    const index = Array.from(listEl.querySelectorAll('li')).indexOf(targetLi);
                    const map = items[index]?.map;
                    if (!map)
                        return null;
                    const text = content.split('\n').slice(map[0], map[1]).join('\n').trimEnd();
                    return { offset: map[0], count: text.split('\n').length };
                }
                // Get 0-indexed markdown line offset of targetTr within a table
                // Row 0 → line 0 (header), separator → line 1, Row N (N≥1) → line N+1
                function getTableLineOffset(tableEl, targetTr) {
                    var rows = tableEl.querySelectorAll('tr');
                    for (var i = 0; i < rows.length; i++) {
                        if (rows[i] === targetTr)
                            return i === 0 ? 0 : i + 1;
                    }
                    return 0;
                }
                // Count line index where next content starts (includes trailing empty lines)
                // "# Heading\n\n" → 2 (heading on line 0, empty on line 1, next starts at 2)
                function countLinesTotal(md) {
                    if (!md)
                        return 0;
                    return md.split('\n').length - 1;
                }
                // Count content lines only (excludes trailing empty lines)
                // "# Heading\n\n" → 1 (only "# Heading" is content)
                function countContentLines(md) {
                    if (!md)
                        return 0;
                    var lines = md.split('\n');
                    while (lines.length > 0 && lines[lines.length - 1] === '')
                        lines.pop();
                    return lines.length;
                }
                var startBlock = findEditorChild(chatRange.startContainer);
                var endBlock = findEditorChild(chatRange.endContainer);
                if (!startBlock || !endBlock)
                    return;
                var editorChildren = Array.from(dependencies.editor.childNodes);
                var startIdx = editorChildren.indexOf(startBlock);
                var endIdx = editorChildren.indexOf(endBlock);
                if (startIdx < 0 || endIdx < 0)
                    return;
                var startSubEl = findSubBlockEl(chatRange.startContainer);
                var endSubEl = findSubBlockEl(chatRange.endContainer);
                // Source separators live outside the DOM; use the same layout
                // serializer as saving when mapping a selection back to lines.
                var sourceLocations = new Map();
                dependencies.serializeMarkdownBlocks(dependencies.editor, true, (node, before, content) => {
                    sourceLocations.set(node, { start: countLinesTotal(before), content });
                });
                if (!sourceLocations.has(startBlock) || !sourceLocations.has(endBlock))
                    return;
                var startBaseLine = sourceLocations.get(startBlock).start;
                var startInBlockOffset = 0;
                var startBlockTag = startBlock.tagName && startBlock.tagName.toLowerCase();
                if (startSubEl && startSubEl.tagName) {
                    var ssTag = startSubEl.tagName.toLowerCase();
                    if (ssTag === 'li' && (startBlockTag === 'ul' || startBlockTag === 'ol')) {
                        startInBlockOffset = getListLineOffset(startBlock, startSubEl);
                    }
                    else if (ssTag === 'tr' && startBlockTag === 'table') {
                        startInBlockOffset = getTableLineOffset(startBlock, startSubEl);
                    }
                }
                var startLine = startBaseLine + startInBlockOffset;
                // --- Calculate endLine ---
                var endBaseLine = sourceLocations.get(endBlock).start;
                var endLine;
                var endBlockTag = endBlock.tagName && endBlock.tagName.toLowerCase();
                if (endSubEl && endSubEl.tagName) {
                    var esTag = endSubEl.tagName.toLowerCase();
                    if (esTag === 'li' && (endBlockTag === 'ul' || endBlockTag === 'ol')) {
                        var endInBlockOffset = getListLineOffset(endBlock, endSubEl);
                        var endLiLines = getLiLineCount(endSubEl);
                        endLine = endBaseLine + endInBlockOffset + endLiLines - 1;
                    }
                    else if (esTag === 'tr' && endBlockTag === 'table') {
                        endLine = endBaseLine + getTableLineOffset(endBlock, endSubEl);
                    }
                    else {
                        endLine = endBaseLine + countContentLines(sourceLocations.get(endBlock).content) - 1;
                    }
                }
                else {
                    endLine = endBaseLine + countContentLines(sourceLocations.get(endBlock).content) - 1;
                }
                // --- selectedMarkdown: slice from full document markdown ---
                var fullMd = dependencies.htmlToMarkdown();
                var fullLines = fullMd.split('\n');
                var safeEnd = Math.min(endLine, fullLines.length - 1);
                var mdSelected = fullLines.slice(startLine, safeEnd + 1).join('\n').trim();
                dependencies.host.sendToChat(startLine, endLine, mdSelected);
                return;
            }
        });
    }
    return {
        dispatchToolbarAction,
        executeCommandPaletteAction,
        executeEditorCommand,
        convertToHeading,
        convertToParagraph,
        convertToBlockquote,
        convertToCodeBlock,
        insertHorizontalRule,
        wrapWithInlineCode,
        insertLink,
        get savedToolbarRange() { return savedToolbarRange; }, set savedToolbarRange(value) { savedToolbarRange = value; },
        get pendingHostInsert() { return pendingHostInsert; }, set pendingHostInsert(value) { pendingHostInsert = value; },
        get hostInsertSequence() { return hostInsertSequence; }, set hostInsertSequence(value) { hostInsertSequence = value; },
        initializeSavedToolbarRange,
        initializeControls1
    };
}
module.exports = { createCommands };
