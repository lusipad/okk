## ADDED Requirements

### Requirement: 知识条目溯源与生命周期治理
系统 SHALL 为知识条目维护来源追踪和生命周期状态，使知识可审核、可追溯、可治理。

#### Scenario: 保存知识时记录来源
- **WHEN** 用户将知识建议保存为知识条目
- **THEN** 系统 SHALL 至少记录来源仓库、来源会话和来源消息摘要
- **AND** 若可获得文件或提交信息，也 SHALL 一并保存

#### Scenario: 过时知识进入治理流程
- **WHEN** 系统检测到知识可能过时
- **THEN** 条目 SHALL 进入待确认的治理状态
- **AND** 用户 SHALL 能选择更新、保留或归档该条知识
