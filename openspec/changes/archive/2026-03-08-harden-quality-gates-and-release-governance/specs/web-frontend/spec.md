## ADDED Requirements

### Requirement: 像素验收进入正式交付门禁
前端 SHALL 将像素验收、参考差异和截图报告纳入正式交付证据，而不是仅用于临时调试。

#### Scenario: 像素证据留档
- **WHEN** 执行正式 UI 验收
- **THEN** 系统 SHALL 输出像素差异结果、参考差异结果和截图报告
- **AND** 这些结果 SHALL 可被发布流程引用或归档

#### Scenario: 参考差异失败阻断交付
- **WHEN** 严格参考差异校验失败
- **THEN** 系统 SHALL 阻断正式交付
- **AND** 输出明确的失败原因与差异定位信息
