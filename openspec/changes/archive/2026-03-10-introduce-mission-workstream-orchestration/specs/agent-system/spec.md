## ADDED Requirements

### Requirement: Team Run 映射到 Mission 编排
系统 SHALL 将 Team Run 视为 Mission 编排的一次运行实例，而不是产品层主对象本身。

#### Scenario: 进入 Mission Room
- **WHEN** 用户查看一个存在多 Partner 协作的 Mission
- **THEN** 系统 SHALL 将 Team Run 状态映射为 Mission Room 的运行状态
- **AND** 用户 SHALL 能理解 Team Run 与 Mission 的对应关系
