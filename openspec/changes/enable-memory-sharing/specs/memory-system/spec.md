## ADDED Requirements

### Requirement: 记忆共享能力扩展
系统 SHALL 在 memory-system capability 中支持可见性、审核状态、共享流转和团队检索约束，并保持与该 capability 既有契约的一致性。

#### Scenario: 触发主题流程
- **WHEN** 系统触发与记忆共享相关的 memory-system 流程
- **THEN** 该 capability SHALL 正确处理可见性、审核状态、共享流转和团队检索约束
- **AND** 结果 SHALL 可被上下游模块稳定消费

#### Scenario: 查询历史或状态
- **WHEN** 调用方查询记忆共享相关状态或历史
- **THEN** 该 capability SHALL 返回结构化结果
- **AND** 调用方 SHALL 能据此继续后续操作
