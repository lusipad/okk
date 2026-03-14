_来源：拆分自 `knowledge-desktop-daily-usable`。本 change 只负责知识工作台与导航入口，不包含对话中的知识注入与建议卡编辑能力。_

## Why

Knowledge 的 Core 层、REST API、版本历史和治理能力已经存在，但前端没有稳定的主浏览/编辑入口，用户仍需在导入页、治理页和对话侧栏之间来回切换。若不先把知识工作台补齐，已有知识能力就无法成为日常主流程的一部分。

## What Changes

- 新建 `KnowledgePage`，提供搜索栏、分类/状态/标签筛选、知识列表、详情查看和编辑侧面板
- 在前端 IOProvider 中补齐知识 CRUD、搜索、版本历史和状态更新方法，对接既有 `/api/knowledge` REST 接口
- 新增 `/knowledge` 与 `/knowledge/:id` 路由，并支持从列表直达单条知识详情
- 将 Knowledge 从侧栏次级入口提升为一级导航，让知识管理成为工作台一等任务

## Capabilities

### New Capabilities

- `knowledge-workbench`: 定义知识主页面、搜索筛选、列表详情与编辑工作台能力

### Modified Capabilities

- `web-frontend`: 增加知识路由、导航入口和知识工作台页面装配

## Impact

- `packages/web-frontend/`：新增 KnowledgePage、路由、导航与相关前端组件
- `packages/web-frontend/src/io/`：补齐 knowledge CRUD / search / versions / status 的前端桥接接口
- 不修改 `packages/core/` 与 `packages/web-backend/` 的知识 API 语义
