# 小金助手 (King Helper) - 桌面固定待办清单

一个始终可见的桌面待办事项管理工具，帮助您更好地管理任务。

## 🚀 快速下载使用

如果您只想直接运行程序，而不需要修改代码，可以：
1. 前往本仓库的 [Releases](https://github.com/wuyuanxin313/king-helper-official/releases) 页面。
2. 下载最新的 `.exe` 安装包。
3. 双击安装即可使用。

## 功能特性

### V1.0 MVP 功能
- ✅ **桌面固定清单** - 可固定在桌面最前端，始终可见
- ✅ **基础任务管理** - 创建、完成、删除任务
- ✅ **窗口控制** - 置顶/取消置顶、调整透明度、最小化、关闭
- ✅ **本地存储** - 任务数据自动保存到本地

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **React** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具

## 开发环境设置

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

这将同时启动：
- Vite 开发服务器（React 应用）
- Electron 应用

### 构建

```bash
# 构建 React 应用
npm run build:react

# 构建 Electron 主进程
npm run build:electron

# 完整构建（包括打包）
npm run build
```

## 使用说明

1. **创建任务**：在输入框中输入任务内容，按回车键添加
2. **完成任务**：点击任务前的复选框
3. **删除任务**：点击任务右侧的 × 按钮
4. **置顶窗口**：点击顶部工具栏的 📌 按钮
5. **调整透明度**：使用顶部工具栏的透明度滑块
6. **最小化/关闭**：使用顶部工具栏的相应按钮

## 项目结构

```
├── src/
│   ├── main/           # Electron 主进程
│   │   ├── main.ts     # 主进程入口
│   │   └── preload.ts  # 预加载脚本
│   └── renderer/       # React 渲染进程
│       ├── components/ # React 组件
│       ├── types/      # TypeScript 类型定义
│       ├── App.tsx     # 主应用组件
│       └── main.tsx    # React 入口
├── package.json
└── README.md
```

## 未来计划

### V2.0 增强体验
- 语音转文字创建任务
- AI 智能解析任务（自动提取截止时间、优先级等）

### V3.0 成熟形态
- 账号体系
- 多端数据同步（桌面端 + 移动端）

## 许可证

MIT

