## Why

当前左侧导航把 10 个入口平铺给用户，导致 Chat 主流程、身份记忆管理和次级工具之间没有明显主次，用户需要先理解导航结构，才能开始工作。对于“合伙人工作台”而言，这种信息密度是反向的：越早暴露全部工具，越晚让用户进入真正的主任务。需要把左栏从“功能目录”收敛成“主流程导航 + 次级工具折叠区”。

## What Changes

- 将左栏导航收敛为主导航 4 项：`Chats`、`Identity`、`Memory`、`Workspaces`
- 将 `Skills`、`MCP`、`Governance`、`Imports`、`Workflows`、`Sharing` 归入默认收起的次级工具区
- 为次级工具区提供显式展开/收起交互，并把折叠状态持久化到 `localStorage`
- 保持 `New chat` 与继续工作入口的高优先级，不让次级工具稀释主流程

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `web-frontend`: 收敛左栏导航层级，建立主任务优先、工具次级的可持久化导航结构

## Impact

- `packages/web-frontend/src/components/layout/LeftSidebar.tsx` — 重构导航分组与折叠交互
- `packages/web-frontend/src/styles.css` — 补齐导航层级、折叠区与持久化状态对应样式
- 左栏导航与本地持久化相关交互验证
