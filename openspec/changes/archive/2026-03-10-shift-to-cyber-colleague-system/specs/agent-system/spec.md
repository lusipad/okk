## ADDED Requirements

### Requirement: Partner 作为主协作对象
系统 SHALL 将 Partner 定义为持续存在的赛博同事对象，而不是一次性聊天会话中的匿名执行角色。

#### Scenario: 用户进入默认工作台
- **WHEN** 用户进入 OKK 的默认入口
- **THEN** 系统 SHALL 以 Partner 作为主要协作对象进行表达
- **AND** 不得把产品主叙事降级为普通 AI 聊天工具

### Requirement: 双协作模式
系统 SHALL 支持 `Direct Thread` 与 `Mission Room` 两种主协作模式。

#### Scenario: 单同事协作
- **WHEN** 一个 Mission 只由单个 Partner 负责推进
- **THEN** 系统 SHALL 将其表达为 `Direct Thread`

#### Scenario: 多同事协作
- **WHEN** 一个 Mission 由多个 Partner 并行或串行协作推进
- **THEN** 系统 SHALL 将其表达为 `Mission Room`
- **AND** SHALL 允许用户识别当前有哪些 Partner 参与
