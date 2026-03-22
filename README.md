# 小金助手（King Helper）

一个基于 Electron + React + Vite 的个人任务管理工具，支持提醒、悬浮清单、AI 语义拆解、以及可爱的“小金”IP 状态交互。

## 下载

- Windows 安装包：请到 GitHub 仓库的 Releases 页面下载最新版本（`.exe`）。

## 功能

- 任务管理：新增/编辑/完成/删除
- 类型支持：deadline / scheduled / reminder
- 提醒系统：到期/临近/日程提醒（含系统通知与应用内提示）
- 悬浮清单：可置顶的小窗（Pinned Todo）
- AI 智能排程：将自然语言拆解为结构化任务（通过主进程 IPC 代理请求，避免 CORS）
- IP 形象：右下角小金助手根据状态切换不同形态，并支持悬停/点击/双击交互
- 数据备份：设置页支持导入/导出 JSON（多设备手动同步）

## 技术栈

- Electron
- React 18
- Vite 5
- TypeScript
- Tailwind CSS

## 开发

安装依赖：

```bash
npm install
```

启动开发模式（Vite + Electron）：

```bash
npm run dev
```

## 打包（Windows 安装包）

执行：

```bash
npm run build
```

会做这些事：

- 从 `public/ip-pictures/default.png` 生成应用图标 `build/icon.ico` 和 `public/favicon.ico`
- 构建渲染进程到 `dist-renderer/`
- 构建主进程到 `dist-electron/`
- 通过 electron-builder 输出安装包到 `dist-release2/`

安装包路径：

- `dist-release2/小金助手 Setup 1.0.0.exe`

## 发布安装包（GitHub Releases）

本仓库已配置 GitHub Actions：推送 tag（例如 `v1.0.0`）后会自动构建 Windows 安装包并上传到 Releases。

```bash
git tag v1.0.0
git push origin v1.0.0
```

## AI 配置（API Key）

应用内：打开「设置」→ 填写「火山引擎 API Key」。

获取方式（参考路径）：

> 登录火山引擎控制台 → 方舟(Ark)/大模型 → API Key 管理 → 创建并复制

提示：

- API Key 不是接入点 ID（形如 `ep-xxx` 的是接入点 ID）

## IP 资源

IP 图片位于：

- `public/ip-pictures/`
  - `default.png`
  - `reminder.png`
  - `urgent.png`
  - `completed.png`
  - `idle.png`

## 数据存储与备份

- 默认数据存储在本机（localStorage）
- 设置页提供：
  - 导出 JSON：生成 `king-helper-tasks-YYYYMMDD-HHmm.json`
  - 导入 JSON：覆盖当前数据，并自动在本机留存一份备份

## 常见问题

### 打包后白屏

打包使用 `file://` 加载页面，资源必须使用相对路径。本项目已配置 `vite base = './'`，并将渲染产物输出到 `dist-renderer/`。

### Windows 图标缓存

如果安装后任务栏图标仍显示为旧图标：

- 取消任务栏固定 → 重新打开并固定
- 删除旧快捷方式 → 重新创建
- 重新安装覆盖旧版本

## 许可

未指定。
