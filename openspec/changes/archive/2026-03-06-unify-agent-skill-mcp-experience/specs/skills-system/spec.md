## ADDED Requirements

### Requirement: Skill 与 MCP 运行证据可见
系统 SHALL 提供 Skill 与 MCP 的运行证据，使用户能看到能力是否启用、是否实际参与当前任务以及执行结果摘要。

#### Scenario: 能力可用性展示
- **WHEN** 用户查看当前会话的可用能力
- **THEN** 系统 SHALL 区分已安装、已启用、运行中、运行失败和不可用状态
- **AND** 用户 SHALL 能跳转到对应配置或管理入口

#### Scenario: 执行证据展示
- **WHEN** Skill 或 MCP 参与本次任务执行
- **THEN** 系统 SHALL 展示其名称、状态、摘要输出与失败原因
- **AND** 高风险或失败执行 SHALL 默认展开详情
