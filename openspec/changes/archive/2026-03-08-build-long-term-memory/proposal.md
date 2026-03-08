## Why

长期记忆决定了赛博合伙人能否真正表现出“持续理解用户和项目”的能力。当前系统只有相对静态的 Knowledge CRUD，缺少对用户偏好、项目事实、关系线索、过程经验和关键事件的结构化记忆建模，也缺少自动提取、检索和注入机制，导致每轮对话都要重新建立上下文。需要先把长期记忆从概念提升为正式系统能力，后续共享、治理和身份能力才有稳定基础。

## What Changes

- 建立分类型记忆模型：明确偏好记忆、项目记忆、关系记忆、过程记忆和事件记忆的结构、生命周期和置信度
- 建立自动积累链路：从对话、执行步骤和用户反馈中提取可复用事实，并进行分类、去重和更新
- 建立记忆检索与注入策略：在新会话或关键步骤开始时，根据仓库、任务和用户上下文检索相关记忆并注入后端请求
- 建立记忆同步与互通：支持与 `CLAUDE.md` 等外部记忆形态双向同步，避免信息孤岛
- 建立衰减、刷新和人工管理机制：根据时效性、访问频率和用户确认对记忆进行刷新、降权或删除

## Capabilities

### New Capabilities

- `memory-system`: 定义长期记忆的建模、提取、检索、注入、衰减和人工治理能力

### Modified Capabilities

- `ai-backend-engine`: 支持请求阶段的记忆检索、注入和命中反馈
- `knowledge-engine`: 支持 Knowledge 与 Memory 的关联、互转和协同检索
- `data-layer`: 增加记忆实体、访问日志、置信度与生命周期元数据
- `web-backend`: 暴露记忆查询、确认、编辑和同步接口
- `web-frontend`: 增加记忆查看、筛选、确认和人工修正界面

## Impact

- `packages/core/src/memory/` — 新增记忆分类、提取、检索和衰减模块
- `packages/core/src/backend/cli-backend.ts` — 集成记忆注入与命中反馈
- `packages/core/src/database/` — 新增 memory DAO、访问日志与迁移
- `packages/web-backend/src/routes/` — 增加记忆查询、编辑和同步相关 API
- `packages/web-frontend/src/pages/` — 新增长期记忆管理页面
- `packages/web-frontend/src/components/` — 增加记忆条目、命中来源和确认交互组件
