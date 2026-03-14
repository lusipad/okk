## ADDED Requirements

### Requirement: 工作流知识输入核心流程
系统 SHALL 提供工作流级知识输入能力，使工作流能够以独立节点引用知识条目并将结果注入后续执行上下文。

#### Scenario: 配置固定知识条目输入
- **WHEN** 用户为工作流添加 `knowledge_ref` 节点并提供一个或多个 `entryIds`
- **THEN** 系统 SHALL 在运行时加载这些知识条目
- **AND** 将条目内容与元数据写入该节点声明的 `outputKey`

#### Scenario: 按筛选条件解析知识输入
- **WHEN** 用户为 `knowledge_ref` 节点配置 `query`、`repoId`、`category`、`tags`、`status` 或 `limit`
- **THEN** 系统 SHALL 基于这些条件查询知识条目
- **AND** 将实际命中的知识列表与摘要作为该节点的运行输出

### Requirement: 工作流知识输入可追溯性
系统 SHALL 在工作流运行历史中保留知识输入节点的查询条件、命中条目和输出键，便于回放与调试。

#### Scenario: 查看知识输入运行步骤
- **WHEN** 用户查看包含 `knowledge_ref` 节点的工作流运行记录
- **THEN** 系统 SHALL 展示该节点命中的知识条目 ID、标题和输出键
- **AND** 用户 SHALL 能判断该运行具体引用了哪些知识
