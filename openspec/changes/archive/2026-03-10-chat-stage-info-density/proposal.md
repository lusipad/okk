## Why

Chat 主舞台已经承载了主要工作流，但当前头部缺少足够的轻量元信息，用户需要依赖侧栏或上下文切换才能知道当前会话规模、启用了多少能力、正在以什么配置工作。这不是功能缺失，而是信息密度不足：关键状态存在，但没有在用户最常看的区域以低噪音方式呈现。需要在不打断阅读流的前提下补齐这一层即时反馈。

## What Changes

- 在 `chat-stage-header` 中增加轻量 meta 信息，如消息数、活跃 Skills 数、活跃 MCP 数等
- 所有统计均从现有会话与能力状态中派生，不新增 API、轮询或持久化逻辑
- 保持头部视觉克制，让元信息服务于扫读而不是抢占聊天内容层级
- 统一元信息语义，确保首页空态和已有会话态之间的数据表达一致

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `web-frontend`: 提升聊天主舞台头部的信息密度，让用户可快速感知当前会话规模与启用能力

## Impact

- `packages/web-frontend/src/pages/ChatPage.tsx` — 扩展主舞台头部元信息展示
- 聊天主舞台头部样式与信息派生逻辑验证
