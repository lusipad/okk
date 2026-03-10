## ADDED Requirements

### Requirement: 默认入口为 Partner Home
前端 SHALL 将 `Partner Home` 作为默认工作入口，而不是空白聊天页。

#### Scenario: 用户进入主入口
- **WHEN** 用户进入默认工作台且尚未聚焦具体任务
- **THEN** 前端 SHALL 优先展示 `Partner Home`
- **AND** 首页 SHALL 表达当前同事、可继续任务和待确认项

### Requirement: 任务视图区分 Direct Thread 与 Mission Room
前端 SHALL 将任务视图区分为 `Direct Thread` 与 `Mission Room`，而不是统一视为聊天页面。

#### Scenario: 单同事任务
- **WHEN** 当前任务只需要单个 Partner 协作
- **THEN** 前端 SHALL 使用 `Direct Thread` 视图承载主流程

#### Scenario: 多同事任务
- **WHEN** 当前任务存在多个 Partner 协作
- **THEN** 前端 SHALL 使用 `Mission Room` 视图承载主流程
- **AND** 前端 SHALL 显示团队状态、并行 workstreams 与待确认项
