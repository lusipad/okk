## Why

用户在不同项目中的工作方式往往并不相同：有的仓库偏向快速原型，有的仓库强调严格测试和发布流程，还有的仓库依赖特定 Agent、Skill 和约定。当前 RepositoryContextService 主要读取 `CLAUDE.md` 和知识摘要，无法持续记住用户在某个仓库里的偏好、最近操作和常见模式，导致“继续上次工作”只能依赖用户重复说明。需要把项目级上下文持久化为正式能力，让合伙人在进入仓库时就带着正确背景开始协作。

## What Changes

- 建立仓库级偏好模型：记录默认 Agent、常用 Skill、偏好的工作模式和关键项目约定
- 建立工作模式识别：从会话和执行记录中归纳用户在该仓库中的常见任务模式，如调试、重构、评审和发布
- 建立上下文自动注入：在新会话开始时根据仓库自动加载项目偏好、最近范围和相关历史操作
- 建立最近操作记忆：保存最近一次任务的关键步骤、结果和待续事项，支持“继续上次工作”
- 建立用户可见的项目上下文入口：让用户可以查看、修正或清理仓库级偏好和工作模式

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `repo-management`: 增加仓库级偏好、最近操作、工作模式和继续工作契约
- `data-layer`: 扩展仓库偏好字段并新增项目活动日志与上下文快照模型
- `ai-backend-engine`: 在请求构建阶段注入项目偏好、最近范围和续作上下文
- `web-frontend`: 增加项目上下文可视化、编辑和“继续上次工作”入口

## Impact

- `packages/core/src/context/repository-context-service.ts` — 扩展偏好加载、续作上下文和注入逻辑
- `packages/core/src/database/dao/repositories-dao.ts` — 扩展仓库偏好、活动日志和上下文快照读写
- `packages/core/src/database/migrations.ts` — 增加偏好字段和活动日志迁移
- `packages/core/src/backend/cli-backend.ts` — 注入项目上下文并记录关键操作回写
- `packages/web-frontend/src/pages/` — 增加项目上下文查看与续作入口
- `packages/web-frontend/src/components/` — 增加仓库偏好设置和最近任务摘要组件
