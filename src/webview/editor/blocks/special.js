'use strict';
// Construction defines capabilities; bootstrap controls the original initialization order.
function createSpecial(dependencies) {
    let finishInlineMathEdit, mermaidRenderVersions, mermaidInitialized, mermaidReady;
    // Helper: check if element is a special wrapper (mermaid or math)
    function isSpecialWrapper(el) {
        return el && el.tagName === 'DIV' && el.classList &&
            (el.classList.contains('mermaid-wrapper') || el.classList.contains('math-wrapper'));
    }
    // Helper: enter special wrapper edit mode and set cursor
    function enterSpecialWrapperEditMode(wrapper, cursorPosition) {
        wrapper.setAttribute('data-mode', 'edit');
        var preSelector = wrapper.classList.contains('mermaid-wrapper')
            ? 'pre[data-lang="mermaid"]' : 'pre[data-lang="math"]';
        var pre = wrapper.querySelector(preSelector);
        if (pre) {
            var code = pre.querySelector('code');
            if (code) {
                // The display-only trailing <br> (data-trailing-br) doubles as
                // the edit-mode visibility <br> for trailing empty lines.
                // Keep it in the DOM but switch tracking from data-trailing-br
                // to codeBlocksWithSentinel so Markdown conversion strips it.
                if (code.getAttribute('data-trailing-br') === 'true') {
                    code.removeAttribute('data-trailing-br');
                    dependencies.codeBlocksWithSentinel.add(wrapper);
                }
                code.focus();
                if (cursorPosition === 'end') {
                    dependencies.setCursorToEnd(code);
                }
                else if (cursorPosition === 'start') {
                    dependencies.setCursorToFirstTextNode(code);
                }
                else if (cursorPosition === 'lastLineStart') {
                    dependencies.setCursorToLastLineStartByDOM(code);
                }
            }
        }
    }
    // Helper: strip sentinel \n from code element and rebuild its DOM.
    // Used by enterDisplayMode and exitSpecialWrapperDisplayMode when
    // transitioning from edit mode back to display mode.
    function stripSentinelAndRebuildCode(code) {
        var plainText = dependencies.getCodePlainText(code);
        if (plainText.endsWith('\n')) {
            plainText = plainText.slice(0, -1);
        }
        if (!plainText || plainText === '') {
            code.innerHTML = '<br>';
            code.removeAttribute('data-trailing-br');
        }
        else if (plainText.endsWith('\n')) {
            code.innerHTML = dependencies.escapeHtml(plainText).replace(/\n/g, '<br>') + '<br>';
            code.setAttribute('data-trailing-br', 'true');
        }
        else {
            code.innerHTML = dependencies.escapeHtml(plainText).replace(/\n/g, '<br>');
            code.removeAttribute('data-trailing-br');
        }
    }
    // Helper: exit special wrapper to display mode and re-render
    function exitSpecialWrapperDisplayMode(wrapper) {
        var hasSentinel = dependencies.codeBlocksWithSentinel.has(wrapper);
        wrapper.setAttribute('data-mode', 'display');
        if (hasSentinel) {
            dependencies.codeBlocksWithSentinel.delete(wrapper);
            var preSelector = wrapper.classList.contains('mermaid-wrapper')
                ? 'pre[data-lang="mermaid"]' : 'pre[data-lang="math"]';
            var pre = wrapper.querySelector(preSelector);
            if (pre) {
                var code = pre.querySelector('code');
                if (code) {
                    stripSentinelAndRebuildCode(code);
                }
            }
        }
        if (wrapper.classList.contains('mermaid-wrapper')) {
            renderMermaidDiagram(wrapper);
        }
        else if (wrapper.classList.contains('math-wrapper')) {
            renderMathBlock(wrapper);
        }
    }
    // Wait for mermaid to be loaded
    function waitForMermaid(callback, maxAttempts = 50) {
        let attempts = 0;
        dependencies.logger.log('waitForMermaid started');
        const check = () => {
            dependencies.logger.log('waitForMermaid check attempt:', attempts, 'mermaid defined:', typeof mermaid !== 'undefined');
            if (typeof mermaid !== 'undefined') {
                mermaidReady = true;
                dependencies.logger.log('Mermaid is ready, calling callback');
                callback();
            }
            else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(check, 100);
            }
            else {
                dependencies.logger.warn('Mermaid library failed to load after', maxAttempts, 'attempts');
            }
        };
        check();
    }
    function initMermaid() {
        dependencies.logger.log('initMermaid called, initialized:', mermaidInitialized, 'mermaid defined:', typeof mermaid !== 'undefined');
        if (typeof mermaid === 'undefined')
            return false;
        if (mermaidInitialized)
            return true;
        // Determine theme based on current editor theme
        const theme = document.documentElement.dataset.theme;
        const mermaidTheme = (theme === 'night' || theme === 'dark') ? 'dark' : 'default';
        dependencies.logger.log('Initializing mermaid with theme:', mermaidTheme);
        mermaid.initialize({
            startOnLoad: false,
            theme: mermaidTheme,
            securityLevel: 'strict',
            flowchart: { useMaxWidth: true },
            sequence: { useMaxWidth: true }
        });
        mermaidInitialized = true;
        dependencies.logger.log('Mermaid initialized successfully');
        return true;
    }
    function setBlockDiagnostic(wrapper, error, source = '') {
        wrapper.dataset.renderError = error ? String(error.message || error).slice(0, 1000) : '';
        const expected = error?.hash?.expected;
        // Mermaid's SQE token is a square node-shape terminator. Derive the
        // recovery hint from the actual parser expectation, not guessed source.
        wrapper.dataset.renderErrorSummary = Array.isArray(expected) && expected.some(token => String(token).replace(/['"]/g, '') === 'SQE') ? dependencies.i18n.diagramExpectedNodeEnd : '';
        const reported = error?.hash?.loc?.first_line;
        // Jison locations are one-based. Plain message text is not a reliable authored-source coordinate.
        const line = Number.isInteger(reported) && reported > 0 && reported <= source.split('\n').length ? reported : Number.isInteger(error?.position) && error.position >= 0 && error.position <= source.length ? source.slice(0, error.position).split('\n').length : null;
        if (line)
            wrapper.dataset.errorLine = String(line);
        else
            delete wrapper.dataset.errorLine;
        if (dependencies.workspaceUi)
            dependencies.workspaceUi.refresh();
    }
    async function renderMermaidDiagram(wrapper) {
        const version = (mermaidRenderVersions.get(wrapper) || 0) + 1;
        mermaidRenderVersions.set(wrapper, version);
        dependencies.logger.log('renderMermaidDiagram called');
        if (!initMermaid()) {
            dependencies.logger.log('initMermaid returned false, skipping render');
            return;
        }
        const pre = wrapper.querySelector('pre[data-lang="mermaid"]');
        const diagramDiv = wrapper.querySelector('.mermaid-diagram');
        dependencies.logger.log('pre found:', !!pre, 'diagramDiv found:', !!diagramDiv);
        if (!pre || !diagramDiv)
            return;
        // Get code content, converting <br> back to newlines
        const code = pre.querySelector('code');
        let mermaidCode = '';
        if (code) {
            mermaidCode = dependencies.getCodePlainText(code);
        }
        mermaidCode = mermaidCode.trim();
        dependencies.logger.log('mermaidCode length:', mermaidCode.length);
        if (!mermaidCode) {
            diagramDiv.innerHTML = '<div class="mermaid-error">' + dependencies.escapeHtml(dependencies.i18n.diagramSyntaxError) + '</div>';
            setBlockDiagnostic(wrapper, new Error(dependencies.i18n.diagramSyntaxError));
            return;
        }
        try {
            const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
            dependencies.logger.log('Calling mermaid.render with id:', id);
            const { svg } = await mermaid.render(id, mermaidCode);
            dependencies.logger.log('mermaid.render succeeded, svg length:', svg?.length);
            if (mermaidRenderVersions.get(wrapper) !== version || !wrapper.isConnected)
                return;
            diagramDiv.innerHTML = svg;
            setBlockDiagnostic(wrapper, null);
        }
        catch (err) {
            if (mermaidRenderVersions.get(wrapper) !== version || !wrapper.isConnected)
                return;
            setBlockDiagnostic(wrapper, err, mermaidCode);
            dependencies.logger.error('mermaid.render failed:', err);
            diagramDiv.innerHTML = '<div class="mermaid-error">' + dependencies.escapeHtml(dependencies.i18n.diagramSyntaxError) + '</div>';
        }
    }
    function setupMermaidDiagrams() {
        const wrappers = dependencies.editor.querySelectorAll('.mermaid-wrapper');
        dependencies.logger.log('setupMermaidDiagrams called, found wrappers:', wrappers.length);
        if (wrappers.length === 0)
            return;
        // Wait for mermaid to be loaded before rendering
        waitForMermaid(() => {
            dependencies.logger.log('waitForMermaid callback, processing', wrappers.length, 'wrappers');
            wrappers.forEach(wrapper => {
                // Skip if already setup
                if (wrapper.dataset.mermaidSetup) {
                    dependencies.logger.log('Wrapper already setup, skipping');
                    return;
                }
                wrapper.dataset.mermaidSetup = 'true';
                dependencies.logger.log('Setting up wrapper');
                renderMermaidDiagram(wrapper);
                // Add click handler to enter editing mode
                wrapper.addEventListener('click', function (e) {
                    // Don't enter edit mode if clicking on the diagram itself when already in display mode
                    if (wrapper.getAttribute('data-mode') !== 'edit') {
                        wrapper.setAttribute('data-mode', 'edit');
                        const pre = wrapper.querySelector('pre[data-lang="mermaid"]');
                        if (pre) {
                            const code = pre.querySelector('code');
                            if (code) {
                                code.focus();
                                dependencies.setCursorToEnd(code);
                            }
                        }
                    }
                });
                // Add focusout handler to return to display mode and re-render
                const pre = wrapper.querySelector('pre[data-lang="mermaid"]');
                if (pre) {
                    const code = pre.querySelector('code');
                    if (code) {
                        // Add input handler for live diagram updates
                        let renderTimeout = null;
                        pre.addEventListener('input', () => {
                            dependencies.logger.log('Mermaid input event fired (setupMermaidDiagrams)');
                            // Debounce rendering to avoid too frequent updates
                            if (renderTimeout) {
                                clearTimeout(renderTimeout);
                            }
                            renderTimeout = setTimeout(() => {
                                dependencies.logger.log('Rendering mermaid diagram after input');
                                renderMermaidDiagram(wrapper);
                            }, 500);
                        });
                        code.addEventListener('focusout', (e) => {
                            setTimeout(() => {
                                const activeEl = document.activeElement;
                                if (!wrapper.contains(activeEl)) {
                                    if (wrapper.getAttribute('data-mode') === 'edit') {
                                        wrapper.setAttribute('data-mode', 'display');
                                        // Re-render the diagram with updated code
                                        renderMermaidDiagram(wrapper);
                                        dependencies.syncMarkdown();
                                    }
                                }
                            }, 100);
                        });
                    }
                }
            });
        });
    }
    // ========== KATEX MATH BLOCK FUNCTIONALITY ==========
    function inlineMathHtml(equation) {
        return '<span class="math-inline" contenteditable="false" tabindex="0" role="button"' +
            ' aria-label="' + dependencies.escapeHtml(dependencies.i18n.editEquation || 'Edit equation') + '"' +
            ' data-math-raw="' + dependencies.escapeHtml(encodeURIComponent(equation.raw)) + '"' +
            ' data-math-tex="' + dependencies.escapeHtml(encodeURIComponent(equation.tex)) + '"' +
            ' data-math-open="' + dependencies.escapeHtml(equation.open) + '" data-math-close="' + dependencies.escapeHtml(equation.close) + '">' +
            dependencies.escapeHtml(equation.raw) + '</span>';
    }
    function inlineMathMarkdown(span) {
        return decodeURIComponent(span.dataset.mathRaw || '');
    }
    function renderInlineMath(span, strict = false) {
        span.innerHTML = katex.renderToString(decodeURIComponent(span.dataset.mathTex), {
            displayMode: false, throwOnError: strict, trust: false, output: 'html'
        });
    }
    function setupInlineMath() {
        const spans = dependencies.editor.querySelectorAll('.math-inline');
        if (!spans.length)
            return;
        waitForKatex(() => spans.forEach(span => {
            if (span.dataset.mathSetup)
                return;
            span.dataset.mathSetup = 'true';
            renderInlineMath(span);
        }));
    }
    function editInlineMath(span) {
        if (dependencies.isSourceMode)
            return;
        if (finishInlineMathEdit)
            finishInlineMathEdit(true, false);
        const input = document.createElement('input');
        input.className = 'math-inline-input';
        input.setAttribute('aria-label', dependencies.i18n.editEquation || 'Edit equation');
        input.title = dependencies.i18n.equationEditHint || 'Enter to apply; Escape to cancel';
        input.spellcheck = false;
        const original = decodeURIComponent(span.dataset.mathTex);
        input.value = original;
        const rect = span.getBoundingClientRect();
        const inputWidth = Math.min(480, window.innerWidth - 16);
        input.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - inputWidth - 8)) + 'px';
        input.style.top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 50)) + 'px';
        document.body.appendChild(input);
        const finish = (apply, focus) => {
            if (finishInlineMathEdit !== finish)
                return;
            finishInlineMathEdit = null;
            const value = input.value;
            input.remove();
            if (!span.isConnected)
                return;
            if (apply && value !== original) {
                dependencies.markdown = dependencies.readCurrentMarkdown();
                dependencies.undoManager.saveSnapshot();
                if (value.trim()) {
                    span.dataset.mathTex = encodeURIComponent(value);
                    span.dataset.mathRaw = encodeURIComponent(span.dataset.mathOpen + value + span.dataset.mathClose);
                    renderInlineMath(span);
                }
                else {
                    // Empty inline delimiters are ambiguous with display math.
                    const placeholder = document.createTextNode('');
                    span.replaceWith(placeholder);
                    span = placeholder;
                }
                dependencies.syncMarkdownSync();
            }
            if (focus) {
                dependencies.editor.focus();
                const range = document.createRange();
                range.setStartAfter(span);
                range.collapse(true);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        };
        finishInlineMathEdit = finish;
        input.addEventListener('blur', () => finish(true, false));
        input.addEventListener('keydown', event => {
            event.stopPropagation();
            if (event.isComposing)
                return;
            if (event.key === 'Enter' || event.key === 'Escape') {
                event.preventDefault();
                finish(event.key === 'Enter', true);
            }
            else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                finish(true, false);
                dependencies.saveCurrentDocument();
            }
        });
        input.focus();
        input.select();
    }
    function mathBlockHtml(block) {
        const trailing = block.tex.endsWith('\n');
        const code = block.tex ? dependencies.escapeHtml(block.tex).replace(/\n/g, '<br>') + (trailing ? '<br>' : '') : '<br>';
        return '<div class="math-wrapper" data-mode="display" contenteditable="false"' +
            ' data-math-original="' + dependencies.escapeHtml(encodeURIComponent(block.raw)) + '"' +
            ' data-math-initial="' + dependencies.escapeHtml(encodeURIComponent(block.tex)) + '"' +
            ' data-math-open="' + dependencies.escapeHtml(block.open) + '" data-math-close="' + dependencies.escapeHtml(block.close) + '"' +
            ' data-math-single="' + Boolean(block.singleLine) + '">' +
            '<pre data-lang="math" contenteditable="true"><code' + (trailing ? ' data-trailing-br="true"' : '') + '>' + code + '</code></pre>' +
            '<div class="math-display"></div></div>';
    }
    function mathBlockMarkdown(wrapper) {
        const code = wrapper.querySelector('pre code');
        const tex = code && code.innerHTML !== '<br>' ? dependencies.stripTrailingNewlines(dependencies.getCodePlainText(code), code, wrapper) : '';
        if (wrapper.hasAttribute('data-math-original') && tex === decodeURIComponent(wrapper.dataset.mathInitial)) {
            return decodeURIComponent(wrapper.dataset.mathOriginal) + '\n';
        }
        const open = wrapper.dataset.mathOpen || '```math';
        const close = wrapper.dataset.mathClose || '```';
        if (wrapper.dataset.mathSingle === 'true' && !tex.includes('\n'))
            return open + tex + close + '\n';
        return open + '\n' + tex + '\n' + close + '\n';
    }
    function waitForKatex(callback, maxAttempts) {
        maxAttempts = maxAttempts || 50;
        var attempts = 0;
        var check = function () {
            if (typeof katex !== 'undefined') {
                callback();
            }
            else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(check, 100);
            }
            else {
                dependencies.logger.warn('KaTeX library failed to load after', maxAttempts, 'attempts');
            }
        };
        check();
    }
    function renderMathBlock(wrapper, strict) {
        var pre = wrapper.querySelector('pre[data-lang="math"]');
        var displayDiv = wrapper.querySelector('.math-display');
        if (!pre || !displayDiv)
            return;
        var code = pre.querySelector('code');
        var texCode = code ? dependencies.getCodePlainText(code).trim() : '';
        if (!texCode) {
            displayDiv.innerHTML = '<div class="math-error">' + dependencies.escapeHtml(dependencies.i18n.equationUnsupported) + '</div>';
            setBlockDiagnostic(wrapper, new Error(dependencies.i18n.equationUnsupported));
            return;
        }
        let diagnostic = null;
        try {
            katex.renderToString(texCode, { displayMode: true, throwOnError: true, trust: false, output: 'html' });
        }
        catch (error) {
            diagnostic = error;
        }
        setBlockDiagnostic(wrapper, diagnostic, texCode);
        try {
            // Newlines are TeX whitespace. Environments such as aligned and
            // matrices must reach KaTeX as one expression, including their rows.
            displayDiv.innerHTML = katex.renderToString(texCode, {
                displayMode: true,
                throwOnError: Boolean(strict),
                trust: false,
                output: 'html'
            });
        }
        catch (err) {
            displayDiv.innerHTML = '<div class="math-error">Error: ' +
                dependencies.escapeHtml(err.message || 'Invalid LaTeX') + '</div>';
        }
    }
    function setupMathBlocks() {
        var wrappers = dependencies.editor.querySelectorAll('.math-wrapper');
        if (wrappers.length === 0)
            return;
        waitForKatex(function () {
            wrappers.forEach(function (wrapper) {
                if (wrapper.dataset.mathSetup)
                    return;
                wrapper.dataset.mathSetup = 'true';
                renderMathBlock(wrapper);
                // Click → edit mode
                wrapper.addEventListener('click', function (e) {
                    if (wrapper.getAttribute('data-mode') !== 'edit') {
                        wrapper.setAttribute('data-mode', 'edit');
                        var pre = wrapper.querySelector('pre[data-lang="math"]');
                        if (pre) {
                            var code = pre.querySelector('code');
                            if (code) {
                                code.focus();
                                dependencies.setCursorToEnd(code);
                            }
                        }
                    }
                });
                // Input → debounce re-render
                var pre = wrapper.querySelector('pre[data-lang="math"]');
                if (pre) {
                    var renderTimeout = null;
                    pre.addEventListener('input', function () {
                        if (renderTimeout)
                            clearTimeout(renderTimeout);
                        renderTimeout = setTimeout(function () {
                            renderMathBlock(wrapper);
                        }, 500);
                    });
                    var code = pre.querySelector('code');
                    if (code) {
                        // Focusout → display mode
                        code.addEventListener('focusout', function (e) {
                            setTimeout(function () {
                                if (!wrapper.contains(document.activeElement)) {
                                    if (wrapper.getAttribute('data-mode') === 'edit') {
                                        wrapper.setAttribute('data-mode', 'display');
                                        renderMathBlock(wrapper);
                                        dependencies.syncMarkdown();
                                    }
                                }
                            }, 100);
                        });
                    }
                }
            });
        });
    }
    let initializeFinishInlineMathEditDone = false;
    function initializeFinishInlineMathEdit() {
        if (initializeFinishInlineMathEditDone)
            return;
        initializeFinishInlineMathEditDone = true;
        (finishInlineMathEdit = null);
    }
    let initializeMermaidRenderVersions1Done = false;
    function initializeMermaidRenderVersions1() {
        if (initializeMermaidRenderVersions1Done)
            return;
        initializeMermaidRenderVersions1Done = true;
        (mermaidRenderVersions = new WeakMap());
    }
    let initializeMermaidInitialized2Done = false;
    function initializeMermaidInitialized2() {
        if (initializeMermaidInitialized2Done)
            return;
        initializeMermaidInitialized2Done = true;
        (mermaidInitialized = false);
        (mermaidReady = false);
        dependencies.editor.addEventListener('click', event => {
            const span = event.target.closest && event.target.closest('.math-inline');
            if (!span)
                return;
            event.preventDefault();
            event.stopImmediatePropagation();
            editInlineMath(span);
        }, true);
        dependencies.editor.addEventListener('keydown', event => {
            if (event.target.classList.contains('math-inline') && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                event.stopImmediatePropagation();
                editInlineMath(event.target);
            }
        }, true);
    }
    return {
        isSpecialWrapper,
        enterSpecialWrapperEditMode,
        stripSentinelAndRebuildCode,
        exitSpecialWrapperDisplayMode,
        waitForMermaid,
        initMermaid,
        setBlockDiagnostic,
        renderMermaidDiagram,
        setupMermaidDiagrams,
        inlineMathHtml,
        inlineMathMarkdown,
        renderInlineMath,
        setupInlineMath,
        editInlineMath,
        mathBlockHtml,
        mathBlockMarkdown,
        waitForKatex,
        renderMathBlock,
        setupMathBlocks,
        get finishInlineMathEdit() { return finishInlineMathEdit; }, set finishInlineMathEdit(value) { finishInlineMathEdit = value; },
        get mermaidRenderVersions() { return mermaidRenderVersions; }, set mermaidRenderVersions(value) { mermaidRenderVersions = value; },
        get mermaidInitialized() { return mermaidInitialized; }, set mermaidInitialized(value) { mermaidInitialized = value; },
        get mermaidReady() { return mermaidReady; }, set mermaidReady(value) { mermaidReady = value; },
        initializeFinishInlineMathEdit,
        initializeMermaidRenderVersions1,
        initializeMermaidInitialized2
    };
}
module.exports = { createSpecial };
