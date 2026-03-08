## ADDED Requirements

### Requirement: 继续工作提示回退
系统 SHALL 在仓库级继续工作接口中提供稳定的 prompt 与 summary 回退，避免仓库快照不完整时返回不可用结果。

#### Scenario: 仓库快照已有继续提示
- **WHEN** 客户端请求仓库继续工作且仓库快照中已存在 continuePrompt 或 lastActivitySummary
- **THEN** 后端 SHALL 返回该仓库的 continue 结果
- **AND** 结果 SHALL 保持现有 repoId、repoName、prompt、summary 和 recentActivities 结构

#### Scenario: 仓库快照缺少摘要
- **WHEN** 客户端请求仓库继续工作但仓库快照缺少 continuePrompt 或 lastActivitySummary
- **THEN** 后端 SHALL 基于 recentActivities 生成可继续使用的 prompt 与 summary
- **AND** 不得因为缺少预写入快照而返回空白或不可执行的继续结果

