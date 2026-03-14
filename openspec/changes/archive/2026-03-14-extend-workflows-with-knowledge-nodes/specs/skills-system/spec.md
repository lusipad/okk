## ADDED Requirements

### Requirement: Skills 系统支持知识引用节点
系统 SHALL 在工作流节点模型中支持 `knowledge_ref` 类型，并为该类型提供统一的配置和执行语义。

#### Scenario: 保存知识引用节点
- **WHEN** 系统创建或更新包含 `knowledge_ref` 节点的工作流
- **THEN** Skills 系统 SHALL 持久化该节点的 `entryIds` 或 `filters` 与 `outputKey`
- **AND** 不得把知识引用降级为普通 `prompt` 节点文本

#### Scenario: 执行知识引用节点
- **WHEN** 工作流执行到 `knowledge_ref` 节点
- **THEN** Skills 系统 SHALL 解析知识条目并产出结构化输出
- **AND** 后续节点 SHALL 能通过该节点的 `outputKey` 读取结果
