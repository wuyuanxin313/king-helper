import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('set-always-on-top', flag),
  setOpacity: (opacity: number) => ipcRenderer.invoke('set-opacity', opacity),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  createTodoWindow: () => ipcRenderer.invoke('create-todo-window'),
});

