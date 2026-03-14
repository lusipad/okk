## ADDED Requirements

### Requirement: 知识引擎接收工作流结果发布
系统 SHALL 支持将工作流运行结果映射为知识条目，并保留来源工作流、运行记录和发布模式元数据。

#### Scenario: 保存工作流结果为知识
- **WHEN** 工作流发布接口提交一个有效的运行结果知识负载
- **THEN** 知识引擎 SHALL 创建新的知识条目
- **AND** 条目 `metadata` SHALL 包含 `workflowId`、`runId` 与发布模式信息

#### Scenario: 追溯工作流来源
- **WHEN** 用户查看由工作流生成的知识条目
- **THEN** 知识引擎 SHALL 返回该条目的工作流来源元数据
- **AND** 后续治理与检索 SHALL 能继续使用这些元数据
