## ADDED Requirements

### Requirement: 协作侧栏与步骤时间线
前端 SHALL 提供统一协作侧栏与步骤时间线，承载 backend、tool、skill、agent、team、mcp 的运行信息。

#### Scenario: 时间线分层展示
- **WHEN** 当前会话发生多类协作运行
- **THEN** 系统 SHALL 按时间线展示各运行节点
- **AND** 用户 SHALL 能区分来源类型、运行状态与上下游关系

#### Scenario: 失败默认放大
- **WHEN** 某个协作节点失败或属于高风险操作
- **THEN** 系统 SHALL 默认展开其详情
- **AND** 提供重试、查看配置或复制诊断信息的入口
