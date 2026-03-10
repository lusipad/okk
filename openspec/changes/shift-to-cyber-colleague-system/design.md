## Context

仓库已经在文档中把产品定义为“赛博合伙人 / Cyber Partner”，但当前实现与概念图仍然经常回到“AI Chat 首页 + 聊天页 + 工具面板”的默认模板。这导致：

- 首页像空白聊天页，而不是“继续工作 / 调度同事”的入口
- 任务页像消息流，而不是“任务执行与协作线程”
- 多同事协作被理解成多 Agent 实现，而不是用户可理解的产品能力

当前 change 的目标不是马上重写所有页面，而是先把主产品语义收敛成后续一切实现的共同约束。

## Goals / Non-Goals

**Goals:**
- 明确 `Partner Home` 是默认入口
- 明确 `Direct Thread` 与 `Mission Room` 是两种主任务视图
- 明确“赛博同事系统”而非“聊天工具”是产品基线
- 为后续 Mission / Workstream / CLI / API backend 的设计提供稳定语义边界

**Non-Goals:**
- 不在本 change 中完成所有页面的最终视觉定稿
- 不在本 change 中定义数据层表结构
- 不在本 change 中实现 API backend

## Decisions

1. 默认入口使用 `Partner Home`，而不是空白聊天页。
   原因：用户首先需要感知“谁在线、有哪些任务、哪些结果等我确认”，而不是先面对输入框。

2. “私聊 / 群聊”仅作为用户理解产品的隐喻，不直接成为最终界面命名。
   最终统一为：
   - `Direct Thread`
   - `Mission Room`

3. 多同事协作是产品层能力，不是 Team Run 的内部实现细节。
   Team Run 可以作为实现载体，但在产品层应被表达为“多个同事围绕一个 Mission 协作”。

4. Skills / MCP / Memory / Governance / Workflows 属于能力中心，不应抢占默认首页主舞台。

## Risks / Trade-offs

- [已有聊天心智过强] → 通过文档、Figma 与 CLI 同步改名，避免只在某一层局部收敛
- [与现有小型前端 change 重叠] → 把本 change 定义为产品语义收敛层，具体 UI 细节继续由细粒度 change 分阶段落地
- [Team Run 与产品语义错位] → 在后续 Mission 编排 change 中补齐对象层映射

## Migration Plan

1. 先更新产品基线文档与总体架构语义
2. 再更新 Figma 概念图与 CLI 输出语义
3. 后续页面实现优先围绕 `Partner Home / Direct Thread / Mission Room` 继续拆分

## Open Change Audit

以下当前开放 change 在后续实现中应统一遵循“赛博同事系统”语言，不再退回“AI Chat 产品”语义：

- `auto-next-step-suggestions`
- `chat-stage-info-density`
- `partner-identity-memory-summary-card`
- `refine-continue-work-entry`
- `refine-partner-experience`
- `sidebar-nav-hierarchy-simplification`
- `topbar-context-breadcrumb`
- `introduce-mission-workstream-orchestration`
- `dogfood-okk-cli-supervision`

## Open Questions

- `Partner` 与 `Agent` 在最终产品中的外显差异应如何保持最小心智负担
- `Mission Room` 是否需要额外的“简洁模式 / 专家模式”切换
