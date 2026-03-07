# 项目上下文持久化说明

## 目标

本次实现只交付最小可落地闭环：
- 仓库级偏好快照
- 最近活动日志
- 继续上次工作的摘要提示

不在本阶段引入复杂的自动工作模式识别或完整项目设置页。

## 数据模型

### `repositories.context_snapshot_json`

用于保存仓库级偏好快照，当前支持：
- `preferredAgentId`
- `preferredAgentName`
- `preferredBackend`
- `preferredMode`
- `preferredSkillIds`
- `preferredMcpServerIds`
- `lastSessionId`
- `lastActivitySummary`
- `continuePrompt`
- `lastUpdatedAt`

### `repo_activity_log`

用于保存最近活动摘要，当前按时间倒序读取最近若干条，供：
- 左栏项目上下文摘要
- `继续上次工作` 提示生成
- repo context / system prompt 注入

## 运行时注入

在构建仓库上下文时，系统会把以下信息附加到项目上下文：
- 偏好 Agent / Backend / Mode
- 最近一次活动摘要
- 最近活动列表

这些信息会与 `CLAUDE.md` 和已发布知识摘要一起进入 system prompt 附录。

## 回写策略

当一次 QA 成功完成后，系统会：
1. 记录 assistant 消息
2. 更新仓库上下文快照
3. 追加一条 `repo_activity_log`
4. 生成下一次 `继续上次工作` 的默认提示

## API

当前提供：
- `GET /api/repos/:repoId/context`
- `PATCH /api/repos/:repoId/context`
- `POST /api/repos/:repoId/continue`

## 前端入口

左栏新增 `Project context` 区块，展示：
- 当前仓库名
- 偏好 Agent
- 最近活动摘要
- `继续上次工作`
- `记住当前偏好`

## 人工修正规则

若自动回写结果不符合预期，优先通过 `PATCH /api/repos/:repoId/context` 或左栏入口重新保存当前偏好；不要直接手改数据库。
