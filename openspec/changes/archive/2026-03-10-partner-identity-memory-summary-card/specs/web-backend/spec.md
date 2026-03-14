## ADDED Requirements

### Requirement: 合伙人摘要聚合接口
系统 SHALL 提供认证后的合伙人摘要接口，以单次请求返回首页所需的身份、记忆和工作仓库摘要信息。

#### Scenario: 成功返回首页摘要
- **WHEN** 已认证客户端请求 GET /api/partner/summary
- **THEN** 后端 SHALL 返回包含 identity、memoryCount、recentMemories 和 activeRepoName 的统一载荷
- **AND** recentMemories SHALL 限制为首页展示所需的最近 3 条摘要数据

#### Scenario: 数据源部分缺失
- **WHEN** active identity、memory 列表或工作仓库上下文存在部分缺失
- **THEN** 后端 SHALL 以 null、0 或空数组填充缺失字段
- **AND** 不得因为单个数据源缺失而将整个摘要请求返回为 404

### Requirement: 合伙人摘要接口稳定降级
系统 SHALL 在可恢复的聚合异常下保持摘要接口响应结构稳定，避免首页因为单点失败整体不可用。

#### Scenario: 可恢复读取失败
- **WHEN** 摘要聚合过程中有单个数据源读取失败但服务整体仍可响应
- **THEN** 后端 SHALL 返回受影响字段的安全降级值
- **AND** 其它未受影响字段 SHALL 继续返回可用数据

