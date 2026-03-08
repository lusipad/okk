## ADDED Requirements

### Requirement: 统一工作台导航层级
系统 SHALL 提供稳定的工作台导航层级，将高频入口、主能力页面与会话历史明确分层，避免页面集合式跳转。

#### Scenario: 左栏分层导航
- **WHEN** 用户进入主工作台
- **THEN** 系统 SHALL 在左栏按 `New chat / Search / Primary links / Chats` 分层展示入口
- **AND** 会话历史 SHALL 独立于一级能力入口展示

#### Scenario: 路由上下文保持
- **WHEN** 用户从 Chat 切换到 Skills、MCP 或 Knowledge 页面后再返回
- **THEN** 系统 SHALL 保留当前仓库、当前会话和最近一次上下文面板状态
- **AND** 不得将用户重置到默认空页面

### Requirement: 上下文侧栏与专注模式
系统 SHALL 提供按需展开的上下文侧栏与专注模式，使主任务舞台始终保持阅读优先。

#### Scenario: 右侧上下文面板按需展开
- **WHEN** 用户打开步骤、知识建议、Team 状态或诊断信息
- **THEN** 系统 SHALL 在右侧统一上下文面板中展示对应内容
- **AND** 默认状态下 SHALL 保持收起，避免干扰主对话

#### Scenario: 专注模式
- **WHEN** 用户通过快捷键或命令面板切换专注模式
- **THEN** 系统 SHALL 隐藏左右侧栏并仅保留中间主舞台
- **AND** 刷新后 SHALL 恢复上次专注模式偏好
