## Context

整体架构已经明确要求 Web 与 Desktop 共享核心业务逻辑，不能形成两套系统。当前桌面端的问题不在“是否能运行”，而在“是否足够可诊断、可恢复、可当主入口使用”。

## Goals / Non-Goals

**Goals:**
- 建立 Desktop 与 Web 的主流程等价基线
- 让 embedded backend、CLI 后端和 renderer 之间的故障可诊断、可恢复
- 明确哪些是共享 UI，哪些是桌面原生增强
- 将桌面打包和启动验证纳入稳定验收链路

**Non-Goals:**
- 不在本 change 中重构工作台的视觉系统
- 不扩展知识治理或 Skill 市场策略
- 不把桌面端做成独立于 Web 的专属产品线

## Decisions

1. Desktop parity 先覆盖主流程，再覆盖边缘增强；不追求一次覆盖所有细节。
2. embedded backend 必须提供 readiness/health/diagnostics 语义，供壳层和 UI 消费。
3. 任何导致空白页的失败都必须转为可见错误态，而不是静默失败。
4. 桌面原生能力只做“增强层”，不替换共享工作台逻辑。
5. 桌面打包成功不等于可交付，必须附带启动 smoke 和运行证据。

## Risks / Trade-offs

- readiness 和 diagnostics 引入后，前后端边界会更显式，初期改动面较大。
- 若 parity 范围定义过宽，会导致 change 迟迟无法收敛，因此需要先锁定主流程矩阵。
- 原生能力增强若直接侵入前端组件，长期会破坏 Web/Desktop 复用原则。
