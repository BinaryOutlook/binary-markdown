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
        context.appendChild(button('…', options.openActions));
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
            const width = context.offsetWidth;
            context.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) + 'px';
            context.style.top = Math.max(pane.top + 4, rect.top - context.offsetHeight - 8) + 'px';
        }
        if (contextToggle) contextToggle.addEventListener('click', () => {
            contextual = !contextual;
            contextToggle.setAttribute('aria-pressed', String(contextual));
            document.documentElement.dataset.contextToolbar = String(contextual);
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
                    const status = document.createElement('span'); status.className = 'block-status'; status.setAttribute('role', 'status'); chrome.appendChild(status);
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
                chrome.querySelectorAll('[data-block-mode]').forEach(toggle => { toggle.disabled = options.isSourceMode(); toggle.setAttribute('aria-pressed', String(block.dataset.mode === toggle.dataset.blockMode)); });
                const error = block.dataset.renderError || '';
                const status = chrome.querySelector('.block-status');
                const unknown = /Undefined control sequence:\s*(\\[A-Za-z]+)/.exec(error);
                const text = error ? (diagram ? i18n.diagramNeedsAttention : unknown ? i18n.unknownEquationCommand + ' ' + unknown[1] : i18n.equationUnsupported) : '';
                if (status.textContent !== text) status.textContent = text;
                status.hidden = !error;
                const diagnostic = chrome.querySelector('.block-diagnostic'); diagnostic.hidden = !error;
                if (diagnostic.lastChild.textContent !== error) diagnostic.lastChild.textContent = error;
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
        }
        sourceEditor.addEventListener('scroll', refresh);
        wrapper.addEventListener('scroll', refresh);
        window.addEventListener('resize', refresh);
        refresh();
        return { refresh };
    }
})();
