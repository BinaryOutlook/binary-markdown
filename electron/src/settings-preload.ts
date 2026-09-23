import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('settingsBridge', {
    save: (key: string, value: unknown) => ipcRenderer.send('settings-save', key, value),
    selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('settings-select-directory'),
    onValue: (handler: (value: { key: string; value: unknown; error: string }) => void) =>
        ipcRenderer.on('settings-value', (_event, value) => handler(value)),
});
