import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('gos', {
  readSave: () => ipcRenderer.invoke('gos:read'),
  writeSave: (json: string) => ipcRenderer.invoke('gos:write', json),
  setFullscreen: (on: boolean) => ipcRenderer.invoke('gos:fullscreen', on),
  savePath: () => ipcRenderer.invoke('gos:savePath'),
  quit: () => ipcRenderer.send('gos:quit'),
});
