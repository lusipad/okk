## ADDED Requirements

### Requirement: 长期记忆知识处理闭环
系统 SHALL 在知识引擎中支持Knowledge 与 Memory 的关联、互转和协同检索，并保持与知识检索、发布和治理流程的一致性。

#### Scenario: 写入或更新知识
- **WHEN** 系统生成、导入或治理与长期记忆相关的知识条目
- **THEN** 知识引擎 SHALL 正确处理对应的来源、状态或关联信息
- **AND** 知识条目 SHALL 可被后续检索、审核或推荐复用

#### Scenario: 检索主题知识
- **WHEN** 用户或系统检索与长期记忆相关的知识
- **THEN** 知识引擎 SHALL 返回符合当前上下文的结果
- **AND** 结果 SHALL 能体现来源、状态或治理信息
