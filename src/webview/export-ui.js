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
    const openOutput = document.getElementById('exportOpenOutput');
    const warningDetails = document.getElementById('exportWarnings');
    const warningList = document.getElementById('exportWarningsList');
    let capabilities = null;
    let running = false;
    let preservedRange = null;
    let preservedSourceSelection = null;
    let previousFocus = null;
    let lastFormat = null, cancelPending = false;
    const stages = new Map();
    const retry = document.getElementById('exportRetry');
    document.getElementById('exportFormatHeading').textContent = text('formatOptions');
    document.getElementById('exportJobHeading').textContent = text('jobStatus');
    document.getElementById('exportResultsHeading').textContent = text('resultsHeading');
    document.getElementById('exportIdleStatus').textContent = text('idleStatus');
    document.getElementById('exportIdleResults').textContent = text('idleResults');
    retry.textContent = text('retry');
    function requestFormat(format) {
        lastFormat = format; cancelPending = false; stages.clear();
        document.getElementById('exportStages').replaceChildren();
        retry.hidden = true; host.requestExport(format);
    }
    retry.addEventListener('click', event => {
        event.stopPropagation();
        const item = menu.querySelector('[data-export-format="' + lastFormat + '"]');
        if (!running && item?.getAttribute('aria-disabled') === 'false') requestFormat(lastFormat);
    });

    button.title = text('title');
    button.setAttribute('aria-label', text('title'));
    const toolbarLabel = button.querySelector('.toolbar-action-label');
    if (toolbarLabel) toolbarLabel.textContent = text('title');
    menu.setAttribute('aria-label', text('title'));
    document.getElementById('exportPanelTitle').textContent = text('title');
    document.getElementById('exportSupportSummary').textContent = text('experimental');
    document.getElementById('exportSetupHeading').textContent = text('setup');
    openOutput.textContent = text('openOutput');
    openOutput.addEventListener('click', event => { event.stopPropagation(); if (!openOutput.hidden) host.openExportOutput?.(); });
    document.getElementById('exportExperimental').textContent = text('experimental');
    document.getElementById('exportLimitations').textContent = text('limitations');
    document.getElementById('exportSettings').textContent = text('installationGuide');
    document.getElementById('exportPandocSetup').textContent = text('configurePandoc');
    document.getElementById('exportPandocSetup').title = text('pandocInstall');
    document.getElementById('exportBrowserSetup').textContent = text('configureBrowser');
    document.getElementById('exportBrowserSetup').title = text('browserInstall');
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
        return Array.from(menu.querySelectorAll('[role="menuitem"], #exportCancel, #exportOpenOutput, #exportRetry')).filter(item => !item.hidden);
    }

    function visibleButton() {
        return button.getClientRects().length ? button : document.getElementById('toolbarMore') || button;
    }

    function positionMenu() {
        const rect = visibleButton().getBoundingClientRect();
        const width = Math.min(380, Math.max(220, window.innerWidth - 24));
        menu.style.width = width + 'px';
        menu.style.left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)) + 'px';
        menu.style.top = Math.min(rect.bottom + 6, Math.max(6, window.innerHeight - 160)) + 'px';
        menu.style.maxHeight = Math.max(120, window.innerHeight - rect.bottom - 18) + 'px';
    }

    function closeMenu(restoreFocus) {
        menu.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        if (restoreFocus) visibleButton().focus({ preventScroll: true });
        restoreSelection();
    }

    function updateCapabilities() {
        const blocked = capabilities && !capabilities.host.available;
        document.getElementById('exportLimitations').textContent = blocked
            ? capabilities.host.error : text('limitations');
        menu.querySelectorAll('[data-export-format]').forEach(item => {
            const format = item.dataset.exportFormat;
            const tool = capabilities && (blocked ? capabilities.host :
                format === 'html' ? { available: true } : capabilities[format === 'pdf' ? 'browser' : 'pandoc']);
            const label = blocked ? text('blocked') : tool ? text(tool.available ? 'available' : 'unavailable') : text('detecting');
            item.querySelector('[data-export-tool-status]').textContent = label;
            item.setAttribute('aria-label', format.toUpperCase() + ' — ' + label);
            item.setAttribute('aria-disabled', String(running || !tool || !tool.available));
            item.title = tool && !tool.available && tool.error ? tool.error : '';
        });
        document.getElementById('exportPandocSetup').hidden = !capabilities || blocked || Boolean(capabilities.pandoc.available);
        document.getElementById('exportBrowserSetup').hidden = !capabilities || blocked || Boolean(capabilities.browser.available);
    }

    function openMenu(keyboard) {
        const fromOverflow = Boolean(button.closest('#toolbarOverflow'));
        if (menu.hidden) preserveSelection();
        button.dispatchEvent(new CustomEvent('toolbar-submenu-open', { bubbles: true }));
        menu.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        positionMenu();
        updateCapabilities();
        if (typeof host.requestExportCapabilities === 'function') host.requestExportCapabilities();
        if (keyboard || fromOverflow) items()[0].focus({ preventScroll: true });
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
            event.stopPropagation();
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
        if (event.key === 'Tab') return;
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
            if (item.getAttribute('aria-disabled') === 'true') return;
            requestFormat(format);
        } else {
            const tool = item.dataset.exportAction;
            if (!['settings','pandoc','browser'].includes(tool)) return;
            closeMenu(false);
            host.openExportSettings(tool === 'settings' ? undefined : tool);
        }
        if (previousFocus && previousFocus.isConnected && previousFocus !== document.body) {
            (previousFocus.getClientRects().length ? previousFocus : visibleButton()).focus({ preventScroll: true });
        }
        restoreSelection();
    });
    cancel.addEventListener('click', event => {
        event.stopPropagation();
        if (running && !cancelPending) {
            cancelPending = true; cancel.disabled = true;
            statusMessage.textContent = text('cancelPending');
            host.cancelExport();
        }
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
            if (!message.host || !message.pandoc || !message.browser) return;
            capabilities = message;
            updateCapabilities();
        } else if (message.type === 'exportStatus') {
            if (!['running','complete','failed','cancelled'].includes(message.state)) return;
            if (message.state === 'running' && !running) {
                // Exports can also start through a host command. Never carry a
                // previous job's completed stages into that independent run.
                stages.clear(); cancelPending = false;
            }
            running = message.state === 'running';
            if (!running) cancelPending = false;
            if (running && menu.hidden) openMenu(false);
            status.hidden = false;
            status.dataset.state = message.state;
            // Keep the live region announceable during work; aria-busy on it
            // would defer stage announcements until completion.
            spinner.setAttribute('role', 'progressbar');
            spinner.setAttribute('aria-label', text('title'));
            spinner.removeAttribute('aria-hidden');
            spinner.hidden = !running;
            cancel.hidden = !running;
            cancel.disabled = cancelPending;
            const stateKey = message.state === 'complete' ? 'completed' : message.state;
            statusMessage.textContent = cancelPending ? text('cancelPending') : message.message || text(message.stage || stateKey);
            document.getElementById('exportIdleStatus').hidden = true;
            document.getElementById('exportIdleResults').hidden = message.state === 'complete';
            retry.hidden = message.state !== 'failed' || !lastFormat;
            const knownStages = ['checking','dependencies','resources','rendering','converting','saving'];
            if (running && knownStages.includes(message.stage)) {
                for (const stage of stages.keys()) stages.set(stage, 'complete');
                stages.set(message.stage, 'running');
            } else if (!running && stages.size) stages.set([...stages.keys()].at(-1), message.state);
            const stageList = document.getElementById('exportStages'); stageList.replaceChildren();
            for (const [key, state] of stages) {
                const row = document.createElement('li'); row.dataset.state = state;
                const indicator = document.createElement('span'); indicator.setAttribute('aria-hidden', 'true'); indicator.textContent = state === 'complete' ? '✓' : state === 'running' ? '•' : '–';
                row.append(indicator, document.createTextNode(text(key))); stageList.appendChild(row);
            }
            outputPath.textContent = message.outputPath || '';
            openOutput.hidden = message.state !== 'complete' || typeof message.outputPath !== 'string' || !message.outputPath;
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
