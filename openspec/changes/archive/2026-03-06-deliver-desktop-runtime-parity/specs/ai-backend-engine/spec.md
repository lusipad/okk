## ADDED Requirements

### Requirement: 桌面本地运行时前置检查
AI 后端执行引擎 SHALL 在桌面本地运行时提供 CLI、路径和依赖的前置检查，避免在会话中途才暴露环境问题。

#### Scenario: 会话前校验 CLI 可用性
- **WHEN** 用户在 Desktop 中准备发起对话
- **THEN** 系统 SHALL 检查所选 CLI 后端是否可用
- **AND** 若不可用 SHALL 返回具体缺失项与修复建议

#### Scenario: 本地路径或权限异常
- **WHEN** 桌面本地运行所需路径、配置或权限异常
- **THEN** 系统 SHALL 在会话开始前返回结构化错误
- **AND** 不得等到流式执行中才模糊失败
