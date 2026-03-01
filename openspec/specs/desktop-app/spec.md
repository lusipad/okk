# desktop-app Specification

## Purpose
TBD - created by archiving change okclaw-architecture. Update Purpose after archive.
## Requirements
### Requirement: Electron 应用壳
系统 SHALL 提供 Electron 36 桌面应用，使用 electron-vite 构建，包含 Main 进程、Preload 脚本和 Renderer 进程。

#### Scenario: 应用启动
- **WHEN** 用户启动桌面应用
- **THEN** 系统 SHALL 创建 BrowserWindow 加载 React 前端
- **AND** Main 进程 SHALL 初始化 core 包的所有服务（engine、knowledge、repo、db）

### Requirement: IPC 桥接层
系统 SHALL 通过 Electron IPC channels 桥接 Renderer 和 Main 进程，Main 进程调用 core 包的服务。

#### Scenario: IPC 调用 AI 后端
- **WHEN** Renderer 通过 IPC 发送 Q&A 请求
- **THEN** Main 进程 SHALL 调用 core/engine 的 BackendManager
- **AND** 通过 IPC 将 BackendEvent 流推送回 Renderer

### Requirement: 复用 Web 前端组件
系统 SHALL 复用 packages/web/client 的 React 组件，通过 IOProvider 适配 IPC 通信。

#### Scenario: 组件复用
- **WHEN** Desktop Renderer 导入 web/client 的 ChatInput 组件
- **THEN** 组件 SHALL 通过注入的 IPC IOProvider 正常工作
- **AND** 无需修改组件源码

### Requirement: 系统托盘
系统 SHALL 支持最小化到系统托盘，后台运行 Agent Team 和知识过时检测。

#### Scenario: 最小化到托盘
- **WHEN** 用户关闭窗口
- **THEN** 应用 SHALL 最小化到系统托盘而非退出
- **AND** 托盘图标 SHALL 显示运行状态

#### Scenario: 托盘通知
- **WHEN** 后台检测到知识条目过时
- **THEN** 系统 SHALL 通过系统通知提醒用户

### Requirement: 全局快捷键搜索
系统 SHALL 支持全局快捷键（Ctrl+Shift+K）唤起搜索框，搜索知识库、会话历史和仓库。

#### Scenario: 快捷键搜索
- **WHEN** 用户按下 Ctrl+Shift+K
- **THEN** 系统 SHALL 显示全局搜索框
- **AND** 搜索范围 SHALL 包括知识条目、会话标题、仓库名称

### Requirement: 文件拖拽
系统 SHALL 支持将文件或文件夹拖拽到窗口，自动识别为代码仓库或待分析文件。

#### Scenario: 拖拽文件夹
- **WHEN** 用户将一个包含 .git 目录的文件夹拖入窗口
- **THEN** 系统 SHALL 提示用户是否注册为新仓库

#### Scenario: 拖拽代码文件
- **WHEN** 用户将代码文件拖入窗口
- **THEN** 系统 SHALL 将文件内容作为 Q&A 上下文附加到当前对话

### Requirement: 本地仓库自动发现
系统 SHALL 支持扫描常用开发目录，自动发现并建议注册本地 Git 仓库。

#### Scenario: 自动发现
- **WHEN** 用户首次启动应用或手动触发扫描
- **THEN** 系统 SHALL 扫描常用目录（~/Projects、~/repos、~/code 等）
- **AND** 列出发现的 Git 仓库供用户选择注册

