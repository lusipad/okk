## ADDED Requirements

### Requirement: 知识共享流转持久化
数据层 SHALL 为知识共享提供独立的共享记录、审核记录和查询索引，并保持与既有知识主表的引用完整性。

#### Scenario: 写入共享请求
- **WHEN** 系统创建知识共享请求
- **THEN** 数据层 SHALL 持久化共享记录并引用对应 KnowledgeEntry
- **AND** 若知识条目不存在，写入 SHALL 失败

#### Scenario: 写入审核动作
- **WHEN** 审核人执行批准、驳回或退回修改
- **THEN** 数据层 SHALL 追加一条审核记录
- **AND** 共享记录的最新状态 SHALL 与审核动作保持一致

### Requirement: 团队共享查询索引
数据层 SHALL 为团队知识浏览和审核列表提供可排序、可过滤的索引能力。

#### Scenario: 查询待审共享列表
- **WHEN** 后端请求待审共享记录
- **THEN** 数据层 SHALL 按更新时间倒序返回待审条目
- **AND** 结果 SHALL 支持按状态过滤
