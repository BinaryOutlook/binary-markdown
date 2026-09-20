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
    mathSourcePosition: 'above' | 'below';
    codeLanguageOrder: 'default' | 'a-z' | 'z-a';
    toolbarMode: string;
    tableToolbarPosition: string;
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
    mathSourcePosition: 'above',
    codeLanguageOrder: 'default',
    toolbarMode: 'full',
    tableToolbarPosition: 'auto',
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
            editorWidthMode: normalizeWidthMode(this.store.get('editorWidthMode')),
            editorMaxWidth: normalizeMaxWidth(this.store.get('editorMaxWidth')),
            editorAlignment: normalizeAlignment(this.store.get('editorAlignment')),
            editorWidthIndicators: this.store.get('editorWidthIndicators') !== false,
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
            width: 480,
            height: 540,
            parent: parentWindow,
            modal: false,
            resizable: false,
            minimizable: false,
            maximizable: false,
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
        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Preferences</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; padding: 24px; background: #f5f5f5; color: #333; }
    h2 { font-size: 14px; font-weight: 600; margin: 20px 0 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    h2:first-child { margin-top: 0; }
    .field { display: flex; align-items: center; justify-content: space-between; margin: 8px 0; padding: 8px 12px; background: white; border-radius: 6px; }
    .field label { font-weight: 500; }
    select, input[type="number"] { padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; background: white; }
    select { min-width: 140px; }
    input[type="number"] { width: 70px; text-align: center; }
    input[type="checkbox"] { width: 16px; height: 16px; }
    .field-text input[type="text"] { flex: 1; margin-left: 12px; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; }
    .field-desc { font-size: 11px; color: #888; margin: -4px 0 8px 12px; }
    hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
</style>
</head>
<body>
    <p id="settingsError" role="alert" style="color:#9f2e2e" hidden></p>
    <h2>Appearance</h2>
    <div class="field">
        <label>Theme</label>
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
        <label>Font Size</label>
        <input type="number" id="fontSize" min="10" max="32" value="${settings.fontSize}" onchange="save('fontSize', parseInt(this.value))">
    </div>
    <div class="field">
        <label>Toolbar</label>
        <select id="toolbarMode" onchange="save('toolbarMode', this.value)">
            <option value="simple" ${settings.toolbarMode === 'simple' ? 'selected' : ''}>Simple</option>
            <option value="full" ${settings.toolbarMode === 'full' ? 'selected' : ''}>Full</option>
        </select>
    </div>
    <div class="field">
        <label>Table controls</label>
        <select id="tableToolbarPosition" onchange="save('tableToolbarPosition', this.value)">
            ${['auto', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right', 'top-bar'].map(value =>
                `<option value="${value}" ${settings.tableToolbarPosition === value ? 'selected' : ''}>${({ auto: 'Automatic (recommended)', 'top-bar': 'Always in top bar', 'top-left': 'Top left', 'top-right': 'Top right', 'bottom-left': 'Bottom left', 'bottom-right': 'Bottom right', left: 'Left side (vertical)', right: 'Right side (vertical)' } as Record<string, string>)[value]}</option>`).join('')}
        </select>
    </div>
    <div class="field">
        <label>Language</label>
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

    <div class="field">
        <label for="codeLanguageOrder">${messages.codeLanguageOrderLabel}</label>
        <select id="codeLanguageOrder" aria-describedby="codeLanguageOrderHelp" onchange="save('codeLanguageOrder', this.value)">
            <option value="default" ${settings.codeLanguageOrder === 'default' ? 'selected' : ''}>${messages.codeLanguageOrderDefault}</option>
            <option value="a-z" ${settings.codeLanguageOrder === 'a-z' ? 'selected' : ''}>${messages.codeLanguageOrderAscending}</option>
            <option value="z-a" ${settings.codeLanguageOrder === 'z-a' ? 'selected' : ''}>${messages.codeLanguageOrderDescending}</option>
        </select>
    </div>
    <div class="field-desc" id="codeLanguageOrderHelp">${messages.codeLanguageOrderHelp}</div>

    <div class="field">
        <label for="mathSourcePosition">${messages.mathSourcePositionLabel}</label>
        <select id="mathSourcePosition" aria-describedby="mathSourcePositionHelp" onchange="save('mathSourcePosition', this.value)">
            <option value="above" ${settings.mathSourcePosition === 'above' ? 'selected' : ''}>${messages.mathSourcePositionAbove}</option>
            <option value="below" ${settings.mathSourcePosition === 'below' ? 'selected' : ''}>${messages.mathSourcePositionBelow}</option>
        </select>
    </div>
    <div class="field-desc" id="mathSourcePositionHelp">${messages.mathSourcePositionHelp}</div>

    <h2>Images</h2>
    <div class="field field-text">
        <label>Default Dir</label>
        <input type="text" id="imageDefaultDir" value="${settings.imageDefaultDir}" onchange="save('imageDefaultDir', this.value)" placeholder="(document directory)">
        <button onclick="selectDir()" style="margin-left:4px;padding:2px 8px;cursor:pointer;">...</button>
    </div>
    <div class="field-desc">Absolute path or relative path from document. e.g. <code>./images</code>, <code>/Users/me/pics</code></div>
    <div class="field">
        <label>Force Relative Path</label>
        <input type="checkbox" id="forceRelativeImagePath" ${settings.forceRelativeImagePath ? 'checked' : ''} onchange="save('forceRelativeImagePath', this.checked)">
    </div>
    <div class="field-desc">When enabled, image paths in Markdown are always saved as relative paths, even if Default Dir is absolute.</div>

    <h2>Advanced</h2>
    <div class="field">
        <label>Debug Logging</label>
        <input type="checkbox" id="enableDebugLogging" ${settings.enableDebugLogging ? 'checked' : ''} onchange="save('enableDebugLogging', this.checked)">
    </div>

    <script>
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
