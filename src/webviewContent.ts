import { normalize as normalizeTablePosition } from './shared/table-placement';
import { normalizeWidthMode, normalizeMaxWidth, normalizeAlignment } from './shared/editor-layout';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WebviewMessages } from './i18n/messages';
import { getExportMessages } from './export/messages';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateEditorBodyHtml } = require('./shared/editor-body-html');

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

interface EditorConfig {
    theme: string;
    fontSize: number;
    editorWidthMode?: string;
    editorMaxWidth?: number;
    editorAlignment?: string;
    editorWidthIndicators?: boolean;
    toolbarMode?: string;
    tableToolbarPosition?: string;
    documentBaseUri?: string;
    webviewMessages?: WebviewMessages;
    enableDebugLogging?: boolean;
    outlineOpen?: boolean;
    outlineActiveColor?: string;
    mathBackslashDelimiters?: boolean;
    renderGeneration?: number;
}

function normalizeOutlineActiveColor(value: string | undefined): string {
    const color = (value || '').trim();
    const presets: Record<string, string> = {
        theme: 'var(--link-color)',
        blue: '#3b82f6',
        green: '#22c55e',
        orange: '#f59e0b',
        red: '#ef4444',
        purple: '#a855f7'
    };
    if (!color) { return presets.theme; }
    if (presets[color]) { return presets[color]; }
    // Preserve custom colors saved by earlier builds while keeping arbitrary
    // CSS out of the generated stylesheet.
    if (/^(?:#[0-9a-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\([\d\s.,%+-]+\))$/i.test(color)) {
        return color;
    }
    return 'var(--link-color)';
}

export function getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    content: string,
    config: EditorConfig
): string {
    // Defensive checks to prevent "Assertion Failed: Argument is undefined or null" errors
    // This can happen when VSCode tries to restore cached webview state after extension updates
    if (!webview) {
        throw new Error('Webview is undefined or null');
    }
    if (!extensionUri) {
        throw new Error('Extension URI is undefined or null');
    }
    
    // Ensure content is a string (can be undefined/null after extension update)
    let safeContent = content ?? '';
    // Strip BOM (Byte Order Mark) if present - some editors add this to UTF-8 files
    if (safeContent.charCodeAt(0) === 0xFEFF) {
        safeContent = safeContent.slice(1);
    }
    // Normalize line endings: \r\n (Windows) and lone \r (old Mac) → \n
    safeContent = safeContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Ensure config has all required properties with defaults
    const safeConfig: EditorConfig = {
        theme: config?.theme ?? 'github',
        fontSize: config?.fontSize ?? 16,
        editorWidthMode: normalizeWidthMode(config?.editorWidthMode),
        editorMaxWidth: normalizeMaxWidth(config?.editorMaxWidth),
        editorAlignment: normalizeAlignment(config?.editorAlignment),
        editorWidthIndicators: config?.editorWidthIndicators !== false,
        toolbarMode: config?.toolbarMode ?? 'full',
        tableToolbarPosition: normalizeTablePosition(config?.tableToolbarPosition),
        documentBaseUri: config?.documentBaseUri ?? '',
        webviewMessages: config?.webviewMessages,
        enableDebugLogging: config?.enableDebugLogging ?? false,
        outlineOpen: config?.outlineOpen ?? true,
        outlineActiveColor: config?.outlineActiveColor ?? 'theme',
        mathBackslashDelimiters: config?.mathBackslashDelimiters ?? true
    };
    
    const nonce = getNonce();
    // webviewMessages should always be provided, but fallback to empty object for safety
    const msg = safeConfig.webviewMessages || {} as WebviewMessages;
    
    // Use Base64 encoding to safely pass content to JavaScript
    // This avoids all escaping issues with template literals, special characters, etc.
    const base64Content = Buffer.from(safeContent, 'utf8').toString('base64');

    // Load external CSS and JS files
    const stylesPath = path.join(__dirname, 'webview', 'styles.css');
    const editorScriptPath = path.join(__dirname, 'webview', 'editor.js');
    const auxScript = fs.readFileSync(path.join(__dirname, 'shared', 'document-aux.js'), 'utf8');
    const exportScript = fs.readFileSync(path.join(__dirname, 'webview', 'export-ui.js'), 'utf8');
    
    const styles = fs.readFileSync(stylesPath, 'utf8')
        .replace('__FONT_SIZE__', String(safeConfig.fontSize))
        .replace('__OUTLINE_ACTIVE_COLOR__', normalizeOutlineActiveColor(safeConfig.outlineActiveColor));
    
    const hostBridgePath = path.join(__dirname, 'shared', 'vscode-host-bridge.js');
    const hostBridgeScript = fs.readFileSync(hostBridgePath, 'utf8');

    // Vendor library URIs (local instead of CDN)
    const vendorDir = path.join(__dirname, '..', 'vendor');
    const vendorUri = (file: string) => webview.asWebviewUri(
        vscode.Uri.file(path.join(vendorDir, file))
    );
    const turndownUri = vendorUri('turndown.js');
    const turndownGfmUri = vendorUri('turndown-plugin-gfm.js');
    const mermaidUri = vendorUri('mermaid.min.js');
    const katexJsUri = vendorUri('katex.min.js');
    const katexCssUri = vendorUri('katex.min.css');

    const mathScript = fs.readFileSync(path.join(__dirname, 'shared', 'math-syntax.js'), 'utf8');
    const editorScript = (fs.readFileSync(path.join(__dirname, 'shared', 'editor-layout.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'shared', 'table-placement.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'webview', 'table-toolbar.js'), 'utf8') + '\n' + mathScript + '\n' + fs.readFileSync(editorScriptPath, 'utf8'))
        .replace('__MATH_BACKSLASH__', String(safeConfig.mathBackslashDelimiters))
        .replace('__DEBUG_MODE__', String(safeConfig.enableDebugLogging ?? false))
        .replace('__I18N__', JSON.stringify(msg))
        .replace('__DOCUMENT_BASE_URI__', safeConfig.documentBaseUri || '')
        .replace('__CONTENT__', `'${base64Content}'`);

    return `<!DOCTYPE html>
<html lang="en" data-theme="${safeConfig.theme}" data-editor-width-mode="${safeConfig.editorWidthMode}" data-editor-max-width="${safeConfig.editorMaxWidth}" data-editor-alignment="${safeConfig.editorAlignment}" data-editor-width-indicators="${safeConfig.editorWidthIndicators}" data-toolbar-mode="${safeConfig.toolbarMode}" data-table-toolbar-position="${safeConfig.tableToolbarPosition}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com; script-src 'nonce-${nonce}' ${webview.cspSource}; img-src ${webview.cspSource} https: http: data: file:; font-src ${webview.cspSource} https: https://fonts.gstatic.com data:; connect-src http://127.0.0.1:7244;">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap">
    <title>Binary Markdown Editor</title>
    <style>
        ${styles}
    </style>
</head>
<body>
    ${generateEditorBodyHtml(msg, process.platform, { outlineOpen: safeConfig.outlineOpen, exportEnabled: true, settingsEnabled: true })}

    <script src="${turndownUri}"></script>
    <script src="${turndownGfmUri}"></script>
    <script src="${mermaidUri}"></script>
    <link rel="stylesheet" href="${katexCssUri}">
    <script src="${katexJsUri}"></script>
    <script nonce="${nonce}">
        ${hostBridgeScript}
    </script>
    <script nonce="${nonce}">
        ${auxScript}
        ${editorScript}
    </script>
    <script nonce="${nonce}">
        window.exportMessages = ${JSON.stringify(getExportMessages())};
        ${exportScript}
    </script>
    <script nonce="${nonce}">
        (() => {
            const generation = ${Number.isSafeInteger(config?.renderGeneration) ? config.renderGeneration : 'null'};
            if (generation === null) return;
            window.addEventListener('message', event => {
                if (event.data?.type === 'renderProbe' && event.data.generation === generation) {
                    window.hostBridge.reportRenderState('renderReady', generation);
                }
            });
            window.hostBridge.reportRenderState('renderLoaded', generation);
        })();
    </script>
</body>
</html>`;
}
