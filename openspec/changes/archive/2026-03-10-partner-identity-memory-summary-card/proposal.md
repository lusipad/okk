## Why

首页不仅要告诉用户“你可以开始聊了”，还要立即证明“这个合伙人认识你”。当前身份信息、近期记忆和当前工作仓库分散在不同页面与数据流里，用户回到 Chat 时无法第一眼感知系统已经记住了自己，也不知道这些记忆是否真的会参与工作。需要把这些已有数据聚合成一个可感知、可降级的首页摘要卡片。

## What Changes

- 在 core 层新增合伙人摘要聚合方法，复用现有 identity、memory、repository DAO 组装首页所需数据
- 在 Web 后端新增 `GET /api/partner/summary`，为首页提供单次请求的摘要载荷
- 在前端 IO 层补齐摘要读取方法，并在 `PartnerHomeView` 中渲染身份名称、摘要、近期记忆和活跃仓库信息
- 对缺失数据和加载失败提供 graceful degradation，不新增数据库表、后台任务或新的持久化模型

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `web-frontend`: 在首页展示身份与记忆联动摘要，并处理加载、空数据与降级态
- `web-backend`: 提供合伙人摘要聚合接口，复用既有身份、记忆和仓库数据源输出统一载荷

## Impact

- `packages/core/src/create-core.ts` — 新增合伙人摘要聚合逻辑
- `packages/web-backend/src/routes/*` — 暴露 `GET /api/partner/summary`
- `packages/web-frontend/src/io/types.ts` — 扩展首页摘要读取能力
- `packages/web-frontend/src/components/home/PartnerHomeView.tsx` — 渲染摘要卡片与降级状态
