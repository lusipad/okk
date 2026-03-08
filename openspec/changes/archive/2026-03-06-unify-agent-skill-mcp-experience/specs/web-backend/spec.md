## ADDED Requirements

### Requirement: 统一协作事件契约
Web 后端 SHALL 为协作运行输出统一事件契约，覆盖 backend、tool、skill、agent、team、mcp 等来源。

#### Scenario: 统一事件字段
- **WHEN** WebSocket 推送协作相关事件
- **THEN** 每个事件 SHALL 包含 run id、source type、status、timestamp 和 diagnostics 摘要
- **AND** 前端 SHALL 无需根据来源类型切换到完全不同的解析逻辑

#### Scenario: 运行详情查询
- **WHEN** 前端请求某个协作运行的详情
- **THEN** REST 接口 SHALL 返回与 WebSocket 事件兼容的结构化详情
- **AND** 用于恢复刷新后的时间线视图
