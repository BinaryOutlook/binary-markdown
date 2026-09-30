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
        function refresh() {
            const stats = byId('documentStatistics');
            const text = options.statistics();
            if (stats && stats.textContent !== text) stats.textContent = text;
            const owner = options.isSourceMode() ? sourceEditor : wrapper;
            const progress = byId('readingProgress');
            if (progress) progress.value = owner.scrollHeight > owner.clientHeight ? Math.round(100 * owner.scrollTop / (owner.scrollHeight - owner.clientHeight)) : 0;
            positionContext();
        }
        sourceEditor.addEventListener('scroll', refresh);
        wrapper.addEventListener('scroll', refresh);
        refresh();
        return { refresh };
    }
})();
