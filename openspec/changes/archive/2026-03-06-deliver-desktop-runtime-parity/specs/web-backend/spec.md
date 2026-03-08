## ADDED Requirements

### Requirement: Embedded Backend 健康检查与诊断输出
Web 后端 SHALL 在 embedded desktop 模式下提供健康检查、readiness 和结构化诊断输出，供桌面壳层使用。

#### Scenario: 启动完成前 readiness 查询
- **WHEN** Desktop 壳层等待 embedded backend 就绪
- **THEN** 系统 SHALL 提供 readiness 状态与未完成项摘要
- **AND** 避免 renderer 在后端未就绪时直接进入空白页

#### Scenario: 后端异常诊断
- **WHEN** embedded backend 启动或运行异常
- **THEN** 系统 SHALL 返回结构化诊断信息
- **AND** 包含失败层级、原因摘要和建议恢复动作
