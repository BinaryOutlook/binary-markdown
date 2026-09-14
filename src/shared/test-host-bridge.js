/**
 * Test HostBridge: mock implementation for the test environment.
 *
 * Injected before editor.js by test/build-standalone.js.
 * Records outgoing messages in window.__testApi.messages.
 * Use window.__hostMessageHandler to send messages from the host to the editor.
 */
(function() {
    window.__testApi = {
        messages: [],
        ready: false,
        getMarkdown: null,
        getHtml: null,
        setMarkdown: null
    };

    window.hostBridge = {
        // Document operations.
        syncContent: function(markdown) {
            window.__testApi.messages.push({ type: 'edit', content: markdown });
        },
        save: function(content, revision) {
            window.__testApi.messages.push({ type: 'save', content: content, revision: revision });
        },
        requestExport: function(format) {
            window.__testApi.messages.push({ type: 'export', format: format });
        },
        requestExportCapabilities: function() {
            window.__testApi.messages.push({ type: 'exportCapabilities' });
        },
        cancelExport: function() {
            window.__testApi.messages.push({ type: 'cancelExport' });
        },
        openExportSettings: function(tool) {
            window.__testApi.messages.push({ type: 'exportSettings', tool: tool });
        },
        respondExport: function(payload) {
            window.__testApi.messages.push(payload);
        },

        // Focus and editing state.
        reportEditingState: function(editing) {
            window.__testApi.messages.push({ type: 'editingStateChanged', editing: editing });
        },
        reportFocus: function() {
            window.__testApi.messages.push({ type: 'webviewFocus' });
        },
        reportBlur: function() {
            window.__testApi.messages.push({ type: 'webviewBlur' });
        },
        reportOutlineState: function(open) {
            window.__testApi.messages.push({ type: 'outlineStateChanged', open: open });
        },

        // Operations that require host interface support.
        openLink: function(href) {
            window.__testApi.messages.push({ type: 'openLink', href: href });
        },
        requestInsertLink: function(text) {
            window.__testApi.messages.push({ type: 'insertLink', text: text });
        },
        requestInsertImage: function() {
            window.__testApi.messages.push({ type: 'insertImage', position: 0 });
        },
        requestSetImageDir: function() {
            window.__testApi.messages.push({ type: 'setImageDir' });
        },
        saveImageAndInsert: function(dataUrl, fileName) {
            window.__testApi.messages.push({ type: 'saveImageAndInsert', dataUrl: dataUrl, fileName: fileName });
        },
        readAndInsertImage: function(filePath) {
            window.__testApi.messages.push({ type: 'readAndInsertImage', filePath: filePath });
        },
        openInTextEditor: function() {
            window.__testApi.messages.push({ type: 'openInTextEditor' });
        },
        sendToChat: function(startLine, endLine, selectedMarkdown) {
            window.__testApi.messages.push({ type: 'sendToChat', startLine: startLine, endLine: endLine, selectedMarkdown: selectedMarkdown });
        },

        // Receive messages from the host.
        onMessage: function(handler) {
            window.__hostMessageHandler = handler;
        }
    };
})();
