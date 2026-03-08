## ADDED Requirements

### Requirement: 仓库上下文切换与恢复
系统 SHALL 将仓库上下文视为一级工作状态，并在切换、刷新和跨页面跳转时保持一致。

#### Scenario: 切换仓库同步上下文
- **WHEN** 用户切换当前仓库
- **THEN** 系统 SHALL 同步更新会话、知识检索和建议范围
- **AND** 用户 SHALL 看到明确的上下文切换反馈

#### Scenario: 恢复最近仓库范围
- **WHEN** 用户重新进入应用或返回工作台
- **THEN** 系统 SHALL 恢复最近一次使用的仓库范围
- **AND** 若该仓库不可用 SHALL 提供可操作的替代或修复提示
