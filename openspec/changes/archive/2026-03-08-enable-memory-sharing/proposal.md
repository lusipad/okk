## Why

从 Personal Mode 走向 Collaboration Mode，核心不是把聊天窗口共享出去，而是让有价值的记忆和知识能够在团队中安全流动。当前记忆与知识默认是单用户视角，既无法支撑团队协作，也没有审核和权限边界来控制敏感信息传播。若要让 OKK 从“个人助手”进化成“团队合伙人”，就必须先把共享、审核和可见性模型正式化。

## What Changes

- 建立记忆与知识可见性分级：支持 `private`、`workspace`、`shared` 等层级，并明确默认策略与切换规则
- 建立共享前审核流程：共享内容进入审核队列，由具备权限的成员确认、驳回或退回修改，降低敏感信息泄露风险
- 建立团队级推荐与复用：当成员处理相似任务时，优先推荐已经被审核通过的共享记忆和知识
- 建立团队知识仪表板：展示团队记忆积累、知识覆盖、贡献来源和待审核事项，便于持续运营
- **BREAKING** 调整底层数据模型：为记忆与知识增加可见性、审核状态和审批记录等字段

## Capabilities

### New Capabilities

- `memory-sharing`: 定义记忆共享、审核、权限边界、团队推荐和运营看板能力

### Modified Capabilities

- `memory-system`: 增加可见性、审核状态、共享流转和团队检索约束
- `knowledge-engine`: 增加团队级推荐、共享过滤和审核通过知识复用能力
- `data-layer`: **BREAKING** 扩展记忆与知识表结构，增加可见性、审核和审批记录模型
- `web-backend`: 增加共享、审核、权限校验和团队治理 API
- `web-frontend`: 增加共享设置、审核队列和团队知识仪表板界面

## Impact

- `packages/core/src/memory/` — 扩展共享过滤、审核流转和团队检索逻辑
- `packages/core/src/knowledge/` — 扩展共享知识推荐和审核通过内容聚合能力
- `packages/core/src/database/` — 调整表结构、迁移与审批记录持久化
- `packages/web-backend/src/routes/` — 增加共享、审核、权限校验和团队概览接口
- `packages/web-frontend/src/pages/` — 新增团队知识仪表板与审核工作台
- 认证与授权相关实现 — 需要从当前简化模型升级到可支撑多用户权限判断的基础设施
