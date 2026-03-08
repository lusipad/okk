# OKK 仓库功能清单

文档版本：`2026-03-08`
文档定位：`全仓功能盘点 / 仓库级能力索引`

## 1. 仓库目标

OKK 目标是成为一个本地优先的工程研发赛博合伙人。

仓库当前已经覆盖以下五个层次：

- 产品层：聊天工作台、协作工作台、能力中心、桌面壳层
- 能力层：对话执行、协作编排、知识沉淀、工作流、治理与共享
- 应用层：Web Frontend、Web Backend、Desktop Main / Preload / Renderer
- 核心层：`@okk/core` 的领域模型、DAO、迁移、上下文与执行内核
- 规格层：OpenSpec proposal / design / spec / task / archive

## 2. 包级能力盘点

## 2.1 `@okk/core`

核心职责：领域建模与执行内核。

已落地对象：

- 用户、仓库、会话、消息
- Knowledge / Version / Tag
- Memory / Access Log
- Installed Skills
- Identity Profile
- Agent Trace
- Workspace
- Knowledge Governance
- Knowledge Import Batch / Item
- Skill Workflow / Workflow Run
- Memory Sharing / Review

已落地能力：

- SQLite 初始化、WAL、增量迁移、DAO 访问层
- CLI backend 执行、事件归一化、超时与重试
- 仓库上下文构建与继续工作摘要
- Team Run 编排与 TeamEvent 发布

## 2.2 `@okk/web-backend`

核心职责：对外 API 与 WebSocket 事件网关。

已落地接口域：

- `/api/auth`
- `/api/repos`
- `/api/sessions`
- `/api/knowledge`
- `/api/knowledge/suggestions`
- `/api/identity`
- `/api/agents`
- `/api/mcp`
- `/api/memory`
- `/api/skills`
- `/api/governance`
- `/api/knowledge-imports`
- `/api/workflows`
- `/api/workspaces`
- `/api/memory-sharing`

已落地实时通道：

- `/ws/qa/:sessionId`
- `/ws/team/:teamId`

## 2.3 `@okk/web-frontend`

核心职责：主工作台与能力页面。

已落地页面：

- Chat
- MCP Settings
- Skills
- Identity
- Memory
- Governance
- Workspaces
- Knowledge Imports
- Workflows
- Memory Sharing

已落地交互结构：

- 左侧分层导航
- 中间主舞台
- 右侧协作与知识上下文
- Trace 内联面板
- Team Run 观察入口

## 2.4 `@okk/desktop`

核心职责：桌面壳层与本地运行时整合。

已落地能力：

- embedded backend 启动
- preload / IPC bridge
- runtime monitor
- fallback page / diagnostics
- Windows dir 打包
- 桌面 smoke / runtime test

## 3. 领域能力盘点

## 3.1 对话与执行

状态：`已落地`

- 真实 CLI backend 调用
- ask / follow_up / abort / resume
- 统一流式事件
- 会话级恢复与错误提示

## 3.2 Agent / Team 协作

状态：`基础可用`

- Team Run 编排
- Team 状态、任务、消息流
- 协作侧栏信息展示
- Trace 时间线与文件变更查看

## 3.3 身份与长期关系

状态：`基础可用`

- Identity 配置与激活
- Identity prompt 注入
- Long-term Memory CRUD
- Project Context 继续工作入口

## 3.4 知识引擎与治理

状态：`能力可用，流程待继续产品化`

- Knowledge 建议生成 / 保存 / 忽略
- CRUD / Version / FTS
- Governance 健康度 / 冲突 / 过时 / 回滚
- Imports 预览 / 去重 / 批次回放

## 3.5 Skills / MCP / Workflow

状态：`能力可用`

- Skill 导入、安装、风险扫描、诊断、启停
- MCP 配置、启停、工具调用、资源读取
- Skill Workflow 模板、CRUD、执行、重试、历史

## 3.6 多仓库与共享

状态：`基础可用`

- Workspace CRUD
- 活跃仓库切换
- 跨仓库搜索
- Memory Sharing 审核 / 发布 / 回滚 / 推荐

## 3.7 桌面与交付

状态：`基础可交付`

- Desktop parity 基线
- runtime 诊断与 fallback
- Windows dir 打包
- smoke、像素比对、release prepare

## 4. 文档盘点

当前文档大致分为四类：

### 4.1 基线与架构

- `docs/product-architecture-baseline.md`
- `docs/overall-architecture.md`
- `docs/perception-memory-architecture.md`
- `docs/cyber-partner-roadmap.md`

### 4.2 能力专题

- Identity / Memory / Knowledge / Skills / Marketplace / Context / Session / Visual System / Advanced Workbenches

### 4.3 运维与验收

- deployment / recovery / governance / acceptance / desktop parity matrix

### 4.4 像素对齐专题

- `docs/pixel-clone/*`

## 5. 当前优势

- 功能覆盖面已超过“聊天原型”，具备明显平台化基础
- OpenSpec 流程已经能承载 proposal → design → spec → tasks → archive
- Web、Backend、Core、Desktop 四层已经形成联动闭环
- 高级工作台（Trace / Governance / Workflow / Workspace / Sharing）已经不再只是规格，而是可运行能力

## 6. 当前短板

- README 过去偏简略，不足以表达当前全仓能力与入口
- 某些能力虽然可用，但仍偏“能力集合”，缺少统一主流程收敛
- 远程协作、团队共享、Partner 关系化体验仍可继续深化
- 工作流与治理能力已落地，但还需要更多真实业务模板与运营规则

## 7. 推荐的下一步方向

### P1：Partner 主流程收敛

- 强化“继续上次工作”“我是谁”“最近记住了什么”“接下来建议做什么”
- 把功能集合收敛成稳定的日常主流程

### P2：团队级共享与治理闭环

- 强化角色、审批、共享范围、审计轨迹
- 让 Memory Sharing / Governance 真正进入团队协作场景

### P3：Workflow 产品化

- 建立真实模板库
- 引入更强的输入映射、条件分支与结果沉淀
- 打通与交付治理能力

### P4：Desktop 产品级体验

- 安装、升级、恢复、日志与桌面诊断进一步产品化
- 补强 packaged 运行态下的全链路 smoke