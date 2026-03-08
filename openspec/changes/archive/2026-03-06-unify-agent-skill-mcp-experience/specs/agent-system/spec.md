## ADDED Requirements

### Requirement: Agent 与 Team 运行状态显式化
系统 SHALL 为 Agent 与 Team 提供统一且可追踪的运行状态，使用户能够区分排队、运行、完成和失败。

#### Scenario: Team 运行状态流转
- **WHEN** 用户发起 Team 协作任务
- **THEN** 系统 SHALL 为该次运行分配稳定的 run id
- **AND** SHALL 按 `queued / running / completed / failed / aborted` 暴露状态变化

#### Scenario: 长时运行可中断
- **WHEN** Agent 或 Team 运行时间较长且用户选择停止
- **THEN** 系统 SHALL 提供明确的停止动作
- **AND** 停止结果 SHALL 反映到最终状态与诊断信息中
