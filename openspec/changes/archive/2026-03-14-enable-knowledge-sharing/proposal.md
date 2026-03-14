_来源：拆分自 `knowledge-sharing-expansion`。本 change 只负责知识共享、审核和发布，不包含标准格式导入导出或订阅分发。_

## Why

个人知识库已经具备沉淀能力，但团队内部仍缺少一个稳定的共享、审核和发布链路。若共享流程不单独建模，团队知识会长期停留在私人条目里，既无法复用，也难以控制敏感内容传播风险。

## What Changes

- 建立知识共享请求流程，允许个人知识条目进入共享队列
- 建立审核与发布状态流，支持审批、驳回、退回修改和正式发布
- 提供团队知识库浏览入口，区分个人条目与已发布共享条目
- 记录共享流转与审核操作，便于追溯发布决策

## Capabilities

### New Capabilities

- `knowledge-sharing`: 定义知识共享、审核、发布和团队浏览能力

### Modified Capabilities

- `knowledge-engine`: 扩展知识条目的共享状态、审核约束和团队可见性
- `data-layer`: 增加知识共享流转和审核记录模型
- `web-backend`: 增加共享请求、审核、发布和团队知识查询 API
- `web-frontend`: 增加共享设置、审核工作台和团队知识浏览界面

## Impact

- `packages/core/`：新增 knowledge sharing DAO、状态流转与可见性过滤
- `packages/web-backend/`：新增知识共享与审核相关 routes
- `packages/web-frontend/`：新增共享面板、审核列表和团队知识浏览入口
