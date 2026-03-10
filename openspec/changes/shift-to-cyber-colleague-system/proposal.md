## Why

当前产品叙事、默认入口和页面组织仍然容易被理解为“AI Chat 工作台”，这会持续把设计和实现拉回消息流与工具面板中心，而不是“你的赛博同事 / 赛博同事团队”这一长期协作对象。需要先在 OpenSpec 层明确主叙事与主路径，把后续界面、CLI 和编排都收拢到同一产品语言下。

## What Changes

- 将主产品叙事从“聊天工具 / AI Chat”收敛为“赛博同事系统 / Cyber Colleague System”
- 将默认工作路径明确为 `Partner Home -> Direct Thread / Mission Room -> Capability Centers`
- 明确“私聊 / 群聊”只是用户心智入口，最终界面语义应统一为 `Direct Thread / Mission Room`
- 把多个同事协同推进任务定义为一等产品能力，而不是 Team Run 的实现细节

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `agent-system`: 将 Partner、Direct Thread、Mission Room 和多同事协作定义为主产品对象与协作模式
- `web-frontend`: 将默认入口、任务页与团队协作表达从聊天导向调整为赛博同事导向

## Impact

- `docs/product-architecture-baseline.md`
- `docs/overall-architecture.md`
- `packages/web-frontend/src/pages/ChatPage.tsx`
- `packages/web-frontend/src/components/home/PartnerHomeView.tsx`
- `packages/web-frontend/src/components/layout/*`
- Figma 概念页与后续工作台信息架构
