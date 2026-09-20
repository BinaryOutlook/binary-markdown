/**
 * VS Code SettingsProvider: wraps vscode.workspace.getConfiguration.
 */
import * as vscode from 'vscode';
import { EditorSettings, SettingsProvider, DEFAULT_SETTINGS } from './settings-provider';

export class VSCodeSettingsProvider implements SettingsProvider {
    private get config() {
        return vscode.workspace.getConfiguration('binary-markdown');
    }

    get<K extends keyof EditorSettings>(key: K): EditorSettings[K] {
        return this.config.get<EditorSettings[K]>(key, DEFAULT_SETTINGS[key])!;
    }

    getAll(): EditorSettings {
        return {
            theme: this.get('theme'),
            fontSize: this.get('fontSize'),
            editorWidthMode: this.get('editorWidthMode'),
            editorMaxWidth: this.get('editorMaxWidth'),
            editorAlignment: this.get('editorAlignment'),
            editorWidthIndicators: this.get('editorWidthIndicators'),
            mathSourceWrap: this.get('mathSourceWrap'),
            mathSourcePosition: this.get('mathSourcePosition'),
            codeLanguageOrder: this.get('codeLanguageOrder'),
            toolbarMode: this.get('toolbarMode'),
            tableToolbarPosition: this.get('tableToolbarPosition'),
            language: this.get('language'),
            imageDefaultDir: this.get('imageDefaultDir'),
            forceRelativeImagePath: this.get('forceRelativeImagePath'),
            enableDebugLogging: this.get('enableDebugLogging'),
        };
    }

    onChange(callback: () => void): { dispose(): void } {
        const disposable = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('binary-markdown')) {
                callback();
            }
        });
        return disposable;
    }

    /**
     * Returns the VS Code interface language.
     */
    getSystemLanguage(): string {
        return vscode.env.language;
    }
}
