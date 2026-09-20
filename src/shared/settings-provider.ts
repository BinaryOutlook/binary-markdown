import { TableToolbarPosition } from './table-placement';
import { EditorWidthMode, EditorAlignment } from './editor-layout';
/**
 * SettingsProvider: an abstraction for reading editor settings and observing changes.
 *
 * VS Code: wraps vscode.workspace.getConfiguration('binary-markdown').
 * Electron: uses an electron-store implementation.
 */

export interface EditorSettings {
    theme: 'github' | 'sepia' | 'night' | 'dark' | 'minimal' | 'perplexity';
    fontSize: number;
    editorWidthMode: EditorWidthMode;
    editorMaxWidth: number;
    editorAlignment: EditorAlignment;
    editorWidthIndicators: boolean;
    mathSourcePosition: 'above' | 'below';
    codeLanguageOrder: 'default' | 'a-z' | 'z-a';
    toolbarMode: 'full' | 'simple';
    tableToolbarPosition: TableToolbarPosition;
    language: 'default' | 'en' | 'ja' | 'zh-TW' | 'zh-CN' | 'ko' | 'es' | 'fr';
    imageDefaultDir: string;
    forceRelativeImagePath: boolean;
    enableDebugLogging: boolean;
}

export const DEFAULT_SETTINGS: EditorSettings = {
    theme: 'github',
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
};

export interface SettingsProvider {
    get<K extends keyof EditorSettings>(key: K): EditorSettings[K];
    getAll(): EditorSettings;
    onChange(callback: () => void): { dispose(): void };
}
