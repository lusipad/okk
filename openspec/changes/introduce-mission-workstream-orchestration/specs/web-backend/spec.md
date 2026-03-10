## ADDED Requirements

### Requirement: 暴露 Mission 编排接口
后端 SHALL 暴露 Mission、团队进度与待确认状态的读取接口。

#### Scenario: 首页读取任务总览
- **WHEN** 前端请求 Mission 总览
- **THEN** 后端 SHALL 返回 Mission Summary
- **AND** 返回值 SHALL 包含 workstream 完成数、阻塞数和待确认数

### Requirement: 暴露 Mission 协作事件
后端 SHALL 提供 Mission Room 所需的结构化协作事件。

#### Scenario: 查看任务协作过程
- **WHEN** 前端请求某个 Mission 的协作事件
- **THEN** 后端 SHALL 返回结构化的运行、交接与确认事件
