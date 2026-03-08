## Why

Phase 1 最紧迫的问题不是继续横向铺能力，而是让用户一进入 Chat 就感知到“合伙人认识我、记得我、知道我在做什么”。当前 `ChatPage` 在无消息时只有一行 `emptyHint`，Identity、Memory、Project Context 等已有能力完全隐身，用户登录后更像落入空白工作台，而不是进入一个有上下文的合伙人主流程。需要先把空态升级成稳定的首页入口，承接后续摘要卡、继续工作和下一步建议。

## What Changes

- 将 `ChatPage` 的无消息态从单行文案升级为结构化 `PartnerHomeView`
- 在首页展示合伙人问候、最近 3 条会话、继续工作入口和快速操作卡片
- 复用现有 `sessions`、`projectContext`、`capabilitySnapshot` 等状态，不新增 API 或全局状态管理
- 将空态渲染职责收敛到 `ChatPage`，移除 `MessageList` 中的简单空态提示，避免双重逻辑

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `web-frontend`: 将聊天空态升级为上下文感知的合伙人首页，建立用户进入 Chat 后的主流程入口

## Impact

- `packages/web-frontend/src/pages/ChatPage.tsx` — 切换空态分支并承载首页入口数据
- `packages/web-frontend/src/components/home/PartnerHomeView.tsx` — 新增首页视图组件
- `packages/web-frontend/src/components/chat/MessageList.tsx` — 移除简单空态文案
- 首页空态布局、会话入口和快速操作相关样式与交互验证
