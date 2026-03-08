# OKK

OKK 是你的赛博合伙人（Cyber Partner）。

它不是单纯的聊天壳，也不是一次性调用的大模型工具，而是一个围绕 **身份、记忆、上下文、执行、协作、治理与交付** 持续工作的本地优先工程工作台。

## 仓库状态

- 产品定位：本地优先的工程研发赛博合伙人
- 当前形态：`Web 工作台 + Desktop 壳层 + Core 执行内核 + OpenSpec 规格体系`
- 运行模式：默认本地工作，可扩展远程协作与共享
- OpenSpec 状态：当前活动 change 已清空，已完成 change 已归档

## 已落地能力

### 对话与执行

- 真实 CLI backend 接入：支持 Codex / Claude Code 子进程执行
- 流式事件归一化：统一 ask / follow_up / abort / resume 事件语义
- 运行时诊断：超时、重试、stderr、退出码、结构化错误反馈
- 聊天恢复体验：断线重连、resume 失败反馈、会话级运行状态提示

### 工作台与协作

- 三栏工作台与视觉系统：主舞台、左侧导航、右侧协作上下文面板
- Team Run 协作：多 Agent 团队执行、事件流、运行态可见化
- Agent Trace：时间线、失败节点、文件变更与 diff 查看
- Identity Kernel：身份配置、激活、提示词注入

### 上下文与记忆

- 仓库上下文持久化：偏好 Agent / Backend / Skill / MCP、最近活动、继续上次工作
- 会话历史治理：搜索、归档、恢复、引用历史片段
- 长期记忆：Memory CRUD、仓库级同步、访问日志
- 记忆共享：可见性分级、审核、发布、回滚、团队推荐

### 知识与治理

- 知识建议保存/忽略链路
- Knowledge CRUD、版本历史、状态流转、FTS 搜索
- Knowledge Governance：健康度、过时检测、冲突发现、审核、合并、回滚
- Cross-Agent Imports：多来源预览、证据保留、去重确认、批次回放

### Skills / MCP / Workflow

- Skill 生命周期：导入、安装、启停、删除、诊断、风险扫描
- Skill 市场：列表、搜索、安装与回滚
- MCP 配置：增删改、启停、工具调用、资源读取
- Skill Workflow：模板库、工作流 CRUD、执行、失败恢复、历史回放

### 多仓库与桌面交付

- Multi-Repo Workspace：工作区 CRUD、活跃仓库切换、跨仓库搜索
- Desktop parity：embedded backend、readiness / diagnostics、fallback 页面、runtime state
- Windows 打包：`electron-builder` 目录产物、发布前 smoke 与 release 准备脚本
- 质量门禁：关键测试、桌面 smoke、像素对比与发布治理脚本

## 包结构

### `packages/core`

核心领域与执行内核：

- CLI backend 管理
- SQLite / migration / DAO
- sessions / messages / knowledge / memory / identity / trace
- workspace / imports / workflows / sharing 等高级能力

### `packages/web-backend`

Fastify API 与 WebSocket 网关：

- 认证
- REST routes
- Q&A gateway
- Team gateway
- 工作台能力聚合接口

### `packages/web-frontend`

React + Vite 工作台前端：

- Chat / Skills / MCP / Identity / Memory
- Governance / Workspaces / Imports / Workflows / Memory Sharing
- 协作侧栏、Trace 面板、会话历史与上下文交互

### `packages/desktop`

Electron 桌面壳层：

- embedded backend 启动
- runtime monitor / runtime fallback page
- preload bridge / IPC
- 打包、启动诊断与桌面 smoke

## 快速开始

### 环境要求

- Node.js `22+`
- Windows 桌面打包场景下建议使用 PowerShell 7+

### 安装

```bash
npm install
```

### Web 开发

```bash
npm run dev -w @okk/web-backend
npm run dev -w @okk/web-frontend
```

### Desktop 开发

```bash
npm run dev -w @okk/desktop
```

### 全量测试

```bash
npm run test
```

### 全量构建

```bash
npm run build
```

### Windows 打包

```bash
npm run package:win -w @okk/desktop
```

### 发布准备

```bash
npm run release:prepare
```

## 推荐验证命令

### 核心层

```bash
npm run build -w @okk/core
npm test -w @okk/core
```

### 后端

```bash
npm run build -w @okk/web-backend
npm test -w @okk/web-backend -- "src/app.test.ts"
```

### 前端

```bash
npm run build -w @okk/web-frontend
npm test -w @okk/web-frontend
```

### 桌面端

```bash
npm test -w @okk/desktop
npm run build -w @okk/desktop
npm run smoke -w @okk/desktop
```

## 文档导航

### 核心文档

- 产品与架构基线：`docs/product-architecture-baseline.md`
- 总体架构：`docs/overall-architecture.md`
- 感知、记忆与协作架构：`docs/perception-memory-architecture.md`
- 仓库功能清单：`docs/repository-capability-inventory.md`
- 整理后路线图：`docs/cyber-partner-roadmap.md`

### 能力专题

- Identity Kernel：`docs/identity-kernel.md`
- Long-term Memory：`docs/long-term-memory.md`
- Knowledge Repo Workflows：`docs/knowledge-repo-workflows.md`
- Skill System Upgrade：`docs/skill-system-upgrade.md`
- Skill Marketplace：`docs/skill-marketplace.md`
- Project Context Persistence：`docs/project-context-persistence.md`
- Session Search & Archive：`docs/session-search-archive.md`
- Workbench Visual System：`docs/workbench-visual-system.md`
- Advanced Workbenches：`docs/operational-workbenches.md`
- Desktop Parity Matrix：`docs/desktop-parity-matrix.md`

### 运维与交付

- 部署手册：`docs/intranet-deployment-runbook.md`
- 故障恢复手册：`docs/failure-recovery-runbook.md`
- 交付治理：`docs/delivery-governance.md`
- 聊天体验验收：`docs/chat-experience-acceptance.md`
- 协作运行时验收：`docs/collaboration-runtime-acceptance.md`

## GitHub Actions

当前仓库提供两类 GitHub Actions：

- 通用 CI：`.github/workflows/ci.yml`
  - Linux 下全仓测试与构建
  - Windows 下桌面端测试与构建
- Windows 打包发布：`.github/workflows/desktop-windows-package.yml`
  - 手动触发或 `v*` tag 触发
  - 执行桌面打包、packaged smoke、checksum 和 release artifact 上传
  - 打 tag 时自动发布 GitHub Release

OpenSpec 校验不放入主 CI，避免规格流程阻塞代码构建。建议在以下场景手工执行：

- 提交新的 proposal / design / spec / tasks
- 准备归档某个 change
- 调整主规格文档

如果你要排查 CI，优先看：

- `npm run test`
- `npm run build`
- `npm run build -w @okk/desktop`

## 当前建议的下一阶段重点

当前活动 change 已归档完成，下一阶段建议聚焦：

1. **Partner 体验收敛**
   - 将“赛博合伙人”体验从功能集合收敛成稳定主流程
   - 强化首页、空态、继续工作、身份与记忆联动

2. **远程协作与共享产品化**
   - 将 Memory Sharing / Governance / Imports 从“能力可用”推进到“协作流程完整”
   - 补全团队视角权限模型与治理策略

3. **工作流与自动化交付深化**
   - 将 Workflow 从模板执行推进到真实可复用自动化资产
   - 强化分支控制、校验门禁、执行结果沉淀

4. **桌面产品级交付**
   - 强化安装、升级、运行时恢复与用户可见诊断
   - 完成更多 packaged smoke / release 验证闭环

## 说明

- 本仓库以 OpenSpec 驱动需求、设计、规格与任务演进
- 当前已完成的 change 已进入 `openspec/changes/archive/`
- 如需开启新能力，请先创建新的 OpenSpec change，再进入实现
