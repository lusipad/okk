# OKK

OKK 是你的赛博合伙人。

默认在本地工作，也能远程协作与共享。

## 环境

- Node.js 22+

## 快速开始

```bash
npm install
npm run test
npm run build
```

启动：

```bash
npm run dev -w @okk/web-backend
npm run dev -w @okk/web-frontend
```

桌面端：

```bash
npm run dev -w @okk/desktop
```

## 发布

```bash
npm run release:prepare
```

发布产物位于 `release/`。`npm run package:win -w @okk/desktop` 会在 `packages/desktop/release/win-unpacked/` 生成原始 Windows 桌面产物；GitHub Actions 会额外生成 `OKK-Desktop-windows-x64-<ref>.zip`、对应 `.sha256.txt` 校验文件，以及同名 release notes Markdown。手动触发 `workflow_dispatch` 时只上传 artifact；推送 `v*` tag 时还会自动创建 GitHub Release 并挂载这三份文件。

## 当前已落地能力

- CLI 后端加固：统一事件模型、启动/执行超时、重试与结构化诊断
- 聊天恢复体验：断线重连、resume 语义、会话级运行状态与长消息折叠
- 项目上下文持久化：仓库偏好、最近活动、继续上次工作
- 会话历史治理：搜索、归档/恢复、历史片段引用
- Skill 生命周期升级：启用/禁用、依赖异常诊断、状态持久化
- Agent Trace：时间线、失败节点、文件变更与 diff 查看
- 知识治理：健康度、冲突检测、审核、合并与回滚
- 多仓库工作区：工作区切换、跨仓库搜索、活跃仓库恢复
- 跨来源知识导入：预览、去重、确认、批次回放
- Skill Workflow：模板库、编排执行、分支恢复与运行历史
- Memory Sharing：审核流转、团队推荐、发布与回滚

## 架构文档

- 产品与架构基线：`docs/product-architecture-baseline.md`
- 感知、记忆与协作架构：`docs/perception-memory-architecture.md`
- 项目整体架构总览：`docs/overall-architecture.md`
- 高级工作台与治理能力：`docs/operational-workbenches.md`

## 运维手册

- 部署手册：`docs/intranet-deployment-runbook.md`
- 故障恢复手册：`docs/failure-recovery-runbook.md`

