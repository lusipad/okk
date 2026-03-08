## ADDED Requirements

### Requirement: 桌面工作台壳层一致性
Desktop 壳层 SHALL 复用与 Web 一致的工作台信息架构，保证导航、快捷键和窗口恢复行为可预测。

#### Scenario: 全局入口回到同一工作台
- **WHEN** 用户通过桌面托盘、全局快捷键或搜索窗打开应用
- **THEN** 系统 SHALL 回到当前工作台上下文，而不是打开一套独立页面流
- **AND** 保留最近访问的主舞台页面与侧栏状态

#### Scenario: 桌面端命令面板一致
- **WHEN** 用户在 Desktop 中触发命令面板
- **THEN** 系统 SHALL 提供与 Web 相同的工作台跳转与模式切换能力
- **AND** 快捷键和执行结果 SHALL 与 Web 保持一致
