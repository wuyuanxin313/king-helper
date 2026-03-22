import React, { useState, useEffect, useMemo, useRef } from 'react'
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Plus, 
  Pin, 
  LayoutDashboard, 
  Calendar, 
  Mic, 
  Sparkles,
  AlertCircle,
  Lightbulb,
  X,
  History,
  Edit2,
  Trash2,
  Tag,
  CornerDownLeft
} from 'lucide-react'
import { format, isPast, isToday, isTomorrow, parseISO, addDays, differenceInHours } from 'date-fns'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type TaskType = 'deadline' | 'scheduled' | 'reminder'
type Priority = 'low' | 'medium' | 'high'
type IPState = 'default' | 'reminder' | 'urgent' | 'completed' | 'idle'

interface Task {
  id: string
  title: string
  completed: boolean
  dueDate: string // YYYY-MM-DD
  time?: string // HH:mm
  type: TaskType
  priority: Priority
  createdAt: number
}

const INITIAL_TASKS: Task[] = [
  { id: '1', title: '提交作业', completed: false, dueDate: format(addDays(new Date(), -1), 'yyyy-MM-dd'), type: 'deadline', priority: 'high', createdAt: Date.now() },
  { id: '2', title: '发PRD给技术', completed: false, dueDate: format(new Date(), 'yyyy-MM-dd'), time: '18:00', type: 'scheduled', priority: 'medium', createdAt: Date.now() },
  { id: '3', title: '买牛奶', completed: false, dueDate: format(new Date(), 'yyyy-MM-dd'), type: 'reminder', priority: 'low', createdAt: Date.now() },
  { id: '4', title: '周五之前交报告', completed: false, dueDate: format(addDays(new Date(), 2), 'yyyy-MM-dd'), type: 'deadline', priority: 'high', createdAt: Date.now() },
]

function App() {
  const [isPinnedView, setIsPinnedView] = useState(() => {
    return window.location.hash.includes('pinned') || window.location.href.includes('pinned')
  })
  const [pinnedExpanded, setPinnedExpanded] = useState(false)
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true)
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('king-helper-tasks')
    return saved ? JSON.parse(saved) : INITIAL_TASKS
  })
  const [inputValue, setInputValue] = useState('')
  const [inputDate, setInputDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [inputTime, setInputTime] = useState('')
  const [inputType, setInputType] = useState<TaskType>('reminder')
  const [inputPriority, setInputPriority] = useState<Priority>('medium')
  const [activeTab, setActiveTab] = useState<'add' | 'today' | 'preview' | 'completed'>('today')
  const [showAIModal, setShowAIModal] = useState(false)
  const [showStrongReminder, setShowStrongReminder] = useState<Task | null>(null)
  const [aiInputValue, setAIInputValue] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const speechRecognitionRef = useRef<any>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [parsedTasks, setParsedTasks] = useState<Partial<Task>[]>([])
  const [now, setNow] = useState(new Date())
  const [selectedPreviewDate, setSelectedPreviewDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [previewMonthOffset, setPreviewMonthOffset] = useState(0)
  const [notifications, setNotifications] = useState<{ id: string, title: string, type: 'light' | 'medium' | 'strong', taskId?: string }[]>([])
  const [ipAssistantText, setIpAssistantText] = useState("今天又是充满活力的一天！")
  const [ipBubbleVisible, setIpBubbleVisible] = useState(false)
  const baseUrl = import.meta.env.BASE_URL
  const ipImages = {
    default: `${baseUrl}ip-pictures/default.png`,
    reminder: `${baseUrl}ip-pictures/reminder.png`,
    urgent: `${baseUrl}ip-pictures/urgent.png`,
    completed: `${baseUrl}ip-pictures/completed.png`,
    idle: `${baseUrl}ip-pictures/idle.png`
  } as const
  const [ipStateOverride, setIpStateOverride] = useState<{ state: IPState, untilMs: number } | null>(null)
  const ipOverrideTimerRef = useRef<any>(null)
  const setIpOverride = (state: IPState, ms: number) => {
    const untilMs = Date.now() + ms
    setIpStateOverride({ state, untilMs })
    if (ipOverrideTimerRef.current) clearTimeout(ipOverrideTimerRef.current)
    ipOverrideTimerRef.current = setTimeout(() => {
      setIpStateOverride(prev => (prev && prev.untilMs === untilMs ? null : prev))
    }, ms)
  }
  const ipState = useMemo<IPState>(() => {
    const nowMs = now.getTime()
    if (ipStateOverride && ipStateOverride.untilMs > nowMs) return ipStateOverride.state

    const todayStr = format(now, 'yyyy-MM-dd')
    const uncompleted = tasks.filter(t => !t.completed)
    if (uncompleted.length === 0) return 'idle'

    const isUrgent = uncompleted.some(t => {
      if (t.type !== 'deadline') return false
      const due = parseISO(t.dueDate)
      due.setHours(23, 59, 0, 0)
      const diffMs = due.getTime() - nowMs
      return diffMs <= 0 || diffMs <= 2 * 60 * 60 * 1000
    })
    if (isUrgent) return 'urgent'

    const isReminder = uncompleted.some(t => {
      if (t.dueDate === todayStr) return true

      if (t.type === 'deadline') {
        const due = parseISO(t.dueDate)
        due.setHours(23, 59, 0, 0)
        const diffMs = due.getTime() - nowMs
        return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000
      }

      if (t.type === 'scheduled' && t.dueDate === todayStr && t.time) {
        const [h, m] = t.time.split(':').map(Number)
        const taskTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
        const diffMinutes = (taskTime.getTime() - nowMs) / 60000
        return diffMinutes <= 15 && diffMinutes > 0
      }

      return false
    })
    if (isReminder) return 'reminder'

    return 'default'
  }, [ipStateOverride, now, tasks])
  const ipImageSrc = ipImages[ipState]

  // Reminder 防打扰：每天最多触达 5 次，并避免同一任务在同一天重复触发
  const reminderTriggeredRef = useRef<Set<string>>(new Set())
  const reminderMetaRef = useRef<{ dateStr: string, count: number }>({ dateStr: '', count: 0 })
  const ignoreCountsRef = useRef<Record<string, number>>({})
  const strongDelayUntilRef = useRef<Record<string, number>>({})
  const ipBubbleHideTimerRef = useRef<any>(null)

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('king-helper-api-key') || '')
  const [showSettings, setShowSettings] = useState(false)

  // Doubao AI Parsing Logic (doubao-seed-2-0-mini-260215) via IPC
  const parseWithAI = async (text: string) => {
    if (!text.trim()) return

    setIsAnalyzing(true)
    setParsedTasks([])
    
    try {
      // Use IPC to call AI API from Main Process to avoid CORS issues
      const result = await window.ipcRenderer.invoke('call-ai-api', {
        apiKey,
        text,
        nowStr: format(now, 'yyyy-MM-dd')
      })

      if (!result.ok) {
        const errorMsg = result.error || `API 请求失败: ${result.status}`
        if (!apiKey && (result.status === 400 || String(errorMsg).includes('未配置'))) {
          setShowSettings(true)
        }
        throw new Error(errorMsg)
      }

      const aiText = result.aiText
      console.log('[AI Debug] Cleaned AI Text:', aiText)

      if (!aiText) {
        throw new Error('API 返回内容为空，请检查 API Key 或网络连接')
      }

      const tryParseJson = (s: string) => {
        try {
          return JSON.parse(s)
        } catch (e) {
          console.error('JSON Parse Error:', e, 'Text:', s)
          return null
        }
      }

      // 尝试解析 JSON
      let parsed = tryParseJson(aiText)
      
      // 如果直接解析失败，尝试正则表达式提取
      if (!parsed) {
        const jsonObjMatch = aiText.match(/\{[\s\S]*\}/)
        const jsonArrMatch = aiText.match(/\[[\s\S]*\]/)
        parsed = jsonObjMatch ? tryParseJson(jsonObjMatch[0]) : (jsonArrMatch ? tryParseJson(jsonArrMatch[0]) : null)
      }

      const tasksArray = Array.isArray(parsed?.tasks)
        ? parsed.tasks
        : Array.isArray(parsed)
          ? parsed
          : null

      if (!Array.isArray(tasksArray)) {
        throw new Error('未能从 AI 返回内容中解析到有效的任务列表')
      }

      const normalizedTasks = tasksArray.map((t: any) => {
        const title = t.title || t.content || '无标题任务'
        const dueDate = t.due_date || t.dueDate || format(now, 'yyyy-MM-dd')
        const time = t.time || t.time_str || null
        const priority = t.priority || 'medium'
        const taskType = t.task_type || t.type || 'reminder'
        
        const safePriority =
          priority === 'low' || priority === 'medium' || priority === 'high' ? priority : 'medium'

        const finalType = (taskType === 'deadline' || taskType === 'scheduled' || taskType === 'reminder')
          ? taskType
          : 'reminder'

        return ({
          title,
          type: finalType,
          priority: safePriority,
          dueDate,
          time: time || undefined
        })
      })

      setParsedTasks(normalizedTasks)
    } catch (error: any) {
      console.error('AI Parsing failed:', error)
      alert(`解析失败: ${error.message}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const startSpeechRecognition = () => {
    if (isRecording) return
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      alert('当前环境不支持语音转文字（SpeechRecognition 不可用）')
      return
    }

    try {
      const recognition = new SpeechRecognitionCtor()
      recognition.lang = 'zh-CN'
      recognition.continuous = true
      recognition.interimResults = true

      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i]?.[0]?.transcript || ''
        }
        transcript = transcript.trim()
        if (transcript) {
          setAIInputValue(transcript)
          // 语音实时转文字后，如果超过3个字且停止说话一小会，可以考虑自动触发解析（可选，此处保持手动触发更稳）
        }
      }

      recognition.onstart = () => {
        setIsRecording(true)
      }

      recognition.onerror = (event: any) => {
        console.error('SpeechRecognition error:', event)
        setIsRecording(false)
        const errorMsgs: Record<string, string> = {
          'not-allowed': '麦克风权限被拒绝，请在浏览器设置中开启',
          'network': '网络连接失败，请检查网络后重试',
          'no-speech': '未检测到语音输入，请大声一点哦'
        }
        alert(errorMsgs[event.error] || `语音识别错误: ${event.error}`)
      }

      recognition.onend = () => {
        setIsRecording(false)
      }

      speechRecognitionRef.current = recognition
      recognition.start()
      setIsRecording(true)
    } catch (e: any) {
      console.error('startSpeechRecognition failed:', e)
      setIsRecording(false)
      alert('开始语音识别失败，请重试')
    }
  }

  const stopSpeechRecognition = () => {
    const recognition = speechRecognitionRef.current
    speechRecognitionRef.current = null
    try {
      recognition?.stop()
    } catch {
      // ignore
    }
    setIsRecording(false)
  }

  useEffect(() => {
    localStorage.setItem('king-helper-api-key', apiKey)
  }, [apiKey])

  const addParsedTasks = () => {
    const newTasks: Task[] = parsedTasks.map((pt, index) => ({
      id: (Date.now() + index).toString(),
      title: pt.title || '无标题任务',
      completed: pt.completed || false,
      dueDate: pt.dueDate || format(now, 'yyyy-MM-dd'),
      type: pt.type as TaskType || 'reminder',
      priority: pt.priority as Priority || 'medium',
      time: pt.time,
      createdAt: Date.now()
    }))
    setTasks(prev => [...prev, ...newTasks])
    setShowAIModal(false)
    setAIInputValue('')
    setParsedTasks([])
    setIpAssistantText("完成得很好！继续保持 🚀")
    trackEvent('task_created', { method: 'ai', count: newTasks.length })
  }

  // Reminder Logic (PRD 5.5)
  useEffect(() => {
    const todayStr = format(now, 'yyyy-MM-dd')
    const nowMs = now.getTime()

    // 每日重置触发记录 + 触达上限
    if (reminderMetaRef.current.dateStr !== todayStr) {
      reminderMetaRef.current = { dateStr: todayStr, count: 0 }
      reminderTriggeredRef.current = new Set()
    }

    const canTrigger = () => reminderMetaRef.current.count < 5

    const triggerKey = (task: Task, category: string) => `${task.id}-${category}-${todayStr}`

    const showIpBubble = () => {
      setIpBubbleVisible(true)
      if (ipBubbleHideTimerRef.current) clearTimeout(ipBubbleHideTimerRef.current)
      ipBubbleHideTimerRef.current = setTimeout(() => {
        setIpBubbleVisible(false)
      }, 5000)
    }

    const showToast = (task: Task, type: 'light' | 'medium', category: string, message: string) => {
      if (!canTrigger()) return
      if (ignoreCountsRef.current[task.id] >= 2) return // 连续忽略后降低频率（简化实现）

      const key = triggerKey(task, category)
      if (reminderTriggeredRef.current.has(key)) return
      reminderTriggeredRef.current.add(key)
      reminderMetaRef.current.count += 1

      // 1. 系统级原生通知 (Desktop Notification)
      if (Notification.permission === 'granted') {
        new Notification('小金助手提醒', {
          body: `${task.title}\n${message}`,
          icon: `${import.meta.env.BASE_URL}favicon.ico`,
          silent: false
        })
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('小金助手提醒', {
              body: `${task.title}\n${message}`,
              silent: false
            })
          }
        })
      }

      // 2. 应用内 UI 通知 (In-app Toast)
      const id = Date.now().toString()
      setNotifications(prev => [...prev, { id, title: task.title, type, taskId: task.id }])
      setIpAssistantText(message)
      showIpBubble()
      setIpOverride('reminder', 4000)

      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id))
      }, 5000)
    }

    const showStrong = (task: Task, category: string, message: string) => {
      if (!canTrigger()) return
      const delayedUntil = strongDelayUntilRef.current[task.id]
      if (delayedUntil && delayedUntil > nowMs) return

      const key = triggerKey(task, category)
      if (reminderTriggeredRef.current.has(key)) return
      reminderTriggeredRef.current.add(key)
      reminderMetaRef.current.count += 1

      // 1. 系统级原生通知 (Desktop Notification) - 强提醒时增加震动或音效感知
      if (Notification.permission === 'granted') {
        new Notification('⚠️ 任务即将到期', {
          body: `任务：${task.title}\n${message}`,
          requireInteraction: true // 通知常驻直到用户操作
        })
      }

      // 2. 应用内 UI 通知 (In-app Strong Modal)
      setShowStrongReminder(task)
      setIpAssistantText(message)
      showIpBubble()
      setIpOverride('urgent', 8000)
    }

    const hasOverdue = tasks.some(t => !t.completed && t.type === 'deadline' && t.dueDate < todayStr)
    if (hasOverdue) {
      setIpAssistantText("这个任务已经延期了，我们要不要重新安排一下时间？")
    }

    tasks.forEach(task => {
      if (task.completed) return

      // 根据任务类型选择不同提醒策略
      if (task.type === 'deadline') {
        // deadline 由于字段只有日期，这里按“当天 23:59 到期”理解，符合 PRD 的“剩余 < 24h/2h”表达
        const due = parseISO(task.dueDate)
        due.setHours(23, 59, 0, 0)
        const diffMs = due.getTime() - nowMs

        if (diffMs <= 0) {
          // overdue：每天提醒 1 次直到完成
          showStrong(task, 'deadline-overdue', "这个任务有点晚了，我们要不要重新安排一下？")
          return
        }

        const hoursLeft = diffMs / 3600000
        if (hoursLeft <= 2) {
          showStrong(task, 'deadline-2h', "这个任务快到时间了，现在开始会更轻松一点")
        } else if (hoursLeft <= 24) {
          showToast(task, 'medium', 'deadline-1d', "还有一点时间，可以慢慢开始～")
        } else if (hoursLeft <= 72) {
          showToast(task, 'light', 'deadline-3d', "还有一点时间，可以慢慢开始～")
        }
      }

      if (task.type === 'scheduled' && task.dueDate === todayStr && task.time) {
        const [h, m] = task.time.split(':').map(Number)
        const taskTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
        const diffMs = taskTime.getTime() - nowMs
        const diffMinutes = diffMs / 60000

        // 提前 15 分钟提醒
        if (diffMinutes <= 15 && diffMinutes > 0) {
          showToast(task, 'medium', 'scheduled-15m', "日程快开始了，可以提前准备～")
        }
        // 到达时间提醒一次（允许 1 分钟容差）
        if (diffMs <= 0 && diffMs > -60000) {
          showToast(task, 'medium', 'scheduled-at', "时间到了，要不要现在开始？")
        }
      }

      if (task.type === 'reminder' && task.dueDate === todayStr) {
        // reminder 默认仅提醒 1 次
        showToast(task, 'light', 'reminder-once', "今天有个提醒，要不要处理？")
      }
    })
  }, [tasks, now])

  // 60s auto refresh (PRD 5.3)
  // 60s auto refresh (PRD 5.3) + Refresh on window focus to ensure date is correct
  useEffect(() => {
    const updateTime = () => setNow(new Date())
    const timer = setInterval(updateTime, 60000)
    
    // 当窗口获得焦点时强制刷新时间，解决机器休眠唤醒后日期不准的问题
    window.addEventListener('focus', updateTime)
    
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', updateTime)
    }
  }, [])

  // Sync tasks across windows via storage event
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'king-helper-tasks' && e.newValue) {
        setTasks(JSON.parse(e.newValue))
      }
      if (e.key === 'king-helper-api-key' && e.newValue) {
        setApiKey(e.newValue)
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  useEffect(() => {
    localStorage.setItem('king-helper-tasks', JSON.stringify(tasks))
  }, [tasks])

  // ESC 关闭 AI 创建弹窗（PRD 8.6.2）
  useEffect(() => {
    if (!showAIModal) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAIModal(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showAIModal])

  // 关闭弹窗时停止录音（避免残留占用麦克风）
  useEffect(() => {
    if (!showAIModal) stopSpeechRecognition()
  }, [showAIModal])

  useEffect(() => {
    const handleHashChange = () => {
      setIsPinnedView(window.location.hash.includes('pinned') || window.location.href.includes('pinned'))
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (!isPinnedView) setPinnedExpanded(false)
  }, [isPinnedView])

  // Mock Analytics (PRD 7.2)
  const trackEvent = (eventName: string, params?: any) => {
    console.log(`[Analytics] ${eventName}`, params || '')
  }

  const showIpAssistant = (text: string, holdMs: number = 3500) => {
    setIpAssistantText(text)
    setIpBubbleVisible(true)
    if (ipBubbleHideTimerRef.current) clearTimeout(ipBubbleHideTimerRef.current)
    ipBubbleHideTimerRef.current = setTimeout(() => {
      setIpBubbleVisible(false)
    }, holdMs)
  }

  const getIpHintByState = (state: IPState) => {
    const pick = (items: string[]) => items[Math.floor(Math.random() * items.length)] || items[0] || ''
    const actionChance = 0.3

    if (Math.random() < actionChance) {
      return pick([
        '双击我可以快速打开AI排程噢~',
        'Shift+点我可进入设置~',
        '设置里可进行数据备份~'
      ])
    }

    if (state === 'urgent') {
      const todayStr = format(now, 'yyyy-MM-dd')
      const nowMs = now.getTime()
      const uncompleted = tasks.filter(t => !t.completed)
      const hasOverdue = uncompleted.some(t => t.type === 'deadline' && t.dueDate < todayStr)

      if (hasOverdue) {
        return '这个任务有点晚了，我们要不要重新安排一下？'
      }

      return '这个任务快到时间了，现在开始会更轻松一点'
    }

    if (state === 'reminder') {
      return '还有一点时间，可以慢慢开始～'
    }

    if (state === 'completed') {
      return '完成啦！继续保持这个节奏 🚀'
    }

    if (state === 'idle') {
      return '目前无任务，要不要安排一下今天的日程？'
    }

    return '需要帮忙的话，我在这儿～'
  }

  const importFileRef = useRef<HTMLInputElement | null>(null)

  const exportTasksToJson = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks
    }
    const text = JSON.stringify(payload, null, 2)
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `king-helper-tasks-${format(new Date(), 'yyyyMMdd-HHmm')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    showIpAssistant('已导出数据到文件。', 2500)
  }

  const requestImportJson = () => {
    importFileRef.current?.click()
  }

  const normalizeImportedTasks = (input: any): Task[] => {
    const todayStr = format(now, 'yyyy-MM-dd')
    if (!Array.isArray(input)) return []

    return input
      .map((t: any, index: number) => {
        const title = typeof t?.title === 'string' ? t.title.trim() : ''
        if (!title) return null
        const dueDate = typeof t?.dueDate === 'string'
          ? t.dueDate
          : (typeof t?.due_date === 'string' ? t.due_date : todayStr)
        const type = (t?.type === 'deadline' || t?.type === 'scheduled' || t?.type === 'reminder')
          ? t.type
          : (t?.task_type === 'deadline' || t?.task_type === 'scheduled' || t?.task_type === 'reminder')
            ? t.task_type
            : 'reminder'
        const priority = (t?.priority === 'low' || t?.priority === 'medium' || t?.priority === 'high')
          ? t.priority
          : 'medium'
        const time = typeof t?.time === 'string' ? t.time : undefined
        const completed = typeof t?.completed === 'boolean' ? t.completed : false
        const createdAt = typeof t?.createdAt === 'number' ? t.createdAt : Date.now()
        const id = typeof t?.id === 'string' ? t.id : `${Date.now()}-${index}`

        const normalized: Task = {
          id,
          title,
          completed,
          dueDate,
          time,
          type,
          priority,
          createdAt
        }

        return normalized
      })
      .filter(Boolean) as Task[]
  }

  const onImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const tasksPayload = Array.isArray(parsed?.tasks) ? parsed.tasks : (Array.isArray(parsed) ? parsed : null)
      if (!tasksPayload) throw new Error('文件格式不正确：未找到 tasks 数组')

      const nextTasks = normalizeImportedTasks(tasksPayload)
      if (nextTasks.length === 0) throw new Error('文件中没有可导入的任务')

      const ok = window.confirm(`将导入 ${nextTasks.length} 条任务，并覆盖当前数据。是否继续？`)
      if (!ok) return

      try {
        localStorage.setItem('king-helper-tasks-backup', JSON.stringify(tasks))
        localStorage.setItem('king-helper-tasks-backup-at', new Date().toISOString())
      } catch {}

      setTasks(nextTasks)
      showIpAssistant('导入完成，已更新任务。', 2500)
    } catch (err: any) {
      alert(`导入失败：${err?.message || '未知错误'}`)
    }
  }

  const toggleTask = (id: string) => {
    setTasks(prev => {
      const newTasks = prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
      const task = newTasks.find(t => t.id === id)
      if (task?.completed) {
        delete strongDelayUntilRef.current[id]
        trackEvent('task_completed', { task_id: id, type: task.type })
        setIpOverride('completed', 2500)
      }
      return newTasks
    })
  }

  const addTask = () => {
    if (!inputValue.trim()) return
    
    // 尝试解析快捷标签
    const { title, time, priority, type } = parseInputShortcuts(inputValue)
    
    const newTask: Task = {
      id: Date.now().toString(),
      title: title || '无标题任务',
      completed: false,
      dueDate: inputDate || format(now, 'yyyy-MM-dd'),
      type,
      priority,
      time: time || undefined,
      createdAt: Date.now()
    }
    setTasks(prev => [...prev, newTask])
    setInputValue('')
    setInputTime('')
    setInputType('reminder')
    setInputPriority('medium')
    trackEvent('task_created', { method: 'manual', type })
  }

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    trackEvent('task_deleted', { task_id: id })
  }

  const [editingTask, setEditingTask] = useState<Task | null>(null)
  
  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    setEditingTask(null)
    trackEvent('task_updated', { task_id: id })
  }

  // 解析快速输入文本中的标签
  const parseInputShortcuts = (text: string) => {
    let title = text
    let time = inputTime
    let priority = inputPriority
    let type = inputType

    // 1. 解析优先级 !h/m/l 或 !高/中/低 (不强制 \b)
    const priorityMap: Record<string, Priority> = {
      h: 'high', m: 'medium', l: 'low',
      高: 'high', 中: 'medium', 低: 'low'
    }
    const priorityMatch = text.match(/!([hml高中低])(?!\w)/i)
    if (priorityMatch) {
      priority = priorityMap[priorityMatch[1].toLowerCase()] || 'medium'
      title = title.replace(priorityMatch[0], '')
    }

    // 2. 解析时间 /HH:mm 或 /HHmm 或 /HH (如 /14:30, /1430, /14)
    const timeMatch = text.match(/\/(\d{1,2}(?::\d{2})?|\d{4})(?!\d)/)
    if (timeMatch) {
      let rawTime = timeMatch[1]
      if (rawTime.length === 4 && !rawTime.includes(':')) {
        // 1430 -> 14:30
        time = `${rawTime.slice(0, 2)}:${rawTime.slice(2, 4)}`
      } else if (rawTime.length <= 2 && !rawTime.includes(':')) {
        // 14 -> 14:00
        time = `${rawTime.padStart(2, '0')}:00`
      } else {
        // 14:30 -> 14:30
        time = rawTime.includes(':') ? rawTime : `${rawTime}:00`
      }
      title = title.replace(timeMatch[0], '')
    }

    // 3. 解析类型 #d/s/r 或 #截止/日程/提醒
    const typeMap: Record<string, TaskType> = {
      d: 'deadline', s: 'scheduled', r: 'reminder',
      截止: 'deadline', 日程: 'scheduled', 提醒: 'reminder'
    }
    const typeMatch = text.match(/#([dsr]|截止|日程|提醒)(?!\w)/i)
    if (typeMatch) {
      type = typeMap[typeMatch[1].toLowerCase()] || 'reminder'
      title = title.replace(typeMatch[0], '')
    }

    // 清理标题：去重空格并 trim
    title = title.replace(/\s+/g, ' ').trim()

    return { title, time, priority, type }
  }

  // PRD 5.2 Sorting Logic
  const sortedTasks = useMemo(() => {
    const todayStr = format(now, 'yyyy-MM-dd')
    
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1

      const getScore = (t: Task) => {
        const isOverdue = !t.completed && t.dueDate < todayStr && t.type === 'deadline'
        const isUrgent = !t.completed && t.type === 'deadline' && t.dueDate === todayStr
        
        if (isOverdue) return 0
        if (isUrgent) return 1
        if (t.type === 'scheduled' && t.dueDate === todayStr) return 2
        if (t.type === 'reminder' && t.dueDate === todayStr) return 3
        return 4
      }

      const scoreA = getScore(a)
      const scoreB = getScore(b)

      if (scoreA !== scoreB) return scoreA - scoreB
      return b.createdAt - a.createdAt
    })
  }, [tasks, now])

  const overdueTasks = sortedTasks.filter(t => !t.completed && t.dueDate < format(now, 'yyyy-MM-dd'))
  const todayTasks = sortedTasks.filter(t => t.dueDate === format(now, 'yyyy-MM-dd'))
  const otherTasks = sortedTasks.filter(t => !t.completed && t.dueDate > format(now, 'yyyy-MM-dd'))
  const completedTasks = sortedTasks.filter(t => t.completed).slice(0, 20) // Show last 20 completed

  // --- Render Pinned View ---
  if (isPinnedView) {
    const todayStr = format(now, 'yyyy-MM-dd')
    const todayTasksList = tasks
      .filter(t => !t.completed && t.dueDate <= todayStr)
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          const pMap = { high: 0, medium: 1, low: 2 }
          return pMap[a.priority] - pMap[b.priority]
        }
        return b.createdAt - a.createdAt
      })

    const displayTasks = pinnedExpanded ? todayTasksList : todayTasksList.slice(0, 5) // 默认最多展示5条
    const moreCount = Math.max(0, todayTasksList.length - 5)

    return (
      <div className="h-screen w-full bg-transparent flex flex-col p-6 select-none font-sans">
        <div className="flex-1 bg-white border-2 border-yellow-400 rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex flex-col">
          {/* Header (Action Buttons on top) */}
          <div className="p-5 bg-yellow-400 flex items-center justify-between shrink-0 drag-region">
            <div className="flex items-center gap-2">
              <Sparkles className="text-white" size={18} fill="currentColor" />
              <h2 className="text-sm font-black text-white tracking-widest uppercase">小金助手</h2>
            </div>
            <div className="flex items-center gap-2 no-drag">
              <button 
                onClick={() => {
                  const newFlag = !isAlwaysOnTop
                  setIsAlwaysOnTop(newFlag)
                  window.ipcRenderer.send('set-always-on-top', newFlag)
                }}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  isAlwaysOnTop ? "bg-white text-yellow-500 shadow-sm" : "text-white/70 hover:text-white"
                )}
                title={isAlwaysOnTop ? "取消置顶" : "固定置顶"}
              >
                <Pin size={16} fill={isAlwaysOnTop ? "currentColor" : "none"} />
              </button>
              <button 
                onClick={() => window.ipcRenderer.send('toggle-pinned-window')}
                className="text-white/70 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
              >
                <X size={18} strokeWidth={3} />
              </button>
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 shrink-0 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">今日待办</h3>
            <span className="text-[10px] font-black text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full">
              {todayTasksList.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white custom-scrollbar">
            {displayTasks.length > 0 ? displayTasks.map(task => (
              <div key={task.id} className="relative group animate-in slide-in-from-left duration-300">
                <TaskItem 
                  task={task} 
                  onToggle={toggleTask} 
                  onDelete={deleteTask} 
                  onEdit={setEditingTask} 
                  isPinned={true}
                />
              </div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20 py-8">
                <CheckCircle2 size={40} />
                <p className="text-xs font-black mt-3 tracking-widest uppercase">搞定啦！</p>
              </div>
            )}
            {moreCount > 0 && !pinnedExpanded && (
              <button
                onClick={() => setPinnedExpanded(true)}
                className="w-full text-left text-[10px] font-black text-gray-400 pl-4 uppercase tracking-widest pt-2 border-t border-dashed border-gray-100 mt-2 hover:text-gray-600 transition-colors"
              >
                +{moreCount} 展开全部
              </button>
            )}
            {pinnedExpanded && moreCount > 0 && (
              <button
                onClick={() => setPinnedExpanded(false)}
                className="w-full text-left text-[10px] font-black text-gray-400 pl-4 uppercase tracking-widest pt-2 border-t border-dashed border-gray-100 mt-2 hover:text-gray-600 transition-colors"
              >
                收起
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-center shrink-0">
            <div className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">
              King Helper Widget
            </div>
          </div>
        </div>
        
        {/* Same Edit Modal for Pinned View */}
        {editingTask && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-xs bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border-2 border-yellow-400">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">编辑任务</h3>
                <button onClick={() => setEditingTask(null)} className="text-gray-400">
                  <X size={16} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <input 
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-transparent focus:border-yellow-400 rounded-lg outline-none text-xs font-bold"
                />
                <button 
                  onClick={() => updateTask(editingTask.id, editingTask)}
                  className="w-full py-2 bg-yellow-400 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-yellow-100"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#F8F9FB] text-gray-800 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-gray-100 flex flex-col shadow-sm">
        <div className="p-8">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-200 group-hover:scale-110 transition-transform">
              <Sparkles className="text-white" size={24} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-gray-900">King Helper</h1>
              <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">小金助手 V2.0</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <SidebarItem 
            icon={<Plus size={20} />} 
            label="添加待办" 
            active={activeTab === 'add'} 
            onClick={() => setActiveTab('add')} 
          />
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="今日" 
            active={activeTab === 'today'} 
            onClick={() => setActiveTab('today')} 
          />
          <SidebarItem 
            icon={<Calendar size={20} />} 
            label="预览" 
            active={activeTab === 'preview'} 
            onClick={() => setActiveTab('preview')} 
          />
          <div className="pt-4 border-t border-gray-50 mt-4">
            <SidebarItem 
              icon={<History size={20} />} 
              label="最近完成" 
              active={activeTab === 'completed'} 
              onClick={() => setActiveTab('completed')} 
            />
          </div>
        </nav>

        <div className="p-6">
          <button 
            onClick={() => {
              window.ipcRenderer.send('toggle-pinned-window')
              trackEvent('pinned_window_toggled')
            }}
            className="w-full group flex items-center justify-center gap-3 px-6 py-4 bg-gray-900 hover:bg-black text-white rounded-2xl transition-all font-bold shadow-xl shadow-gray-200 hover:-translate-y-1 active:translate-y-0"
          >
            <Pin size={18} className="group-hover:rotate-45 transition-transform" /> 
            <span>开启桌面悬浮</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-white/50 backdrop-blur-3xl">
        {/* Header (PRD 8.2-1) */}
        <header className="px-12 pt-12 pb-6">
          <div className="flex items-end justify-between mb-8">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3">
                <h2 className="text-5xl font-black tracking-tighter text-gray-900">
                  {activeTab === 'today' ? "☀️ Today" : activeTab === 'preview' ? "📅 Preview" : "✅ Done"}
                </h2>
                <div className="flex flex-col gap-1">
                  <span className="px-4 py-1.5 bg-yellow-400 text-white rounded-full text-sm font-black shadow-lg shadow-yellow-100">
                    {tasks.filter(t => t.completed && t.dueDate === format(now, 'yyyy-MM-dd')).length}/{todayTasks.length} 完成
                  </span>
                </div>
              </div>
              <p className="text-gray-400 font-bold flex items-center gap-2 text-lg">
                {format(now, 'yyyy年MM月dd日')} · {format(now, 'EEEE')}
              </p>
            </div>
            
            {activeTab === 'today' && (
              <div className="flex flex-col items-end gap-2 max-w-[300px] w-full">
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                  <div 
                    className="h-full bg-yellow-400 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(250,204,21,0.5)]"
                    style={{ width: `${todayTasks.length > 0 ? (tasks.filter(t => t.completed && t.dueDate === format(now, 'yyyy-MM-dd')).length / todayTasks.length) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  今日进度：{todayTasks.length > 0 ? Math.round((tasks.filter(t => t.completed && t.dueDate === format(now, 'yyyy-MM-dd')).length / todayTasks.length) * 100) : 0}%
                </p>
              </div>
            )}
          </div>
        </header>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto px-12 space-y-10 pb-32 custom-scrollbar">
          {activeTab === 'add' && (
            <div className="max-w-2xl mx-auto pt-10 space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-gray-100">
                <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
                  <div className="w-2 h-8 bg-yellow-400 rounded-full" />
                  新建待办任务
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">任务标题</label>
                    <input 
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="想做点什么？"
                      className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-yellow-400 rounded-2xl outline-none text-lg font-bold transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">日期</label>
                      <input 
                        type="date"
                        value={inputDate}
                        onChange={(e) => setInputDate(e.target.value)}
                        className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-yellow-400 rounded-2xl outline-none font-bold transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">具体时间 (可选)</label>
                      <input 
                        type="time"
                        value={inputTime}
                        onChange={(e) => setInputTime(e.target.value)}
                        className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-yellow-400 rounded-2xl outline-none font-bold transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">任务类型</label>
                      <select 
                        value={inputType}
                        onChange={(e) => setInputType(e.target.value as TaskType)}
                        className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-yellow-400 rounded-2xl outline-none font-bold transition-all cursor-pointer"
                      >
                        <option value="reminder">🔔 提醒 (Reminder)</option>
                        <option value="scheduled">📅 日程 (Scheduled)</option>
                        <option value="deadline">🚩 截止 (Deadline)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">优先级</label>
                      <select 
                        value={inputPriority}
                        onChange={(e) => setInputPriority(e.target.value as Priority)}
                        className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-yellow-400 rounded-2xl outline-none font-bold transition-all cursor-pointer"
                      >
                        <option value="low">🟢 低优先级</option>
                        <option value="medium">🟡 中优先级</option>
                        <option value="high">🔴 高优先级</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-6">
                    <button 
                      onClick={() => {
                        addTask()
                        setActiveTab('today')
                      }}
                      className="w-full py-5 bg-yellow-400 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-yellow-100 hover:bg-yellow-500 transition-all hover:-translate-y-1 active:translate-y-0"
                    >
                      立即创建
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-8 rounded-[2.5rem] border border-yellow-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-yellow-500 shadow-sm">
                    <Lightbulb size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-yellow-700">试试 AI 智能创建？</h4>
                    <p className="text-xs text-yellow-600 font-bold opacity-70">直接说出你的想法，小金帮你安排</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setAIInputValue(inputValue)
                    setShowAIModal(true)
                  }}
                  className="px-6 py-3 bg-white text-yellow-600 rounded-xl font-black text-sm shadow-sm hover:shadow-md transition-all active:scale-95"
                >
                  开启 AI
                </button>
              </div>
            </div>
          )}

          {activeTab === 'today' && (
            <>
              {overdueTasks.length > 0 && (
                <section className="animate-in slide-in-from-top duration-500">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-4 bg-red-500 rounded-full" />
                    <h3 className="text-sm font-black text-red-500 uppercase tracking-widest">已逾期任务</h3>
                  </div>
                  <div className="grid gap-3">
                    {overdueTasks.map(task => (
                      <TaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={setEditingTask} />
                    ))}
                  </div>
                </section>
              )}
              <section className="animate-in slide-in-from-top duration-700">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                  <h3 className="text-sm font-black text-blue-500 uppercase tracking-widest">今日待办</h3>
                </div>
                <div className="grid gap-3">
                  {todayTasks.length > 0 ? todayTasks.map(task => (
                    <TaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={setEditingTask} />
                  )) : (
                    <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-3xl opacity-40">
                      <Sparkles size={48} className="text-gray-200 mb-4" />
                      <p className="font-bold text-gray-400 text-lg">今天暂时没有任务哦</p>
                    </div>
                  )}
                </div>
              </section>
              {otherTasks.length > 0 && (
                <section className="animate-in slide-in-from-top duration-1000">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-4 bg-gray-300 rounded-full" />
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">将来</h3>
                  </div>
                  <div className="grid gap-3 opacity-60">
                    {otherTasks.map(task => (
                      <TaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={setEditingTask} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {activeTab === 'preview' && (
            <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500 max-w-7xl mx-auto w-full h-full min-h-0">
              {/* Left Side: Mini Calendar Grid */}
              <div className="lg:w-[450px] shrink-0">
                <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-gray-100/50 border border-gray-50">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black flex items-center gap-2 text-gray-800">
                      <Calendar className="text-yellow-400" size={20} />
                      {format(addDays(new Date(now.getFullYear(), now.getMonth(), 1), previewMonthOffset * 30), 'yyyy年MM月')}
                    </h3>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setPreviewMonthOffset(prev => prev - 1)}
                        className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors text-gray-400"
                      >
                        <Plus className="rotate-45" size={18} />
                      </button>
                      <button 
                        onClick={() => setPreviewMonthOffset(0)}
                        className="px-3 py-1 bg-gray-50 text-gray-500 text-[10px] font-black rounded-lg hover:bg-yellow-400 hover:text-white transition-all"
                      >
                        今天
                      </button>
                      <button 
                        onClick={() => setPreviewMonthOffset(prev => prev + 1)}
                        className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors text-gray-400"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                      <div key={d} className="text-center text-[10px] font-black text-gray-300 py-1 uppercase tracking-widest">{d}</div>
                    ))}
                    {Array.from({ length: 35 }).map((_, i) => {
                      const baseDate = addDays(new Date(now.getFullYear(), now.getMonth(), 1), previewMonthOffset * 30)
                      const firstDayOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)
                      const startDate = addDays(firstDayOfMonth, -firstDayOfMonth.getDay())
                      const date = addDays(startDate, i)
                      const dateStr = format(date, 'yyyy-MM-dd')
                      const dayTasks = tasks.filter(t => t.dueDate === dateStr)
                      const completedCount = dayTasks.filter(t => t.completed).length
                      const isSelected = selectedPreviewDate === dateStr
                      const isTodayDate = dateStr === format(new Date(), 'yyyy-MM-dd')
                      const isCurrentMonth = date.getMonth() === baseDate.getMonth()

                      return (
                        <button 
                          key={i} 
                          onClick={() => setSelectedPreviewDate(dateStr)}
                          className={cn(
                            "aspect-square p-1.5 rounded-xl border-2 transition-all flex flex-col items-center justify-between group",
                            isSelected ? "border-yellow-400 bg-yellow-50/50 scale-105 shadow-md shadow-yellow-100/30" : 
                            isTodayDate ? "border-yellow-100 bg-yellow-50/20" : "border-transparent hover:border-gray-100 hover:bg-gray-50/50",
                            !isCurrentMonth && "opacity-20"
                          )}
                        >
                          <span className={cn(
                            "text-[10px] font-black",
                            isSelected ? "text-yellow-600" : isTodayDate ? "text-yellow-500" : "text-gray-400"
                          )}>
                            {format(date, 'd')}
                          </span>
                          {dayTasks.length > 0 && (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex gap-0.5">
                                {dayTasks.slice(0, 3).map((t, idx) => (
                                  <div key={idx} className={cn(
                                    "w-0.5 h-0.5 rounded-full",
                                    t.completed ? "bg-gray-300" : 
                                    t.type === 'deadline' ? "bg-red-400" : 
                                    t.type === 'scheduled' ? "bg-blue-400" : "bg-yellow-400"
                                  )} />
                                ))}
                              </div>
                              <span className="text-[7px] font-black text-gray-300">
                                {completedCount}/{dayTasks.length}
                              </span>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Right Side: Daily Task List */}
              <div className="flex-1 flex flex-col min-h-0 space-y-6">
                <div className="flex items-center justify-between px-2 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-5 bg-yellow-400 rounded-full" />
                    <h4 className="text-lg font-black text-gray-800">
                      {selectedPreviewDate === format(new Date(), 'yyyy-MM-dd') ? "今日待办" : 
                       format(parseISO(selectedPreviewDate), 'MM月dd日') + " 待办"}
                    </h4>
                  </div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">
                    {tasks.filter(t => t.dueDate === selectedPreviewDate).length} 个任务
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="grid gap-3 pb-8">
                    {tasks.filter(t => t.dueDate === selectedPreviewDate).length > 0 ? (
                      tasks.filter(t => t.dueDate === selectedPreviewDate).map(task => (
                        <TaskItem 
                          key={task.id} 
                          task={task} 
                          onToggle={toggleTask} 
                          onDelete={deleteTask} 
                          onEdit={setEditingTask} 
                        />
                      ))
                    ) : (
                      <div className="py-20 flex flex-col items-center justify-center bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100 opacity-50">
                        <Sparkles size={40} className="text-gray-200 mb-3" />
                        <p className="font-bold text-gray-400 text-sm">这一天暂时没有任务哦</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'completed' && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-4 bg-green-500 rounded-full" />
                <h3 className="text-sm font-black text-green-500 uppercase tracking-widest">最近完成的任务</h3>
              </div>
              <div className="grid gap-3">
                {completedTasks.length > 0 ? completedTasks.map(task => (
                  <TaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={setEditingTask} />
                )) : (
                  <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-3xl opacity-40">
                    <History size={48} className="text-gray-200 mb-4" />
                    <p className="font-bold text-gray-400 text-lg">还没有已完成的任务</p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Bottom Input Area */}
        {activeTab !== 'add' && (
          <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-white via-white/95 to-transparent pt-24">
            <div className="max-w-3xl mx-auto relative group">
              
              {/* --- Smart Floating Bar (PRD 8.6.1 Enhanced) --- */}
              <div className="absolute -top-14 left-0 right-0 flex items-center justify-between px-6 py-3 bg-white/80 backdrop-blur-xl border border-yellow-100 rounded-2xl shadow-xl shadow-yellow-100/20 animate-in slide-in-from-bottom-4 duration-500">
                {(!inputValue.includes('!') && !inputValue.includes('/') && !inputValue.includes('#')) ? (
                  /* Initial State: Shortcut Hints with Diverse Examples */
                  <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                    <span className="text-[10px] font-black text-yellow-600 uppercase tracking-widest shrink-0">快捷录入：</span>
                    <div className="flex gap-2 shrink-0">
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                        <span className="text-yellow-500 font-black mr-1">/</span>14:30 或 /1400 或 /14
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                        <span className="text-red-500 font-black mr-1">!</span>h 或 !高
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                        <span className="text-blue-500 font-black mr-1">#</span>d 或 #截止
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Active State: Parsing Preview */
                  <div className="flex items-center gap-4 w-full animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-1.5 h-4 bg-yellow-400 rounded-full animate-pulse" />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">解析结果</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {(() => {
                        const p = parseInputShortcuts(inputValue)
                        return (
                          <>
                            <span className="px-3 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-full shadow-sm truncate max-w-[150px]">
                              {p.title || '待输入...'}
                            </span>
                            <div className="flex gap-1.5 items-center">
                              {p.time !== inputTime && (
                                <span className="px-3 py-1 bg-yellow-400 text-white text-[10px] font-black rounded-full shadow-sm flex items-center gap-1 border-2 border-white animate-in zoom-in-50">
                                  <Clock size={10} strokeWidth={3} /> {p.time}
                                </span>
                              )}
                              {p.priority !== 'medium' && (
                                <span className={cn(
                                  "px-3 py-1 text-[10px] font-black rounded-full shadow-sm flex items-center gap-1 border-2 border-white animate-in zoom-in-50",
                                  p.priority === 'high' ? "bg-red-500 text-white" : "bg-green-500 text-white"
                                )}>
                                  <AlertCircle size={10} strokeWidth={3} /> {p.priority === 'high' ? '高' : '低'}
                                </span>
                              )}
                              {p.type !== 'reminder' && (
                                <span className="px-3 py-1 bg-blue-500 text-white text-[10px] font-black rounded-full shadow-sm flex items-center gap-1 border-2 border-white animate-in zoom-in-50">
                                  <Tag size={10} strokeWidth={3} /> {p.type === 'deadline' ? '截止' : '日程'}
                                </span>
                              )}
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-1 ml-4 border-l border-gray-100 pl-4 shrink-0">
                   <span className="text-[9px] font-black text-gray-300 uppercase">回车确认</span>
                   <CornerDownLeft size={10} className="text-gray-300" />
                </div>
              </div>

              <input 
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                placeholder="在此快速记录今日任务..."
                className="w-full pl-8 pr-32 py-6 bg-white border-2 border-gray-100 rounded-[2.5rem] shadow-2xl shadow-gray-100/50 focus:outline-none focus:border-yellow-400 transition-all text-lg font-medium group-hover:shadow-yellow-100/40"
              />
              
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button 
                  onClick={() => {
                    setAIInputValue(inputValue)
                    setShowAIModal(true)
                  }}
                  className="p-3 text-yellow-500 hover:bg-yellow-50 rounded-2xl transition-all active:scale-90"
                  title="使用 AI 智能解析"
                >
                  <Lightbulb size={20} />
                </button>
                <div className="w-px h-6 bg-gray-100 mx-1" />
                <button 
                  onClick={addTask}
                  className="p-3 bg-yellow-400 text-white rounded-2xl hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-200 hover:-translate-y-1 active:translate-y-0"
                >
                  <Plus size={22} strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* IP Assistant (PRD 8.2-4) */}
        <div className="fixed bottom-10 right-10 z-50 flex flex-col items-end gap-4 group">
          <div className={cn(
            "max-w-[200px] bg-white px-5 py-3 rounded-3xl shadow-2xl border border-yellow-50 transition-all duration-500 pointer-events-none",
            ipBubbleVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}>
            <p className="text-xs font-bold text-gray-700 leading-relaxed">
              🙂 {ipAssistantText}
            </p>
          </div>
          <button
            type="button"
            onMouseEnter={() => showIpAssistant(getIpHintByState(ipState), 2500)}
            onClick={(e) => {
              if ((e as any).shiftKey) {
                setShowSettings(true)
                showIpAssistant('已为你打开设置页：在这里粘贴 API Key 即可使用 AI。', 3500)
                return
              }
              if (ipBubbleVisible) {
                setIpBubbleVisible(false)
                return
              }
              showIpAssistant(getIpHintByState(ipState), 4000)
            }}
            onDoubleClick={() => {
              setAIInputValue(inputValue)
              setShowAIModal(true)
              showIpAssistant('我来帮你拆解～', 2000)
              setIpOverride('reminder', 2000)
            }}
            className={cn(
              "w-32 h-32 rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all duration-500 border-4 border-white group-active:scale-95 overflow-hidden bg-white relative",
              ipState === 'urgent' ? "scale-110 ring-4 ring-red-400 animate-pulse" :
              ipState === 'reminder' ? "scale-110 ring-4 ring-yellow-300" :
              ipState === 'completed' ? "scale-110 ring-4 ring-green-400 animate-bounce" :
              ipState === 'idle' ? "ring-2 ring-gray-100 hover:rotate-6 hover:scale-110" :
              "hover:rotate-12 hover:scale-110"
            )}
          >
            <img 
              src={ipImageSrc} 
              alt="小金助手 IP" 
              className={cn(
                "w-full h-full object-contain"
              )} 
            />
          </button>
        </div>

        {/* AI Creation Modal (PRD 8.6.2) */}
        {showAIModal && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
            onMouseDown={(e) => {
              if (e.currentTarget === e.target) setShowAIModal(false)
            }}
          >
            <div className="w-full max-w-xl bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border-none ring-1 ring-black/5">
              <div className="p-8 border-b flex items-center justify-between bg-yellow-400 text-white">
                <div className="flex items-center gap-3">
                  <Lightbulb size={24} />
                  <h3 className="text-xl font-black italic uppercase tracking-tight">AI 智能排程</h3>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => setShowSettings(true)} className="text-yellow-100 hover:text-white text-sm font-bold transition-colors">
                    配置 API Key
                  </button>
                  <button onClick={() => setShowAIModal(false)} className="hover:rotate-90 transition-transform">
                    <X size={24} />
                  </button>
                </div>
              </div>
              <div className="p-10 space-y-8">
                <div className="relative">
                  <textarea 
                    value={aiInputValue}
                    onChange={(e) => setAIInputValue(e.target.value)}
                    placeholder="例如：明天下午三点开会，提醒我周五前交报告，然后今晚买牛奶..."
                    className="w-full h-40 p-6 bg-gray-50 border-2 border-transparent focus:border-yellow-400 rounded-[2rem] outline-none resize-none text-lg font-medium transition-all"
                  />
                  
                  {/* AI 弹窗内的录音提示气泡 */}
                  {isRecording && (
                    <div className="absolute -top-20 right-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="bg-yellow-400 text-white px-5 py-3 rounded-2xl text-xs font-bold shadow-lg flex items-center gap-3 relative">
                        <div className="w-8 h-8 rounded-full bg-white overflow-hidden shrink-0 border border-yellow-200">
                          <img src={ipImages.default} className="w-full h-full object-contain" />
                        </div>
                        <span>正在倾听您的指令...</span>
                        <div className="absolute -bottom-1 right-6 w-3 h-3 bg-yellow-400 rotate-45" />
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={() => {
                      if (isRecording) stopSpeechRecognition()
                      else startSpeechRecognition()
                    }}
                    className={cn(
                      "absolute bottom-4 right-4 p-4 rounded-full transition-all shadow-lg flex items-center justify-center overflow-hidden",
                      isRecording 
                        ? "bg-red-500 text-white scale-110 ring-4 ring-red-100" 
                        : "bg-white text-gray-400 hover:text-yellow-500 hover:shadow-md"
                    )}
                  >
                    {isRecording && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-full bg-red-400 animate-ping opacity-20" />
                        <div className="w-full h-full bg-red-300 animate-pulse opacity-10 rounded-full scale-150" />
                      </div>
                    )}
                    <Mic size={24} className={cn("relative z-10", isRecording && "animate-bounce")} />
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">解析预览</p>
                  <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 min-h-[150px]">
                    {isAnalyzing ? (
                      <div className="flex flex-col items-center justify-center py-8 space-y-3">
                        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm font-bold text-yellow-600 animate-pulse">小金正在思考并拆解任务...</p>
                      </div>
                    ) : parsedTasks.length > 0 ? (
                      <div className="space-y-3">
                        {parsedTasks.map((pt, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-yellow-100 group">
                            <button 
                              onClick={() => {
                                setParsedTasks(prev => prev.map((t, idx) => 
                                  idx === i ? { ...t, completed: !t.completed } : t
                                ))
                              }}
                              className="shrink-0"
                            >
                              {pt.completed ? (
                                <CheckCircle2 className="text-green-500" size={20} />
                              ) : (
                                <Circle className="text-gray-200 group-hover:text-yellow-400" size={20} strokeWidth={3} />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm font-bold truncate",
                                pt.completed && "line-through text-gray-400"
                              )}>{pt.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-gray-400 font-medium">
                                  {pt.dueDate === format(now, 'yyyy-MM-dd') ? "今天" : pt.dueDate}
                                  {pt.time && ` ${pt.time}`}
                                </span>
                                {pt.priority === 'high' && <span className="text-[10px] text-red-500 font-black">紧急</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 space-y-3">
                        <p className="text-gray-300 text-sm font-medium italic">输入文本或点击麦克风，AI 将自动为您拆分任务、识别时间和优先级</p>
                        {!apiKey && (
                          <button onClick={() => setShowSettings(true)} className="px-4 py-2 bg-yellow-400 text-white rounded-xl text-xs font-bold">去配置</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    disabled={isAnalyzing || !aiInputValue.trim()}
                    className={cn(
                      "px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-widest transition-all",
                      isAnalyzing || !aiInputValue.trim()
                        ? "bg-gray-100 text-gray-300 cursor-not-allowed" 
                        : "bg-blue-500 text-white shadow-xl shadow-blue-100 hover:bg-blue-600 hover:-translate-y-1"
                    )}
                    onClick={() => parseWithAI(aiInputValue)}
                  >
                    {isAnalyzing ? "正在解析..." : (parsedTasks.length > 0 ? "重新生成" : "开始解析")}
                  </button>
                  <button 
                    disabled={isAnalyzing || parsedTasks.length === 0}
                    className={cn(
                      "flex-1 py-5 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl transition-all",
                      isAnalyzing || parsedTasks.length === 0 
                        ? "bg-gray-100 text-gray-300 cursor-not-allowed" 
                        : "bg-yellow-400 text-white shadow-yellow-100 hover:bg-yellow-500 hover:-translate-y-1 active:translate-y-0"
                    )}
                    onClick={addParsedTasks}
                  >
                    确认添加
                  </button>
                  <button 
                    onClick={() => setAIInputValue('')}
                    className="px-8 py-5 bg-gray-100 text-gray-400 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                  >
                    重置
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold">设置</h3>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">火山引擎 API Key</label>
                  <input 
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="请输入你的 API Key（非接入点 ID）"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-yellow-400 transition-colors"
                  />
                  <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                    获取方式：登录火山引擎控制台 → 方舟(Ark) / 大模型 → API Key 管理 → 创建并复制。<br/>
                    提示：API Key 不是接入点 ID（形如 <code>ep-xxx</code> 的是接入点 ID）。
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">模型标识 (Model / Endpoint ID)</label>
                  <input 
                    type="text"
                    defaultValue="doubao-seed-2-0-mini-260215"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-yellow-400 transition-colors"
                  />
                  <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                    注意：火山引擎 Ark 平台通常要求在此填写 <b>接入点 ID (Endpoint ID)</b>，例如 <code>ep-2024...</code>。<br/>
                    目前固定为测试模型，如需更改请联系开发。
                  </p>
                </div>
                <div className="pt-2">
                  <p className="text-xs font-bold text-gray-700 mb-2">数据备份</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={exportTasksToJson}
                      className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                    >
                      导出 JSON
                    </button>
                    <button
                      onClick={requestImportJson}
                      className="w-full py-3 bg-yellow-400 text-white rounded-xl font-bold hover:bg-yellow-500 transition-colors"
                    >
                      导入 JSON
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                    导入会覆盖当前任务；已自动备份一份到本机。
                  </p>
                  <input
                    ref={importFileRef}
                    type="file"
                    accept="application/json"
                    onChange={onImportFileChange}
                    className="hidden"
                  />
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors"
                >
                  保存并关闭
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Notifications / Toast (PRD 5.5.9) */}
        <div className="fixed top-10 right-10 z-[200] space-y-4">
          {notifications.map(n => (
            <div 
              key={n.id} 
              className={cn(
                "p-6 rounded-3xl shadow-2xl border-2 flex items-center gap-4 animate-in slide-in-from-right duration-500 bg-white border-yellow-400 text-gray-800"
              )}
            >
              <div className="w-12 h-12 bg-yellow-100 rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle className="text-yellow-600" size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">📅 任务提醒</p>
                <h4 className="text-lg font-bold">{n.title}</h4>
              </div>
              <button 
                onClick={() => {
                  if (n.taskId) {
                    ignoreCountsRef.current[n.taskId] = (ignoreCountsRef.current[n.taskId] || 0) + 1
                  }
                  setNotifications(prev => prev.filter(notif => notif.id !== n.id))
                }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Strong Reminder Modal (PRD 8.6.4) */}
        {showStrongReminder && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-red-500/20 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border-4 border-red-500">
              <div className="p-8 bg-red-500 text-white flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 animate-bounce">
                  <AlertCircle size={48} />
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight mb-2">任务即将截止！</h3>
                <p className="text-red-100 font-bold uppercase tracking-widest text-xs">⚠️ 强提醒模式</p>
              </div>
              <div className="p-10 text-center">
                <h4 className="text-3xl font-black text-gray-900 mb-6">{showStrongReminder.title}</h4>
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={() => {
                      toggleTask(showStrongReminder.id)
                      setShowStrongReminder(null)
                    }}
                    className="w-full py-5 bg-green-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-green-100 hover:bg-green-600 transition-all hover:-translate-y-1"
                  >
                    完成任务
                  </button>
                  <button 
                    onClick={() => {
                      // 延后：在指定时长内跳过强提醒触发（简化实现）
                      strongDelayUntilRef.current[showStrongReminder.id] = Date.now() + 60 * 60 * 1000
                      setShowStrongReminder(null)
                      trackEvent('strong_reminder_delayed', { task_id: showStrongReminder.id })
                    }}
                    className="w-full py-5 bg-gray-100 text-gray-400 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                  >
                    稍后提醒
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Edit Modal */}
        {editingTask && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold">编辑任务</h3>
                <button onClick={() => setEditingTask(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">任务标题</label>
                  <input 
                    type="text"
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                    className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-yellow-400 rounded-xl outline-none font-bold transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">日期</label>
                    <input 
                      type="date"
                      value={editingTask.dueDate}
                      onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                      className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-yellow-400 rounded-xl outline-none font-bold transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">时间</label>
                    <input 
                      type="time"
                      value={editingTask.time || ''}
                      onChange={(e) => setEditingTask({ ...editingTask, time: e.target.value })}
                      className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-yellow-400 rounded-xl outline-none font-bold transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">类型</label>
                    <select 
                      value={editingTask.type}
                      onChange={(e) => setEditingTask({ ...editingTask, type: e.target.value as TaskType })}
                      className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-yellow-400 rounded-xl outline-none font-bold transition-all"
                    >
                      <option value="reminder">提醒</option>
                      <option value="scheduled">日程</option>
                      <option value="deadline">截止</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">优先级</label>
                    <select 
                      value={editingTask.priority}
                      onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value as Priority })}
                      className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-yellow-400 rounded-xl outline-none font-bold transition-all"
                    >
                      <option value="low">低</option>
                      <option value="medium">中</option>
                      <option value="high">高</option>
                    </select>
                  </div>
                </div>
                <button 
                  onClick={() => updateTask(editingTask.id, editingTask)}
                  className="w-full py-4 bg-yellow-400 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-yellow-100 hover:bg-yellow-500 transition-all"
                >
                  保存修改
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold text-sm",
        active ? "bg-yellow-400 text-white shadow-lg shadow-yellow-100" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
      )}
    >
      {icon} {label}
    </button>
  )
}

function TaskItem({ task, onToggle, onDelete, onEdit, isPinned = false }: { task: Task; onToggle: (id: string) => void; onDelete: (id: string) => void; onEdit: (task: Task) => void; isPinned?: boolean }) {
  return (
    <div 
      className={cn(
        "group flex items-center gap-4 p-4 bg-white rounded-3xl border-2 border-transparent hover:border-yellow-100 hover:shadow-xl hover:shadow-yellow-50/50 transition-all duration-300",
        task.completed && "opacity-40",
        isPinned && "p-3 gap-3" // 悬浮窗内稍微紧凑点
      )}
    >
      <button 
        onClick={() => onToggle(task.id)}
        className="focus:outline-none shrink-0"
      >
        {task.completed ? (
          <CheckCircle2 className="text-green-500" size={isPinned ? 24 : 28} />
        ) : (
          <Circle className="text-gray-200 group-hover:text-yellow-400 transition-colors" size={isPinned ? 24 : 28} strokeWidth={2.5} />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <h4 className={cn(
          "text-base font-bold text-gray-800 transition-all mb-1 break-words", // 使用 break-words 支持换行
          !isPinned && "text-lg",
          task.completed && "line-through text-gray-400"
        )}>
          {task.title}
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          {task.time && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-500 rounded-lg text-[9px] font-black uppercase tracking-tight">
              <Clock size={10} /> {task.time}
            </span>
          )}
          {task.type === 'deadline' && (
            <span className={cn(
              "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tight",
              task.dueDate < format(new Date(), 'yyyy-MM-dd') ? "bg-red-50 text-red-500" : "bg-yellow-50 text-yellow-600"
            )}>
              Deadline: {task.dueDate === format(new Date(), 'yyyy-MM-dd') ? "今天" : task.dueDate}
            </span>
          )}
          {task.priority === 'high' && (
            <span className="flex items-center gap-1 text-[9px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">
              <AlertCircle size={10} /> 紧急
            </span>
          )}
        </div>
      </div>
      
      <div className={cn(
        "flex items-center gap-1 transition-all",
        isPinned ? "opacity-100" : "opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
      )}>
        <button 
          onClick={() => onEdit(task)}
          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
          title="编辑任务"
        >
          <Edit2 size={isPinned ? 14 : 18} />
        </button>
        <button 
          onClick={() => onDelete(task.id)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
          title="删除任务"
        >
          <Trash2 size={isPinned ? 14 : 18} />
        </button>
      </div>
    </div>
  )
}

export default App
