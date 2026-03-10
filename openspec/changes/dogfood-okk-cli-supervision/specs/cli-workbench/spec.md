## ADDED Requirements

### Requirement: CLI 提供赛博同事首页
系统 SHALL 提供 CLI-first 的 `partner home` 视图，帮助用户在命令行中继续当前工作。

#### Scenario: 查看 CLI 首页
- **WHEN** 用户执行 `okk partner home`
- **THEN** 系统 SHALL 显示主同事、最近 missions、最近记忆和运行时状态

### Requirement: CLI 提供任务主路径
系统 SHALL 提供 `mission` 命令用于创建、查看和继续任务。

#### Scenario: 查看任务
- **WHEN** 用户执行 `okk mission show <missionId>`
- **THEN** 系统 SHALL 显示任务摘要、相关片段、Team Runs 和团队进度

### Requirement: CLI 提供默认团队编排
系统 SHALL 在 `run team` 中提供默认的多同事协作模板。

#### Scenario: 启动默认团队
- **WHEN** 用户执行 `okk run team <missionId>` 且未显式提供成员列表
- **THEN** 系统 SHALL 自动创建协调、执行和审查三个角色的默认团队模板

### Requirement: CLI 提供待确认视图
系统 SHALL 提供 `checkpoint list` 命令展示当前任务的待确认项。

#### Scenario: 查看任务待确认
- **WHEN** 用户执行 `okk checkpoint list <missionId>`
- **THEN** 系统 SHALL 显示需要用户确认的关键项和摘要
