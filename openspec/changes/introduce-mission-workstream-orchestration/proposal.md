## Why

当前系统已经有 `Session`、`Team Run`、`TeamEvent`、`Workflow` 等能力，但缺少一个统一、产品可理解的任务编排对象层。没有 `Mission / Workstream / Checkpoint / Handoff`，就很难把“多个赛博同事并行推进任务、等待确认、交接与合并结果”稳定地表达给用户，也难以支撑 CLI、Web 和未来 API backend 的统一行为。

## What Changes

- 新增 `Mission / Workstream / Checkpoint / Handoff / Mission Summary` 对象模型
- 将 Team Run 明确收敛为 Mission Room 的一次运行实例，而不是产品层主对象
- 为首页和任务页提供结构化团队整体进度视图
- 为后端、前端和数据层建立统一的编排状态与事件表达

## Capabilities

### New Capabilities

- `mission-orchestration`: 定义 Mission、Workstream、Checkpoint、Handoff 与 Mission Summary 的对象模型和生命周期

### Modified Capabilities

- `agent-system`: 将 Team Run 映射到 Mission 编排语义
- `data-layer`: 持久化 Mission 编排对象及其状态
- `web-backend`: 暴露 Mission 编排状态与运行事件
- `web-frontend`: 消费并展示 Mission 编排、团队进度与待确认项

## Impact

- `packages/core/src/create-core.ts`
- `packages/core/src/team/*`
- `packages/core/src/database/*`
- `packages/web-backend/src/routes/*`
- `packages/web-frontend/src/pages/*`
- `packages/web-frontend/src/components/*`
- CLI / Web / Desktop 对 Mission 与 Team Run 的统一表达
