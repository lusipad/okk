## Why

CLI 后端是合伙人“执行”能力的核心基础设施，一旦这里出现解析脆弱、进程泄漏或异常恢复不完整，用户看到的就会是流式输出断裂、工具调用卡死和不可信的执行状态。当前 Claude CLI 与 Codex CLI 的事件模型和错误形态并不完全一致，如果继续靠零散兼容逻辑兜底，后续聊天体验、Trace、工作流等上层能力都会建立在不稳定地基之上。需要先把 CLI 后端的契约、生命周期和容错能力系统性加固。

## What Changes

- 建立统一事件模型：把 Claude CLI 与 Codex CLI 的输出归一化为一致的 `BackendEvent` 语义和状态转换规则
- 加强解析容错：对不完整 JSON、混合输出、异常行和协议漂移提供跳过、恢复和告警能力，避免单条异常拖垮整场会话
- 加强进程生命周期管理：补齐启动超时、执行超时、僵尸进程清理、异常退出检测和资源回收
- 建立重试与降级策略：对可恢复错误提供指数退避重试，对不可恢复错误返回结构化失败原因和修复建议
- 建立健康诊断与观测：统一暴露后端可用性、命令来源、失败类别和关键指标，支持后续前端与运维可见性

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `ai-backend-engine`: 统一事件模型、解析容错、进程生命周期、失败恢复和健康诊断契约

## Impact

- `packages/core/src/backend/cli-backend.ts` — 重构事件归一化、解析恢复和生命周期管理
- `packages/core/src/backend/backend-manager.ts` — 增加健康检查、超时控制和重试编排
- `packages/core/src/types.ts` 或对应类型目录 — 统一 `BackendEvent` 和错误类型定义
- `packages/core/test/` — 增加 CLI 解析容错、异常恢复和生命周期测试
- 与 CLI 后端相关的日志/诊断模块 — 补齐结构化失败原因和可观测字段
