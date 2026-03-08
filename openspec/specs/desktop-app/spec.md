# desktop-app Specification

## Purpose
TBD - created by archiving change okk-architecture. Update Purpose after archive.
## Requirements
### Requirement: Electron 应用壳
系统 SHALL 提供 Electron 36 桌面应用，使用 electron-vite 构建，包含 Main 进程、Preload 脚本和 Renderer 进程。

#### Scenario: 应用启动
- **WHEN** 用户启动桌面应用
- **THEN** 系统 SHALL 创建 BrowserWindow 加载 React 前端
- **AND** Main 进程 SHALL 初始化 core 包的所有服务（engine、knowledge、repo、db）

### Requirement: Windows 桌面版自动打包
系统 SHALL 提供 GitHub Actions 流水线，自动产出可直接运行的 Windows 桌面版安装产物。

#### Scenario: 手动触发或版本标签触发打包
- **WHEN** 研发在 GitHub Actions 手动触发桌面打包工作流，或推送 `v*` 标签
- **THEN** 系统 SHALL 执行 `@okk/desktop` 的测试与 Windows 打包流程
- **AND** SHALL 产出 `win-unpacked/OKK.exe` 与分发 zip 包作为构建产物

### Requirement: 桌面内置后端服务
系统 SHALL 在桌面应用启动时自动拉起本地后端服务，避免依赖外部手动启动 `web-backend`。

#### Scenario: 桌面启动自动可用
- **WHEN** 用户直接启动 Windows 桌面版 `OKK.exe`
- **THEN** 系统 SHALL 在主进程启动本地 API/WS 服务并注入前端运行时配置
- **AND** 用户输入消息后 SHALL 可直接获得回复，无需额外启动 `http://127.0.0.1:3000`

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

### Requirement: 桌面工作台壳层一致性
Desktop 壳层 SHALL 复用与 Web 一致的工作台信息架构，保证导航、快捷键和窗口恢复行为可预测。

#### Scenario: 全局入口回到同一工作台
- **WHEN** 用户通过桌面托盘、全局快捷键或搜索窗打开应用
- **THEN** 系统 SHALL 回到当前工作台上下文，而不是打开一套独立页面流
- **AND** 保留最近访问的主舞台页面与侧栏状态

#### Scenario: 桌面端命令面板一致
- **WHEN** 用户在 Desktop 中触发命令面板
- **THEN** 系统 SHALL 提供与 Web 相同的工作台跳转与模式切换能力
- **AND** 快捷键和执行结果 SHALL 与 Web 保持一致

### Requirement: Desktop 主流程等价与启动诊断
Desktop 应用 SHALL 对主流程提供与 Web 一致的可用性，并在启动失败时返回结构化诊断信息。

#### Scenario: 启动失败可诊断
- **WHEN** embedded backend、预载桥接或渲染主入口启动失败
- **THEN** 系统 SHALL 展示可见错误态
- **AND** 提供失败层级、原因摘要和建议恢复动作

#### Scenario: 主流程等价
- **WHEN** 用户在 Desktop 中执行登录、对话、Skills、MCP、Knowledge 或 Team 主流程
- **THEN** 系统 SHALL 与 Web 端保持相同的业务语义和结果
- **AND** 桌面增强能力不得破坏共享工作台交互

### Requirement: 桌面原生增强接入共享工作台
Desktop 应用 SHALL 将托盘、全局搜索、拖拽和文件选择等原生能力接入共享工作台，而不是形成独立流程。

#### Scenario: 全局搜索回到当前工作台
- **WHEN** 用户通过全局搜索或托盘入口唤起应用
- **THEN** 系统 SHALL 回到当前工作台上下文
- **AND** 将搜索或文件输入注入现有工作流，而不是跳转到独立功能页

