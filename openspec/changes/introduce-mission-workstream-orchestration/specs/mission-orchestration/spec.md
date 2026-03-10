## ADDED Requirements

### Requirement: Mission 作为主任务对象
系统 SHALL 将 Mission 作为用户当前任务的主对象，而不是只依赖 Session 表达任务。

#### Scenario: 创建任务
- **WHEN** 用户创建一个新的任务
- **THEN** 系统 SHALL 创建一个 Mission 对象
- **AND** Mission SHALL 包含标题、目标、状态和阶段等最小字段

### Requirement: Workstream 作为并行执行单元
系统 SHALL 将 Workstream 作为 Mission 下最小可分配、可并行推进的执行单元。

#### Scenario: 任务拆解
- **WHEN** 一个 Mission 被拆解为多个子任务
- **THEN** 系统 SHALL 为每个子任务创建独立 Workstream
- **AND** 每个 Workstream SHALL 绑定负责人与状态

### Requirement: Checkpoint 作为用户确认节点
系统 SHALL 将等待用户确认的关键节点建模为 Checkpoint。

#### Scenario: 需要用户确认方向
- **WHEN** 任务推进到必须由用户拍板的关键节点
- **THEN** 系统 SHALL 创建一个 Checkpoint
- **AND** Checkpoint SHALL 标记为需要用户操作

### Requirement: Handoff 作为结构化交接
系统 SHALL 将 Partner 间的交接表示为 Handoff，而不是普通消息。

#### Scenario: 设计转交审查
- **WHEN** 一个 Workstream 需要转交给另一个 Partner 继续处理
- **THEN** 系统 SHALL 记录一个 Handoff
- **AND** Handoff SHALL 绑定来源 Workstream 与接收方 Partner

### Requirement: Mission Summary 作为进度投影视图
系统 SHALL 提供 Mission Summary 用于首页和列表页展示团队整体进度。

#### Scenario: 查看任务卡片
- **WHEN** 用户在首页查看一个 Mission
- **THEN** 系统 SHALL 提供已完成 workstreams、阻塞数和待确认数等汇总信息
