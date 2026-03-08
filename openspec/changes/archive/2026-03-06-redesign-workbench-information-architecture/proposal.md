## Why

当前产品仍然更像“页面集合”而不是“统一工作台”：Chat、Knowledge、Skills、MCP、Team 之间的层级和切换关系不够稳定，右侧上下文区域也缺少清晰边界。若不先收敛信息架构，后续官网级视觉复刻、多能力编排和 Desktop 等价都会持续返工。

## What Changes

- 定义统一工作台信息架构：左侧导航、中间主任务舞台、右侧上下文面板
- 明确 `New chat / Search / Primary links / Chats` 的导航分层与路由语义
- 引入命令面板、专注模式、上下文侧栏切换与响应式抽屉规则
- 约束 Desktop 壳层与 Web 工作台在导航、快捷键和上下文恢复上的一致性

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `web-frontend`: 调整工作台信息层级、导航结构、上下文面板和专注模式行为
- `desktop-app`: 调整桌面壳层对工作台导航、快捷键和窗口恢复的承载方式

## Impact

- `packages/web-frontend/src/components/layout/*`
- `packages/web-frontend/src/App.tsx`
- `packages/web-frontend/src/pages/*`
- `packages/desktop/src/main/index.ts`
- `packages/desktop/src/preload/*`
- 工作台路由、布局状态、快捷键与响应式行为测试
