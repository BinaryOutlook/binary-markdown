(function() {
    'use strict';
    window.BinaryWorkspaceUi = { create };

    // Optional view controls share the core editor's commands and never serialize
    // UI state into the document. User-derived labels are always plain text.
    function create(options) {
        const { editor, sourceEditor, wrapper, outline, toolbar, i18n, icons } = options;
        const byId = id => document.getElementById(id);
        const button = (label, handler) => {
            const node = document.createElement('button');
            node.type = 'button'; node.textContent = label;
            node.addEventListener('click', handler); return node;
        };
        const format = byId('formatButton');
        if (format) format.addEventListener('click', options.openActions);
        const allActions = byId('allActionsButton');
        if (allActions) allActions.addEventListener('click', options.openActions);
        const contextToggle = byId('contextToolbarToggle');
        let contextual = false;
        const context = document.createElement('div');
        context.className = 'context-format-toolbar'; context.hidden = true;
        context.setAttribute('role', 'toolbar'); context.setAttribute('aria-label', i18n.formatActions);
        let selection = null;
        for (const action of ['bold', 'italic', 'underline', 'strikethrough', 'code', 'link']) {
            const original = toolbar.querySelector('[data-action="' + action + '"]');
            if (!original) continue;
            const control = button('', () => {
                if (!selection?.startContainer.isConnected || options.isSourceMode()) return;
                editor.focus({ preventScroll: true });
                const live = window.getSelection(); live.removeAllRanges(); live.addRange(selection);
                options.format(action);
            });
            control.innerHTML = icons[action] || '';
            control.title = original.title; control.setAttribute('aria-label', original.title);
            control.addEventListener('mousedown', event => event.preventDefault());
            context.appendChild(control);
        }
        const contextMore = button('…', options.openActions);
        contextMore.setAttribute('aria-label', i18n.allActions);
        contextMore.title = i18n.allActions;
        contextMore.setAttribute('aria-haspopup', 'dialog');
        context.appendChild(contextMore);
        document.body.appendChild(context);
        function positionContext() {
            if (!contextual || options.isSourceMode()) { context.hidden = true; return; }
            const live = window.getSelection();
            const range = live?.rangeCount ? live.getRangeAt(0) : null;
            if (range && !range.collapsed && editor.contains(range.commonAncestorContainer) &&
                !(range.startContainer.parentElement?.closest('pre,.math-wrapper,.mermaid-wrapper,.document-aux,.math-inline'))) {
                selection = range.cloneRange();
            } else if (!context.contains(document.activeElement)) { context.hidden = true; return; }
            const rect = selection?.getBoundingClientRect();
            const pane = wrapper.getBoundingClientRect();
            if (!rect || rect.bottom < pane.top || rect.top > pane.bottom) { context.hidden = true; return; }
            context.hidden = false;
            const width = context.offsetWidth, height = context.offsetHeight;
            // Search the nearest visible gap rather than placing an overlay on
            // the preceding heading. Dense pages retain the permanent Format action.
            const obstacles = [...editor.children, ...document.querySelectorAll('.editor-width-guide button, .editor-width-guide [role="tooltip"]')]
                .map(node => node.getBoundingClientRect()).filter(box => box.width && box.height);
            const minTop = toolbar.getBoundingClientRect().bottom + 6;
            const clampLeft = left => Math.max(pane.left + 4, Math.min(left, pane.right - width - 4));
            const columns = [...new Set([rect.left, rect.left - width - 6, rect.right + 6].map(clampLeft))];
            const positions = [rect.top - height - 8, rect.bottom + 8, rect.top, minTop,
                ...obstacles.flatMap(box => [box.top - height - 6, box.bottom + 6])];
            const candidates = positions.flatMap(top => columns.map(left => ({ left, top }))).filter(({ left, top }) =>
                top >= minTop && top + height <= Math.min(pane.bottom, window.innerHeight) - 4 &&
                !obstacles.some(box => left < box.right + 2 && left + width > box.left - 2 && top < box.bottom + 2 && top + height > box.top - 2));
            const distance = item => Math.hypot(Math.max(rect.left - item.left - width, item.left - rect.right, 0), Math.max(rect.top - item.top - height, item.top - rect.bottom, 0));
            candidates.sort((a, b) => distance(a) - distance(b));
            if (!candidates.length) { context.hidden = true; return; }
            if (distance(candidates[0]) > 96) { context.hidden = true; return; }
            context.style.left = candidates[0].left + 'px';
            context.style.top = candidates[0].top + 'px';
        }
        if (contextToggle) contextToggle.addEventListener('click', () => {
            contextual = !contextual;
            contextToggle.setAttribute('aria-pressed', String(contextual));
            document.documentElement.dataset.contextToolbar = String(contextual);
            if (allActions) allActions.hidden = !contextual;
            options.layout(); positionContext();
        });
        context.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); context.hidden = true; editor.focus({ preventScroll: true }); }
        });
        document.addEventListener('selectionchange', positionContext);
        wrapper.addEventListener('scroll', positionContext);
        window.addEventListener('resize', positionContext);

        const tabs = [byId('outlineTab'), byId('documentTab')].filter(Boolean);
        function selectTab(index) {
            tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
            outline.hidden = index === 1;
            if (byId('documentInfo')) byId('documentInfo').hidden = index === 0;
        }
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => { selectTab(index); refresh(); });
            tab.addEventListener('keydown', event => {
                if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
                    event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
                    selectTab(next); tabs[next].focus();
                }
            });
        });
        // A decorative cue follows the heading containing the source caret.
        // It sits outside authored content and never changes textarea selection.
        const sourceCue = document.createElement('span');
        sourceCue.className = 'source-heading-cue'; sourceCue.hidden = true;
        sourceCue.setAttribute('aria-hidden', 'true'); document.body.appendChild(sourceCue);
        let sourceHeadingLine = null, sourceMeasure = null;
        function refreshSourceHeadingCue() {
            sourceCue.hidden = true;
            if (document.documentElement.dataset.editorMode !== 'split' || sourceHeadingLine === null) return;
            const bounds = sourceEditor.getBoundingClientRect();
            if (!bounds.width || !bounds.height) return;
            const style = getComputedStyle(sourceEditor);
            const properties = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'textIndent'];
            const key = JSON.stringify([sourceEditor.value, sourceHeadingLine, sourceEditor.clientWidth, ...properties.map(name => style[name])]);
            if (sourceMeasure?.key !== key) {
                const mirror = document.createElement('div'); mirror.setAttribute('aria-hidden', 'true');
                Object.assign(mirror.style, { position: 'fixed', left: '-10000px', top: '0', visibility: 'hidden', boxSizing: 'border-box', width: sourceEditor.clientWidth + 'px', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' });
                for (const name of properties) mirror.style[name] = style[name];
                const lines = sourceEditor.value.split('\n');
                mirror.textContent = lines.slice(0, sourceHeadingLine).join('\n') + (sourceHeadingLine ? '\n' : '');
                const marker = document.createElement('span'); marker.textContent = lines[sourceHeadingLine] || ' '; mirror.appendChild(marker);
                document.body.appendChild(mirror);
                try {
                    const box = marker.getBoundingClientRect(), lineHeight = parseFloat(style.lineHeight) || 21;
                    sourceMeasure = { key, top: box.top - mirror.getBoundingClientRect().top - (lineHeight - Math.min(lineHeight, box.height)) / 2, height: Math.ceil(box.height / lineHeight) * lineHeight };
                } finally { mirror.remove(); }
            }
            const top = bounds.top + sourceEditor.clientTop + sourceMeasure.top - sourceEditor.scrollTop;
            const visibleTop = Math.max(bounds.top + sourceEditor.clientTop, top);
            const height = Math.min(bounds.bottom - sourceEditor.clientTop, top + sourceMeasure.height) - visibleTop;
            if (height <= 0) return;
            Object.assign(sourceCue.style, { left: (bounds.left + sourceEditor.clientLeft) + 'px', top: visibleTop + 'px', width: sourceEditor.clientWidth + 'px', height: height + 'px' });
            sourceCue.hidden = false;
        }
        function markSourceHeading(line) {
            sourceHeadingLine = Number.isInteger(line) && line >= 0 ? line : null;
            refreshSourceHeadingCue();
        }
        function decorateBlocks() {
            for (const block of editor.querySelectorAll('.math-wrapper,.mermaid-wrapper')) {
                const diagram = block.classList.contains('mermaid-wrapper');
                let chrome = block.querySelector('.block-chrome');
                if (!chrome) {
                    chrome = document.createElement('div'); chrome.className = 'block-chrome'; chrome.contentEditable = 'false';
                    const title = document.createElement('strong'); title.textContent = diagram ? 'Mermaid' : i18n.equationTitle; chrome.appendChild(title);
                    if (diagram) for (const mode of ['display','edit']) {
                        const toggle = button(mode === 'display' ? i18n.previewLabel : i18n.sourceLabel, event => {
                            event.stopPropagation(); if (options.isSourceMode()) return;
                            block.dataset.mode = mode;
                            if (mode === 'edit') {
                                const source = block.querySelector('pre code'); source.focus({ preventScroll: true });
                                const range = document.createRange(); range.selectNodeContents(source); range.collapse(false);
                                window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
                            }
                            decorateBlocks();
                        });
                        toggle.dataset.blockMode = mode;
                        toggle.addEventListener('mousedown', event => event.preventDefault());
                        chrome.appendChild(toggle);
                    }
                    const hint = document.createElement('small'); hint.textContent = i18n.blockExitHint; chrome.appendChild(hint);
                    if (!diagram) for (const part of ['source', 'preview']) {
                        const scroll = document.createElement('span'); scroll.className = 'block-preview-scroll'; scroll.hidden = true;
                        scroll.dataset.scrollPart = part;
                        const partLabel = part === 'source' ? i18n.sourceLabel : i18n.previewLabel;
                        scroll.setAttribute('role', 'group'); scroll.setAttribute('aria-label', partLabel + ' · ' + i18n.equationScrollHint);
                        const label = document.createElement('span'); label.textContent = scroll.getAttribute('aria-label'); scroll.appendChild(label);
                        for (const [delta, key, symbol] of [[-1, 'equationScrollLeft', '←'], [1, 'equationScrollRight', '→']]) {
                            const control = button(symbol, event => {
                                event.stopPropagation(); const target = block.querySelector(part === 'source' ? 'pre[data-lang="math"]' : '.math-display');
                                target.scrollLeft += delta * Math.max(80, target.clientWidth * .65); decorateBlocks();
                            });
                            control.setAttribute('aria-label', partLabel + ' · ' + i18n[key]); control.title = control.getAttribute('aria-label');
                            control.addEventListener('mousedown', event => event.preventDefault()); scroll.appendChild(control);
                        }
                        chrome.appendChild(scroll);
                        block.querySelector(part === 'source' ? 'pre[data-lang="math"]' : '.math-display')?.addEventListener('scroll', decorateBlocks, { passive: true });
                    }
                    const status = document.createElement('span'); status.className = 'block-status'; status.setAttribute('role', 'status'); chrome.appendChild(status);
                    const concise = document.createElement('span'); concise.className = 'block-error-summary'; concise.hidden = true; chrome.appendChild(concise);
                    const diagnostic = document.createElement('details'); diagnostic.className = 'block-diagnostic';
                    const summary = document.createElement('summary'); summary.textContent = i18n.diagnosticDetails;
                    const detail = document.createElement('div'); detail.className = 'block-diagnostic-text'; diagnostic.append(summary, detail); chrome.appendChild(diagnostic);
                    block.prepend(chrome);
                }
                const pre = block.querySelector(diagram ? 'pre[data-lang="mermaid"]' : 'pre[data-lang="math"]');
                if (pre) {
                    pre.dataset.sourceLabel = i18n.sourceLabel + (block.dataset.errorLine ? ' · ' + i18n.sourceLine + ' ' + block.dataset.errorLine : '');
                    let cue = pre.querySelector('.block-error-line');
                    if (!cue) { cue = document.createElement('span'); cue.className = 'block-error-line'; cue.contentEditable = 'false'; cue.setAttribute('aria-hidden', 'true'); pre.appendChild(cue); }
                    cue.hidden = !block.dataset.errorLine || block.dataset.mode !== 'edit';
                    if (!cue.hidden) {
                        const code = pre.querySelector('code'), lineHeight = parseFloat(getComputedStyle(code).lineHeight) || 22;
                        cue.style.top = (code.getBoundingClientRect().top - pre.getBoundingClientRect().top + (Number(block.dataset.errorLine) - 1) * lineHeight) + 'px';
                        cue.style.height = lineHeight + 'px';
                    }
                }
                const preview = block.querySelector(diagram ? '.mermaid-diagram' : '.math-display');
                if (preview) preview.dataset.previewLabel = i18n.previewLabel;
                for (const scroll of chrome.querySelectorAll('.block-preview-scroll')) {
                    const target = scroll.dataset.scrollPart === 'source' ? pre : preview;
                    scroll.hidden = !target.clientWidth || target.scrollWidth <= target.clientWidth + 1;
                    const controls = scroll.querySelectorAll('button');
                    controls[0].disabled = target.scrollLeft <= 1;
                    controls[1].disabled = target.scrollLeft >= target.scrollWidth - target.clientWidth - 1;
                }
                chrome.querySelectorAll('[data-block-mode]').forEach(toggle => { toggle.disabled = options.isSourceMode(); toggle.setAttribute('aria-pressed', String(block.dataset.mode === toggle.dataset.blockMode)); });
                const error = block.dataset.renderError || '';
                const status = chrome.querySelector('.block-status');
                const unknown = /Undefined control sequence:\s*(\\[A-Za-z]+)/.exec(error);
                const text = error ? (diagram ? i18n.diagramNeedsAttention : unknown ? i18n.unknownEquationCommand + ' ' + unknown[1] : i18n.equationUnsupported) : '';
                if (status.textContent !== text) status.textContent = text;
                status.hidden = !error;
                const concise = chrome.querySelector('.block-error-summary');
                concise.hidden = !diagram || !error;
                // Message-only parser coordinates can disagree with its structured
                // source location. Keep the original error in data-render-error,
                // and expose only the verified source cue as a visible line number.
                const readableError = diagram ? error.replace(/(\b(?:parse|syntax) error)\s+on line \d+\s*:/gi, '$1:') : error;
                concise.textContent = diagram && error ? (block.dataset.renderErrorSummary || (readableError.split(/\r?\n/).find(line => line.trim()) || '').trim()).slice(0, 180) : '';
                const diagnostic = chrome.querySelector('.block-diagnostic'); diagnostic.hidden = !error;
                if (diagnostic.lastChild.textContent !== readableError) diagnostic.lastChild.textContent = readableError;
                block.classList.toggle('block-needs-attention', Boolean(error));
            }
        }
        function refresh() {
            const headings = [...outline.querySelectorAll('.outline-item')];
            const active = headings.findIndex(node => node.classList.contains('is-active'));
            const current = Math.max(0, active);
            const title = byId('documentTitle');
            if (title) title.textContent = headings[0]?.textContent || i18n.documentTab;
            const progress = byId('readingProgress');
            if (progress) progress.value = headings.length ? Math.round(100 * (current + 1) / headings.length) : 0;
            const position = byId('sectionProgress');
            if (position) position.textContent = (headings.length ? current + 1 : 0) + ' / ' + headings.length + ' ' + i18n.sectionsLabel;
            const documentPosition = byId('documentPosition');
            if (documentPosition) documentPosition.textContent = i18n.readingProgress + ': ' + (headings[current]?.textContent || '—');
            const navigation = byId('documentNavigation');
            if (navigation && !byId('documentInfo').hidden) {
                const signature = headings.map(node => node.textContent + ':' + node.classList.contains('is-active')).join('|');
                if (navigation.dataset.signature !== signature) {
                    navigation.dataset.signature = signature; navigation.replaceChildren();
                    headings.filter(node => Number(node.dataset.level) <= 2).forEach(original => {
                        const entry = button(original.textContent, () => original.click());
                        entry.className = 'document-heading'; entry.classList.toggle('is-active', original === headings[current]); navigation.appendChild(entry);
                    });
                }
            }
            positionContext();
            decorateBlocks();
            refreshSourceHeadingCue();
        }
        sourceEditor.addEventListener('scroll', refresh);
        wrapper.addEventListener('scroll', refresh);
        window.addEventListener('resize', refresh);
        const blockModes = new MutationObserver(decorateBlocks);
        blockModes.observe(editor, { subtree: true, attributes: true, attributeFilter: ['data-mode'] });
        window.addEventListener('pagehide', () => { blockModes.disconnect(); sourceCue.remove(); }, { once: true });
        refresh();
        return { refresh, markSourceHeading };
    }
})();
