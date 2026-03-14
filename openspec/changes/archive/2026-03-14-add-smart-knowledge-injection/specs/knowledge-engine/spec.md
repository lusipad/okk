## ADDED Requirements

### Requirement: 知识引擎支持分层注入候选
知识引擎 SHALL 为上下文构建提供背景知识和查询相关知识两类候选结果。

#### Scenario: 生成背景知识
- **WHEN** 系统为某个仓库构建对话上下文
- **THEN** 知识引擎 SHALL 返回可稳定注入的背景知识集合
- **AND** 这些结果 SHALL 可独立于当前问题重复使用

#### Scenario: 检索查询相关知识
- **WHEN** 系统收到用户当前问题并请求知识候选
- **THEN** 知识引擎 SHALL 基于问题内容执行知识检索
- **AND** 返回结果 SHALL 保留条目身份与排序所需的元数据

### Requirement: 知识使用计数只记录实际注入
知识引擎 SHALL 仅对实际进入上下文的知识条目更新使用统计。

#### Scenario: 候选条目未被注入
- **WHEN** 某个知识条目出现在候选集中但未进入最终上下文
- **THEN** 系统 SHALL 不更新该条目的 `view_count`

#### Scenario: 条目实际被注入
- **WHEN** 某个知识条目进入最终上下文并参与回答生成
- **THEN** 系统 SHALL 更新该条目的 `view_count`
- **AND** 更新后的统计 SHALL 可被后续列表或排序逻辑消费
