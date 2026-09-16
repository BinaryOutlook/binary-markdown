import { normalize as normalizeTablePosition, positions as tablePositions } from './shared/table-placement';
import { refreshTocs } from './shared/document-aux';
import * as vscode from 'vscode';
import { getWebviewContent } from './webviewContent';
import { EditQueue } from './export/edit-queue';
import { ExportController } from './export/controller';
import { ExportFormat } from './export/types';
import { t, getWebviewMessages, initLocale } from './i18n/messages';

type OutlineStateScope = 'file' | 'global';

interface OutlineStateStoreContract {
    getOpen(scope: OutlineStateScope, resourceKey: string, defaultOpen: boolean): boolean;
    setOpen(scope: OutlineStateScope, resourceKey: string, open: boolean): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { OutlineStateStore } = require('./shared/outline-state-store') as {
    OutlineStateStore: new (
        workspaceState: vscode.Memento,
        globalState: vscode.Memento
    ) => OutlineStateStoreContract;
};

// ============================================
// DocumentParser: IMAGE_DIR directive parsing.
// ============================================

/**
 * Extracts the IMAGE_DIR directive from a document.
 * Expected format at the end of the document:
 * ---
 * IMAGE_DIR: <dir_path>
 * FORCE_RELATIVE_PATH: <true|false>
 * 
 * Supports standalone directives and blocks containing other directives.
 */
function extractImageDir(content: string): string | null {
    // Pattern: matches IMAGE_DIR in a directive block (may have other directives before/after)
    const pattern = /\n---\n(?:[\s\S]*?\n)?IMAGE_DIR:\s*([^\n]+)/;
    const match = content.match(pattern);
    if (match) {
        return match[1].trim();
    }
    return null;
}

/**
 * Inserts or updates the IMAGE_DIR directive.
 * Replaces an existing directive block or creates one if absent.
 * Keeps IMAGE_DIR and FORCE_RELATIVE_PATH in the same block.
 */
function insertOrUpdateImageDir(content: string, dirPath: string): string {
    const existingImageDir = extractImageDir(content);
    const existingForceRelative = extractForceRelativePath(content);
    
    // Remove all existing directive blocks
    let cleanContent = removeAllDirectives(content);
    
    // Build new directive block
    let directives = `IMAGE_DIR: ${dirPath}`;
    if (existingForceRelative !== null) {
        directives += `\nFORCE_RELATIVE_PATH: ${existingForceRelative}`;
    }
    
    return cleanContent.trimEnd() + `\n---\n${directives}`;
}

/**
 * Checks whether the document contains an IMAGE_DIR directive.
 */
function hasImageDir(content: string): boolean {
    return extractImageDir(content) !== null;
}

/**
 * Extracts the FORCE_RELATIVE_PATH directive from a document.
 * Expected format at the end of the document:
 * ---
 * FORCE_RELATIVE_PATH: true/false
 * 
 * Supports standalone directives and blocks containing other directives.
 */
function extractForceRelativePath(content: string): boolean | null {
    const pattern = /\n---\n(?:[\s\S]*?\n)?FORCE_RELATIVE_PATH:\s*(true|false)/i;
    const match = content.match(pattern);
    if (match) {
        return match[1].toLowerCase() === 'true';
    }
    return null;
}

/**
 * Removes recognized trailing image directive blocks.
 */
function removeAllDirectives(content: string): string {
    // Remove standalone directive blocks
    let result = content.replace(/\n---\nIMAGE_DIR:\s*[^\n]+\s*$/g, '');
    result = result.replace(/\n---\nFORCE_RELATIVE_PATH:\s*(true|false)\s*$/gi, '');
    
    // Remove combined directive block at end of file
    result = result.replace(/\n---\n(?:(?:IMAGE_DIR:\s*[^\n]+|FORCE_RELATIVE_PATH:\s*(?:true|false))\n?)+\s*$/gi, '');
    
    return result;
}

// ============================================
// PathResolver: path resolution.
// ============================================

const path = require('path');
const fs = require('fs');

/**
 * Resolves a configured path to an absolute path.
 * @param configPath - Configured absolute or relative path.
 * @param documentPath - Absolute path to the document.
 * @returns The resolved absolute path.
 */
function resolveToAbsolute(configPath: string, documentPath: string): string {
    if (!configPath || configPath === '') {
        // An empty setting uses the document directory.
        return path.dirname(documentPath);
    }
    
    if (path.isAbsolute(configPath)) {
        // Use an absolute path as supplied.
        return configPath;
    }
    
    // Resolve relative paths against the document directory.
    const docDir = path.dirname(documentPath);
    return path.resolve(docDir, configPath);
}

/**
 * Converts an absolute image path to a path for Markdown.
 * @param imagePath - Absolute path to the image.
 * @param documentPath - Absolute path to the document.
 * @param useAbsolute - Whether to use an absolute path.
 * @param forceRelative - Whether to force a relative path.
 * @returns An absolute or relative path for Markdown.
 */
function toMarkdownPath(imagePath: string, documentPath: string, useAbsolute: boolean, forceRelative: boolean = false): string {
    // forceRelative overrides the absolute-path preference.
    if (forceRelative || !useAbsolute) {
        const docDir = path.dirname(documentPath);
        let relativePath = path.relative(docDir, imagePath);
        // Convert Windows backslashes to forward slashes.
        relativePath = relativePath.replace(/\\/g, '/');
        return relativePath;
    }
    
    // Use the absolute path when configured to do so.
    // Convert Windows backslashes to forward slashes.
    return imagePath.replace(/\\/g, '/');
}

/**
 * Creates the directory if it does not exist.
 */
function ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Generates a unique filename using a timestamp.
 * Adds a numeric suffix if a file with the same timestamp already exists.
 * @param dir - Directory path.
 * @param extension - File extension without the leading dot.
 * @returns A unique filename.
 */
function generateUniqueFileName(dir: string, extension: string): string {
    const timestamp = Date.now();
    const baseName = `${timestamp}.${extension}`;
    const basePath = path.join(dir, baseName);
    
    // Use the name directly if the file does not exist.
    if (!fs.existsSync(basePath)) {
        return baseName;
    }
    
    // Add a numeric suffix when the timestamp is already in use.
    let counter = 1;
    while (true) {
        const counterStr = counter.toString().padStart(4, '0');
        const newName = `${timestamp}-${counterStr}.${extension}`;
        const newPath = path.join(dir, newName);
        if (!fs.existsSync(newPath)) {
            return newName;
        }
        counter++;
    }
}

// ============================================
// ImageDirectoryManager: image save directory management.
// ============================================

/**
 * Normalizes a path by removing trailing separators.
 */
function normalizeTrailingSlash(p: string): string {
    // Preserve root paths such as / and C:\.
    if (p === '/' || /^[A-Za-z]:\\?$/.test(p)) {
        return p;
    }
    return p.replace(/[\/\\]+$/, '');
}

class ImageDirectoryManager {
    // Per-file IMAGE_DIR values keyed by document URI.
    private fileImageDirs: Map<string, string> = new Map();
    // Last detected IMAGE_DIR values for change detection.
    private lastDetectedDirs: Map<string, string> = new Map();
    // Records whether the configured path is absolute.
    private useAbsolutePath: Map<string, boolean> = new Map();
    
    /**
     * Returns the effective image save directory.
     * Priority: 1. Per-file IMAGE_DIR, 2. Document IMAGE_DIR directive, 3. VS Code imageDefaultDir setting, 4. Document directory.
     */
    getImageDirectory(documentUri: vscode.Uri, documentContent: string): string {
        const documentPath = documentUri.fsPath;
        const uriKey = documentUri.toString();
        
        // 1. Check the per-file IMAGE_DIR.
        const fileImageDir = this.fileImageDirs.get(uriKey);
        if (fileImageDir) {
            const normalized = normalizeTrailingSlash(fileImageDir);
            this.useAbsolutePath.set(uriKey, path.isAbsolute(normalized));
            return resolveToAbsolute(normalized, documentPath);
        }
        
        // 2. Check the document's IMAGE_DIR directive.
        const docImageDir = extractImageDir(documentContent);
        if (docImageDir) {
            const normalized = normalizeTrailingSlash(docImageDir);
            this.useAbsolutePath.set(uriKey, path.isAbsolute(normalized));
            return resolveToAbsolute(normalized, documentPath);
        }
        
        // 3. Check the VS Code imageDefaultDir setting.
        const config = vscode.workspace.getConfiguration('binary-markdown');
        const defaultDir = config.get<string>('imageDefaultDir', '');
        if (defaultDir) {
            const normalized = normalizeTrailingSlash(defaultDir);
            this.useAbsolutePath.set(uriKey, path.isAbsolute(normalized));
            return resolveToAbsolute(normalized, documentPath);
        }
        
        // 4. Default to the document directory, using relative image paths.
        this.useAbsolutePath.set(uriKey, false);
        return path.dirname(documentPath);
    }
    
    /**
     * Returns whether the configured image directory uses an absolute path.
     * Call getImageDirectory() first to populate this state.
     */
    shouldUseAbsolutePath(documentUri: vscode.Uri): boolean {
        return this.useAbsolutePath.get(documentUri.toString()) || false;
    }
    
    /**
     * Returns whether image paths must be relative.
     * Priority: 1. Document FORCE_RELATIVE_PATH directive, 2. VS Code forceRelativeImagePath setting.
     */
    shouldForceRelativePath(documentUri: vscode.Uri, documentContent: string): boolean {
        // 1. Check the document directive.
        const docForceRelative = extractForceRelativePath(documentContent);
        if (docForceRelative !== null) {
            return docForceRelative;
        }
        
        // 2. Check the VS Code setting.
        const config = vscode.workspace.getConfiguration('binary-markdown');
        return config.get<boolean>('forceRelativeImagePath', false);
    }
    
    /**
     * Sets the per-file IMAGE_DIR.
     */
    setFileImageDir(documentUri: vscode.Uri, dirPath: string): void {
        this.fileImageDirs.set(documentUri.toString(), dirPath);
    }
    
    /**
     * Returns the per-file IMAGE_DIR.
     */
    getFileImageDir(uriKey: string): string | undefined {
        const dir = this.fileImageDirs.get(uriKey);
        return dir || undefined;
    }

    /**
     * Clears the per-file IMAGE_DIR.
     */
    clearFileImageDir(documentUri: vscode.Uri): void {
        this.fileImageDirs.delete(documentUri.toString());
    }
    
    /**
     * Detects IMAGE_DIR changes so the caller can display a warning.
     */
    checkAndWarnIfChanged(documentUri: vscode.Uri, documentContent: string): boolean {
        const uriKey = documentUri.toString();
        const currentDir = extractImageDir(documentContent);
        const lastDir = this.lastDetectedDirs.get(uriKey);
        
        // On first inspection, only record the current value.
        if (lastDir === undefined) {
            if (currentDir) {
                this.lastDetectedDirs.set(uriKey, currentDir);
            }
            return false;
        }
        
        // Detect a change.
        if (currentDir !== lastDir) {
            this.lastDetectedDirs.set(uriKey, currentDir || '');
            return true; // The value changed.
        }
        
        return false;
    }
    
    /**
     * Records the initial IMAGE_DIR for the document.
     */
    initializeForDocument(documentUri: vscode.Uri, documentContent: string): void {
        const currentDir = extractImageDir(documentContent);
        if (currentDir) {
            this.lastDetectedDirs.set(documentUri.toString(), currentDir);
        }
    }
}

// Shared instance.
const imageDirectoryManager = new ImageDirectoryManager();

export class BinaryMarkdownEditorProvider implements vscode.CustomTextEditorProvider {
    private static readonly viewType = 'binary-markdown.editor';

    // Track the currently active webview panel for undo/redo command forwarding
    private activeWebviewPanel: vscode.WebviewPanel | undefined;
    private readonly exportControllers = new Map<vscode.WebviewPanel, ExportController>();

    public insertToc(): boolean {
        if (!this.activeWebviewPanel?.active) { return false; }
        void this.activeWebviewPanel.webview.postMessage({ type: 'insertToc' });
        return true;
    }

    public requestExport(format: ExportFormat): void {
        const panel = this.activeWebviewPanel;
        const controller = panel?.active ? this.exportControllers.get(panel) : undefined;
        if (controller) { void controller.export(format); }
        else { void vscode.window.showInformationMessage(t('openMarkdownFirst')); }
    }
    private readonly outlineStateStore: OutlineStateStoreContract;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.outlineStateStore = new OutlineStateStore(context.workspaceState, context.globalState);
    }

    /**
     * Send undo command to the active webview
     */
    public sendUndo(): void {
        this.activeWebviewPanel?.webview.postMessage({ type: 'performUndo' });
    }

    /**
     * Send redo command to the active webview
     */
    public sendRedo(): void {
        this.activeWebviewPanel?.webview.postMessage({ type: 'performRedo' });
    }

    /**
     * Send toggle source mode command to the active webview
     */
    public sendToggleSourceMode(): void {
        this.activeWebviewPanel?.webview.postMessage({ type: 'toggleSourceMode' });
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // IMPORTANT: Clear any cached webview state immediately to prevent
        // "Assertion Failed: Argument is undefined or null" errors after extension updates.
        // VSCode may try to restore old webview state that's incompatible with new extension code.
        // Setting html to empty string first ensures we start fresh.
        webviewPanel.webview.html = '';
        
        // Get the document directory and workspace folder for local resource access
        const documentDir = vscode.Uri.joinPath(document.uri, '..');
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        
        // Get user's home directory for accessing Downloads, etc.
        const homeDir = require('os').homedir();
        const homeDirUri = vscode.Uri.file(homeDir);
        
        const localResourceRoots = [
            vscode.Uri.joinPath(this.context.extensionUri, 'media'),
            vscode.Uri.joinPath(this.context.extensionUri, 'vendor'),
            vscode.Uri.joinPath(this.context.extensionUri, 'node_modules'),
            documentDir,
            homeDirUri // Allow access to home directory (Downloads, Pictures, etc.)
        ];
        if (workspaceFolder) {
            localResourceRoots.push(workspaceFolder.uri);
        }

        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots
        };

        // Get the base URI for resolving relative paths
        const documentBaseUri = webviewPanel.webview.asWebviewUri(documentDir).toString();
        
        // Convert absolute image paths to webview URIs
        const originalImagePaths = new Map<string, string>();
        const convertImagePaths = (content: string): string => {
            // Match image markdown: ![alt](path)
            return content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
                // Skip if already a URL or data URI
                if (src.startsWith('http://') || src.startsWith('https://') || 
                    src.startsWith('data:') || src.startsWith('vscode-webview:') ||
                    src.startsWith('vscode-resource:')) {
                    return match;
                }
                // Convert absolute path to webview URI
                if (src.startsWith('/')) {
                    const fileUri = vscode.Uri.file(src);
                    const webviewUri = webviewPanel.webview.asWebviewUri(fileUri).toString();
                    originalImagePaths.set(webviewUri, src);
                    return `![${alt}](${webviewUri})`;
                }
                // Relative path - will be resolved by webview using documentBaseUri
                return match;
            });
        };
        
        const restoreImagePaths = (content: string): string => content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
            (match, alt, src) => originalImagePaths.has(src) ? '!' + '[' + alt + '](' + originalImagePaths.get(src) + ')' : match);

        // Remember the original line ending style to preserve on save
        const originalEol = document.eol;
        let lastSavedContent: string | undefined = document.isDirty ? undefined : document.getText();
        let diskSaveGeneration = 0;

        let disposed = false;
        let renderGeneration = 0;
        let pendingRender: number | undefined;
        let renderQueued = false;
        const updateWebview = () => {
            if (disposed) { return; }
            // VS Code swaps an active and a pending iframe. A second HTML
            // replacement before that swap can strand the new frame hidden.
            if (pendingRender !== undefined) { renderQueued = true; return; }
            pendingRender = ++renderGeneration;
            try {
                const config = vscode.workspace.getConfiguration('binary-markdown');
                // Use the same settings snapshot for labels and layout. A locale
                // cached by an earlier configuration event can be stale when
                // settings change rapidly or while no editor is open.
                initLocale(config.get<string>('language', 'default'), vscode.env.language);
                const content = convertImagePaths(document.getText());
                const outlineScope = config.get<OutlineStateScope>('outlineStateScope', 'file');
                const outlineDefaultOpen = config.get<boolean>('outlineDefaultOpen', true);
                const outlineOpen = this.outlineStateStore.getOpen(
                    outlineScope,
                    document.uri.toString(),
                    outlineDefaultOpen
                );
                webviewPanel.webview.html = getWebviewContent(
                    webviewPanel.webview,
                    this.context.extensionUri,
                    content,
                    {
                        theme: config.get<string>('theme', 'github'),
                        fontSize: config.get<number>('fontSize', 16),
                        toolbarMode: config.get<string>('toolbarMode', 'full'),
                        tableToolbarPosition: normalizeTablePosition(config.get('tableToolbarPosition')),
                        renderGeneration,
                        documentBaseUri: documentBaseUri,
                        webviewMessages: getWebviewMessages(),
                        enableDebugLogging: config.get<boolean>('enableDebugLogging', false),
                        outlineOpen,
                        mathBackslashDelimiters: config.get<boolean>('math.backslashDelimiters', true)
                    }
                );
            } catch (error) {
                pendingRender = undefined;
                renderQueued = false;
                console.error('[Binary Markdown] Error updating webview:', error);
                // Show a minimal error page instead of crashing
                webviewPanel.webview.html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Error</title></head>
<body style="padding: 20px; font-family: sans-serif;">
    <h2>Failed to load editor</h2>
    <p>Please try closing and reopening this file.</p>
    <p>If the problem persists, try reloading VS Code window (Cmd/Ctrl+Shift+P → "Reload Window").</p>
    <details>
        <summary>Error details</summary>
        <pre>${String(error)}</pre>
    </details>
</body>
</html>`;
            }
        };

        // Send current image directory status to webview
        const sendImageDirStatus = () => {
            const docContent = document.getText();
            const docPath = document.uri.fsPath;
            const uriKey = document.uri.toString();
            const docDir = path.dirname(docPath);

            // Determine source
            const fileImageDir = imageDirectoryManager.getFileImageDir(uriKey);
            const docImageDir = extractImageDir(docContent);
            const cfg = vscode.workspace.getConfiguration('binary-markdown');
            const settingsDir = cfg.get<string>('imageDefaultDir', '');

            let source: 'file' | 'settings' | 'default';
            if (fileImageDir || docImageDir) {
                source = 'file';
            } else if (settingsDir) {
                source = 'settings';
            } else {
                source = 'default';
            }

            // Compute display path (same logic as toMarkdownPath for directories)
            const absDir = imageDirectoryManager.getImageDirectory(document.uri, docContent);
            const useAbsolute = imageDirectoryManager.shouldUseAbsolutePath(document.uri);
            const forceRelative = imageDirectoryManager.shouldForceRelativePath(document.uri, docContent);

            let displayPath: string;
            if (forceRelative || !useAbsolute) {
                displayPath = path.relative(docDir, absDir) || '.';
                displayPath = displayPath.replace(/\\/g, '/');
            } else {
                displayPath = absDir;
            }

            webviewPanel.webview.postMessage({
                type: 'imageDirStatus',
                displayPath,
                source
            });
        };

        // Initial content
        updateWebview();

        // Initialize IMAGE_DIR tracking
        imageDirectoryManager.initializeForDocument(document.uri, document.getText());

        // Send initial image dir status (queued for webview)
        sendImageDirStatus();

        // Sync policy: when user is actively editing, external changes are queued in webview.
        // When user is idle (even with focus), external changes are applied with cursor preservation.
        let webviewHasFocus = false;
        let isActivelyEditing = false;
        let isApplyingOwnEdit = false;

        // Listen for document changes
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() !== document.uri.toString()) return;
            if (e.contentChanges.length === 0) return; // Skip metadata-only changes

            // Skip our own edits — they are already reflected in the webview
            if (isApplyingOwnEdit) return;

            // External change detected — send update to webview.
            // The webview will decide whether to apply immediately (idle) or queue (editing).
            const currentContent = document.getText();
            const content = convertImagePaths(currentContent);

            webviewPanel.webview.postMessage({
                type: 'update',
                content: content
            });

            // Update image dir status (directive may have changed)
            sendImageDirStatus();

            // Check for IMAGE_DIR changes (external edit)
            if (imageDirectoryManager.checkAndWarnIfChanged(document.uri, currentContent)) {
                vscode.window.showInformationMessage(
                    t('imageDirChanged'),
                    t('reload')
                ).then(selection => {
                    if (selection === t('reload')) {
                        updateWebview();
                        imageDirectoryManager.initializeForDocument(document.uri, document.getText());
                    }
                });
            }
        });

        // Listen for file system changes (from external editors like Claude)
        // This ONLY syncs the VS Code document; messaging is handled by onDidChangeTextDocument
        const fileWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(vscode.Uri.joinPath(document.uri, '..'), path.basename(document.uri.fsPath))
        );

        const fileChangeSubscription = fileWatcher.onDidChange(async (uri) => {
            if (uri.toString() === document.uri.toString()) {
                setTimeout(async () => {
                    try {
                        const readGeneration = diskSaveGeneration;
                        const fileContent = await vscode.workspace.fs.readFile(uri);
                        if (disposed || readGeneration !== diskSaveGeneration) { return; }
                        const newContent = new TextDecoder().decode(fileContent);
                        // Our own save can notify the watcher after the user has
                        // already typed again. That disk snapshot is not a new
                        // external edit and must not replace the newer document.
                        if (newContent === lastSavedContent) { return; }
                        const currentContent = document.getText();

                        if (newContent !== currentContent) {
                            // Sync VS Code document with file content (triggers onDidChangeTextDocument)
                            isApplyingOwnEdit = true;
                            const fullRange = new vscode.Range(
                                document.positionAt(0),
                                document.positionAt(currentContent.length)
                            );
                            const edit = new vscode.WorkspaceEdit();
                            edit.replace(document.uri, fullRange, newContent);
                            await vscode.workspace.applyEdit(edit);
                            isApplyingOwnEdit = false;

                            // Save immediately to clear dirty state — file on disk is already up to date
                            // The webview still contains the old external revision.
                            // This disk-sync save must not capture that stale content.
                            await saveWithoutSnapshot();

                            // Notify webview directly (since isApplyingOwnEdit suppressed onDidChangeTextDocument)
                            const content = convertImagePaths(newContent);
                            webviewPanel.webview.postMessage({
                                type: 'update',
                                content: content
                            });
                        }
                    } catch (error) {
                        isApplyingOwnEdit = false;
                        console.error('[Binary Markdown] Error reading file after external change:', error);
                    }
                }, 100);
            }
        });

        // Coalesce a settings burst into one HTML replacement. Overlapping
        // replacements can leave a loaded frame pending in native VS Code.
        let configurationRefresh: ReturnType<typeof setTimeout> | undefined;
        // Listen for configuration changes
        const changeConfigSubscription = vscode.workspace.onDidChangeConfiguration(e => {
            const positionChanged = e.affectsConfiguration('binary-markdown.tableToolbarPosition');
            if (positionChanged) {
                void webviewPanel.webview.postMessage({ type: 'tableToolbarPosition', value:
                    normalizeTablePosition(vscode.workspace.getConfiguration('binary-markdown').get('tableToolbarPosition')) });
            }
            const exportChanged = e.affectsConfiguration('binary-markdown.export');
            // Presentation options are read by each export. Re-probing tools in
            // every open editor here launches a burst of browsers on Windows.
            const toolsChanged = ['pandocPath', 'browserPath'].some(key =>
                e.affectsConfiguration('binary-markdown.export.' + key));
            if (toolsChanged) { exportController.refreshCapabilities(); }
            const editorSettings = ['theme', 'fontSize', 'imageDefaultDir', 'forceRelativeImagePath', 'language',
                'toolbarMode', 'outlineStateScope', 'outlineDefaultOpen', 'enableDebugLogging', 'math.backslashDelimiters'];
            const editorChanged = editorSettings.some(key => e.affectsConfiguration('binary-markdown.' + key));
            if (e.affectsConfiguration('binary-markdown') && (editorChanged || (!exportChanged && !positionChanged))) {
                clearTimeout(configurationRefresh);
                configurationRefresh = setTimeout(() => {
                    configurationRefresh = undefined;
                    if (disposed) return;
                    updateWebview();
                    sendImageDirStatus();
                }, 250);
            }
        });

        const normalizeEol = (content: string) => originalEol === vscode.EndOfLine.CRLF
            ? content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n') : content.replace(/\r\n/g, '\n');
        const editQueue = new EditQueue(async content => {
            if (content.replace(/\r\n/g, '\n') === document.getText().replace(/\r\n/g, '\n')) { return; }
            isApplyingOwnEdit = true;
            try {
                const edit = new vscode.WorkspaceEdit();
                edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), content);
                if (!await vscode.workspace.applyEdit(edit)) { throw new Error('Unable to apply the pending document edit.'); }
            } finally {
                isApplyingOwnEdit = false;
            }
        });
        let saveQueue: Promise<void> = Promise.resolve();
        let ownSaveDepth = 0;
        interface PendingNativeSave { promise: Promise<void>; resolve(): void; reject(error: unknown): void; }
        let nativeSave: PendingNativeSave | undefined;
        const finishNativeSave = (pending: PendingNativeSave, error?: unknown) => {
            if (nativeSave === pending) { nativeSave = undefined; }
            if (error) { pending.reject(error); } else { pending.resolve(); }
        };
        const postSaveState = (message: Record<string, unknown>) => {
            try { void Promise.resolve(webviewPanel.webview.postMessage(message)).catch(() => undefined); }
            catch { /* Closing a panel must not turn a completed save into a failure. */ }
        };
        const saveWithoutSnapshot = async (): Promise<boolean> => {
            ownSaveDepth++;
            try { return await document.save(); } finally { ownSaveDepth--; }
        };
        const waitForSaves = async (signal?: AbortSignal): Promise<void> => {
            while (true) {
                if (disposed) { throw new Error('The document editor was closed.'); }
                const keyboardSave = saveQueue;
                const pendingNative = nativeSave;
                await new Promise<void>((resolve, reject) => {
                    const cancelled = () => {
                        // VS Code has no native save-failed event. Forget an
                        // abandoned native wait when the user cancels; retries
                        // still require the document to be clean and identical.
                        if (pendingNative && nativeSave === pendingNative) { finishNativeSave(pendingNative); }
                        const error = new Error('Export cancelled');
                        error.name = 'AbortError';
                        reject(error);
                    };
                    signal?.addEventListener('abort', cancelled, { once: true });
                    if (signal?.aborted) { cancelled(); }
                    Promise.all([keyboardSave, pendingNative?.promise]).then(() => resolve(), reject)
                        .finally(() => signal?.removeEventListener('abort', cancelled));
                });
                if (keyboardSave === saveQueue && (!nativeSave || nativeSave === pendingNative)) { return; }
            }
        };
        const exportController = new ExportController(this.context, document, webviewPanel, waitForSaves, convertImagePaths);
        this.exportControllers.set(webviewPanel, exportController);
        const willSaveSubscription = vscode.workspace.onWillSaveTextDocument(event => {
            if (event.document !== document || ownSaveDepth > 0 || disposed) { return; }
            // A retry supersedes a native write that failed without a didSave event.
            if (nativeSave) { finishNativeSave(nativeSave); }
            let resolve!: () => void;
            let reject!: (error: unknown) => void;
            const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
            const pending = { promise, resolve, reject };
            nativeSave = pending;
            void promise.catch(() => undefined); // A save may happen without any export waiter.
            const preparation = (async () => {
                await editQueue.flush();
                const content = normalizeEol(refreshTocs(restoreImagePaths(await exportController.captureForSave())));
                return content === document.getText() ? [] : [vscode.TextEdit.replace(
                    new vscode.Range(0, 0, document.lineCount, 0), content)];
            })();
            void preparation.catch(error => finishNativeSave(pending, error));
            // Keep this listener to source synchronization; rendering and export
            // work must never consume VS Code's shared native-save time budget.
            event.waitUntil(preparation);
        });
        const didSaveSubscription = vscode.workspace.onDidSaveTextDocument(saved => {
            if (saved === document) {
                lastSavedContent = document.getText();
                diskSaveGeneration++;
                if (nativeSave) { finishNativeSave(nativeSave); }
                postSaveState({ type: 'documentSaved', content: convertImagePaths(document.getText()) });
            }
        });

        // Handle messages from the webview
        webviewPanel.webview.onDidReceiveMessage(async message => {
            if (exportController.handleMessage(message)) { return; }
            switch (message.type) {
                case 'setTableToolbarPosition': {
                    if (!tablePositions.includes(message.value)) {
                        break;
                    }
                    const config = vscode.workspace.getConfiguration('binary-markdown');
                    const scope = config.inspect('tableToolbarPosition')?.workspaceValue !== undefined
                        ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
                    await config.update('tableToolbarPosition', message.value, scope);
                    void webviewPanel.webview.postMessage({ type: 'tableToolbarPosition', value:
                        normalizeTablePosition(config.get('tableToolbarPosition')) });
                    break;
                }
                case 'renderLoaded':
                    if (!disposed && pendingRender !== undefined && message.generation === pendingRender) {
                        // VS Code queues host messages until its pending frame
                        // becomes active; the round trip confirms the swap.
                        void Promise.resolve(webviewPanel.webview.postMessage({
                            type: 'renderProbe', generation: pendingRender
                        })).catch(() => undefined);
                    }
                    break;

                case 'renderReady':
                    if (!disposed && pendingRender !== undefined && message.generation === pendingRender) {
                        pendingRender = undefined;
                        if (renderQueued) { renderQueued = false; updateWebview(); }
                    }
                    break;

                case 'edit':
                    // Restore original line endings if document uses CRLF
                    if (typeof message.content === 'string') { editQueue.schedule(normalizeEol(restoreImagePaths(message.content))); }
                    break;

                case 'save': {
                    // Message order fixes the saved revision before later export requests.
                    const content = typeof message.content === 'string' ? normalizeEol(restoreImagePaths(message.content)) : undefined;
                    saveQueue = saveQueue.catch(() => undefined).then(async () => {
                        let success = false;
                        try {
                            if (content !== undefined) { editQueue.schedule(refreshTocs(content)); }
                            await editQueue.flush();
                            success = await saveWithoutSnapshot();
                        } catch (error) {
                            vscode.window.showErrorMessage(String(error));
                        }
                        postSaveState({ type: 'saveResult', revision: message.revision, success });
                    });
                    await saveQueue;
                    break;
                }

                case 'editingStateChanged':
                    isActivelyEditing = message.editing;
                    break;

                case 'webviewFocus':
                    webviewHasFocus = true;
                    break;

                case 'webviewBlur':
                    webviewHasFocus = false;
                    isActivelyEditing = false;
                    break;

                case 'outlineStateChanged': {
                    if (typeof message.open !== 'boolean') {
                        break;
                    }
                    const outlineConfig = vscode.workspace.getConfiguration('binary-markdown');
                    const outlineScope = outlineConfig.get<OutlineStateScope>('outlineStateScope', 'file');
                    try {
                        await this.outlineStateStore.setOpen(
                            outlineScope,
                            document.uri.toString(),
                            message.open
                        );
                    } catch (error) {
                        console.error('[Binary Markdown] Failed to persist outline state:', error);
                    }
                    break;
                }

                case 'insertImage':
                    await this.handleImageInsert(document, webviewPanel.webview);
                    break;

                case 'saveImageAndInsert':
                    // Save pasted/dropped image to file
                    await this.handleSaveImage(document, webviewPanel.webview, message.dataUrl, message.fileName);
                    break;

                case 'readAndInsertImage':
                    // Read an existing image file and insert it
                    await this.handleReadAndInsertImage(document, webviewPanel.webview, message.filePath);
                    break;

                case 'insertLink':
                    const url = await vscode.window.showInputBox({
                        prompt: t('enterUrl'),
                        placeHolder: 'https://example.com'
                    });
                    if (url) {
                        const linkText = message.text || await vscode.window.showInputBox({
                            prompt: t('enterLinkText'),
                            placeHolder: 'Link text',
                            value: 'link'
                        }) || 'link';
                        webviewPanel.webview.postMessage({
                            type: 'insertLinkHtml',
                            url: url,
                            text: linkText
                        });
                    }
                    break;

                case 'openLink':
                    if (message.href.startsWith('http')) {
                        vscode.env.openExternal(vscode.Uri.parse(message.href));
                    } else if (message.href.startsWith('#')) {
                        // Handle anchor links (scroll to heading in the same document)
                        webviewPanel.webview.postMessage({
                            type: 'scrollToAnchor',
                            anchor: message.href.substring(1) // Remove the leading #
                        });
                    } else {
                        // Handle internal links
                        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
                        if (workspaceFolder) {
                            const linkUri = vscode.Uri.joinPath(workspaceFolder.uri, message.href);
                            vscode.commands.executeCommand('vscode.open', linkUri);
                        }
                    }
                    break;

                case 'requestOutline':
                    const outline = this.generateOutline(document.getText());
                    webviewPanel.webview.postMessage({
                        type: 'outline',
                        data: outline
                    });
                    break;

                case 'requestWordCount':
                    const stats = this.calculateWordCount(document.getText());
                    webviewPanel.webview.postMessage({
                        type: 'wordCount',
                        data: stats
                    });
                    break;

                case 'error':
                    vscode.window.showErrorMessage(`Binary Markdown: ${message.message}`);
                    break;

                case 'openInTextEditor':
                    // Open the same file in VS Code's default text editor
                    await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
                    break;

                case 'sendToChat':
                    // Open text editor with selection based on line numbers from webview
                    try {
                        const chatStartLine = message.startLine as number;
                        const chatEndLine = message.endLine as number;
                        if (chatStartLine == null || chatEndLine == null) break;

                        // Open the file in VS Code's text editor
                        const textDoc = await vscode.workspace.openTextDocument(document.uri);
                        const textEditor = await vscode.window.showTextDocument(textDoc, { preview: false });

                        // Clamp line numbers to document range
                        const maxLine = textDoc.lineCount - 1;
                        const startLine = Math.max(0, Math.min(chatStartLine, maxLine));
                        const endLine = Math.max(startLine, Math.min(chatEndLine, maxLine));

                        const startPos = new vscode.Position(startLine, 0);
                        const endPos = textDoc.lineAt(endLine).range.end;
                        textEditor.selection = new vscode.Selection(startPos, endPos);
                        textEditor.revealRange(new vscode.Range(startPos, endPos), vscode.TextEditorRevealType.InCenter);

                        // Copy selected markdown to clipboard
                        const selectedMd = message.selectedMarkdown as string;
                        if (selectedMd) {
                            await vscode.env.clipboard.writeText(selectedMd);
                        }
                    } catch (err) {
                        console.error('[Binary Markdown] sendToChat error:', err);
                    }
                    break;

                case 'openExtensionSettings':
                    await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:BinaryOutlook.binary-markdown');
                    break;

                case 'setImageDir':
                    // Set IMAGE_DIR and FORCE_RELATIVE_PATH directives via toolbar button
                    const inputDir = await vscode.window.showInputBox({
                        prompt: t('enterImageDir'),
                        placeHolder: './images',
                        value: extractImageDir(document.getText()) || ''
                    });
                    if (inputDir !== undefined) {
                        if (inputDir === '') {
                            // An empty string clears both IMAGE_DIR and FORCE_RELATIVE_PATH.
                            imageDirectoryManager.setFileImageDir(document.uri, '');
                            webviewPanel.webview.postMessage({
                                type: 'setImageDir',
                                dirPath: '',
                                forceRelativePath: null  // null clears the directive.
                            });
                            vscode.window.showInformationMessage(t('imageDirCleared'));
                            sendImageDirStatus();
                        } else {
                            // When a path is supplied, check the FORCE_RELATIVE_PATH preference.
                            const forceRelativeChoice = await vscode.window.showQuickPick(
                                [
                                    { label: 'No', description: t('forceRelativeNo'), value: false },
                                    { label: 'Yes', description: t('forceRelativeYes'), value: true }
                                ],
                                {
                                    placeHolder: t('forceRelativePrompt'),
                                    title: t('forceRelativeTitle')
                                }
                            );
                            
                            if (forceRelativeChoice !== undefined) {
                                // Update the manager
                                imageDirectoryManager.setFileImageDir(document.uri, inputDir);
                                
                                // Send to webview to update both settings
                                webviewPanel.webview.postMessage({
                                    type: 'setImageDir',
                                    dirPath: inputDir,
                                    forceRelativePath: forceRelativeChoice.value
                                });
                                
                                const relativeMsg = forceRelativeChoice.value ? t('relativePathOn') : '';
                                vscode.window.showInformationMessage(`${t('imageDirSet')}${inputDir} ${relativeMsg}`);
                                sendImageDirStatus();
                            }
                        }
                    }
                    break;

                case 'getImageDir':
                    // Return current IMAGE_DIR to webview
                    const currentImageDir = extractImageDir(document.getText()) || '';
                    const config = vscode.workspace.getConfiguration('binary-markdown');
                    const defaultImageDir = config.get<string>('imageDefaultDir', '');
                    webviewPanel.webview.postMessage({
                        type: 'imageDirInfo',
                        fileImageDir: currentImageDir,
                        defaultImageDir: defaultImageDir
                    });
                    break;
            }
        });

        // Track active webview panel for undo/redo command forwarding
        if (webviewPanel.active) {
            this.activeWebviewPanel = webviewPanel;
        }
        webviewPanel.onDidChangeViewState(() => {
            if (webviewPanel.active) {
                this.activeWebviewPanel = webviewPanel;
            } else if (this.activeWebviewPanel === webviewPanel) {
                this.activeWebviewPanel = undefined;
            }
        });

        webviewPanel.onDidDispose(() => {
            if (this.activeWebviewPanel === webviewPanel) {
                this.activeWebviewPanel = undefined;
            }
            disposed = true;
            pendingRender = undefined;
            renderQueued = false;
            clearTimeout(configurationRefresh);
            configurationRefresh = undefined;
            if (nativeSave) { finishNativeSave(nativeSave, new Error('The document editor was closed.')); }
            exportController.dispose();
            this.exportControllers.delete(webviewPanel);
            willSaveSubscription.dispose();
            didSaveSubscription.dispose();
            editQueue.dispose();
            changeDocumentSubscription.dispose();
            changeConfigSubscription.dispose();
            fileChangeSubscription.dispose();
            fileWatcher.dispose();
        });
    }

    private async handleImageInsert(document: vscode.TextDocument, webview: vscode.Webview) {
        const path = require('path');
        const fs = require('fs');
        
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: t('selectImage'),
            filters: {
                'Images': ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
            },
            // Default to current document's directory
            defaultUri: vscode.Uri.file(path.dirname(document.uri.fsPath))
        };

        const fileUri = await vscode.window.showOpenDialog(options);
        
        if (fileUri && fileUri[0]) {
            const sourcePath = fileUri[0].fsPath;
            
            // Get the image directory from settings/directive
            const imageDir = imageDirectoryManager.getImageDirectory(document.uri, document.getText());

            try {
            // Ensure the directory exists
            ensureDirectoryExists(imageDir);

            // Always generate unique filename using timestamp format
            const ext = path.extname(sourcePath).slice(1) || 'png'; // Remove leading dot
            const fileName = generateUniqueFileName(imageDir, ext);
            const destPath = path.join(imageDir, fileName);
                // Copy the image with new name
                fs.copyFileSync(sourcePath, destPath);
                
                // Get webview URI for display
                const webviewUri = webview.asWebviewUri(vscode.Uri.file(destPath)).toString();
                
                // Generate path for Markdown (absolute if configured with absolute path)
                const useAbsolute = imageDirectoryManager.shouldUseAbsolutePath(document.uri);
                const forceRelative = imageDirectoryManager.shouldForceRelativePath(document.uri, document.getText());
                const markdownPath = toMarkdownPath(destPath, document.uri.fsPath, useAbsolute, forceRelative);
                
                webview.postMessage({
                    type: 'insertImageHtml',
                    markdownPath: markdownPath,
                    displayUri: webviewUri
                });
            } catch (error) {
                console.error('Failed to copy image:', error);
                vscode.window.showErrorMessage(`${t('failedToCopyImage')}${error}`);
            }
        }
    }

    private async handleSaveImage(document: vscode.TextDocument, webview: vscode.Webview, dataUrl: string, fileName?: string) {
        const path = require('path');
        const fs = require('fs');
        
        // Get the image directory from settings/directive
        const imageDir = imageDirectoryManager.getImageDirectory(document.uri, document.getText());

        try {
        // Ensure the directory exists
        ensureDirectoryExists(imageDir);

        // Always generate unique filename using timestamp format
        const extension = this.getImageExtension(dataUrl);
        const imageName = generateUniqueFileName(imageDir, extension);
        const imagePath = path.join(imageDir, imageName);

        // Convert data URL to buffer
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
            // Write the file
            fs.writeFileSync(imagePath, imageBuffer);
            console.log('[DEBUG] Image saved to:', imagePath);
            
            // Get webview URI for display
            const webviewUri = webview.asWebviewUri(vscode.Uri.file(imagePath)).toString();
            
            // Generate path for Markdown (absolute if configured with absolute path)
            const useAbsolute = imageDirectoryManager.shouldUseAbsolutePath(document.uri);
            const forceRelative = imageDirectoryManager.shouldForceRelativePath(document.uri, document.getText());
            const markdownPath = toMarkdownPath(imagePath, document.uri.fsPath, useAbsolute, forceRelative);
            
            // Send to webview
            webview.postMessage({
                type: 'insertImageHtml',
                markdownPath: markdownPath,
                displayUri: webviewUri
            });
        } catch (error) {
            console.error('[DEBUG] Failed to save image:', error);
            vscode.window.showErrorMessage(`${t('failedToSaveImage')}${error}`);
        }
    }

    private getImageExtension(dataUrl: string): string {
        const match = dataUrl.match(/^data:image\/(\w+);/);
        if (match) {
            return match[1] === 'jpeg' ? 'jpg' : match[1];
        }
        return 'png'; // Default to png
    }

    private async handleReadAndInsertImage(document: vscode.TextDocument, webview: vscode.Webview, filePath: string) {
        const path = require('path');
        const fs = require('fs');
        
        try {
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                vscode.window.showErrorMessage(`${t('imageFileNotFound')}${filePath}`);
                return;
            }
            
            // Get the image directory from settings/directive
            const imageDir = imageDirectoryManager.getImageDirectory(document.uri, document.getText());
            
            // Ensure the directory exists
            ensureDirectoryExists(imageDir);
            
            // Always generate unique filename using timestamp format
            const ext = path.extname(filePath).slice(1) || 'png'; // Remove leading dot
            const fileName = generateUniqueFileName(imageDir, ext);
            const destPath = path.join(imageDir, fileName);
            
            // Copy the file with new name
            fs.copyFileSync(filePath, destPath);
            
            // Get webview URI for display
            const webviewUri = webview.asWebviewUri(vscode.Uri.file(destPath)).toString();
            
            // Generate path for Markdown (absolute if configured with absolute path)
            const useAbsolute = imageDirectoryManager.shouldUseAbsolutePath(document.uri);
            const forceRelative = imageDirectoryManager.shouldForceRelativePath(document.uri, document.getText());
            const markdownPath = toMarkdownPath(destPath, document.uri.fsPath, useAbsolute, forceRelative);
            
            // Send to webview
            webview.postMessage({
                type: 'insertImageHtml',
                markdownPath: markdownPath,
                displayUri: webviewUri
            });
        } catch (error) {
            console.error('Failed to read/copy image:', error);
            vscode.window.showErrorMessage(`${t('failedToProcessImage')}${error}`);
        }
    }

    private generateOutline(content: string): Array<{ level: number; text: string; line: number }> {
        const lines = content.split('\n');
        const outline: Array<{ level: number; text: string; line: number }> = [];

        lines.forEach((line, index) => {
            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (match) {
                outline.push({
                    level: match[1].length,
                    text: match[2].trim(),
                    line: index
                });
            }
        });

        return outline;
    }

    private calculateWordCount(content: string): { words: number; characters: number; lines: number; readingTime: string } {
        const lines = content.split('\n').length;
        const characters = content.length;
        const words = content.trim().split(/\s+/).filter(word => word.length > 0).length;
        const readingMinutes = Math.ceil(words / 200);
        const readingTime = readingMinutes < 1 ? 'Less than 1 min' : `${readingMinutes} min read`;

        return { words, characters, lines, readingTime };
    }
}
