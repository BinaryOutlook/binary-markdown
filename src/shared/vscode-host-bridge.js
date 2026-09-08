/**
 * VSCode HostBridge — acquireVsCodeApi() をラップし、
 * editor.js が使う window.hostBridge インターフェースを提供する。
 *
 * webviewContent.ts により editor.js の前に注入される。
 */
(function() {
    const api = acquireVsCodeApi();

    window.hostBridge = {
        // ドキュメント操作
        syncContent: function(markdown) {
            api.postMessage({ type: 'edit', content: markdown });
        },
        save: function(content, revision) {
            api.postMessage({ type: 'save', content: content, revision: revision });
        },
        requestExport: function(format) {
            api.postMessage({ type: 'export', format: format });
        },
        cancelExport: function() {
            api.postMessage({ type: 'cancelExport' });
        },
        openExportSettings: function(tool) {
            api.postMessage({ type: 'exportSettings', tool: tool });
        },
        respondExport: function(payload) {
            api.postMessage(payload);
        },

        // フォーカス/編集状態
        reportEditingState: function(editing) {
            api.postMessage({ type: 'editingStateChanged', editing: editing });
        },
        reportFocus: function() {
            api.postMessage({ type: 'webviewFocus' });
        },
        reportBlur: function() {
            api.postMessage({ type: 'webviewBlur' });
        },
        reportOutlineState: function(open) {
            api.postMessage({ type: 'outlineStateChanged', open: open });
        },

        // ホスト側 UI が必要な操作
        openLink: function(href) {
            api.postMessage({ type: 'openLink', href: href });
        },
        requestInsertLink: function(text) {
            api.postMessage({ type: 'insertLink', text: text });
        },
        requestInsertImage: function() {
            api.postMessage({ type: 'insertImage', position: 0 });
        },
        requestSetImageDir: function() {
            api.postMessage({ type: 'setImageDir' });
        },
        saveImageAndInsert: function(dataUrl, fileName) {
            api.postMessage({ type: 'saveImageAndInsert', dataUrl: dataUrl, fileName: fileName });
        },
        readAndInsertImage: function(filePath) {
            api.postMessage({ type: 'readAndInsertImage', filePath: filePath });
        },
        openInTextEditor: function() {
            api.postMessage({ type: 'openInTextEditor' });
        },
        sendToChat: function(startLine, endLine, selectedMarkdown) {
            api.postMessage({ type: 'sendToChat', startLine: startLine, endLine: endLine, selectedMarkdown: selectedMarkdown });
        },

        // ホストからのメッセージ受信
        onMessage: function(handler) {
            window.addEventListener('message', function(e) {
                handler(e.data);
            });
        }
    };
})();
