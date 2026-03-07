## Why

会话历史是赛博合伙人最直接、最容易被忽略的长期资产。当前会话列表主要依赖时间排序，缺少搜索、归档和引用能力，导致过去的讨论、结论和排障过程很快沉没，用户不得不反复描述同一背景。把会话从“用完即走的聊天记录”升级为“可搜索、可沉淀、可复用的工作档案”，是提升长期使用价值的必要一步。

## What Changes

- 建立会话全文检索：对标题、消息正文和会话摘要建立检索索引，支持关键字搜索、命中高亮和结果排序
- 建立归档与恢复机制：支持用户主动归档不活跃会话，并在需要时恢复，保持主列表聚焦当前工作
- 建立标签和筛选能力：为会话增加标签、状态和筛选条件，方便按主题或阶段组织历史内容
- 建立跨会话引用：在当前会话中引用历史对话片段、摘要或结论，减少重复描述和上下文搬运
- 建立摘要辅助检索：在会话结束或空闲时生成摘要，提升搜索召回质量和归档后的可读性

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `data-layer`: 为会话与消息增加检索索引、归档状态、标签和摘要字段
- `web-backend`: 增加会话搜索、归档、恢复和引用片段查询 API
- `web-frontend`: 增加搜索框、归档视图、标签筛选和引用交互

## Impact

- `packages/core/src/database/dao/sessions-dao.ts` — 扩展搜索、归档、标签和摘要查询能力
- `packages/core/src/database/dao/messages-dao.ts` — 增加消息检索和引用片段定位支持
- `packages/core/src/database/migrations.ts` — 新增 FTS、归档和标签相关迁移
- `packages/web-backend/src/routes/sessions.ts` — 增加搜索、归档与引用 API
- `packages/web-frontend/src/components/layout/LeftSidebar.tsx` — 集成搜索、归档和筛选入口
- `packages/web-frontend/src/pages/ChatPage.tsx` — 支持插入历史片段与展示引用来源
