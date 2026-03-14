## ADDED Requirements

### Requirement: QA Gateway 回传知识引用
AI backend SHALL 在回答链路中记录并返回本次实际使用的知识引用。

#### Scenario: 回答成功完成
- **WHEN** QA Gateway 完成一次回答
- **THEN** 系统 SHALL 将本次实际注入的知识条目作为结构化引用随结果返回
- **AND** 引用列表 SHALL 与最终上下文构建结果一致

#### Scenario: 回答过程中没有使用知识
- **WHEN** 本次上下文构建未注入任何知识条目
- **THEN** QA Gateway SHALL 返回空引用列表或等价的明确空状态
- **AND** 前端 SHALL 无需自行推断引用结果

### Requirement: QA Gateway 支持编辑后的知识建议保存
AI backend SHALL 接收知识建议保存时用户修正后的标题、内容和标签。

#### Scenario: 保存编辑后的建议
- **WHEN** 前端提交带有修正字段的知识建议保存请求
- **THEN** 系统 SHALL 按用户修正后的字段创建知识条目
- **AND** 保存结果 SHALL 返回新建知识条目的标识信息
