## ADDED Requirements

### Requirement: 聊天主舞台轻量元信息
系统 SHALL 在聊天主舞台头部展示当前会话的轻量元信息，帮助用户快速感知会话规模与启用能力。

#### Scenario: 已有消息的会话
- **WHEN** 用户查看一个已有消息的 Chat 会话
- **THEN** chat-stage-header SHALL 展示当前消息数以及启用的 Skills 与 MCP 数量等元信息
- **AND** 这些信息 SHALL 以紧凑、弱化的方式呈现，不抢占消息正文层级

#### Scenario: 空会话或零值状态
- **WHEN** 当前会话为空或没有启用任何 Skill 与 MCP
- **THEN** chat-stage-header SHALL 保持稳定的元信息布局
- **AND** 系统 SHALL 使用中性文案或零值表达，而不是让头部结构缺失

### Requirement: 元信息与当前选择实时联动
系统 SHALL 随当前会话消息与能力选择变化，实时更新主舞台头部元信息。

#### Scenario: 消息数量变化
- **WHEN** 当前会话新增、重试或恢复消息导致消息数变化
- **THEN** 头部消息计数 SHALL 同步更新
- **AND** 不得依赖刷新页面后才显示正确值

#### Scenario: 能力选择变化
- **WHEN** 用户切换已选 Skills 或 MCP 服务器
- **THEN** 头部对应元信息 SHALL 立即反映最新数量
- **AND** 不得出现与当前选择不一致的滞后显示

