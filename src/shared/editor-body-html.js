'use strict';

/**
 * Generates the editor body HTML shared by VS Code and Electron.
 *
 * @param {Record<string, string>} messages - Localized interface messages.
 * @param {string} platform - process.platform ('darwin' | 'win32' | 'linux')
 * @param {{ outlineOpen?: boolean, exportEnabled?: boolean, settingsEnabled?: boolean, hostEditor?: 'vscode' }} [options] - editor UI state
 * @returns {string} HTML for <div class="container">...</div>.
 */
function generateEditorBodyHtml(messages, platform, options) {
    const msg = messages || {};
    const m = (key) => msg[key] || '';
    const outlineOpen = !options || options.outlineOpen !== false;
    const sidebarClass = outlineOpen ? 'sidebar' : 'sidebar hidden';
    const openButtonClass = outlineOpen ? 'menu-btn hidden' : 'menu-btn';
    const settingsButton = options && options.settingsEnabled ? `<button type="button" class="sidebar-footer-action" id="extensionSettingsBtn" title="${m('openExtensionSettings')}" aria-label="${m('openExtensionSettings')}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></button>` : '';
    const exportEnabled = Boolean(options && options.exportEnabled);
    const exportButton = exportEnabled ? `<button type="button" data-action="export" id="exportButton" title="Export" aria-label="Export" aria-haspopup="dialog" aria-expanded="false" aria-controls="exportMenu"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 4 6 6-6 6"/><path d="M21 10H11a8 8 0 0 0-8 8v2"/></svg></button>` : '';
    const exportPanels = exportEnabled ? `
            <div id="exportMenu" class="export-menu" role="dialog" aria-label="Export" aria-describedby="exportLimitations" hidden>
                <h3 id="exportPanelTitle">Export</h3>
                <strong id="exportExperimental" class="export-experimental" hidden></strong><section class="export-section"><h4 id="exportFormatHeading"></h4>
                <details class="export-support"><summary id="exportSupportSummary"></summary><p id="exportLimitations" class="export-limitations"></p></details>
                <button type="button" role="menuitem" data-export-format="html"><span>HTML</span><span data-export-tool-status="html"></span></button>
                <button type="button" role="menuitem" data-export-format="pdf"><span>PDF</span><span data-export-tool-status="pdf"></span></button>
                <button type="button" role="menuitem" data-export-format="docx"><span>DOCX</span><span data-export-tool-status="docx"></span></button>
                <button type="button" role="menuitem" data-export-format="epub"><span>EPUB</span><span data-export-tool-status="epub"></span></button>
                <h4 id="exportSetupHeading"></h4><button type="button" role="menuitem" data-export-action="settings" id="exportSettings"></button>
                <button type="button" role="menuitem" data-export-action="pandoc" id="exportPandocSetup" hidden></button>
                <button type="button" role="menuitem" data-export-action="browser" id="exportBrowserSetup" hidden></button>
            </section><section class="export-section"><h4 id="exportJobHeading"></h4><p id="exportIdleStatus"></p><section id="exportStatus" class="export-status" role="status" aria-live="polite" aria-atomic="false" hidden>
                <div class="export-status-row"><span id="exportSpinner" class="export-spinner" aria-hidden="true" hidden></span><span id="exportStatusMessage"></span><button type="button" data-export-action="cancel" id="exportCancel" hidden></button></div>
                <ol id="exportStages" class="export-stages"></ol><button type="button" id="exportRetry" hidden></button></section></section><section class="export-section"><h4 id="exportResultsHeading"></h4><p id="exportIdleResults"></p><div id="exportOutputPath" class="export-output-path"></div><button type="button" id="exportOpenOutput" hidden></button>
                <details id="exportWarnings" hidden><summary id="exportWarningsSummary"></summary><ul id="exportWarningsList"></ul></details>
            </section></div>` : '';

    return `<div class="container">
        <aside class="${sidebarClass}" id="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-tabs" role="tablist" aria-label="${m('documentTab')}"><button type="button" role="tab" id="outlineTab" aria-selected="true" aria-controls="outline">${m('outlineTitle')}</button><button type="button" role="tab" id="documentTab" aria-selected="false" aria-controls="documentInfo" tabindex="-1">${m('documentTab')}</button></div>
                <button class="sidebar-toggle" id="closeSidebar" title="${m('closeOutline')}">&#9776;</button>
            </div>
            <nav class="outline" id="outline" role="tabpanel" aria-labelledby="outlineTab"></nav><section id="documentInfo" class="document-info" role="tabpanel" aria-labelledby="documentTab" hidden><p id="documentPosition" class="document-position"></p><div id="documentNavigation" class="document-navigation"></div></section>
            <div class="sidebar-footer">
                <strong id="documentTitle" class="document-title"></strong><div class="word-count" id="wordCount"></div><div class="reading-progress"><progress id="readingProgress" max="100" value="0" aria-label="${m('readingProgress')}"></progress><span id="sectionProgress"></span></div>
                <div class="sidebar-status-imagedir" id="statusImageDir">
                    <div class="imagedir-header">
                        <span class="imagedir-label">${m('imageDirLabel')}</span>
                        <span class="imagedir-source" id="imageDirSource"></span>
                        <button type="button" class="imagedir-settings-btn sidebar-footer-action" id="imageDirSettingsBtn" title="${m('setImageDir')}" aria-label="${m('setImageDir')}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                        </button>
                        ${settingsButton}
                    </div>
                    <div class="imagedir-info">
                        <span class="imagedir-path" id="imageDirPath"></span>
                    </div>
                </div>
            </div>
            <div class="sidebar-resizer" id="sidebarResizer"></div>
        </aside>
        <main class="editor-container">
            <div class="toolbar" id="toolbar">
                <div class="toolbar-fixed toolbar-fixed--left">
                    <button data-action="openOutline" class="${openButtonClass}" id="openSidebarBtn" title="${m('openOutline')}"></button>
                    <div class="toolbar-group" data-group="history">
                        <button data-action="undo" title="${m('undo')}"></button>
                        <button data-action="redo" title="${m('redo')}"></button>
                    </div>
                </div>
                <div class="toolbar-fixed toolbar-fixed--tools"><button type="button" data-action="contextToolbar" id="contextToolbarToggle" title="${m('contextualTools')}" aria-label="${m('contextualTools')}" aria-pressed="false"><span aria-hidden="true">&gt;&gt;</span></button></div><div class="toolbar-inner" id="toolbarInner">
                    <div class="toolbar-group" data-group="inline">
                        <button data-action="bold" title="${m('bold')}"></button>
                        <button data-action="italic" title="${m('italic')}"></button>
                        <button data-action="underline" title="${m('underline')}"></button>
                        <button data-action="strikethrough" title="${m('strikethrough')}"></button>
                        <button data-action="code" title="${m('inlineCode')}"></button>
                    </div>
                    <div class="toolbar-group" data-group="block">
                        <button data-action="heading1" title="${m('heading1')}"></button>
                        <button data-action="heading2" title="${m('heading2')}"></button>
                        <button data-action="heading3" title="${m('heading3')}"></button>
                        <button data-action="heading4" title="${m('heading4')}"></button>
                        <button data-action="heading5" title="${m('heading5')}"></button>
                        <button data-action="heading6" title="${m('heading6')}"></button>
                        <button data-action="ul" title="${m('unorderedList')}"></button>
                        <button data-action="ol" title="${m('orderedList')}"></button>
                        <button data-action="task" title="${m('taskList')}"></button>
                        <button data-action="quote" title="${m('blockquote')}"></button>
                        <button data-action="codeblock" title="${m('codeBlock')}"></button>
                        <button data-action="mermaid" title="${m('mermaidBlock')}"></button>
                        <button data-action="math" title="${m('mathBlock')}"></button>
                        <button data-action="inlineMath" title="${m('inlineMath')}">𝑥</button>
                        <button data-action="hr" title="${m('horizontalRule')}"></button>
                    </div>
                    <div class="toolbar-group" data-group="insert">
                        <button data-action="link" title="${m('insertLink')}"></button>
                        <button data-action="image" title="${m('insertImage')}"></button>
                        <button data-action="table" title="${m('insertTable')}"></button>
                    </div>
                </div>
                <button type="button" class="toolbar-more" id="toolbarMore" title="${m('toolbarMoreActions')}" aria-label="${m('toolbarMoreActions')}" aria-haspopup="dialog" aria-expanded="false" aria-controls="toolbarOverflow">&#x22EF;</button>
                <div class="toolbar-fixed toolbar-fixed--right">
                    <div class="toolbar-group" data-group="utility">
                        ${exportButton}
                        <div class="editor-mode-switch" role="group" aria-label="${m('editorModes')}"><button type="button" data-editor-mode="visual" aria-pressed="true">${m('modeVisual')}</button><button type="button" data-editor-mode="source" aria-pressed="false">${m('modeSource')}</button><button type="button" data-editor-mode="split" aria-pressed="false">${m('modeSplit')}</button></div>
                    </div>
                </div>
                <div id="toolbarOverflow" class="toolbar-overflow" role="dialog" aria-label="${m('toolbarMoreActions')}" hidden><div class="toolbar-overflow-search"><input type="search" id="toolbarCommandSearch" placeholder="${m('commandPaletteFilter')}" aria-label="${m('commandPaletteFilter')}" /></div><div id="toolbarOverflowItems" role="menu" aria-label="${m('toolbarMoreActions')}"></div><div id="toolbarCommandResults" role="menu" aria-label="${m('allActions')}" hidden></div></div>
            </div>
            <div id="insertMenu" class="insert-menu" role="dialog" aria-label="${m('commandPaletteInsert')}" hidden></div>
            ${exportPanels}
            <div class="editor-width-guide" id="editorWidthGuide" hidden data-capped="false">
                <div class="editor-width-bounds" id="editorWidthBounds">
                    <button type="button" class="editor-width-mark editor-width-mark--left" aria-label="${m('editorAlignmentLeft')}: ${m('widthIndicatorsLabel')}" aria-describedby="editorWidthExplanation"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24"><path d="M1 17V7H11"/></svg></button>
                    <button type="button" class="editor-width-mark editor-width-mark--right" aria-label="${m('editorAlignmentRight')}: ${m('widthIndicatorsLabel')}" aria-describedby="editorWidthExplanation"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24"><path d="M23 17V7H13"/></svg></button>
                </div>
                <div class="editor-width-explanation" id="editorWidthExplanation" role="tooltip" hidden>${m('widthBoundaryExplanation')}</div>
            </div>
            <div id="modeHelp" class="mode-help" hidden></div><div class="editor-wrapper" id="editorWrapper">
                <div class="search-replace-box" id="searchReplaceBox" style="display: none;">
                    <div class="search-panel-heading"><strong>${m('findReplaceTitle')}</strong><button id="closeSearch" title="${m('closeSearch')}" aria-label="${m('closeSearch')}">&#10005;</button></div>
                    <label class="search-field-label" for="searchInput">${m('findLabel')}</label><div class="search-row">
                        <input type="search" id="searchInput" aria-label="${m('searchPlaceholder')}" placeholder="${m('searchPlaceholder')}" />
                        <span class="search-count" id="searchCount" role="status" aria-live="polite">0/0</span>
                        <button id="searchPrev" title="${m('searchPrev')}">&#9650;</button>
                        <button id="searchNext" title="${m('searchNext')}">&#9660;</button>
                        <button id="toggleReplace" title="${m('toggleReplace')}">&#8693;</button>
                    </div>
                    <div class="replace-row" id="replaceRow" style="display: none;">
                        <label class="search-field-label" for="replaceInput">${m('replaceWithLabel')}</label><input type="text" id="replaceInput" aria-label="${m('replacePlaceholder')}" placeholder="${m('replacePlaceholder')}" />
                        <button id="replaceOne" title="${m('replace')}">${m('replace')}</button>
                        <button id="replaceAll" title="${m('replaceAll')}">${m('replaceAll')}</button>
                    </div>
                    <label class="search-field-label" for="replaceScope">${m('replaceScopeLabel')}</label><select id="replaceScope"><option value="document">${m('scopeDocument')}</option><option value="selected">${m('scopeSelected')}</option></select>
                    <p class="search-scope">${m('searchSourceScope')}</p>
                    <div class="search-options">
                        <label><input type="checkbox" id="searchCaseSensitive" /> ${m('caseSensitive')}</label>
                        <label><input type="checkbox" id="searchWholeWord" /> ${m('wholeWord')}</label>
                        <label><input type="checkbox" id="searchRegex" /> ${m('regex')}</label>
                    </div>
                    <div class="search-replacement-actions" id="searchReplacementActions"></div><div class="search-results-controls"><label><input type="checkbox" id="searchSelectAll" /> ${m('selectAllMatches')}</label><output id="searchSelectedCount" aria-live="polite"></output></div>
                    <p id="searchFeedback" role="status" aria-live="polite"></p>
                    <div id="searchResults" class="search-results" aria-label="${m('searchResults')}"></div>
                </div>
                <div class="pane-heading" id="previewPaneHeading" hidden>${m('previewPaneTitle')}</div><div class="editor" id="editor" contenteditable="true" spellcheck="true"></div>
                <div class="pane-heading" id="sourcePaneHeading" hidden>${m('sourcePaneTitle')}</div><textarea class="source-editor" id="sourceEditor" aria-label="${m('sourceLabel')}" spellcheck="false" style="display: none;"></textarea>
            </div>
        </main>
    </div>`;
}

module.exports = { generateEditorBodyHtml };
