## ADDED Requirements

### Requirement: 知识订阅管理界面
Web Frontend SHALL 提供知识订阅列表、来源详情和启停管理界面。

#### Scenario: 查看订阅列表
- **WHEN** 用户打开知识订阅页面
- **THEN** 前端 SHALL 展示当前订阅列表及其同步状态
- **AND** 用户 SHALL 能发起新增或停用订阅动作

#### Scenario: 管理单个订阅
- **WHEN** 用户打开某个订阅详情
- **THEN** 前端 SHALL 展示来源信息、最近同步时间和基础配置
- **AND** 用户 SHALL 能执行停用或重新同步

### Requirement: 订阅更新消费界面
Web Frontend SHALL 提供订阅更新列表和一键导入交互。

#### Scenario: 查看最近更新
- **WHEN** 用户进入订阅更新视图
- **THEN** 前端 SHALL 展示每条更新的标题、来源、更新时间和消费状态
- **AND** 用户 SHALL 能按来源或状态过滤

#### Scenario: 一键导入更新项
- **WHEN** 用户点击导入某条订阅更新
- **THEN** 前端 SHALL 触发导入动作并显示结果
- **AND** 成功导入后 SHALL 更新该项的消费状态
