## ADDED Requirements

### Requirement: 知识共享管理接口
Web Backend SHALL 提供知识共享请求、审核、发布和团队列表查询接口，并返回结构化状态信息供工作台消费。

#### Scenario: 创建共享请求
- **WHEN** 前端调用知识共享请求接口
- **THEN** 后端 SHALL 校验知识条目存在且可共享
- **AND** 成功响应 SHALL 返回共享记录详情与当前状态

#### Scenario: 审核共享请求
- **WHEN** 前端调用审核接口提交批准、驳回或退回修改动作
- **THEN** 后端 SHALL 执行状态流转并写入审核记录
- **AND** 响应 SHALL 返回更新后的共享记录

### Requirement: 团队知识浏览接口
Web Backend SHALL 提供团队知识列表与概览接口，仅暴露已发布共享知识。

#### Scenario: 拉取团队知识列表
- **WHEN** 前端请求团队共享知识列表
- **THEN** 后端 SHALL 返回已发布共享知识
- **AND** 响应中不得包含未通过审核的条目
