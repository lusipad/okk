## Why

用户在 OKK 之外还会长期使用 Claude Code、OpenClaw、NanoClaw 等工具，这些工具中已经积累了大量对项目有价值的会话、记忆和约定。如果这些资产无法被 OKK 识别和吸收，用户就不得不在多个工具之间重复维护上下文，长期记忆也会被割裂。需要把“跨工具知识汇聚”定义为正式能力，让 OKK 成为统一的工程知识入口而不是新的孤岛。

## What Changes

- 建立多来源导入适配层：支持读取 Claude Code 本地会话、`CLAUDE.md` 记忆文件以及后续其他 Agent 工具的数据源
- 建立统一导入契约：把不同来源的消息、记忆和元数据归一化为一致的知识导入格式，便于治理和扩展
- 建立来源与证据链：为每条导入知识记录来源工具、原始文件或会话引用，确保后续可追溯、可审核
- 建立去重与合并流程：识别与现有知识重复、重叠或冲突的内容，并提供合并、覆盖或忽略策略
- 建立导入向导与回顾能力：支持用户分批导入、预览结果、选择保留项，并回看历史导入记录

## Capabilities

### New Capabilities

- `knowledge-import`: 定义跨 Agent/跨工具知识导入、格式适配、证据保留和去重合并能力

### Modified Capabilities

- `knowledge-engine`: 增加导入入口、来源管理、去重合并和导入后治理能力
- `data-layer`: 扩展知识来源字段、导入批次记录和去重关系模型
- `web-backend`: 暴露导入、预览、确认和导入记录查询 API
- `web-frontend`: 增加导入向导、来源筛选和导入结果回顾界面

## Impact

- `packages/core/src/knowledge/` — 新增 importers、归一化映射和去重合并模块
- `packages/core/src/database/dao/knowledge-dao.ts` — 扩展导入、批次记录和来源查询能力
- `packages/core/src/database/migrations.ts` — 增加导入批次与来源字段迁移
- `packages/web-backend/src/routes/knowledge.ts` — 增加导入预览、确认和历史记录 API
- `packages/web-frontend/src/pages/` — 新增跨工具知识导入向导页
- `packages/web-frontend/src/components/` — 增加来源预览、差异确认和导入结果组件
