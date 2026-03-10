import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;
let todoWindow: BrowserWindow | null = null;

// 创建主窗口
function createMainWindow() {
  // 每次启动清理缓存
  session.defaultSession.clearCache();

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: "小金助手",
    frame: true,
    transparent: false,
    resizable: true,
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.ico')
      : path.join(__dirname, '../../public/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = !app.isPackaged;
  
  if (isDev) {
    // 添加时间戳防止缓存
    const timestamp = Date.now();
    mainWindow.loadURL(`http://localhost:5174/?t=${timestamp}`).catch((err) => {
      console.error('Failed to load Vite server:', err);
      setTimeout(() => {
        mainWindow?.loadURL(`http://localhost:5174/?t=${timestamp}`);
      }, 2000);
    });
    // 打开开发者工具
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    // 关闭主窗口时，也关闭待办窗口
    if (todoWindow) {
      todoWindow.close();
    }
  });
}

// 创建待办清单窗口（固定在桌面）
function createTodoWindow() {
  if (todoWindow) {
    // 如果窗口已存在，显示并聚焦
    todoWindow.show();
    todoWindow.focus();
    return;
  }

  todoWindow = new BrowserWindow({
    width: 400,
    height: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.ico')
      : path.join(__dirname, '../../public/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = !app.isPackaged;
  console.log('App is packaged:', app.isPackaged);
  console.log('Is Dev mode:', isDev);
  
  if (isDev) {
    const timestamp = Date.now();
    todoWindow.loadURL(`http://localhost:5174/todo?t=${timestamp}`).catch((err) => {
      console.error('Failed to load Vite server:', err);
      setTimeout(() => {
        todoWindow?.loadURL(`http://localhost:5174/todo?t=${timestamp}`);
      }, 2000);
    });
  } else {
    todoWindow.loadFile(path.join(__dirname, 'renderer/index.html'), {
      hash: 'todo',
    });
  }

  todoWindow.on('closed', () => {
    todoWindow = null;
  });
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 处理程序
ipcMain.handle('set-always-on-top', (_, flag: boolean) => {
  if (todoWindow) {
    todoWindow.setAlwaysOnTop(flag);
  }
});

ipcMain.handle('set-opacity', (_, opacity: number) => {
  if (todoWindow) {
    todoWindow.setOpacity(opacity);
  }
});

ipcMain.handle('minimize-window', () => {
  if (todoWindow) {
    todoWindow.minimize();
  }
});

ipcMain.handle('close-window', () => {
  if (todoWindow) {
    todoWindow.close();
  }
});

// 创建待办窗口
ipcMain.handle('create-todo-window', () => {
  createTodoWindow();
});
