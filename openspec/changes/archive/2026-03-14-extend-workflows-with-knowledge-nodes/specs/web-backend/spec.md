## ADDED Requirements

### Requirement: 工作流 API 校验知识引用节点
系统 SHALL 在工作流创建、更新和运行接口中校验 `knowledge_ref` 节点配置，拒绝缺失关键字段或无效筛选条件的请求。

#### Scenario: 创建包含无效知识节点的工作流
- **WHEN** 客户端提交的 `knowledge_ref` 节点缺少 `outputKey`，或同时缺少 `entryIds` 与 `filters`
- **THEN** 工作流 API SHALL 返回校验失败
- **AND** 响应中 SHALL 指出具体的节点和字段错误

#### Scenario: 运行包含知识节点的工作流
- **WHEN** 客户端触发包含 `knowledge_ref` 节点的工作流运行
- **THEN** 工作流 API SHALL 返回包含知识节点步骤输出的运行结果
- **AND** 步骤输出 SHALL 包含命中的知识条目摘要
