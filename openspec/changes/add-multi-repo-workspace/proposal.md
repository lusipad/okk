## Why

真实工程工作经常横跨多个仓库：前端、后端、SDK、脚本仓、文档仓往往需要联动理解和同时修改。当前 OKK 以单仓库为中心组织会话和上下文，用户一旦切换项目就容易丢失历史选择、仓库关系和跨仓库记忆，导致多项目任务只能靠人工补全背景。需要引入 workspace 级抽象，把“多个仓库组成一个工作空间”升级为正式的一等能力。

## What Changes

- 建立多仓库 workspace 模型：允许用户把多个仓库组织到一个工作空间下，并维护名称、描述、默认仓库和活跃仓库
- 建立 workspace 级上下文：支持在同一会话中携带多个仓库的背景信息、已发布知识和关联记忆，减少频繁切换造成的上下文丢失
- 支持仓库切换与附加目录协作：在工作台里快速切换当前主仓库，并在需要时将其他仓库作为附加上下文参与任务执行
- 支持跨仓库检索与导航：对 workspace 内代码、知识和会话进行统一搜索，并能跳转回具体仓库和文件位置
- 持久化 workspace 配置：保存用户的仓库分组、默认排序、最近活跃范围和常用组合，支持继续上次工作

## Capabilities

### New Capabilities

- `workspace-management`: 定义 workspace 的建模、仓库归属、上下文组装、跨仓库检索与持久化管理能力

### Modified Capabilities

- `repo-management`: 增加仓库归属 workspace、活跃仓库切换和附加目录协同契约
- `knowledge-engine`: 支持 workspace 级知识检索、聚合与来源展示
- `data-layer`: 增加 workspace 实体、仓库关联关系和最近活跃上下文记录
- `web-backend`: 暴露 workspace CRUD、切换和跨仓库查询 API
- `web-frontend`: 增加 workspace 切换器、多仓库导航和跨仓库搜索体验

## Impact

- `packages/core/src/context/` — 新增 workspace 级上下文构建和多仓库注入逻辑
- `packages/core/src/database/` — 新增 workspace DAO、关联表和迁移
- `packages/core/src/repo/` 或对应目录 — 扩展仓库切换与附加目录组装能力
- `packages/web-backend/src/routes/` — 增加 workspace 管理和跨仓库搜索接口
- `packages/web-frontend/src/components/layout/` — 增加 workspace 切换器与多仓库导航
- `packages/web-frontend/src/pages/` — 增加 workspace 视图与跨仓库搜索结果页
