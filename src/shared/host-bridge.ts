/**
 * HostBridge — editor.js とホスト環境(VSCode / Electron / テスト)間の通信インターフェース
 *
 * editor.js は window.hostBridge を通じてホスト側と通信する。
 * 各ホスト環境が HostBridge を実装し、editor.js の前に <script> で注入する。
 */

/** editor.js → ホスト (送信) */
export interface HostBridge {
    // ドキュメント操作
    syncContent(markdown: string): void;
    save(content?: string, revision?: number): void;
    requestExport?(format: 'html' | 'pdf' | 'docx' | 'epub'): void;
    cancelExport?(): void;
    openExportSettings?(tool?: 'pandoc' | 'browser'): void;
    respondExport?(payload: ExportWebviewResponse): void;

    // フォーカス/編集状態
    reportEditingState(editing: boolean): void;
    reportFocus(): void;
    reportBlur(): void;
    reportOutlineState(open: boolean): void;

    // ホスト側 UI が必要な操作
    openLink(href: string): void;
    requestInsertLink(text: string): void;
    requestInsertImage(): void;
    requestSetImageDir(): void;
    saveImageAndInsert(dataUrl: string, fileName?: string): void;
    readAndInsertImage(filePath: string): void;
    openInTextEditor(): void;
    sendToChat(startLine: number, endLine: number, selectedMarkdown: string): void;

    // ホストからのメッセージ受信
    onMessage(handler: (message: HostMessage) => void): void;
}

export interface ExportWarning { code: string; message: string; }
export type ExportWebviewResponse =
    | { type: 'exportSnapshot'; requestId: string; content: string; pending: boolean }
    | { type: 'exportPrepared'; requestId: string; html: string; warnings: ExportWarning[]; diagrams?: Array<{ source: string; svg: string }>; theme: string; fontSize: number }
    | { type: 'exportError'; requestId: string; error: string };

/** ホスト → editor.js (受信メッセージ型) */
export type HostMessage =
    | { type: 'documentSaved'; content: string }
    | { type: 'saveResult'; revision: number; success: boolean }
    | { type: 'captureExportSnapshot'; requestId: string }
    | { type: 'prepareExport'; requestId: string; markdown: string }
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

/** window にグローバルとして注入される */
declare global {
    interface Window {
        hostBridge: HostBridge;
    }
}
