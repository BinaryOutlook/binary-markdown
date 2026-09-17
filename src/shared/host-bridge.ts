/**
 * HostBridge: communication between editor.js and its host (VS Code, Electron, or tests).
 *
 * editor.js communicates with the host through window.hostBridge.
 * Each host implements HostBridge and injects it in a <script> before editor.js.
 */

/** Outgoing messages: editor.js → host. */
export interface HostBridge {
    // Document operations.
    syncContent(markdown: string): void;
    save(content?: string, revision?: number): void;
    requestExport?(format: 'html' | 'pdf' | 'docx' | 'epub'): void;
    requestExportCapabilities?(): void;
    cancelExport?(): void;
    openExportSettings?(tool?: 'pandoc' | 'browser'): void;
    respondExport?(payload: ExportWebviewResponse): void;

    // Focus and editing state.
    reportEditingState(editing: boolean): void;
    reportFocus(): void;
    reportBlur(): void;
    reportOutlineState(open: boolean): void;

    // Operations that require host interface support.
    openLink(href: string): void;
    requestInsertLink(text: string): void;
    requestInsertImage(): void;
    requestSetImageDir(): void;
    openSettings?(): void;
    setTableToolbarPosition?(value: string): void;
    saveImageAndInsert(dataUrl: string, fileName?: string): void;
    readAndInsertImage(filePath: string): void;
    openInTextEditor(): void;
    sendToChat(startLine: number, endLine: number, selectedMarkdown: string): void;

    // Receive messages from the host.
    onMessage(handler: (message: HostMessage) => void): void;
}

export interface ExportWarning { code: string; message: string; }
export type ExportWebviewResponse =
    | { type: 'exportImageValidated'; requestId: string; valid: boolean }
    | { type: 'exportSnapshot'; requestId: string; content: string; pending: boolean }
    | { type: 'exportPrepared'; requestId: string; html: string; warnings: ExportWarning[]; diagrams?: Array<{ source: string; svg: string }>; theme: string; fontSize: number }
    | { type: 'exportError'; requestId: string; error: string };

/** Incoming message types: host → editor.js. */
export type HostMessage =
    | { type: 'tableToolbarPosition'; value: string }
    | { type: 'validateExportImage'; requestId: string; dataUri: string }
    | { type: 'documentSaved'; content: string }
    | { type: 'saveResult'; revision: number; success: boolean }
    | { type: 'captureExportSnapshot'; requestId: string }
    | { type: 'prepareExport'; requestId: string; markdown: string; theme?: string; fontSize?: number }
    | { type: 'cancelExportPreparation'; requestId: string }
    | { type: 'update'; content: string }
    | { type: 'performUndo' }
    | { type: 'performRedo' }
    | { type: 'toggleSourceMode' }
    | { type: 'setImageDir'; dirPath: string; forceRelativePath: boolean | null }
    | { type: 'insertImageHtml'; markdownPath: string; displayUri: string }
    | { type: 'insertLinkHtml'; url: string; text: string }
    | { type: 'externalChangeDetected'; message: string }
    | { type: 'scrollToAnchor'; anchor: string }
    | { type: 'imageDirInfo'; fileImageDir: string; defaultImageDir: string }
    | { type: 'imageDirStatus'; displayPath: string; source: 'file' | 'settings' | 'default' };

/** Injected as a global property on window. */
declare global {
    interface Window {
        hostBridge: HostBridge;
    }
}
