## ADDED Requirements

### Requirement: 合伙人首页空态入口
系统 SHALL 在当前会话没有消息时，将 Chat 主舞台渲染为结构化的合伙人首页，而不是简单的空态提示文案。

#### Scenario: 零消息会话进入首页
- **WHEN** 用户进入 Chat 页面且当前会话消息数为 0
- **THEN** 前端 SHALL 渲染 PartnerHomeView 作为主舞台内容
- **AND** 首页 SHALL 展示问候区与关键入口区块，而不是旧的 emptyHint 文案

#### Scenario: 首页加载中
- **WHEN** 当前会话没有消息且首页依赖的 bootstrap 数据仍在加载
- **THEN** 前端 SHALL 显示结构化加载态或占位态
- **AND** 不得把旧 MessageList 空态作为最终零消息体验

### Requirement: 最近会话与快捷回流入口
系统 SHALL 在合伙人首页中提供最近会话、继续工作和快速操作入口，帮助用户从零消息态快速回到主流程。

#### Scenario: 最近会话可切换
- **WHEN** 当前用户存在最近会话记录
- **THEN** 首页 SHALL 展示至多 3 条最近会话摘要
- **AND** 用户点击任一会话后 SHALL 直接切换到对应会话上下文

#### Scenario: 首页承接已有上下文动作
- **WHEN** 当前存在项目上下文或可用能力数据
- **THEN** 首页 SHALL 展示继续工作入口与快速操作卡片
- **AND** 用户 SHALL 能在不离开 Chat 页面的前提下继续当前工作流

