## Why

单个 Skill 更像一个能力原子，而真实工程工作往往需要一组固定顺序、带条件判断和上下文传递的步骤。缺少工作流层时，用户只能靠记忆手动组织“先做什么、再做什么、失败后怎么办”，这会让高频流程无法复用，也让 Agent 与 Skill 的组合能力难以沉淀。需要把“Skill 组合成工作流”升级为正式能力，让 OKK 可以复用工程 SOP 而不仅是单次执行命令。

## What Changes

- 建立工作流定义格式：支持描述节点、执行顺序、输入输出映射、条件分支、失败处理和人工确认点
- 建立工作流运行模型：把 Agent、Skill、提示模板和上下文注入组织成可复用节点，并在执行中传递状态
- 建立模板库与分享机制：预置常见工程工作流模板，并支持保存团队自定义流程供重复使用
- 建立运行与观察能力：记录每次工作流执行结果、步骤状态和失败原因，便于重试与复盘
- 建立编辑与管理入口：支持在界面中创建、编辑、复制和发布工作流模板

## Capabilities

### New Capabilities

- `skill-workflows`: 定义工作流建模、模板管理、执行编排和运行历史能力

### Modified Capabilities

- `skills-system`: 允许 Skill 作为标准工作流节点被引用、配置和复用
- `agent-system`: 支持 Agent 在工作流上下文中执行、交接和汇总结果
- `web-backend`: 暴露工作流定义、执行、重试和历史查询 API
- `web-frontend`: 增加工作流编辑器、模板库和执行观察界面

## Impact

- `packages/core/src/skills/` — 新增工作流定义、执行引擎和节点适配层
- `packages/core/src/agent/` 或对应目录 — 支持工作流上下文下的 Agent 运行模式
- `packages/core/src/database/` — 增加工作流定义和运行历史持久化
- `packages/web-backend/src/routes/` — 增加工作流 CRUD、执行和历史 API
- `packages/web-frontend/src/pages/` — 新增工作流列表、编辑器和执行详情页
- `packages/web-frontend/src/components/` — 新增流程画布、节点配置和运行状态组件
