# knowledge-sharing Specification

## Purpose
定义知识共享请求、审核发布和团队知识浏览的业务能力。

## Requirements
### Requirement: 知识共享请求流程
系统 SHALL 允许用户将个人知识条目提交为共享请求，并为每次请求记录可审计的共享状态、提交说明和目标可见范围。

#### Scenario: 提交共享请求
- **WHEN** 用户在个人知识条目上发起共享
- **THEN** 系统 SHALL 创建一条知识共享记录并将其状态设为 `pending_review`
- **AND** 共享记录 SHALL 关联原始知识条目、提交人、提交时间和提交备注

#### Scenario: 重复提交共享请求
- **WHEN** 某条知识已经存在未终结的共享请求
- **THEN** 系统 SHALL 阻止再次创建新的并行请求
- **AND** 返回当前未终结请求的状态与标识

### Requirement: 知识共享审核与发布
系统 SHALL 提供知识共享审核流，支持批准、驳回、退回修改和发布，并保留完整审核记录。

#### Scenario: 审核通过并发布
- **WHEN** 审核人批准某条待审共享请求并执行发布
- **THEN** 系统 SHALL 将共享记录状态更新为 `published`
- **AND** 团队知识浏览结果 SHALL 包含该知识条目

#### Scenario: 退回修改
- **WHEN** 审核人要求作者补充或修正内容
- **THEN** 系统 SHALL 将共享记录状态更新为 `changes_requested`
- **AND** 保存审核备注供作者后续查看

### Requirement: 团队知识浏览
系统 SHALL 提供团队知识库浏览能力，仅展示已发布的共享知识，并支持基于分类、标签和来源的检索。

#### Scenario: 查看团队知识库
- **WHEN** 用户打开团队知识浏览视图
- **THEN** 系统 SHALL 返回已发布共享知识列表
- **AND** 每条结果 SHALL 包含标题、摘要、标签、发布信息和来源作者

#### Scenario: 过滤团队共享知识
- **WHEN** 用户在团队知识库中按分类或标签过滤
- **THEN** 系统 SHALL 只返回符合过滤条件的已发布共享知识
- **AND** 不得混入未发布或已驳回的共享请求
