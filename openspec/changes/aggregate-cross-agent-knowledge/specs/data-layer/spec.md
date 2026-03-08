## ADDED Requirements

### Requirement: 跨 Agent 知识聚合数据持久化
系统 SHALL 为跨 Agent 知识聚合持久化知识来源字段、导入批次记录和去重关系模型，并保持与既有数据库模型、索引和迁移流程的一致性。

#### Scenario: 写入或更新数据
- **WHEN** 上层服务创建、更新或同步跨 Agent 知识聚合相关数据
- **THEN** 数据层 SHALL 正确写入知识来源字段、导入批次记录和去重关系模型
- **AND** 写入结果 SHALL 保持与会话、仓库、来源或用户上下文的关联

#### Scenario: 查询或恢复数据
- **WHEN** 上层模块按主题查询或恢复跨 Agent 知识聚合相关记录
- **THEN** 数据层 SHALL 返回稳定、可筛选的结果
- **AND** 查询结果 SHALL 支持后续界面展示或运行时继续处理

### Requirement: 跨 Agent 知识聚合迁移与兼容
系统 SHALL 通过增量迁移方式引入跨 Agent 知识聚合相关字段、索引或关联表，避免破坏既有数据语义。

#### Scenario: 升级现有数据库
- **WHEN** 系统加载已有数据库并发现 schema 版本落后
- **THEN** 系统 SHALL 执行与主题相关的增量迁移
- **AND** 既有核心业务数据 SHALL 保持可读可用
