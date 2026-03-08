## Why

聊天是用户感知 OKK 能力的第一触点，稳定性和细节质量直接决定“这个合伙人靠不靠谱”。当前聊天链路在流式状态管理、工具调用展示、错误恢复和长消息处理上仍然存在明显摩擦，导致即使底层能力已经具备，用户也会因为体验断裂而怀疑系统可靠性。Phase 1.5 需要先把聊天体验从“能用”提升到“可信、顺手、可恢复”。

## What Changes

- 加固流式会话状态机：处理 WebSocket 断连重连、事件丢失恢复、背压控制和消息顺序一致性
- 重构工具调用呈现：以更清晰的卡片展示工具名称、输入输出摘要、状态、耗时和可展开详情
- 建立错误恢复与重试：为超时、CLI 异常、恢复失败和用户中止提供明确状态与重试动作
- 优化消息渲染：提升 Markdown、代码块、高亮、长消息分段加载和空态反馈体验
- 建立会话级中断与恢复能力：允许用户在执行中中止当前链路，并在需要时继续同一上下文

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `web-frontend`: 升级聊天状态管理、消息渲染、工具调用卡片和错误恢复体验
- `web-backend`: 加固 WebSocket 网关的重连、事件重放和幂等处理
- `ai-backend-engine`: 增加 CLI 异常恢复、超时控制和中断/恢复配合能力

## Impact

- `packages/web-frontend/src/state/chat-store.tsx` — 重构聊天状态机与恢复状态
- `packages/web-frontend/src/pages/ChatPage.tsx` — 优化消息流渲染和交互反馈
- `packages/web-frontend/src/components/chat/` — 重构工具调用卡片、错误提示和长消息组件
- `packages/web-backend/src/ws/qa-gateway.ts` — 加强事件缓存、重连恢复和异常处理
- `packages/core/src/backend/cli-backend.ts` — 补齐超时、中止与恢复协同逻辑
