## ADDED Requirements

### Requirement: 桌面发布证据完整
Desktop 发布 SHALL 附带可运行产物和启动验证证据，确保“打包成功”不被误认为“可交付”。

#### Scenario: 桌面产物附带校验信息
- **WHEN** Desktop 打包完成
- **THEN** 系统 SHALL 产出可运行压缩包、checksum 和 release notes
- **AND** 这些产物 SHALL 使用统一的版本与命名语义

#### Scenario: 启动验证进入发布结果
- **WHEN** Desktop 产物被标记为可交付
- **THEN** 系统 SHALL 附带启动 smoke 或等价启动验证证据
- **AND** 不得仅凭打包命令成功就视为发布完成
