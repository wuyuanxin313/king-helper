# 项目结构说明

```
金金管家/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── main.ts             # 主进程入口，负责创建和管理窗口
│   │   └── preload.ts          # 预加载脚本，桥接主进程和渲染进程
│   │
│   └── renderer/                # React 渲染进程（UI层）
│       ├── components/          # React 组件
│       │   ├── TodoInput.tsx   # 任务输入组件
│       │   ├── TodoList.tsx    # 任务列表组件
│       │   ├── TodoItem.tsx    # 单个任务项组件
│       │   └── WindowControls.tsx # 窗口控制组件（置顶、透明度等）
│       │
│       ├── types/               # TypeScript 类型定义
│       │   ├── todo.d.ts       # 任务数据类型
│       │   └── electron.d.ts   # Electron API 类型
│       │
│       ├── App.tsx              # 主应用组件
│       ├── App.css              # 主应用样式
│       ├── main.tsx             # React 入口文件
│       └── index.html           # HTML 模板
│
├── dist/                        # 构建输出目录（自动生成）
│   ├── main.js                  # 编译后的主进程代码
│   └── renderer/                # 编译后的渲染进程代码
│
├── package.json                 # 项目配置和依赖
├── tsconfig.json                # React 渲染进程 TypeScript 配置
├── tsconfig.main.json           # Electron 主进程 TypeScript 配置
├── vite.config.ts               # Vite 构建配置
├── electron-builder.json        # Electron 打包配置
├── .gitignore                   # Git 忽略文件
├── README.md                    # 项目说明文档
├── QUICKSTART.md                # 快速启动指南
└── PROJECT_STRUCTURE.md         # 本文件

```

## 核心文件说明

### Electron 主进程 (`src/main/`)

- **main.ts**: 
  - 创建和管理 Electron 窗口
  - 处理窗口置顶、透明度等设置
  - 处理 IPC 通信

- **preload.ts**: 
  - 在渲染进程中暴露安全的 Electron API
  - 实现主进程和渲染进程之间的通信桥接

### React 渲染进程 (`src/renderer/`)

- **App.tsx**: 
  - 主应用组件
  - 管理任务状态
  - 处理任务 CRUD 操作
  - 管理窗口设置（置顶、透明度）

- **components/TodoInput.tsx**: 
  - 任务输入框
  - 支持回车键快速添加任务

- **components/TodoList.tsx**: 
  - 任务列表容器
  - 区分待完成和已完成任务

- **components/TodoItem.tsx**: 
  - 单个任务项
  - 支持完成/取消完成
  - 支持删除任务

- **components/WindowControls.tsx**: 
  - 窗口控制工具栏
  - 置顶/取消置顶
  - 透明度调整
  - 最小化/关闭

## 数据流

1. **任务数据**: 存储在 React 组件的 state 中，通过 `localStorage` 持久化
2. **窗口控制**: 通过 Electron IPC 在主进程和渲染进程之间通信
3. **窗口设置**: 透明度、置顶状态等通过 Electron API 实时应用

## 技术栈

- **Electron**: 桌面应用框架
- **React**: UI 框架
- **TypeScript**: 类型安全
- **Vite**: 构建工具和开发服务器
- **localStorage**: 数据持久化

