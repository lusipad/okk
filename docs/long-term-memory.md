# 长期记忆说明

## 当前已落地范围

- 统一的 `memory_entries / memory_access_log` 数据模型
- 五类记忆：`preference / project / relationship / process / event`
- 会话前按 `user + repo` 检索相关记忆并注入 prompt
- 会话成功后自动沉淀 `process` 型长期记忆
- 支持从仓库 `CLAUDE.md` 同步项目记忆
- 提供基础的记忆查看、创建、编辑与同步 API
- 提供轻量 `Memory` 页面用于查看当前记忆条目

## 数据模型

### `memory_entries`
- `memory_type`
- `confidence`
- `status`
- `source_kind`
- `source_ref`
- `metadata`

### `memory_access_log`
- `memory_id`
- `session_id`
- `access_kind`
- `created_at`

## 自动积累规则

当前最小闭环实现：
- QA 成功完成后，将本轮 user/assistant 交互摘要写入 `process` 类型记忆
- 同一 `user + repo + memory_type + title` 会进行 upsert，而不是无限追加重复条目

## 注入规则

会话前会优先检索：
- 当前 repo 下的 active 记忆
- 没有 repo 归属的通用 active 记忆

并将命中的摘要拼到 system prompt 的 `Relevant Memory` 区块。

## 同步规则

- `POST /api/memory/sync` 当前实现为：从仓库根目录读取 `CLAUDE.md`，生成或更新一条 `project` 型记忆
- Knowledge 与 Memory 的深度互通暂未做双向治理，本阶段先提供最小单向同步能力
