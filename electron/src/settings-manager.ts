import Store from 'electron-store';
import { BrowserWindow } from 'electron';
import * as path from 'path';
import type { EditorWidthMode, EditorAlignment } from '../../src/shared/editor-layout';
import { getResourcePath } from './html-generator';
const { normalizeWidthMode, normalizeMaxWidth, normalizeAlignment } = require(getResourcePath('src/shared/editor-layout.js')) as typeof import('../../src/shared/editor-layout');

/**
 * Electron settings backed by electron-store.
 */

export interface ElectronSettings {
    theme: string;
    fontSize: number;
    editorWidthMode: EditorWidthMode;
    editorMaxWidth: number;
    editorAlignment: EditorAlignment;
    editorWidthIndicators: boolean;
    mathSourceWrap: boolean;
    mathSourcePosition: 'above' | 'below';
    codeLanguageOrder: 'default' | 'a-z' | 'z-a';
    codeBlockActionLabels: boolean;
    toolbarMode: string;
    toolbarToggleIcon: 'logo' | 'chevrons';
    toolbarToggleOnHover: boolean;
    tableToolbarPosition: string;
    tableSourceFormat: 'aligned' | 'compact';
    language: string;
    imageDefaultDir: string;
    forceRelativeImagePath: boolean;
    enableDebugLogging: boolean;
    windowBounds?: { x: number; y: number; width: number; height: number };
    recentFiles?: string[];
}

const DEFAULTS: ElectronSettings = {
    theme: 'things',
    fontSize: 16,
    editorWidthMode: 'default',
    editorMaxWidth: 860,
    editorAlignment: 'center',
    editorWidthIndicators: true,
    mathSourceWrap: false,
    mathSourcePosition: 'above',
    codeLanguageOrder: 'default',
    codeBlockActionLabels: true,
    toolbarMode: 'full',
    toolbarToggleIcon: 'logo',
    toolbarToggleOnHover: false,
    tableToolbarPosition: 'auto',
    tableSourceFormat: 'aligned',
    language: 'default',
    imageDefaultDir: '',
    forceRelativeImagePath: false,
    enableDebugLogging: false,
    recentFiles: [],
};

export class SettingsManager {
    private store: Store<ElectronSettings>;
    private settingsWindow: BrowserWindow | null = null;

    constructor() {
        this.store = new Store<ElectronSettings>({
            name: 'config',
            defaults: DEFAULTS,
        });
    }

    get<K extends keyof ElectronSettings>(key: K): ElectronSettings[K] {
        return this.store.get(key);
    }

    set<K extends keyof ElectronSettings>(key: K, value: ElectronSettings[K]): void {
        this.store.set(key, value);
    }

    getAll(): ElectronSettings {
        return { ...DEFAULTS, ...this.store.store,
            tableSourceFormat: this.store.get('tableSourceFormat') === 'compact' ? 'compact' : 'aligned',
            editorWidthMode: normalizeWidthMode(this.store.get('editorWidthMode')),
            editorMaxWidth: normalizeMaxWidth(this.store.get('editorMaxWidth')),
            editorAlignment: normalizeAlignment(this.store.get('editorAlignment')),
            editorWidthIndicators: this.store.get('editorWidthIndicators') !== false,
            mathSourceWrap: this.store.get('mathSourceWrap') === true,
            codeBlockActionLabels: this.store.get('codeBlockActionLabels') !== false,
            mathSourcePosition: this.store.get('mathSourcePosition') === 'below' ? 'below' : 'above',
            codeLanguageOrder: ['a-z', 'z-a'].includes(this.store.get('codeLanguageOrder')) ? this.store.get('codeLanguageOrder') : 'default' };
    }

    refreshSetting(key: keyof ElectronSettings, error = ''): void {
        if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
            this.settingsWindow.webContents.send('settings-value', { key, value: this.get(key), error });
        }
    }

    addRecentFile(filePath: string): void {
        const recent = this.get('recentFiles') || [];
        const filtered = recent.filter(f => f !== filePath);
        filtered.unshift(filePath);
        this.set('recentFiles', filtered.slice(0, 10));
    }

    openSettingsWindow(parentWindow: BrowserWindow, messages: Record<string, string> = {}): void {
        if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
            this.settingsWindow.focus();
            return;
        }

        this.settingsWindow = new BrowserWindow({
            width: 820,
            height: 680,
            minWidth: 360,
            minHeight: 400,
            parent: parentWindow,
            modal: false,
            resizable: true,
            minimizable: false,
            maximizable: true,
            title: 'Binary Markdown — Preferences',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'settings-preload.js'),
            },
        });

        const html = this.generateSettingsHtml(messages);
        this.settingsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

        this.settingsWindow.on('closed', () => {
            this.settingsWindow = null;
        });
    }

    private generateSettingsHtml(messages: Record<string, string>): string {
        const settings = this.getAll();
        const fallback = require(getResourcePath('out/locales/en.js')).webviewMessages;
        messages = { ...fallback, ...messages };
        const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
        const m = (key: string): string => escapeHtml(messages[key]);
        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${m('settingsPreferences')}</title>
<style>
    * { box-sizing: border-box; }
    :root { color-scheme: light dark; }
    body { margin: 0; height: 100vh; display: flex; flex-direction: column; font: 14px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f6f7f9; color: #252a34; }
    .settings-layout { display: grid; grid-template-columns: 190px minmax(0, 1fr); flex: 1; min-height: 0; }
    nav { padding: 20px 12px; border-right: 1px solid #d6dae1; overflow-y: auto; }
    nav a { display: block; padding: 9px 12px; margin-bottom: 4px; border-radius: 6px; color: inherit; text-decoration: none; overflow-wrap: anywhere; }
    nav a:hover, nav a:focus-visible { background: #e5e9f0; }
    main { padding: 24px; min-width: 0; overflow-y: auto; }
    section { margin-bottom: 32px; }
    h2 { margin: 0 0 16px; font-size: 19px; line-height: 1.3; scroll-margin-top: 24px; }
    h3 { margin: 24px 0 12px; font-size: 15px; }
    .field { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; margin: 10px 0; padding: 12px; background: #fff; border: 1px solid #d6dae1; border-radius: 8px; }
    .field label { font-weight: 500; flex: 1 1 150px; overflow-wrap: anywhere; }
    select, input, button { font: inherit; color: inherit; }
    select, input[type="number"], input[type="text"], button { padding: 6px 8px; border: 1px solid #a4adba; border-radius: 4px; background: #fff; max-width: 100%; min-width: 0; }
    select { width: 210px; }
    input[type="number"] { width: 100px; }
    input[type="checkbox"] { width: 18px; height: 18px; flex-shrink: 0; }
    .field-text input[type="text"] { flex: 1 1 180px; }
    .field-desc { font-size: 13px; color: #525c6c; margin: -2px 12px 16px; overflow-wrap: anywhere; }
    :focus-visible { outline: 2px solid #2766ca; outline-offset: 3px; }
    #settingsError { flex-shrink: 0; max-height: 30vh; overflow-y: auto; margin: 0; padding: 12px 20px; color: #8e2020; background: #ffeded; border-bottom: 1px solid #d97e7e; overflow-wrap: anywhere; }
    @media (max-width: 600px) {
        .settings-layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
        nav { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px; border-right: 0; border-bottom: 1px solid #d6dae1; max-height: 35vh; }
        nav a { margin: 0; padding: 6px 8px; }
        main { padding: 16px; }
        h2 { scroll-margin-top: 16px; }
    }
    @media (prefers-color-scheme: dark) {
        body { background: #1f2228; color: #eef0f4; }
        nav, .field { border-color: #4b5260; }
        nav a:hover, nav a:focus-visible { background: #383f4b; }
        .field, select, input[type="number"], input[type="text"], button { background: #2b3039; }
        .field-desc { color: #b8c1cf; }
        :focus-visible { outline-color: #8fbaff; }
        #settingsError { color: #ffd1d1; background: #492424; }
    }
</style>
</head>
<body>
    <p id="settingsError" role="alert" hidden></p>
    <div class="settings-layout">
        <nav aria-label="${m('settingsCategories')}">
            <a href="#settings-editor">${m('settingsEditor')}</a>
            <a href="#settings-writing">${m('settingsWriting')}</a>
            <a href="#settings-images">${m('settingsImages')}</a>
            <a href="#settings-advanced">${m('settingsAdvanced')}</a>
        </nav>
        <main>
            <section aria-labelledby="settings-editor">
                <h2 id="settings-editor" tabindex="-1">${m('settingsEditor')}</h2>
                <div class="field">
                    <label for="language">Language</label>
                    <select id="language" onchange="save('language', this.value)">
                        <option value="default" ${settings.language === 'default' ? 'selected' : ''}>Auto</option>
                        <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
                        <option value="ja" ${settings.language === 'ja' ? 'selected' : ''}>Japanese</option>
                        <option value="zh-CN" ${settings.language === 'zh-CN' ? 'selected' : ''}>Chinese (Simplified)</option>
                        <option value="zh-TW" ${settings.language === 'zh-TW' ? 'selected' : ''}>Chinese (Traditional)</option>
                        <option value="ko" ${settings.language === 'ko' ? 'selected' : ''}>Korean</option>
                        <option value="es" ${settings.language === 'es' ? 'selected' : ''}>Spanish</option>
                        <option value="fr" ${settings.language === 'fr' ? 'selected' : ''}>French</option>
                    </select>
                </div>
                <div class="field">
                    <label for="theme">Theme</label>
                    <select id="theme" onchange="save('theme', this.value)">
                        <option value="github" ${settings.theme === 'github' ? 'selected' : ''}>GitHub</option>
                        <option value="sepia" ${settings.theme === 'sepia' ? 'selected' : ''}>Sepia</option>
                        <option value="night" ${settings.theme === 'night' ? 'selected' : ''}>Night</option>
                        <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                        <option value="minimal" ${settings.theme === 'minimal' ? 'selected' : ''}>Minimal</option>
                        <option value="perplexity" ${settings.theme === 'perplexity' ? 'selected' : ''}>Perplexity</option>
                        <option value="things" ${settings.theme === 'things' ? 'selected' : ''}>Things</option>
                    </select>
                </div>
                <div class="field">
                    <label for="fontSize">Font Size</label>
                    <input type="number" id="fontSize" min="10" max="32" value="${settings.fontSize}" onchange="save('fontSize', parseInt(this.value))">
                </div>
                <div class="field">
                    <label for="toolbarMode">Toolbar</label>
                    <select id="toolbarMode" onchange="save('toolbarMode', this.value)">
                        <option value="simple" ${settings.toolbarMode === 'simple' ? 'selected' : ''}>Simple</option>
                        <option value="full" ${settings.toolbarMode === 'full' ? 'selected' : ''}>Full</option>
                    </select>
                </div>
                <div class="field">
                    <label for="toolbarToggleIcon">${messages.toolbarToggleIconLabel}</label>
                    <select id="toolbarToggleIcon" onchange="save('toolbarToggleIcon', this.value)">
                        <option value="logo" ${settings.toolbarToggleIcon === 'logo' ? 'selected' : ''}>${messages.toolbarToggleLogo}</option>
                        <option value="chevrons" ${settings.toolbarToggleIcon === 'chevrons' ? 'selected' : ''}>${messages.toolbarToggleChevrons}</option>
                    </select>
                </div>
                <div class="field">
                    <label for="toolbarToggleOnHover">${messages.toolbarToggleOnHoverLabel}</label>
                    <input type="checkbox" id="toolbarToggleOnHover" ${settings.toolbarToggleOnHover ? 'checked' : ''} aria-describedby="toolbarToggleOnHoverHelp" onchange="save('toolbarToggleOnHover', this.checked)">
                </div>
                <p class="field-desc" id="toolbarToggleOnHoverHelp">${messages.toolbarToggleOnHoverHelp}</p>
                <div class="field">
                    <label for="editorWidthMode">${messages.editorWidthLabel || 'Editor width'}</label>
                    <select id="editorWidthMode" onchange="save('editorWidthMode', this.value)">
                        <option value="default" ${settings.editorWidthMode === 'default' ? 'selected' : ''}>${messages.editorWidthDefault || 'Default (860 px)'}</option>
                        <option value="full" ${settings.editorWidthMode === 'full' ? 'selected' : ''}>${messages.editorWidthFull || 'Full width'}</option>
                        <option value="custom" ${settings.editorWidthMode === 'custom' ? 'selected' : ''}>${messages.editorWidthCustom || 'Custom width'}</option>
                    </select>
                </div>
                <div class="field">
                    <label for="editorMaxWidth">${messages.editorMaxWidthLabel || 'Maximum width (px)'}</label>
                    <input type="number" id="editorMaxWidth" min="320" max="4000" step="1" value="${settings.editorMaxWidth}" aria-describedby="editorWidthHelp" onchange="save('editorMaxWidth', Number(this.value))">
                </div>
                <div class="field-desc" id="editorWidthHelp">${messages.editorWidthHelp || 'Custom width: 320–4000 CSS pixels, including padding. Visual editor only; Source and exports keep their own layout.'}</div>
                <div class="field">
                    <label for="editorAlignment">${messages.editorAlignmentLabel || 'Column alignment'}</label>
                    <select id="editorAlignment" aria-describedby="editorAlignmentHelp" onchange="save('editorAlignment', this.value)">
                        <option value="left" ${settings.editorAlignment === 'left' ? 'selected' : ''}>${messages.editorAlignmentLeft || 'Left'}</option>
                        <option value="center" ${settings.editorAlignment === 'center' ? 'selected' : ''}>${messages.editorAlignmentCenter || 'Center'}</option>
                        <option value="right" ${settings.editorAlignment === 'right' ? 'selected' : ''}>${messages.editorAlignmentRight || 'Right'}</option>
                    </select>
                </div>
                <div class="field-desc" id="editorAlignmentHelp">${messages.editorAlignmentHelp || 'Places a capped column within the editor pane. Does not align the text or change Source or exports.'}</div>
                <div class="field">
                    <label for="editorWidthIndicators">${messages.widthIndicatorsLabel}</label>
                    <input type="checkbox" id="editorWidthIndicators" ${settings.editorWidthIndicators ? 'checked' : ''} aria-describedby="widthIndicatorsHelp" onchange="save('editorWidthIndicators', this.checked)">
                </div>
                <div class="field-desc" id="widthIndicatorsHelp">${messages.widthIndicatorsHelp}</div>
            </section>
            <section aria-labelledby="settings-writing">
                <h2 id="settings-writing" tabindex="-1">${m('settingsWriting')}</h2>
                <h3>${m('settingsTables')}</h3>
                <div class="field">
                    <label for="tableToolbarPosition">Table controls</label>
                    <select id="tableToolbarPosition" onchange="save('tableToolbarPosition', this.value)">
                        ${['auto', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right', 'top-bar'].map(value =>
                            `<option value="${value}" ${settings.tableToolbarPosition === value ? 'selected' : ''}>${({ auto: 'Automatic (recommended)', 'top-bar': 'Always in top bar', 'top-left': 'Top left', 'top-right': 'Top right', 'bottom-left': 'Bottom left', 'bottom-right': 'Bottom right', left: 'Left side (vertical)', right: 'Right side (vertical)' } as Record<string, string>)[value]}</option>`).join('')}
                    </select>
                </div>
                <div class="field">
                    <label for="tableSourceFormat">${messages.tableSourceFormatLabel}</label>
                    <select id="tableSourceFormat" onchange="save('tableSourceFormat', this.value)">
                        <option value="aligned" ${settings.tableSourceFormat === 'aligned' ? 'selected' : ''}>${messages.tableSourceFormatAligned}</option>
                        <option value="compact" ${settings.tableSourceFormat === 'compact' ? 'selected' : ''}>${messages.tableSourceFormatCompact}</option>
                    </select>
                </div>
                <p class="field-desc">${messages.tableSourceFormatHelp}</p>
                <h3>${m('settingsCode')}</h3>
                <div class="field">
                    <label for="codeBlockActionLabels">${messages.codeBlockActionLabelsLabel}</label>
                    <input type="checkbox" id="codeBlockActionLabels" aria-describedby="codeBlockActionLabelsHelp" ${settings.codeBlockActionLabels ? 'checked' : ''} onchange="save('codeBlockActionLabels', this.checked)">
                </div>
                <div class="field-desc" id="codeBlockActionLabelsHelp">${messages.codeBlockActionLabelsHelp}</div>
                <div class="field">
                    <label for="codeLanguageOrder">${messages.codeLanguageOrderLabel}</label>
                    <select id="codeLanguageOrder" aria-describedby="codeLanguageOrderHelp" onchange="save('codeLanguageOrder', this.value)">
                        <option value="default" ${settings.codeLanguageOrder === 'default' ? 'selected' : ''}>${messages.codeLanguageOrderDefault}</option>
                        <option value="a-z" ${settings.codeLanguageOrder === 'a-z' ? 'selected' : ''}>${messages.codeLanguageOrderAscending}</option>
                        <option value="z-a" ${settings.codeLanguageOrder === 'z-a' ? 'selected' : ''}>${messages.codeLanguageOrderDescending}</option>
                    </select>
                </div>
                <div class="field-desc" id="codeLanguageOrderHelp">${messages.codeLanguageOrderHelp}</div>
                <h3>${m('settingsEquations')}</h3>
                <div class="field">
                    <label for="mathSourcePosition">${messages.mathSourcePositionLabel}</label>
                    <select id="mathSourcePosition" aria-describedby="mathSourcePositionHelp" onchange="save('mathSourcePosition', this.value)">
                        <option value="above" ${settings.mathSourcePosition === 'above' ? 'selected' : ''}>${messages.mathSourcePositionAbove}</option>
                        <option value="below" ${settings.mathSourcePosition === 'below' ? 'selected' : ''}>${messages.mathSourcePositionBelow}</option>
                    </select>
                </div>
                <div class="field-desc" id="mathSourcePositionHelp">${messages.mathSourcePositionHelp}</div>
                <div class="field">
                    <label for="mathSourceWrap">${messages.mathSourceWrapLabel}</label>
                    <input type="checkbox" id="mathSourceWrap" aria-describedby="mathSourceWrapHelp" ${settings.mathSourceWrap ? 'checked' : ''} onchange="save('mathSourceWrap', this.checked)">
                </div>
                <div class="field-desc" id="mathSourceWrapHelp">${messages.mathSourceWrapHelp}</div>
            </section>
            <section aria-labelledby="settings-images">
                <h2 id="settings-images" tabindex="-1">${m('settingsImages')}</h2>
                <div class="field field-text">
                    <label for="imageDefaultDir">Default Dir</label>
                    <input type="text" id="imageDefaultDir" value="${escapeHtml(settings.imageDefaultDir)}" onchange="save('imageDefaultDir', this.value)" placeholder="(document directory)">
                    <button type="button" aria-label="${m('setImageDir')}" onclick="selectDir()" style="margin-left:4px;padding:2px 8px;cursor:pointer;">...</button>
                </div>
                <div class="field-desc">Absolute path or relative path from document. e.g. <code>./images</code>, <code>/path/to/images</code></div>
                <div class="field">
                    <label for="forceRelativeImagePath">Force Relative Path</label>
                    <input type="checkbox" id="forceRelativeImagePath" ${settings.forceRelativeImagePath ? 'checked' : ''} onchange="save('forceRelativeImagePath', this.checked)">
                </div>
                <div class="field-desc">When enabled, image paths in Markdown are always saved as relative paths, even if Default Dir is absolute.</div>
            </section>
            <section aria-labelledby="settings-advanced">
                <h2 id="settings-advanced" tabindex="-1">${m('settingsAdvanced')}</h2>
                <div class="field">
                    <label for="enableDebugLogging">Debug Logging</label>
                    <input type="checkbox" id="enableDebugLogging" ${settings.enableDebugLogging ? 'checked' : ''} onchange="save('enableDebugLogging', this.checked)">
                </div>
            </section>
        </main>
    </div>

    <script>
    document.querySelector('nav').addEventListener('click', function(event) {
        const link = event.target.closest('a');
        if (!link) return;
        event.preventDefault();
        const heading = document.querySelector(link.getAttribute('href'));
        heading.focus({ preventScroll: true });
        heading.scrollIntoView({ block: 'start' });
    });
    window.settingsBridge.onValue(function(update) {
        const field = document.getElementById(update.key);
        if (field) {
            if (field.type === 'checkbox') field.checked = Boolean(update.value);
            else field.value = String(update.value);
        }
        const error = document.getElementById('settingsError');
        error.textContent = update.error || '';
        error.hidden = !update.error;
    });
    function save(key, value) {
        window.settingsBridge.save(key, value);
    }
    async function selectDir() {
        const dir = await window.settingsBridge.selectDirectory();
        if (dir !== null) {
            document.getElementById('imageDefaultDir').value = dir;
            save('imageDefaultDir', dir);
        }
    }
    </script>
</body>
</html>`;
    }
}
