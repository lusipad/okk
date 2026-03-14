## ADDED Requirements

### Requirement: 订阅关系与同步记录持久化
数据层 SHALL 为知识订阅提供订阅关系、同步游标和更新记录模型，并保持与共享知识来源的引用完整性。

#### Scenario: 创建订阅记录
- **WHEN** 系统创建新的知识订阅
- **THEN** 数据层 SHALL 持久化来源类型、来源标识、订阅状态和最近同步信息
- **AND** 记录 SHALL 可按用户与来源检索

#### Scenario: 写入订阅更新记录
- **WHEN** 系统同步到新的知识更新
- **THEN** 数据层 SHALL 持久化更新项及其消费状态
- **AND** 更新项 SHALL 能关联回对应的订阅和共享知识来源
