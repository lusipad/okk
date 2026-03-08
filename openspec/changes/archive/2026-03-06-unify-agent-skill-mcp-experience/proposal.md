## Why

当前 Agent、Skill、MCP、后端工具虽然多数已经存在，但用户在对话过程中看不到统一心智模型：哪些能力可用、当前到底是谁在执行、失败发生在哪一层、如何恢复，都不够清晰。整体架构要求这些能力进入统一协作与诊断体系，因此需要独立 change 收敛运行时体验和事件契约。

## What Changes

- 统一 Agent / Skill / MCP / Backend Tool 的运行时状态模型和展示语义
- 定义跨 REST / WebSocket 的协作事件契约、运行标识和失败诊断字段
- 在工作台中提供统一协作侧栏、步骤时间线和能力状态入口
- 明确能力可用性、执行证据、失败恢复与重试的用户路径

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `agent-system`: 增强 Agent/Team 运行状态、控制动作和事件可见性
- `ai-backend-engine`: 增强后端能力探测、失败原因和可恢复性契约
- `skills-system`: 增强 Skill/MCP 运行时状态、执行证据和能力可见性
- `web-backend`: 统一协作事件与运行诊断接口的输出契约
- `web-frontend`: 增加统一协作侧栏、步骤时间线与能力状态交互

## Impact

- `packages/core/src/agent*`
- `packages/core/src/backend*`
- `packages/web-backend/src/ws/*`
- `packages/web-backend/src/routes/*`
- `packages/web-frontend/src/components/**/*`
- 运行事件 schema、诊断面板和协作相关 E2E/集成测试
