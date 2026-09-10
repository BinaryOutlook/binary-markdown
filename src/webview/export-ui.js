(function() {
    'use strict';
    const button = document.getElementById('exportButton');
    const host = window.hostBridge;
    if (!button || !host || typeof host.requestExport !== 'function') return;
    const messages = window.exportMessages || {};
    const text = key => messages[key] || key;
    const menu = document.getElementById('exportMenu');
    const status = document.getElementById('exportStatus');
    const cancel = document.getElementById('exportCancel');
    const statusMessage = document.getElementById('exportStatusMessage');
    const outputPath = document.getElementById('exportOutputPath');
    const spinner = document.getElementById('exportSpinner');
    const warningDetails = document.getElementById('exportWarnings');
    const warningList = document.getElementById('exportWarningsList');
    let capabilities = null;
    let running = false;
    let preservedRange = null;
    let preservedSourceSelection = null;
    let previousFocus = null;

    button.title = text('title');
    button.setAttribute('aria-label', text('title'));
    menu.setAttribute('aria-label', text('title'));
    document.getElementById('exportExperimental').textContent = text('experimental');
    document.getElementById('exportLimitations').textContent = text('limitations');
    document.getElementById('exportSettings').textContent = text('setup');
    document.getElementById('exportPandocSetup').textContent = text('pandocInstall');
    document.getElementById('exportBrowserSetup').textContent = text('browserInstall');
    cancel.textContent = text('cancel');

    function preserveSelection() {
        previousFocus = document.activeElement;
        const selection = window.getSelection();
        preservedRange = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
        const source = document.getElementById('sourceEditor');
        preservedSourceSelection = source && typeof source.selectionStart === 'number'
            ? { source: source, start: source.selectionStart, end: source.selectionEnd, direction: source.selectionDirection } : null;
    }

    function restoreSelection() {
        if (preservedRange && preservedRange.startContainer.isConnected && preservedRange.endContainer.isConnected) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(preservedRange);
        }
        if (preservedSourceSelection) {
            const saved = preservedSourceSelection;
            saved.source.setSelectionRange(saved.start, saved.end, saved.direction);
        }
    }

    function items() {
        return Array.from(menu.querySelectorAll('[role="menuitem"]')).filter(item => !item.hidden);
    }

    function positionMenu() {
        const rect = button.getBoundingClientRect();
        const width = Math.min(380, Math.max(220, window.innerWidth - 24));
        menu.style.width = width + 'px';
        menu.style.left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)) + 'px';
        menu.style.top = Math.min(rect.bottom + 6, Math.max(6, window.innerHeight - 160)) + 'px';
        menu.style.maxHeight = Math.max(120, window.innerHeight - rect.bottom - 18) + 'px';
    }

    function closeMenu(restoreFocus) {
        menu.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        if (restoreFocus) button.focus({ preventScroll: true });
        restoreSelection();
    }

    function updateCapabilities() {
        menu.querySelectorAll('[data-export-format]').forEach(item => {
            const format = item.dataset.exportFormat;
            const tool = format === 'html' ? { available: true } : capabilities && capabilities[format === 'pdf' ? 'browser' : 'pandoc'];
            const label = tool ? text(tool.available ? 'available' : 'unavailable') : text('detecting');
            item.querySelector('[data-export-tool-status]').textContent = label;
            item.setAttribute('aria-label', format.toUpperCase() + ' — ' + label);
            item.setAttribute('aria-disabled', String(running || Boolean(tool && !tool.available)));
            item.title = tool && !tool.available && tool.error ? tool.error : '';
        });
        document.getElementById('exportPandocSetup').hidden = !capabilities || Boolean(capabilities.pandoc.available);
        document.getElementById('exportBrowserSetup').hidden = !capabilities || Boolean(capabilities.browser.available);
    }

    function openMenu(keyboard) {
        if (menu.hidden) preserveSelection();
        menu.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        positionMenu();
        updateCapabilities();
        if (typeof host.requestExportCapabilities === 'function') host.requestExportCapabilities();
        if (keyboard) items()[0].focus({ preventScroll: true });
    }

    // Mouse opening keeps the caret and source selection; keyboard opening moves
    // focus into the menu, while the preserved document selection stays intact.
    button.addEventListener('mousedown', event => {
        preserveSelection();
        event.preventDefault();
    });
    menu.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', event => {
        event.stopPropagation();
        if (menu.hidden) openMenu(event.detail === 0);
        else closeMenu(false);
    });
    button.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openMenu(true);
            if (event.key === 'ArrowUp') items().at(-1).focus();
        }
    });
    menu.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeMenu(true);
            return;
        }
        if (event.key === 'Tab') {
            closeMenu(true);
            return;
        }
        const choices = items();
        const index = choices.indexOf(document.activeElement);
        let next;
        if (event.key === 'ArrowDown') next = (index + 1) % choices.length;
        if (event.key === 'ArrowUp') next = (index - 1 + choices.length) % choices.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = choices.length - 1;
        if (next !== undefined) {
            event.preventDefault();
            choices[next].focus({ preventScroll: true });
        }
    });
    menu.addEventListener('click', event => {
        const item = event.target.closest('button');
        if (!item) return;
        const format = item.dataset.exportFormat;
        if (format) {
            if (running) return;
            const toolKind = format === 'pdf' ? 'browser' : (format === 'html' ? null : 'pandoc');
            const tool = toolKind && capabilities && capabilities[toolKind];
            if (tool && !tool.available) return;
            closeMenu(false);
            host.requestExport(format);
        } else {
            const tool = item.dataset.exportAction;
            closeMenu(false);
            host.openExportSettings(tool === 'settings' ? undefined : tool);
        }
        if (previousFocus && previousFocus.isConnected && previousFocus !== document.body) previousFocus.focus({ preventScroll: true });
        restoreSelection();
    });
    cancel.addEventListener('click', () => {
        if (running) host.cancelExport();
    });
    document.addEventListener('keydown', event => {
        if (!menu.hidden && event.key === 'Escape') {
            event.preventDefault();
            closeMenu(true);
        }
    });
    document.addEventListener('mousedown', event => {
        if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) closeMenu(false);
    });
    window.addEventListener('resize', () => { if (!menu.hidden) positionMenu(); });
    window.addEventListener('message', event => {
        const message = event.data || {};
        if (message.type === 'exportCapabilities') {
            if (!message.pandoc || !message.browser) return;
            capabilities = message;
            updateCapabilities();
        } else if (message.type === 'exportStatus') {
            running = message.state === 'running';
            status.hidden = false;
            status.dataset.state = message.state;
            // Keep the live region announceable during work; aria-busy on it
            // would defer stage announcements until completion.
            spinner.setAttribute('role', 'progressbar');
            spinner.setAttribute('aria-label', text('title'));
            spinner.removeAttribute('aria-hidden');
            spinner.hidden = !running;
            cancel.hidden = !running;
            const stateKey = message.state === 'complete' ? 'completed' : message.state;
            statusMessage.textContent = message.message || text(message.stage || stateKey);
            outputPath.textContent = message.outputPath || '';
            warningList.replaceChildren();
            const warnings = Array.isArray(message.warnings) ? message.warnings : [];
            warningDetails.hidden = warnings.length === 0;
            document.getElementById('exportWarningsSummary').textContent = text('warnings') + ' (' + warnings.length + ')';
            warnings.forEach(warning => {
                const item = document.createElement('li');
                item.textContent = warning.message || warning.code;
                warningList.appendChild(item);
            });
            updateCapabilities();
        }
    });
    updateCapabilities();
    // The static English label exists before scripts load. Publish readiness
    // only after localization and every export interaction handler are installed.
    button.dataset.exportReady = 'true';
})();
