## ADDED Requirements

### Requirement: 工作流编辑器支持知识输入节点配置
系统 SHALL 在工作流编辑界面中提供 `knowledge_ref` 节点的创建、编辑和预览能力。

#### Scenario: 创建知识输入节点
- **WHEN** 用户在工作流编辑器中选择添加知识输入节点
- **THEN** 前端 SHALL 提供用于录入 `entryIds`、筛选条件和 `outputKey` 的配置入口
- **AND** 节点预览 SHALL 明确显示该节点为知识输入类型

#### Scenario: 预览知识输入节点配置
- **WHEN** 用户查看已保存的 `knowledge_ref` 节点
- **THEN** 前端 SHALL 展示节点的引用方式、筛选条件和输出键
- **AND** 用户 SHALL 能在不直接手改 JSON 的情况下理解节点行为

### Requirement: 工作流运行详情展示知识输入结果
系统 SHALL 在运行详情中展示知识输入节点的命中结果和执行状态。

#### Scenario: 查看知识节点运行结果
- **WHEN** 用户打开包含 `knowledge_ref` 节点的运行详情
- **THEN** 前端 SHALL 展示该节点的执行状态、命中条目数量和条目摘要
- **AND** 节点失败时 SHALL 展示结构化错误信息
