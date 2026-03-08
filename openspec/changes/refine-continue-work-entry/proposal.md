## Why

“继续上次工作”应该是老用户回流后的第一入口，但当前入口位置靠后，而且过度依赖已有仓库上下文，导致很多有历史会话的用户仍然只能面对一个空白开始。继续工作能力如果不能在没有 `repoId` 的情况下给出可执行的回流摘要，就会削弱 OKK 作为长期合伙人的连续性体验。需要把继续工作从“附属按钮”提升为明确主流程。

## What Changes

- 放宽继续工作摘要生成条件：当缺少仓库上下文时，改为从最近会话提炼 fallback 摘要
- 将“继续上次工作”提升为首页核心卡片，并在 `LeftSidebar` 中与 `New chat` 同级呈现
- 在首页和侧栏统一展示上次会话标题、摘要和继续动作，降低用户回流决策成本
- 保持现有 session / project context 数据流，不引入新的恢复流程或独立状态容器

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `web-frontend`: 将继续工作提升为首页和侧栏的一等入口，并统一其展示与交互语义
- `web-backend`: 调整继续工作摘要生成逻辑，使无仓库上下文时仍能返回可继续的提示内容

## Impact

- `packages/core/src/create-core.ts` — 扩展继续工作 prompt 与 summary 的 fallback 逻辑
- `packages/web-frontend/src/pages/ChatPage.tsx` — 调整 continueProjectContext 的触发与展示数据
- `packages/web-frontend/src/components/layout/LeftSidebar.tsx` — 提升继续工作入口层级
- `packages/web-frontend/src/components/home/PartnerHomeView.tsx` — 首页渲染继续工作核心卡片
