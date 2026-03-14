## ADDED Requirements

### Requirement: 知识订阅管理接口
Web Backend SHALL 提供知识订阅的创建、查询、更新和停用接口。

#### Scenario: 创建订阅接口
- **WHEN** 前端提交一个知识源订阅请求
- **THEN** 后端 SHALL 创建订阅并返回订阅详情
- **AND** 响应 SHALL 包含来源描述和同步状态

#### Scenario: 停用订阅接口
- **WHEN** 前端请求停用一个订阅
- **THEN** 后端 SHALL 更新订阅状态
- **AND** 响应 SHALL 返回停用后的订阅记录

### Requirement: 订阅更新与导入接口
Web Backend SHALL 提供订阅更新查询和一键导入接口。

#### Scenario: 拉取订阅更新列表
- **WHEN** 前端请求某个订阅的更新列表
- **THEN** 后端 SHALL 返回结构化更新项集合
- **AND** 每个更新项 SHALL 包含来源、时间和导入状态

#### Scenario: 导入订阅更新项
- **WHEN** 前端请求导入某个订阅更新项
- **THEN** 后端 SHALL 调用知识导入或创建链路
- **AND** 成功后 SHALL 返回目标知识条目信息和新的消费状态
