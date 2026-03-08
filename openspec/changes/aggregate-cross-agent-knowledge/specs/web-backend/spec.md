## ADDED Requirements

### Requirement: 跨 Agent 知识聚合服务接口
系统 SHALL 通过 Web 后端暴露暴露导入、预览、确认和导入记录查询 API相关接口，使前端与其他调用方可稳定访问该能力。

#### Scenario: 查询或提交主题请求
- **WHEN** 客户端发起跨 Agent 知识聚合相关查询、提交或动作请求
- **THEN** Web 后端 SHALL 校验输入并调用对应服务返回结构化结果
- **AND** 响应 SHALL 保留主题相关状态与错误信息

#### Scenario: 异常请求处理
- **WHEN** 跨 Agent 知识聚合相关请求参数不完整、状态不合法或权限不足
- **THEN** Web 后端 SHALL 返回可操作的错误反馈
- **AND** 不得返回无法定位问题的模糊错误
