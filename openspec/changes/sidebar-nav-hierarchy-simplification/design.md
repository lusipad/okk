## Context

当前左侧导航把 Chats、Workspaces、MCP、Governance、Imports、Workflows、Identity、Memory、Sharing、Skills 平铺展示，信息密度与主任务优先级不匹配。用户还没开始工作，就先被大量工具入口包围；而 New chat、继续工作和会话历史之间也缺少稳定层级。

这个 change 需要在不改动底层路由语义的前提下，把左栏收敛为主导航与次级工具区两层，让用户先看见主任务入口，再按需展开其他能力。

## Goals / Non-Goals

**Goals:**
- 将左栏默认可见导航收敛为 Chats、Identity、Memory、Workspaces 四个主入口
- 将 Skills、MCP、Governance、Imports、Workflows、Sharing 收纳到默认收起的更多工具区
- 持久化更多工具区的展开状态，保证刷新后层级一致
- 保持 New chat、继续工作和 Chats 历史区的可发现性

**Non-Goals:**
- 不修改任何页面路由或菜单目标地址
- 不引入新的图标库、命令面板逻辑或全局布局框架
- 不在本 change 中重构会话列表的数据来源与分组算法
- 不把更多工具区扩展成多级嵌套导航

## Decisions

1. 左栏采用静态分组而非动态配置，主导航和更多工具区由同一个导航定义生成，减少重复渲染逻辑。
2. 更多工具区默认收起，并通过 localStorage 持久化其展开状态，保证用户刷新或重新进入后层级保持稳定。
3. New chat 和 continue 入口始终位于导航分组之前，确保主流程动作不被次级工具稀释。
4. 该 change 只收敛展示层级，不改变底层路由和页面职责，降低实现风险。
5. 如果本地存储不可用或读取失败，系统回退到默认收起状态，保持行为可预测。

## Risks / Trade-offs

- [导航重排影响老用户肌肉记忆] -> 保持原有路由不变，只改变分组与默认可见层级。
- [折叠状态实现分散] -> 统一使用单一 localStorage key 管理更多工具区状态。
- [更多工具隐藏过深] -> 在左栏提供明确的展开按钮与区块标题，确保用户按需可发现。

## Migration Plan

- 先重构 LeftSidebar 内的导航分组定义，明确主导航和更多工具区。
- 再加入折叠交互与 localStorage 持久化。
- 最后调整样式与验收用例，验证默认态、展开态与刷新恢复行为。

## Open Questions

- 当前无阻塞性开放问题；如后续需要团队级自定义导航排序，再通过独立 change 处理。

