## Why

知识会随着代码演进、外部依赖变化和团队决策更新而逐步失真。当前系统虽然已经有知识状态和版本记录，但还没有把“过时检测、来源追踪、冲突处理、治理闭环”提升为正式能力，这会直接影响知识可信度，也会拖累后续长期记忆、共享知识和自动推荐能力的质量。需要先建立治理底座，才能让知识积累真正可持续。

## What Changes

- 建立知识过时检测：结合时间衰减、仓库变更、引用失效和人工反馈，主动标记可能失真的知识条目
- 建立来源追踪：记录知识从哪次会话、哪个仓库、哪个 Agent、哪条操作链路中产生，并保留原始证据引用
- 建立冲突发现与处理流程：识别语义矛盾、重复覆盖或版本分叉的知识，并进入待审核队列
- 建立知识版本比对：支持查看知识演进历史、变更摘要和前后差异，方便审核和回滚
- 建立治理工作台：集中展示健康度、过时清单、冲突清单、待审核事项和治理操作入口

## Capabilities

### New Capabilities

- `knowledge-governance`: 定义知识过时检测、来源追踪、冲突治理、版本对比与治理工作台能力

### Modified Capabilities

- `knowledge-engine`: 增加过时判断、冲突检测、来源追踪和治理动作接口
- `data-layer`: 扩展知识条目的来源、健康度、冲突关系和版本元数据
- `web-backend`: 暴露治理查询、审核、合并和回滚相关 API
- `web-frontend`: 增加知识治理仪表板、冲突处理和版本对比界面

## Impact

- `packages/core/src/knowledge/` — 新增治理规则、冲突检测和健康度计算模块
- `packages/core/src/database/dao/knowledge-dao.ts` — 扩展来源、版本、冲突和治理查询能力
- `packages/core/src/database/migrations.ts` — 扩展知识表结构和关联表
- `packages/web-backend/src/routes/knowledge.ts` — 增加治理、审核、回滚和差异查询接口
- `packages/web-frontend/src/pages/` — 新增知识治理页与待审核队列
- `packages/web-frontend/src/components/` — 新增知识版本 diff 和冲突处理组件
