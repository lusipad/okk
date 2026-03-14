## ADDED Requirements

### Requirement: 标准知识文件序列化与解析
知识引擎 SHALL 能在 KnowledgeEntry 与标准知识文件之间进行双向转换，并保证稳定字段的一致性。

#### Scenario: 序列化知识条目
- **WHEN** 系统导出某条知识
- **THEN** 知识引擎 SHALL 将标题、摘要、正文、标签、分类和来源信息写入标准文件
- **AND** 不得暴露仅用于内部实现的瞬时字段

#### Scenario: 解析标准知识文件
- **WHEN** 系统接收一个标准知识文件
- **THEN** 知识引擎 SHALL 解析 frontmatter 与正文并映射到内部导入结构
- **AND** 解析错误 SHALL 以结构化方式返回
