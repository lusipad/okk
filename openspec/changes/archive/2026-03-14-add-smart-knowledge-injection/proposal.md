_来源：拆分自 `knowledge-powered-ai-context`，并吸收 `knowledge-desktop-daily-usable` 中与 `KnowledgeSuggestionCard` 编辑相关的部分。_

## Why

当前 RepositoryContextService 只按固定数量拼接知识摘要，无法根据用户当前问题挑选真正相关的知识条目，既浪费 token，也无法让用户理解 AI 回答背后参考了哪些知识。与此同时，知识建议卡仍是“直接保存或忽略”的弱交互，无法在保存前纠正标题、内容和标签，降低了知识提取质量。

## What Changes

- 将固定 top-N 知识摘要替换为基于用户问题的 FTS5 检索与分层注入，区分背景知识与问题相关知识
- 在 QA Gateway 中记录本次对话实际使用的知识条目，并更新 `view_count`
- 在 Chat UI 中展示“本次对话使用了哪些知识”，让用户看到引用来源
- 增强 `KnowledgeSuggestionCard`，支持保存前编辑标题、内容、标签，并在保存后跳转到对应知识条目

## Capabilities

### New Capabilities

- `smart-knowledge-injection`: 定义基于查询的知识匹配、分层注入、使用统计和引用可见性

### Modified Capabilities

- `knowledge-engine`: 上下文构建从固定摘要切换到查询相关检索与注入
- `ai-backend-engine`: QA Gateway 集成知识查询、引用回传与使用计数更新
- `web-frontend`: 聊天引用展示与知识建议卡编辑交互升级

## Impact

- `packages/core/`：重构 RepositoryContextService 的知识选择与注入摘要生成逻辑
- `packages/web-backend/`：在 QA Gateway 中串联知识检索、引用记录和 `view_count` 更新
- `packages/web-frontend/`：为 Chat 与 KnowledgeSuggestionCard 增加编辑、引用可见性和跳转交互
