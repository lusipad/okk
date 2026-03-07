# 会话搜索与归档说明

## 目标

本次实现交付会话历史的最小可用闭环：
- 标题 / 摘要 / 消息正文搜索
- 会话归档与恢复
- 会话摘要持久化
- 历史片段引用

## 数据模型

### `sessions`

新增字段：
- `summary`
- `tags_json`
- `archived_at`

### `session_fts`

用于对会话标题与摘要进行 FTS5 检索。

### `messages_fts`

用于对消息正文进行 FTS5 检索，并为“引用历史片段”提供 snippet。

## API

- `GET /api/sessions?q=&archived=&tag=`
- `POST /api/sessions/:sessionId/archive`
- `POST /api/sessions/:sessionId/restore`
- `GET /api/sessions/:sessionId/references?q=`

## 前端行为

左栏支持：
- 搜索标题 / 摘要 / 标签
- 切换归档视图
- 归档与恢复
- 将历史片段引用回当前输入区

## 回写策略

当一次 QA 成功完成后：
- assistant 内容摘要会写回 `sessions.summary`
- 供搜索排序与历史会话识别复用

## 限制

- 当前标签编辑未开放独立设置 UI，先走数据层与 API 能力
- 左栏本地筛选优先使用当前已加载的会话元数据；更深层消息正文搜索由后端 API 承担
