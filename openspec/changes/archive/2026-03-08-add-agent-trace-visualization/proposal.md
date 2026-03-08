## Why

当前 Agent 执行链路对用户几乎是不可见的：用户只能看到最后一条回复，却看不到中间调用了哪些工具、为什么修改这些文件、在哪一步发生了失败或回退。缺少可视化 Trace 会同时削弱信任、复盘和调试效率，也让“赛博合伙人”难以体现出比纯文本助手更强的可审计性与协作透明度。现在补上这层能力，可以为后续的调试、回放、验收和团队审计提供统一事实底座。

## What Changes

- 建立统一 Trace 采集链路：从 CLI 事件流、后端编排和子 Agent 执行中提取结构化步骤、输入输出摘要、文件变更和状态切换
- 提供 Trace 浏览体验：在工作台中按时间线展示关键步骤，并支持查看工具调用详情、执行耗时和失败节点
- 提供文件变更可视化：把 Agent 修改过的文件与关键 diff 片段关联到对应步骤，帮助用户快速理解“为什么改、改了什么”
- 提供调用链和上下文关联：展示父子 Agent、工具嵌套调用和会话级事件关系，支持按步骤、文件和工具多维筛选
- 提供 Trace 持久化与回放：将 Trace 存入数据库，支持历史会话回看、问题复盘和后续治理能力复用

## Capabilities

### New Capabilities

- `agent-trace`: 定义 Trace 采集、持久化、时间线展示、diff 关联与历史回放能力

### Modified Capabilities

- `agent-system`: 为 Agent 执行过程增加可追踪的结构化步骤与父子关系
- `ai-backend-engine`: 输出稳定的执行事件、工具调用节点和文件修改元数据
- `data-layer`: 增加 Trace 存储模型、查询索引和历史会话关联
- `web-backend`: 暴露 Trace 查询、筛选和步骤明细接口
- `web-frontend`: 增加 Trace 时间线、调用链和 diff 查看界面

## Impact

- `packages/core/src/backend/` — 补齐 Trace 事件采集、归一化与编排出口
- `packages/core/src/agent/` 或对应 Agent 编排目录 — 输出父子 Agent 结构化步骤
- `packages/core/src/database/` — 新增 Trace DAO、迁移和查询索引
- `packages/web-backend/src/routes/` — 增加 Trace 查询与详情 API
- `packages/web-frontend/src/components/` — 新增时间线、调用链和 diff 组件
- `packages/web-frontend/src/pages/ChatPage.tsx` — 集成 Trace 面板与历史回看入口
