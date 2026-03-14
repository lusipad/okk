## ADDED Requirements

### Requirement: 订阅同步状态与来源映射
知识引擎 SHALL 维护订阅关系的来源映射、最近同步状态和更新消费状态。

#### Scenario: 刷新订阅更新
- **WHEN** 系统执行某个订阅的更新查询
- **THEN** 知识引擎 SHALL 按订阅游标筛选新增或变更的共享知识
- **AND** 刷新结果 SHALL 回写最近同步状态

#### Scenario: 导入订阅项
- **WHEN** 用户从订阅更新中导入一条知识
- **THEN** 知识引擎 SHALL 记录订阅项与目标知识条目的映射
- **AND** 同一更新项 SHALL 具备可追踪的消费状态
