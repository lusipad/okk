## ADDED Requirements

### Requirement: 顶栏页面上下文面包屑
系统 SHALL 在顶栏中心区域稳定展示当前页面上下文，并在可用时附加活跃身份信息。

#### Scenario: 展示当前页面名称
- **WHEN** 用户进入 Chat、Identity、Memory、Workspaces 或其他主页面
- **THEN** 顶栏中心 SHALL 显示当前页面名称
- **AND** 页面切换后 SHALL 立即更新为新的页面上下文，而不是保留旧标题

#### Scenario: 展示活跃身份信息
- **WHEN** 当前页面提供活跃身份名称且该信息可用
- **THEN** 顶栏中心 SHALL 在页面名称旁展示身份上下文
- **AND** 该信息 SHALL 作为辅助定位语义，而不是替代页面标题

### Requirement: 顶栏上下文的响应式表达
系统 SHALL 在不同视口下保持顶栏上下文可读，优先保证页面定位信息不丢失。

#### Scenario: 桌面视口
- **WHEN** 用户在桌面宽度下查看顶栏
- **THEN** 顶栏 SHALL 完整展示页面名称与可用的身份信息
- **AND** 不得挤压全局动作区到不可用状态

#### Scenario: 窄屏视口
- **WHEN** 用户在窄屏或移动端查看顶栏
- **THEN** 顶栏 SHALL 至少保持当前页面名称可读
- **AND** 身份信息 SHALL 允许弱化、压缩或次级展示

