export interface ElectronAPI {
  setAlwaysOnTop: (flag: boolean) => Promise<void>;
  setOpacity: (opacity: number) => Promise<void>;
  minimizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  createTodoWindow: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

