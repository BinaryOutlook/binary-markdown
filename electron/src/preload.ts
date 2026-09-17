import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script: exposes window.hostBridge through contextBridge.
 * Provides the HostBridge interface expected by editor.js.
 */
contextBridge.exposeInMainWorld('hostBridge', {
    setTableToolbarPosition: (value: string) => ipcRenderer.send('settings-save', 'tableToolbarPosition', value),
    syncContent: (markdown: string) => ipcRenderer.send('sync-content', markdown),
    save: () => ipcRenderer.send('save'),
    reportEditingState: (editing: boolean) => ipcRenderer.send('editing-state', editing),
    reportFocus: () => ipcRenderer.send('focus'),
    reportBlur: () => ipcRenderer.send('blur'),
    reportOutlineState: () => { /* VS Code extension setting only */ },
    openLink: (href: string) => ipcRenderer.send('open-link', href),
    requestInsertLink: (text: string) => ipcRenderer.send('insert-link', text),
    requestInsertImage: () => ipcRenderer.send('insert-image'),
    requestSetImageDir: () => ipcRenderer.send('set-image-dir'),
    saveImageAndInsert: (dataUrl: string, fileName?: string) =>
        ipcRenderer.send('save-image', dataUrl, fileName),
    readAndInsertImage: (filePath: string) =>
        ipcRenderer.send('read-insert-image', filePath),
    openInTextEditor: () => ipcRenderer.send('open-in-text-editor'),
    sendToChat: () => { /* no-op in Electron */ },
    onMessage: (handler: (message: unknown) => void) => {
        ipcRenderer.on('host-message', (_event, message) => handler(message));
    },
});
