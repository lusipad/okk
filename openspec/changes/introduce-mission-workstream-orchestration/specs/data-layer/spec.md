## ADDED Requirements

### Requirement: 持久化 Mission 编排对象
数据层 SHALL 持久化 Mission、Workstream、Checkpoint 和 Handoff 对象。

#### Scenario: 保存任务编排状态
- **WHEN** Mission 编排状态发生变化
- **THEN** 数据层 SHALL 保存相关对象与更新时间
- **AND** 后续查询 SHALL 能恢复完整任务编排视图
