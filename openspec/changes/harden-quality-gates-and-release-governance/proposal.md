## Why

整体架构把“规格 -> 实现 -> 验证 -> 发布”定义为硬约束，但当前质量门禁、发布产物、回滚说明和验收证据仍散落在脚本、CI 和文档里。若不把它们提升为独立 change 与 capability，后续功能完成度仍会停留在“能跑”而不是“可发布”。

## What Changes

- 新增交付治理 capability，定义从测试、构建、smoke、pixel 到打包、release 的强制门禁链路
- 明确发布产物、checksum、release notes、job summary 和回滚信息的交付要求
- 将 Web 与 Desktop 的验收证据纳入统一治理，而不是依赖人工口头确认
- 建立 OpenSpec change、CI 结果和发布产物之间的可追溯关系

## Capabilities

### New Capabilities
- `delivery-governance`: 定义质量门禁、发布产物、回滚与可追溯性要求

### Modified Capabilities
- `web-frontend`: 将像素验收与参考差异纳入正式交付门禁
- `desktop-app`: 将桌面打包、启动验证和交付证据纳入正式发布契约

## Impact

- `.github/workflows/*`
- `scripts/pixel-*`
- `scripts/smoke-*`
- `scripts/prepare-release.mjs`
- `docs/*runbook.md`
- `release/` 与 `packages/desktop/release/` 产物管理策略
