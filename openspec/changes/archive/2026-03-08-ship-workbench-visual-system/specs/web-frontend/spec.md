## ADDED Requirements

### Requirement: 统一视觉令牌系统
系统 SHALL 提供统一的工作台视觉令牌系统，覆盖颜色语义、间距、圆角、边框、阴影、排版和动效。

#### Scenario: 默认暗色主题
- **WHEN** 用户首次进入应用且尚未设置主题偏好
- **THEN** 系统 SHALL 默认采用暗色主题
- **AND** 左栏、主舞台、输入区和状态组件 SHALL 使用统一的视觉令牌而非页面局部样式

#### Scenario: 主题切换一致性
- **WHEN** 用户切换浅色或深色主题
- **THEN** 系统 SHALL 同步更新所有核心组件的颜色和对比度
- **AND** 不得出现局部组件仍沿用旧主题样式

### Requirement: 主舞台与输入 Dock 统一表达
系统 SHALL 让消息舞台、输入 Dock、空态和状态反馈形成统一表达，支持官网级阅读体验。

#### Scenario: 空态与输入 Dock 同屏
- **WHEN** 用户在空会话中打开主舞台
- **THEN** 系统 SHALL 在同一视窗内完整展示空态主文案与输入 Dock
- **AND** 输入 Dock SHALL 保持稳定布局，不因按钮激活态抖动

#### Scenario: 消息阅读优先
- **WHEN** 用户浏览消息流或流式回复
- **THEN** assistant 消息 SHALL 采用阅读优先的低噪音表现
- **AND** 工具、错误和高风险状态 SHALL 通过统一强调样式被识别
