# knowledge-engine Specification

## Purpose
TBD - created by archiving change okk-architecture. Update Purpose after archive.
## Requirements
### Requirement: 知识条目 CRUD
系统 SHALL 提供知识条目的创建、读取、更新、删除操作，每个条目包含 title、content（Markdown）、summary、repo_id、category、tags、quality_score、status（draft/published/stale/archived）。

#### Scenario: 创建知识条目
- **WHEN** 用户从 Q&A 会话保存知识
- **THEN** 系统 SHALL 创建 KnowledgeEntry，status 为 draft，关联 source_session_id
- **AND** 同时创建 KnowledgeVersion 记录（version=1）

#### Scenario: 发布知识条目
- **WHEN** 用户将 draft 状态的条目发布
- **THEN** 系统 SHALL 将 status 更新为 published
- **AND** 更新 FTS5 搜索索引

#### Scenario: 编辑已发布条目
- **WHEN** 用户编辑 published 状态的条目
- **THEN** 系统 SHALL 递增 version 号
- **AND** 创建新的 KnowledgeVersion 记录保存变更前内容

#### Scenario: 设置知识分类
- **WHEN** 用户创建或编辑知识条目并选择分类
- **THEN** 系统 SHALL 持久化 category 字段
- **AND** category SHALL 可用于后续搜索过滤

### Requirement: 全文搜索
系统 SHALL 使用 SQLite FTS5 提供知识条目的全文搜索，搜索范围包括 title、content、summary。

#### Scenario: 关键词搜索
- **WHEN** 用户输入搜索关键词
- **THEN** 系统 SHALL 返回匹配的知识条目列表，按相关性排序
- **AND** 结果 SHALL 包含匹配片段高亮

#### Scenario: 标签过滤
- **WHEN** 用户搜索时指定标签过滤
- **THEN** 系统 SHALL 在 FTS5 结果基础上按 knowledge_tags 表过滤

#### Scenario: 仓库与分类过滤
- **WHEN** 用户搜索时指定 repo_id 或 category
- **THEN** 系统 SHALL 在 FTS5 结果基础上追加仓库和分类过滤
- **AND** 过滤后结果 SHALL 仍按相关性与质量分排序

### Requirement: 知识提取建议
系统 SHALL 在 Q&A 完成后，通过 knowledge-extractor Agent 自动分析对话，生成知识提取建议供用户审核。

#### Scenario: Q&A 完成后触发知识建议
- **WHEN** 一次 Q&A 会话的 AI 回答完成（收到 done 事件）
- **THEN** 系统 SHALL 异步调用 knowledge-extractor Agent 分析该对话
- **AND** 如果 Agent 识别出可复用知识，SHALL 通过 knowledge_suggestion 事件通知前端

#### Scenario: 用户接受知识建议
- **WHEN** 用户点击"保存为知识"
- **THEN** 系统 SHALL 使用 Agent 提取的 title、content、tags 预填充知识编辑器
- **AND** 用户可以编辑后保存

#### Scenario: 用户忽略知识建议
- **WHEN** 用户关闭知识建议卡片
- **THEN** 系统 SHALL 不创建任何知识条目

### Requirement: 质量评分
系统 SHALL 为每个知识条目维护 quality_score，基于用户投票（upvote/downvote）、查看次数、时效性计算。

#### Scenario: 用户投票
- **WHEN** 用户对知识条目投 upvote
- **THEN** 系统 SHALL 递增 upvote_count
- **AND** 重新计算 quality_score

#### Scenario: 低分条目搜索降权
- **WHEN** 搜索结果包含 quality_score < 0 的条目
- **THEN** 该条目 SHALL 在搜索结果中排名靠后

### Requirement: 知识过时检测
系统 SHALL 检测知识条目关联的仓库文件是否发生变更，如果变更则标记条目为 stale。

#### Scenario: 关联文件变更
- **WHEN** 知识条目的 metadata.related_files 中的文件在仓库中发生 Git 变更
- **THEN** 系统 SHALL 将该条目的 status 更新为 stale
- **AND** 通知条目创建者

#### Scenario: 定期检查
- **WHEN** 系统执行定期过时检查（可配置间隔）
- **THEN** 系统 SHALL 对所有 published 状态的条目执行 Git diff 比对

### Requirement: 版本历史
系统 SHALL 为每个知识条目维护完整的版本历史，支持查看和回滚。

#### Scenario: 查看版本历史
- **WHEN** 用户查看知识条目的版本历史
- **THEN** 系统 SHALL 返回所有 KnowledgeVersion 记录，包含 version、change_summary、edited_by、created_at

#### Scenario: 回滚到历史版本
- **WHEN** 用户选择回滚到某个历史版本
- **THEN** 系统 SHALL 用该版本的 content 更新当前条目
- **AND** 创建新的 KnowledgeVersion 记录（change_summary 标注为回滚）

### Requirement: 知识引擎支持分层注入候选
知识引擎 SHALL 为上下文构建提供背景知识和查询相关知识两类候选结果。

#### Scenario: 生成背景知识
- **WHEN** 系统为某个仓库构建对话上下文
- **THEN** 知识引擎 SHALL 返回可稳定注入的背景知识集合
- **AND** 这些结果 SHALL 可独立于当前问题重复使用

#### Scenario: 检索查询相关知识
- **WHEN** 系统收到用户当前问题并请求知识候选
- **THEN** 知识引擎 SHALL 基于问题内容执行知识检索
- **AND** 返回结果 SHALL 保留条目身份与排序所需的元数据

### Requirement: 知识使用计数只记录实际注入
知识引擎 SHALL 仅对实际进入上下文的知识条目更新使用统计。

#### Scenario: 候选条目未被注入
- **WHEN** 某个知识条目出现在候选集中但未进入最终上下文
- **THEN** 系统 SHALL 不更新该条目的 `view_count`

#### Scenario: 条目实际被注入
- **WHEN** 某个知识条目进入最终上下文并参与回答生成
- **THEN** 系统 SHALL 更新该条目的 `view_count`
- **AND** 更新后的统计 SHALL 可被后续列表或排序逻辑消费

### Requirement: 知识共享状态与可见性
知识引擎 SHALL 持久化知识条目的共享状态、团队可见性和发布元数据，并在个人检索与团队检索之间正确执行过滤。

#### Scenario: 共享知识进入待审
- **WHEN** 某条知识被提交为共享请求
- **THEN** 知识引擎 SHALL 为该条目关联共享状态与请求元数据
- **AND** 该条目 SHALL 继续在个人知识视图中可见

#### Scenario: 已发布共享知识进入团队检索
- **WHEN** 某条知识的共享状态变为 `published`
- **THEN** 知识引擎 SHALL 允许其进入团队知识查询结果
- **AND** 结果 SHALL 带有共享来源和发布时间信息

### Requirement: 知识共享审计关联
知识引擎 SHALL 维护共享流转与知识版本、治理状态之间的关联，确保后续审核与治理可追溯。

#### Scenario: 审核后查看知识历史
- **WHEN** 用户查看某条已共享知识的历史信息
- **THEN** 系统 SHALL 能同时展示知识版本轨迹与共享审核轨迹
- **AND** 审核记录 SHALL 保留操作者、动作和备注
