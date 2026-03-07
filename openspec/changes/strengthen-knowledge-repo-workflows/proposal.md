## Why

知识沉淀和仓库上下文是 OKK 的核心差异化能力，但当前从“选择仓库 -> 对话 -> 生成知识建议 -> 审核发布 -> 后续检索”的链路仍然割裂。整体架构要求 repo context 与 knowledge lifecycle 成为主工作流的一部分，因此需要单独 change 将这条链路收拢成可运营、可追溯的流程。

## What Changes

- 统一仓库上下文切换、最近范围恢复与会话/知识联动方式
- 让知识建议进入明确的审核、发布、忽略、回收和过时处理流程
- 为知识条目补齐来源追踪：仓库、文件、提交、会话、消息
- 改进知识检索和策展工作流，使其成为工作台的第一类任务而非附属页面

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `knowledge-engine`: 增强知识条目的溯源、生命周期和过时治理能力
- `repo-management`: 增强仓库上下文切换、最近范围恢复与工作台联动契约
- `web-frontend`: 增强仓库上下文可见性、知识建议审核与知识策展体验

## Impact

- `packages/core/src/knowledge*`
- `packages/core/src/repo*`
- `packages/web-backend/src/routes/*`
- `packages/web-frontend/src/pages/*`
- `packages/web-frontend/src/components/**/*`
- 知识检索、知识建议、仓库切换和过时治理相关测试
