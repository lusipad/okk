## ADDED Requirements

### Requirement: Skill 工作流Agent 编排扩展
系统 SHALL 在 Agent 编排与协作链路中支持Agent 在工作流上下文中执行、交接和汇总结果，保持步骤、角色或父子关系的一致性。

#### Scenario: 执行主题任务
- **WHEN** Agent 执行与Skill 工作流相关的任务链路
- **THEN** 系统 SHALL 输出与主题相关的结构化步骤或状态
- **AND** 父子 Agent 之间 SHALL 能共享必要上下文

#### Scenario: 回看主题过程
- **WHEN** 用户回看 Agent 历史过程或步骤关系
- **THEN** 系统 SHALL 能根据主题维度还原关键节点
- **AND** 回看结果 SHALL 能支撑调试、审计或继续执行
