import { app, BrowserWindow, ipcMain, screen } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬─ dist
// │ │ └── index.html
// │ │
// │ ├─┬─ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
const distPath = path.join(__dirname, '../dist')
process.env.DIST = distPath
const vitePublicPath = app.isPackaged ? distPath : path.join(distPath, '../public')
process.env.VITE_PUBLIC = vitePublicPath


let win: BrowserWindow | null
let pinnedWin: BrowserWindow | null

// 🛠️ Main Window
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(vitePublicPath, 'electron-vite.svg'),
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    title: '小金助手 (King-helper)',
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(distPath, 'index.html'))
  }
}

// 🛠️ Pinned Todo Window
function createPinnedWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  pinnedWin = new BrowserWindow({
    width: 450, // 进一步增加宽度，给阴影留出足够空间
    height: 650, // 进一步增加高度
    x: screenWidth - 500,
    y: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    minWidth: 380,
    minHeight: 420,
    skipTaskbar: true,
    backgroundColor: '#00000000', // 显式设置背景透明
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    title: '小金助手 Pinned Todo',
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    pinnedWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/pinned`)
  } else {
    pinnedWin.loadFile(path.join(distPath, 'index.html'), { hash: 'pinned' })
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
    pinnedWin = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  // 设置 AppUserModelID 以修复 Windows 通知标题显示
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.king.helper')
  }
  createWindow()
  
  // IPC listeners
  ipcMain.on('toggle-pinned-window', () => {
    if (pinnedWin) {
      pinnedWin.close()
      pinnedWin = null
    } else {
      createPinnedWindow()
    }
  })

  ipcMain.on('set-always-on-top', (_event, flag: boolean) => {
    if (pinnedWin) {
      pinnedWin.setAlwaysOnTop(flag)
    }
  })

  // AI API Proxy to avoid CORS issues
  ipcMain.handle('call-ai-api', async (_event, { apiKey, text, nowStr }) => {
    try {
      const fallbackKey = (process.env.LLM_API_KEY || process.env.VITE_LLM_API_KEY || '').trim()
      const providedKey = (typeof apiKey === 'string' ? apiKey : '').trim()
      const effectiveKey = providedKey || fallbackKey

      if (!effectiveKey) {
        return {
          ok: false,
          status: 400,
          error: '未配置 LLM API Key（可在设置中填写，或在环境变量 LLM_API_KEY 中预置）'
        }
      }

      // Use OpenAI-compatible Chat Completions endpoint for Ark/Doubao
      const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveKey}`
        },
        body: JSON.stringify({
          // Note: In Ark, the "model" field should usually be your Endpoint ID (e.g., ep-xxx)
          model: 'doubao-seed-2-0-mini-260215', 
          messages: [
            {
              role: 'system',
              content: `你是一个专业的任务管理助手。请将用户的自然语言描述精准拆解为结构化待办任务。
              
              输出要求：
              1. 严格输出 JSON 格式，不要包含任何 Markdown 代码块标签（如 \`\`\`json）或多余的解释文字。
              2. JSON 结构必须为：
              {
                "tasks": [
                  {
                    "title": "任务名称",
                    "due_date": "YYYY-MM-DD",
                    "time": "HH:mm",
                    "priority": "low | medium | high",
                    "task_type": "deadline | scheduled | reminder"
                  }
                ]
              }
              
              字段规则：
              - title: 任务的核心内容
              - due_date: 如果未提及日期，默认为当前日期：${nowStr}
              - time: 任务的具体时间（24小时制），如未提及则为 null
              - priority: 根据语气判断优先级，默认 medium
              - task_type: 
                - deadline: 有明确截止时间点的任务（如“截止明天”）
                - scheduled: 有固定开始时间点的日程（如“三点开会”）
                - reminder: 普通提醒（如“记得买牛奶”）`
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: 0.1 // Keep output stable
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return { 
          ok: false, 
          status: response.status, 
          error: errorData.error?.message || `HTTP ${response.status}: API 调用失败`
        }
      }

      const data = await response.json()
      
      // Standard OpenAI structure: choices[0].message.content
      const aiText = data?.choices?.[0]?.message?.content || ''
      const cleanedText = aiText.replace(/```json/g, '').replace(/```/g, '').trim()

      return { ok: true, data, aiText: cleanedText }
    } catch (error: any) {
      return { ok: false, error: error.message }
    }
  })
})
