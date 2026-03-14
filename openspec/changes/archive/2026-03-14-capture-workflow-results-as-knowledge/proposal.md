_来源：拆分自 `knowledge-driven-workflow`。本 change 只负责工作流输出沉淀为知识以及围绕该链路的模板。_

## Why

工作流已经能编排步骤，但执行完成后结果仍然停留在运行记录里，无法自然沉淀为团队可复用的知识。若没有统一的结果发布链路，代码审查结论、上下文整理结果和知识巡检发现仍会散落在运行日志中，无法积累成长期资产。

## What Changes

- 为工作流运行结果增加“保存为知识”能力，支持将完整结果或摘要保存为知识条目
- 定义结果到知识条目的转换规则，包括标题、摘要、正文和标签的默认映射
- 预置 3 个围绕知识沉淀的模板：代码审查沉淀、上下文整理、知识健康检查
- 在运行详情与知识保存交互中补齐确认、编辑和成功回流体验

## Capabilities

### New Capabilities

- `workflow-knowledge-publishing`: 定义工作流结果到知识条目的保存、确认和模板化沉淀能力

### Modified Capabilities

- `skills-system`: 扩展工作流运行结果的导出与模板预置能力
- `knowledge-engine`: 提供工作流结果转知识的创建入口与默认元数据映射
- `web-backend`: 增加工作流结果保存为知识的 API 与模板分发接口
- `web-frontend`: 扩展运行详情中的保存、编辑和回流交互

## Impact

- `packages/core/`：新增 workflow result -> knowledge 的转换与模板元数据定义
- `packages/web-backend/`：暴露结果沉淀和模板查询接口
- `packages/web-frontend/`：扩展 WorkflowsPage 运行详情与知识保存入口
