## ADDED Requirements

### Requirement: 强制交付门禁链路
系统 SHALL 为正式交付提供强制门禁链路，覆盖测试、构建、smoke、pixel、打包与发布。

#### Scenario: 正式交付顺序固定
- **WHEN** 触发正式交付流程
- **THEN** 系统 SHALL 按测试、构建、smoke、pixel、package、release 的固定顺序执行
- **AND** 任一环节失败 SHALL 阻断后续发布动作

#### Scenario: 失败快返
- **WHEN** 任一门禁失败
- **THEN** 系统 SHALL 输出失败环节、失败原因和可定位证据
- **AND** 不得继续生成对外发布结果

### Requirement: 标准发布产物与证据
系统 SHALL 为每次交付生成标准发布产物与验收证据，确保发布结果可验证、可追溯。

#### Scenario: 发布附件完整
- **WHEN** 交付完成
- **THEN** 系统 SHALL 生成可运行产物、checksum、release notes 和 job summary
- **AND** 这些附件 SHALL 使用同一版本和命名上下文

#### Scenario: 回滚信息可用
- **WHEN** 发布完成或发布失败
- **THEN** 系统 SHALL 能关联到对应回滚指引与故障恢复文档
- **AND** 运维人员 SHALL 无需额外猜测恢复入口
