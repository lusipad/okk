## ADDED Requirements

### Requirement: 首页身份与记忆摘要卡
系统 SHALL 在合伙人首页展示身份与记忆联动摘要卡，帮助用户快速感知系统已经认识自己并记住近期上下文。

#### Scenario: 摘要数据可用
- **WHEN** PartnerHomeView 成功加载合伙人摘要
- **THEN** 前端 SHALL 展示身份名称、近期记忆摘要和活跃工作仓库信息
- **AND** 用户 SHALL 能在首页直接感知当前合伙人画像与近期记忆线索

#### Scenario: 摘要数据为空
- **WHEN** 当前没有 active identity 或近期记忆为空
- **THEN** 前端 SHALL 显示对应的空状态文案或占位信息
- **AND** 不得让摘要卡区域变成无说明的空白

### Requirement: 首页摘要卡非阻塞降级
系统 SHALL 以非阻塞方式加载首页摘要卡，并在失败时保持合伙人首页其他区块可用。

#### Scenario: 摘要卡加载中
- **WHEN** 首页已渲染但摘要请求仍在进行
- **THEN** 前端 SHALL 显示摘要卡的加载态
- **AND** 最近会话、继续工作和快速操作区块 SHALL 可独立继续展示

#### Scenario: 摘要请求失败
- **WHEN** partner summary 请求失败
- **THEN** 前端 SHALL 将摘要卡降级为轻量错误或提示状态
- **AND** 不得阻塞用户继续使用首页其他入口

