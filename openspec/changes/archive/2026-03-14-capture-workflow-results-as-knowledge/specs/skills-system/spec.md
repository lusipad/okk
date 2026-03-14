## ADDED Requirements

### Requirement: Skills 系统支持知识沉淀模板元数据
系统 SHALL 在工作流模板和运行结果中支持知识沉淀相关的默认映射信息。

#### Scenario: 返回知识沉淀模板
- **WHEN** 客户端查询工作流模板列表
- **THEN** Skills 系统 SHALL 返回包含默认知识分类、标签或保存模式的模板元数据
- **AND** 客户端 SHALL 能据此初始化保存为知识界面

#### Scenario: 运行完成后暴露发布线索
- **WHEN** 工作流使用知识沉淀模板执行完成
- **THEN** Skills 系统 SHALL 在运行结果中保留与知识发布相关的模板上下文
- **AND** 不得要求前端重新推断模板行为
