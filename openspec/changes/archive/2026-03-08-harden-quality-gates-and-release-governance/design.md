## Context

项目现在已经具备大量脚本和 workflow，但它们更像“可用工具集合”，还不是一套严格的交付治理体系。整体架构已经把门禁、发布和回滚定义为硬约束，因此需要把这些能力正式规格化。

## Goals / Non-Goals

**Goals:**
- 让交付门禁成为显式 capability，而不是散落脚本约定
- 统一定义 Web / Desktop 的发布产物与验收证据
- 让 release notes、checksum、job summary、rollback 指南变成标准产物
- 让 OpenSpec change 与交付结果可以追溯

**Non-Goals:**
- 不在本 change 中重写业务页面交互
- 不扩大 Agent / Skill / Knowledge 的功能范围
- 不引入新的部署平台或云原生基础设施

## Decisions

1. 交付治理使用单独 capability 承载，避免把发布要求挤进任意业务 spec。
2. 质量门禁必须有明确的执行顺序和失败快返行为。
3. Desktop 与 Web 共享“发布必须带证据”的原则，但具体证据类型不同。
4. 发布文案和发布附件复用同一份 release notes，避免多份事实来源。
5. 回滚指南和故障恢复信息属于交付产物的一部分，而不是发布后的补充说明。

## Risks / Trade-offs

- 门禁越严格，短期交付速度越容易下降，需要通过自动化来抵消摩擦。
- 若 change 与现有 workflow 绑定过死，后续 CI 调整会造成额外维护成本。
- 如果 OpenSpec change 与 release 产物不做映射，规范仍可能流于形式。
