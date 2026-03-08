## Why

当一轮回答结束后，用户经常需要停下来思考“下一句该怎么问”，这会让对话流在关键时刻重新变成空白输入框。Phase 1 需要先用低成本、可控的方式把“下一步”显式化，让用户更容易沿着当前上下文继续推进，而不是马上引入额外的 LLM 推理链路。规则驱动的建议按钮足以覆盖 V1 需求，并避免新一轮模型成本和不确定性。

## What Changes

- 新增 `NextStepSuggestions` 组件，在聊天主舞台中展示 2-3 个规则驱动的下一步建议
- 基于最后一条消息内容和当前会话上下文推断建议，不发起额外 LLM 调用
- 点击建议按钮时只把建议注入 Composer，由用户决定是否发送
- 保持建议系统可扩展，但 V1 仅实现当前明确需要的规则集

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `web-frontend`: 在会话主流程中提供规则驱动的下一步建议，降低对话续写摩擦

## Impact

- `packages/web-frontend/src/components/chat/NextStepSuggestions.tsx` — 新增建议组件
- `packages/web-frontend/src/pages/ChatPage.tsx` — 接入建议生成与注入 Composer 的交互
- 建议规则、展示状态与点击注入相关验证
