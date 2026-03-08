## ADDED Requirements

### Requirement: 左栏主次分层导航
系统 SHALL 将左侧导航收敛为默认可见的主导航与默认收起的更多工具区，突出主任务入口。

#### Scenario: 默认展示主导航
- **WHEN** 用户进入主工作台且更多工具区尚未展开
- **THEN** 左栏 SHALL 默认展示 Chats、Identity、Memory 和 Workspaces 四个主导航入口
- **AND** Skills、MCP、Governance、Imports、Workflows 和 Sharing SHALL 收纳在默认收起的更多工具区中

#### Scenario: 展开更多工具
- **WHEN** 用户主动展开更多工具区
- **THEN** 左栏 SHALL 展示全部次级工具入口
- **AND** 不得影响主导航、New chat、继续工作和 Chats 历史区的可见性

### Requirement: 导航折叠状态持久化
系统 SHALL 持久化更多工具区的展开状态，使用户刷新后仍保持一致的导航层级。

#### Scenario: 状态刷新保持
- **WHEN** 用户展开或收起更多工具区后刷新页面
- **THEN** 左栏 SHALL 恢复上次的折叠状态
- **AND** 不得回退到与用户预期不一致的随机层级

#### Scenario: 本地存储不可用
- **WHEN** 前端无法读取或写入折叠状态的本地存储
- **THEN** 左栏 SHALL 回退到默认收起的安全状态
- **AND** 导航主体仍 SHALL 可正常使用

