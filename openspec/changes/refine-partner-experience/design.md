## Context

Phase 1 的目标是把已有能力收敛成稳定的合伙人主流程，而不是继续横向堆功能。当前 ChatPage 在零消息场景只显示一行空态文案，Identity、Memory、Project Context 和 recent sessions 这些已经存在的数据没有被组织成清晰入口，用户登录后更像落入空白工作台，而不是进入一个已经理解自己上下文的合伙人首页。

当前 change 聚焦于首页空态升级：在不新增 API、不引入独立 home 路由、不重构全局状态的前提下，把现有前端状态组装成一个上下文感知的 PartnerHomeView，并把空态渲染职责从 MessageList 收敛回 ChatPage。

## Goals / Non-Goals

**Goals:**
- 将零消息会话渲染为结构化的合伙人首页，而不是单行 emptyHint
- 复用现有 sessions、projectContext、capabilitySnapshot 和 active identity 数据驱动首页
- 在首页中提供问候、最近会话、继续工作和快速操作等主流程入口
- 让最近会话切换与快捷动作都发生在 Chat 主舞台内，避免额外页面跳转

**Non-Goals:**
- 不新增独立的 /home 路由或新的页面级导航结构
- 不为首页引入新的后端接口或全局状态框架
- 不在本 change 中重新定义继续工作 fallback 策略或身份记忆聚合接口
- 不重构与首页空态无关的聊天流式状态机

## Decisions

1. ChatPage 持有零消息态的最终分支判断，MessageList 不再负责首页空态。这样可以把首页视图与现有聊天状态放在同一层决策，避免两个组件同时维护空态逻辑。
2. PartnerHomeView 设计为纯展示组件，由 ChatPage 传入已经整理好的 view model 与回调，避免把会话切换、项目上下文和能力状态重新散落到多个子组件里。
3. 首页只展示最近 3 条会话，优先服务回流和继续工作，不把它扩展成完整会话管理页，保持 KISS。
4. 继续工作区在本 change 中只承接现有 projectContext 和 continue 动作，不在首页内部重新实现新的 continue 推断逻辑；更复杂的 fallback 留给后续 change。
5. 快速操作卡片只复用当前已存在的能力与 Composer 注入方式，不增加新的执行协议或专门接口。

## Risks / Trade-offs

- [首页信息过密] -> 将首页严格收敛为问候、最近会话、继续工作、快速操作四个区块，不引入第二套导航。
- [ChatPage props 与状态映射变复杂] -> 通过集中构造 PartnerHomeView 的 view model，避免子组件各自读取全局状态。
- [旧空态逻辑残留] -> 移除 MessageList 的简单 emptyHint 依赖，确保零消息场景只有一条渲染链路。

## Migration Plan

- 先新增 PartnerHomeView，并在不影响消息列表场景的前提下接入 ChatPage 的零消息分支。
- 再迁移最近会话、继续工作和快速操作入口，确保全部复用现有回调与状态。
- 最后移除 MessageList 的旧空态职责，并执行零消息态与已有消息态切换验证。

## Open Questions

- 当前无阻塞性开放问题；若实现阶段发现首页区块需要进一步拆分，再在不改变 capability 边界的前提下微调组件结构。

