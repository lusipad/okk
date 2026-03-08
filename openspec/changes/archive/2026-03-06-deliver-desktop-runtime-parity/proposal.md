## Why

Desktop 端是整体架构里的关键交付形态，但它当前仍存在空白页、启动失败难诊断、与 Web 能力不完全等价等问题。若没有单独的 parity change，桌面端将持续沦为“能打包但不可作为主产品体验”的次级入口。

## What Changes

- 定义 Desktop 与 Web 的能力等价基线，覆盖登录、对话、Skills、MCP、Team、Knowledge 等主流程
- 强化 embedded backend 启动、健康检查、错误诊断和恢复路径
- 收敛 Desktop 的原生能力（托盘、搜索、拖拽、文件选择）与共享工作台之间的边界
- 补齐 Desktop 专属的 smoke、打包与可运行性验收

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `desktop-app`: 增强桌面壳层的启动诊断、原生能力承载与 Web 等价契约
- `web-backend`: 增强 embedded backend 的健康检查与结构化诊断输出
- `ai-backend-engine`: 增强桌面本地运行时对 CLI、路径和依赖的前置校验

## Impact

- `packages/desktop/src/main/*`
- `packages/desktop/src/preload/*`
- `packages/web-backend/src/*`
- `packages/core/src/backend/*`
- Desktop smoke E2E、打包验证、启动日志与错误恢复文档
