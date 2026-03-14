## ADDED Requirements

### Requirement: 首页展示团队整体进度
前端 SHALL 在 `Partner Home` 中展示 Mission 的团队整体进度，而不是只展示最近聊天记录。

#### Scenario: 查看首页任务卡片
- **WHEN** 首页展示一个进行中的 Mission
- **THEN** 前端 SHALL 显示已完成 workstreams、阻塞数和待确认数

### Requirement: Mission Room 展示编排状态
前端 SHALL 在 `Mission Room` 中展示阶段进度、并行 workstreams、handoff 和 checkpoints。

#### Scenario: 进入多同事任务
- **WHEN** 用户进入一个多 Partner 协作的 Mission
- **THEN** 前端 SHALL 显示阶段进度、workstream 状态和待确认项
