## ADDED Requirements

### Requirement: 多仓库工作空间知识处理闭环
系统 SHALL 在知识引擎中支持workspace 级知识检索、聚合与来源展示，并保持与知识检索、发布和治理流程的一致性。

#### Scenario: 写入或更新知识
- **WHEN** 系统生成、导入或治理与多仓库工作空间相关的知识条目
- **THEN** 知识引擎 SHALL 正确处理对应的来源、状态或关联信息
- **AND** 知识条目 SHALL 可被后续检索、审核或推荐复用

#### Scenario: 检索主题知识
- **WHEN** 用户或系统检索与多仓库工作空间相关的知识
- **THEN** 知识引擎 SHALL 返回符合当前上下文的结果
- **AND** 结果 SHALL 能体现来源、状态或治理信息
