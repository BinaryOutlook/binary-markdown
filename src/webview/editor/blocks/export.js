'use strict';
// Construction defines capabilities; bootstrap controls the original initialization order.
function createExport(dependencies) {
    let exportRenderSequence, exportRenderQueue, exportRenderRequests;
    function checkExportCancellation(signal) {
        if (signal.aborted)
            throw new Error('Export preparation was cancelled.');
    }
    function awaitExportReady(promise, signal) {
        checkExportCancellation(signal);
        return new Promise((resolve, reject) => {
            const onAbort = () => reject(new Error('Export preparation was cancelled.'));
            signal.addEventListener('abort', onAbort, { once: true });
            Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
        });
    }
    function exportWarning(warnings, code, message) {
        if (!warnings.some(warning => warning.code === code && warning.message === message)) {
            warnings.push({ code: code, message: message });
        }
    }
    function stripExportMetadata(source) {
        let text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
        text = dependencies.documentAux.splitFrontMatter(text).body;
        // Only a trailing app directive block outside a code fence is metadata.
        const directiveStart = text.lastIndexOf('\n---\n');
        if (directiveStart >= 0 && /^(?:(?:IMAGE_DIR:\s*[^\n]+|FORCE_RELATIVE_PATH:\s*(?:true|false))\n?)+\s*$/i.test(text.slice(directiveStart + 5))) {
            let fence = null;
            for (const line of text.slice(0, directiveStart).split('\n')) {
                const match = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
                if (!match)
                    continue;
                if (!fence)
                    fence = { character: match[1][0], length: match[1].length };
                else if (match[1][0] === fence.character && match[1].length >= fence.length && !match[2].trim())
                    fence = null;
            }
            if (!fence)
                text = text.slice(0, directiveStart);
        }
        return text;
    }
    function hasUnsafeExportStyle(value) {
        const withoutLocalReferences = value.replace(/url\(\s*(['"]?)#[^)]+\)/gi, '');
        return /(?:\\|@import|expression\s*\(|javascript\s*:|url\s*\()/i.test(withoutLocalReferences);
    }
    function sanitizeExportTree(root, warnings) {
        const blocked = 'script,iframe,object,embed,link,meta,base,form,button,textarea,select,video,audio,canvas,template,animate,animateMotion,animateTransform,set';
        root.querySelectorAll(blocked).forEach(element => {
            const fallback = document.createElement('span');
            fallback.className = 'export-warning';
            fallback.textContent = '[Export omitted active ' + element.tagName.toLowerCase() + ' content]';
            element.replaceWith(fallback);
            exportWarning(warnings, 'active-content', 'Active document content was replaced with a visible fallback.');
        });
        root.querySelectorAll('*').forEach(element => {
            Array.from(element.attributes).forEach(attribute => {
                const name = attribute.name.toLowerCase();
                const value = attribute.value;
                if (name.startsWith('on') || /^(?:contenteditable|spellcheck|tabindex|draggable|srcdoc|srcset|action|formaction|ping|autofocus|nonce)$/.test(name)) {
                    element.removeAttribute(attribute.name);
                    if (name.startsWith('on') || /^(?:srcdoc|action|formaction|ping)$/.test(name)) {
                        exportWarning(warnings, 'active-content', 'Active document content was replaced with a visible fallback.');
                    }
                }
                else if (/^(?:href|xlink:href|src)$/.test(name)) {
                    const compact = value.replace(/[\u0000-\u0020\u007f]/g, '');
                    const safeData = name === 'src' && /^data:image\/(?:png|jpeg|gif|webp|svg\+xml|avif|bmp);/i.test(compact);
                    const scheme = compact.match(/^([a-z][a-z0-9+.-]*):/i);
                    const safeScheme = !scheme || /^(?:https?|file|mailto|vscode-resource|vscode-webview)$/i.test(scheme[1]);
                    if ((!safeScheme && !safeData) || (name !== 'src' && /^data:/i.test(compact)) ||
                        (element.namespaceURI === 'http://www.w3.org/2000/svg' && /^(?:image|use)$/i.test(element.tagName) && !compact.startsWith('#'))) {
                        element.removeAttribute(attribute.name);
                        element.setAttribute('data-export-fallback', 'Unsafe resource or link removed');
                        const note = document.createElement('span');
                        note.className = 'export-warning';
                        note.textContent = '[Unsafe resource or link disabled]';
                        element.after(note);
                        exportWarning(warnings, 'unsafe-reference', 'An unsafe resource or link was disabled.');
                    }
                }
                else if (name === 'style' && hasUnsafeExportStyle(value)) {
                    element.removeAttribute(attribute.name);
                    exportWarning(warnings, 'active-style', 'An active or external style was removed.');
                }
            });
            if (element.tagName.toLowerCase() === 'style' && hasUnsafeExportStyle(element.textContent || '')) {
                element.remove();
                exportWarning(warnings, 'active-style', 'An active or external style was removed.');
            }
            if (element.tagName.toLowerCase() === 'input') {
                if (element.getAttribute('type') === 'checkbox')
                    element.setAttribute('disabled', '');
                else
                    element.remove();
            }
            if (element.tagName.toLowerCase() === 'a') {
                element.removeAttribute('target');
                element.setAttribute('rel', 'noreferrer noopener');
            }
        });
    }
    function createExportFallback(wrapper, label, source, warnings, code) {
        const fallback = document.createElement('div');
        fallback.className = 'export-fallback';
        const note = document.createElement('p');
        note.className = 'export-warning';
        note.textContent = label;
        const pre = document.createElement('pre');
        const content = document.createElement('code');
        content.textContent = source;
        pre.appendChild(content);
        fallback.append(note, pre);
        wrapper.replaceWith(fallback);
        exportWarning(warnings, code, label);
    }
    async function prepareExportDocument(source, appearance, signal) {
        checkExportCancellation(signal);
        const warnings = [];
        const diagrams = [];
        const template = document.createElement('template');
        const normalizedSource = stripExportMetadata(source);
        template.innerHTML = dependencies.markdownToHtmlFragment(normalizedSource, true);
        dependencies.assignHeadingAnchors(template.content, normalizedSource);
        template.content.querySelectorAll('.toc-refresh').forEach(button => button.remove());
        template.content.querySelectorAll('[data-toc-source]').forEach(block => block.removeAttribute('data-toc-source'));
        sanitizeExportTree(template.content, warnings);
        // These are diagnostics about the current rendered output, not a new
        // Markdown parser. Literal notation stays exactly as the user sees it.
        const diagnosticTree = template.content.cloneNode(true);
        diagnosticTree.querySelectorAll('pre,code,.math-wrapper,.math-inline,.mermaid-wrapper').forEach(element => element.remove());
        const visibleSource = (diagnosticTree.textContent || '').replace(/\\\$/g, '');
        if (/\$\$[\s\S]*?\$\$|\$(?!\$)(?=\S)[^$\n]*?[^\s$]\$(?![\d$])/.test(visibleSource)) {
            exportWarning(warnings, 'renderer-math-source', 'Unrecognized equation delimiters remain visible source in the exported document.');
        }
        if (/\[TOC\]/i.test(visibleSource)) {
            exportWarning(warnings, 'renderer-toc-source', 'A literal [TOC] marker remains visible. HTML/PDF do not generate a table of contents from that marker in the current renderer.');
        }
        if (/\[\^[^\]\n]+\]/.test(visibleSource)) {
            exportWarning(warnings, 'renderer-footnote-source', 'Footnote markers and definitions remain visible source. HTML/PDF do not generate linked footnotes in the current renderer.');
        }
        const container = document.createElement('div');
        container.className = 'editor export-preparation';
        container.dataset.theme = appearance.theme;
        container.setAttribute('aria-hidden', 'true');
        container.setAttribute('inert', '');
        container.style.cssText = 'position:fixed;left:-100000px;top:0;width:860px;max-height:none;overflow:visible;pointer-events:none;';
        container.style.setProperty('--font-size', appearance.fontSize + 'px');
        container.style.fontSize = 'var(--font-size)';
        container.style.fontFamily = 'var(--font-family)';
        container.style.color = 'var(--text-color)';
        // Asset fetching/embedding belongs to the host so files are read once at
        // original resolution. Do not trigger duplicate image loads in this tree.
        const images = Array.from(template.content.querySelectorAll('img')).map(image => {
            const original = image.getAttribute('src');
            image.removeAttribute('src');
            return { image: image, original: original };
        });
        container.appendChild(template.content);
        document.body.appendChild(container);
        try {
            container.querySelectorAll('pre:not([data-lang="math"]):not([data-lang="mermaid"])').forEach(pre => {
                dependencies.applyHighlighting(pre);
                const code = pre.querySelector('code');
                // Mark display-only breaks before sanitization removes editor
                // attributes. PDF metadata must never count a caret placeholder.
                if (code && code.lastChild?.nodeName === 'BR' &&
                    (code.dataset.trailingBr === 'true' || Number(pre.dataset.exportCodeLines) <= 1)) {
                    code.lastChild.setAttribute('data-export-display-break', '');
                }
            });
            for (const span of container.querySelectorAll('.math-inline')) {
                checkExportCancellation(signal);
                const output = document.createElement('span');
                try {
                    dependencies.renderInlineMath(span, true);
                    output.className = 'math-inline-display';
                    output.innerHTML = span.innerHTML;
                }
                catch (error) {
                    output.className = 'export-warning';
                    output.textContent = dependencies.inlineMathMarkdown(span);
                    exportWarning(warnings, 'math-fallback', 'An inline equation could not be rendered; its source is preserved.');
                }
                span.replaceWith(output);
            }
            for (const wrapper of Array.from(container.querySelectorAll('.math-wrapper'))) {
                checkExportCancellation(signal);
                const code = wrapper.querySelector('pre code');
                const mathSource = code ? dependencies.getCodePlainText(code).trim() : '';
                if (typeof katex === 'undefined') {
                    createExportFallback(wrapper, 'Math rendering is unavailable; the expression is preserved below.', mathSource, warnings, 'math-unavailable');
                    continue;
                }
                dependencies.renderMathBlock(wrapper, true);
                const display = wrapper.querySelector('.math-display');
                if (!display || !display.innerHTML || display.querySelector('.katex-error, .math-error')) {
                    createExportFallback(wrapper, 'This mathematical expression could not be rendered; its source is preserved below.', mathSource, warnings, 'math-fallback');
                }
                else {
                    wrapper.replaceWith(display);
                }
            }
            for (const wrapper of Array.from(container.querySelectorAll('.mermaid-wrapper'))) {
                checkExportCancellation(signal);
                const code = wrapper.querySelector('pre code');
                const diagramSource = code ? dependencies.getCodePlainText(code).trim() : '';
                if (typeof mermaid === 'undefined') {
                    createExportFallback(wrapper, 'Diagram rendering is unavailable; the diagram source is preserved below.', diagramSource, warnings, 'diagram-unavailable');
                    continue;
                }
                dependencies.initMermaid();
                const previousConfig = mermaid.mermaidAPI.getConfig();
                const id = 'binary-export-diagram-' + (++exportRenderSequence);
                const measurement = document.createElement('div');
                container.appendChild(measurement);
                try {
                    // Reuse the production Mermaid library with strict settings;
                    // never run click handlers or document-provided directives.
                    // Start with the captured palette. getConfig() includes
                    // resolved themeVariables which would otherwise retain the
                    // live editor's dark colours even when theme is changed.
                    mermaid.initialize({
                        theme: ['dark', 'night'].includes(appearance.theme) ? 'dark' : 'default',
                        securityLevel: 'strict', startOnLoad: false, htmlLabels: false,
                        secure: Array.from(new Set([...(previousConfig.secure || []), 'securityLevel', 'htmlLabels', 'flowchart'])),
                        flowchart: { useMaxWidth: true, htmlLabels: false },
                        sequence: { useMaxWidth: true }
                    });
                    const result = await awaitExportReady(mermaid.render(id, diagramSource, measurement), signal);
                    checkExportCancellation(signal);
                    const fragment = document.createElement('template');
                    fragment.innerHTML = result.svg;
                    sanitizeExportTree(fragment.content, warnings);
                    const svg = fragment.content.querySelector('svg');
                    if (!svg)
                        throw new Error('The diagram renderer produced no SVG.');
                    diagrams.push({ source: diagramSource, svg: svg.outerHTML });
                    wrapper.replaceWith(svg);
                }
                catch (error) {
                    checkExportCancellation(signal);
                    createExportFallback(wrapper, 'This diagram could not be rendered; its source is preserved below.', diagramSource, warnings, 'diagram-fallback');
                }
                finally {
                    mermaid.initialize(previousConfig);
                    // Mermaid can leave its owned error container after rejection.
                    const failedContainer = document.getElementById('d' + id);
                    if (failedContainer && container.contains(failedContainer))
                        failedContainer.remove();
                    measurement.remove();
                }
            }
            if (document.fonts && document.fonts.ready)
                await awaitExportReady(document.fonts.ready, signal);
            checkExportCancellation(signal);
            sanitizeExportTree(container, warnings);
            container.querySelectorAll('[data-mode], [data-trailing-br], [data-mermaid-setup], [data-math-setup]').forEach(element => {
                element.removeAttribute('data-mode');
                element.removeAttribute('data-trailing-br');
                element.removeAttribute('data-mermaid-setup');
                element.removeAttribute('data-math-setup');
            });
            // Move back to an inert document before restoring src: even an
            // unattached HTMLImageElement in the live document starts fetching.
            const output = document.createElement('template');
            while (container.firstChild)
                output.content.appendChild(container.firstChild);
            images.forEach(entry => {
                if (entry.original !== null && output.content.contains(entry.image))
                    entry.image.setAttribute('src', entry.original);
            });
            return {
                html: '<article class="editor export-document">' + output.innerHTML + '</article>',
                warnings: warnings,
                diagrams: diagrams,
                theme: appearance.theme,
                fontSize: appearance.fontSize
            };
        }
        finally {
            container.remove();
        }
    }
    let initializeExportRenderSequenceDone = false;
    function initializeExportRenderSequence() {
        if (initializeExportRenderSequenceDone)
            return;
        initializeExportRenderSequenceDone = true;
        (exportRenderSequence = 0);
        (exportRenderQueue = Promise.resolve());
        (exportRenderRequests = new Map());
    }
    return {
        checkExportCancellation,
        awaitExportReady,
        exportWarning,
        stripExportMetadata,
        hasUnsafeExportStyle,
        sanitizeExportTree,
        createExportFallback,
        prepareExportDocument,
        get exportRenderSequence() { return exportRenderSequence; }, set exportRenderSequence(value) { exportRenderSequence = value; },
        get exportRenderQueue() { return exportRenderQueue; }, set exportRenderQueue(value) { exportRenderQueue = value; },
        get exportRenderRequests() { return exportRenderRequests; }, set exportRenderRequests(value) { exportRenderRequests = value; },
        initializeExportRenderSequence
    };
}
module.exports = { createExport };
