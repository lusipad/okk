_来源：拆分自 `knowledge-driven-workflow`。本 change 只负责让工作流消费知识，不负责把运行结果发布回知识库。_

## Why

当前工作流系统已经具备节点建模、执行和运行历史，但工作流仍无法引用已沉淀的知识作为输入。开发者在复用代码规范、仓库约定、治理规则等场景里，仍需手动复制知识内容到 prompt 节点，既低效，也破坏知识作为结构化上下文的价值。

## What Changes

- 扩展 `SkillWorkflowNodeType`，新增 `knowledge_ref` 节点类型
- 支持工作流节点配置知识条目引用、筛选条件和输出键，作为后续节点输入上下文
- 更新工作流编辑器与运行时视图，使知识节点可被创建、预览和追踪
- 在工作流执行链路中解析知识节点并将内容注入后续 prompt / agent / skill 节点

## Capabilities

### New Capabilities

- `workflow-knowledge-inputs`: 定义工作流对知识条目的引用、配置和执行期注入能力

### Modified Capabilities

- `skills-system`: 扩展工作流节点模型与执行逻辑，支持 `knowledge_ref`
- `web-frontend`: 扩展工作流编辑器与运行详情对知识节点的配置和展示
- `web-backend`: 扩展工作流 API 的节点校验与运行序列化能力

## Impact

- `packages/core/`：调整 workflow node 类型、执行器与节点配置模型
- `packages/web-backend/`：补齐知识节点的请求校验和运行输出结构
- `packages/web-frontend/`：为工作流编辑器增加知识节点创建、选择和预览 UI
