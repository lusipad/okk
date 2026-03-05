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

