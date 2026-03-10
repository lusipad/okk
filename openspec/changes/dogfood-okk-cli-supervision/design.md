## Context

当前我们已经开始通过 CLI 骨架接入 `@okk/core`，但还停留在“命令能跑”的阶段。要让 OKK 真正成为开发自己的主工具，需要一个可持续、低摩擦、能反映赛博同事和团队协作状态的 CLI 工作台视图。

## Goals / Non-Goals

**Goals:**
- 提供可日常使用的 CLI 首页与任务视图
- 支持 Direct Run / Team Run 的默认编排
- 支持查看任务整体进度与待确认
- 提供稳定的 Windows 启动入口

**Non-Goals:**
- 不在本 change 中实现完整 TUI
- 不在本 change 中新增 API backend
- 不在本 change 中替代 Web/Desktop 的所有能力

## Decisions

1. CLI 第一阶段直接复用 `@okk/core`，不单独引入新的 daemon。
2. `mission` 第一阶段映射到现有 `session`，先保证 dog-fooding 跑通。
3. `run team` 默认模板固定包含三类角色：
   - `coordinator`
   - `builder`
   - `reviewer`
4. `checkpoint` 第一阶段允许由现有状态派生，而不是等完整持久化完成后再暴露。
5. Windows 启动使用 `cmd + ps1` 双入口，不要求用户手动处理执行策略与路径解析。

## Risks / Trade-offs

- [Mission 仍映射到 Session] → 先接受语义不完全收敛，后续再切换到 Mission 编排层
- [CLI 输出缺少结构化机器接口] → 后续补 `--json`
- [backend 可用性影响 dog-fooding 体验] → 先让 CLI 能显式显示 runtime 健康和 Team Run 失败原因

## Migration Plan

1. 先完成 CLI MVP 与 Windows 启动器
2. 再补团队视图、任务进度与 checkpoint
3. 后续对接 Mission 编排层时平滑迁移命令语义

## Open Questions

- 是否需要在下一阶段引入 `dogfood start "<goal>"` 这样的高阶入口
- 是否要为 CLI 增加日志重放或半结构化交互视图
