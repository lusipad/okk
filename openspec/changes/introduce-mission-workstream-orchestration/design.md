## Context

我们已经确认产品方向是“赛博同事系统”，并且支持多个同事协作。但当前实现仍主要围绕：

- `Session`
- `Message`
- `Team Run`
- `Workflow`

这些对象更偏“实现与运行时”，而不是“用户真正拥有和理解的任务对象”。为了让首页、任务页、CLI、未来 API backend 都围绕同一组对象工作，需要引入一层稳定的任务编排模型。

## Goals / Non-Goals

**Goals:**
- 定义 `Mission / Workstream / Checkpoint / Handoff`
- 让 Team Run 成为 Mission 编排的运行实例
- 提供结构化团队进度与待确认表达
- 为 CLI/Web/Desktop 提供统一的任务对象语义

**Non-Goals:**
- 不在本 change 中完成所有视图定稿
- 不在本 change 中引入远程多用户权限模型
- 不在本 change 中实现 API backend

## Decisions

1. `Mission` 是产品层主任务对象，`Session` 是其交互表面。
   原因：用户关心的是任务推进，而不是消息本身。

2. `Workstream` 是最小可并行执行单元。
   原因：团队整体进度应统计“子任务状态”，而不是消息数或在线人数。

3. `Checkpoint` 单独建模。
   原因：等待用户确认不应混在普通消息语义中，否则难以汇总和提醒。

4. `Handoff` 单独建模。
   原因：合作不是“大家都发言”，而是“谁把什么交给了谁继续处理”。

5. 第一阶段允许 `Mission` 与现有 `Session` 同步映射。
   原因：先平滑接入现有系统，避免一次性推翻会话与 Team Run。

## Risks / Trade-offs

- [对象层与现有 Session 重叠] → 先允许映射共存，逐步把 Session 降为交互表面
- [数据迁移复杂] → 先引入最小字段与投影视图，再逐步补充历史回填
- [前端信息密度过高] → 首页与任务页只展示对用户最关键的编排信息

## Migration Plan

1. 在 core 与 data-layer 中引入 Mission 编排模型
2. 让 Team Run 读写 Mission 相关状态
3. 在 web-backend 暴露 Mission 查询与运行接口
4. 在 CLI 与前端中逐步切换到 Mission 视图

## Open Questions

- Mission 与 Workflow 的边界是否需要在后续进一步拆分为“临时任务”与“可复用流程模板”
- Handoff 是否需要支持 artifact 附件与结构化审查结论
