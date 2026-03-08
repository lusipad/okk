# OKK 项目整体架构文档

文档版本：`v3.0`
文档状态：`Project Architecture Baseline`
最后更新：`2026-03-07`
适用范围：`OKK 全项目（产品、业务、能力、系统、部署、交付）`

---

## 1. 文档定位

### 1.1 目标

本文定义的是 **整个 OKK 项目的总体架构**，不是单一前端、后端或某个模块的技术说明。

当前正式产品形态与架构形态，以 `docs/product-architecture-baseline.md` 为主基线；本文保留为项目总览与落地映射文档。

它用于统一以下内容：

- 项目的产品定位与边界
- 业务对象与核心工作流
- 能力分层与模块职责
- 系统拓扑、部署方式、数据流与状态归属
- 安全、质量、测试、发布与演进治理机制

后续所有 OpenSpec 提案、设计稿、研发任务、测试验收、发布流程，都必须与本文保持一致。

### 1.2 非目标

本文不替代以下文档：

- 视觉稿与像素级 UI 标注文档
- 单个模块的详细设计文档
- 某一次 change 的任务分解清单
- 商业策略、定价、市场增长方案

### 1.3 架构原则

- `产品优先`：系统设计先服务“协作效率”和“真实可用性”，不是为了堆叠技术名词。
- `简单可靠`：优先可运行、可恢复、可发布、可诊断的方案。
- `单向分层`：模块边界清晰，禁止跨层侵入。
- `共享内核`：核心能力只实现一次，Web 与 Desktop 复用。
- `可观测可验收`：所有关键链路都必须能测试、诊断、回滚。
- `能力显式化`：Skill、MCP、多 Agent、工具调用、运行状态都必须对用户可见。

### 1.4 命名策略

- 项目统一品牌名称为 `OKK`，正式全称为 `Open Knowledge Kernel`。
- 工程命名已统一切换到 `okk` / `OKK`，包括包名、配置目录、环境变量与桌面标识。
- 后续新增代码、脚本、文档与配置禁止再引入 `旧项目标识` 相关命名。
- 若外部环境存在旧名称缓存，需要在发布与运维环节同步清理。

---

## 2. 项目定义

### 2.1 项目定位

OKK 是一个面向开发者与研发团队、以“你的赛博合伙人”为核心体验的工程工作台。

它不是单纯的聊天工具，也不是单纯的 IDE 插件，而是一个整合以下能力的工作平台：

- 本地优先的 Partner 工作模式
- 长期记忆与 Source-first 理解
- 多 Agent 协作与远程协作能力
- Skills / MCP / CLI / IDE 等执行能力接入
- 官网级聊天式工作界面
- 仓库上下文理解、知识沉淀与工作痕迹复用
- Web 与 Desktop 双形态交付

### 2.2 项目核心价值

OKK 要解决的不是“能不能和模型对话”，而是以下系统性问题：

- 开发上下文分散：问题、代码、工具、知识分散在不同系统里
- 协作过程不可见：多 Agent 工作常常黑盒化，难以跟踪和回放
- 知识无法沉淀：有价值的对话与输出难以结构化为可检索资产
- 工具接入混乱：Skill、脚本、MCP、CLI 后端没有统一治理
- 交付不完整：很多原型只有前端壳，没有真实后端、测试与发布闭环
- 关系缺失：传统 AI 工具缺少长期连续性，难以形成“赛博合伙人”体验

### 2.2.1 最近已落地能力`r`n`r`n- CLI 后端已具备统一事件归一化、超时治理、重试与运行时诊断。`r`n- 聊天主链路已具备重连恢复、resume 反馈和会话级运行状态表达。`r`n- 仓库上下文已支持持久化偏好、最近活动和“继续上次工作”入口。`r`n- 会话历史已支持搜索、归档/恢复和引用历史片段。`r`n- Skills 系统已支持启用/禁用、依赖异常诊断和状态持久化。`r`n`r`n### 2.3 目标产品形态

OKK 的目标产品形态是：

- 默认以“你的赛博合伙人”这一体验进入
- 在需要时进入远程协作与共享模式
- 通过感知、记忆、执行与协作形成持续关系
- 表层像 ChatGPT / Claude / Cowork 一样干净、稳定、低噪音
- 底层具备真实运行时、知识引擎、质量门禁与桌面分发能力

---
## 3. 利益相关方与使用场景

### 3.1 角色定义

| 角色 | 目标 | 典型行为 |
| --- | --- | --- |
| 个人开发者 | 快速提问、执行任务、调用能力 | 发起对话、启用 Skill/MCP、查看工具调用 |
| 技术负责人 | 拆解问题、协作编排、审查结果 | 启动 Team Run、查看 DAG、汇总结果 |
| 知识管理员 | 沉淀知识、维护技能与工具安全 | 保存知识建议、审核 Skill、维护 MCP |
| 平台维护者 | 保障系统稳定可发布 | 诊断后端、运行 smoke、打包发布 |

### 3.2 核心使用场景

#### 场景 A：单 Agent 问答与执行

- 用户进入聊天工作台
- 选择 Agent / Skill / MCP 组合
- 发起问题或任务
- 实时查看流式回复、工具调用、错误与重试

#### 场景 B：多 Agent 协作

- 用户发起一个复杂任务
- 系统创建 Team Run
- 多个 Agent 并行或按依赖执行
- 用户在时间线与 DAG 中跟踪过程与结果

#### 场景 C：知识沉淀

- 对话产生知识建议
- 用户保存、忽略或后续编辑
- 内容进入可检索知识库与版本体系

#### 场景 D：能力治理

- 用户在 Skill 页面浏览、导入、安装或删除技能
- 用户在 MCP 设置页配置服务、调用工具、读取资源
- 平台对风险与运行时状态进行可视化诊断

#### 场景 E：桌面本地工作

- 用户直接启动桌面版
- 系统自动拉起内置后端
- 用户无需额外手工启动服务即可使用完整链路

---

## 4. 项目总体架构视图

### 4.1 五层架构

```mermaid
flowchart TB
  subgraph L1[产品层]
    UX[聊天工作台 / 协作工作台 / 能力中心 / 设置中心]
  end

  subgraph L2[能力层]
    CHAT[对话引擎]
    TEAM[多 Agent 编排]
    SKILL[Skills / MCP]
    KNOW[知识引擎]
    RUNTIME[运行时诊断]
  end

  subgraph L3[应用层]
    WEBFE[Web Frontend]
    DESKRE[Desktop Renderer]
    WEBBE[Web Backend]
    DESKMAIN[Desktop Main]
  end

  subgraph L4[领域层]
    CORE[@okk/core]
    DOMAIN[Session / Agent / Team / Skill / Knowledge / Repo]
  end

  subgraph L5[基础设施层]
    CLI[Codex / Claude CLI]
    MCP[MCP Servers]
    DB[(SQLite)]
    FS[Workspace / Skills / Config]
    CI[CI / Packaging / Smoke / Pixel Gate]
  end

  UX --> CHAT
  UX --> TEAM
  UX --> SKILL
  UX --> KNOW
  UX --> RUNTIME

  CHAT --> WEBFE
  TEAM --> WEBFE
  SKILL --> WEBFE
  KNOW --> WEBFE
  RUNTIME --> WEBFE

  WEBFE --> WEBBE
  DESKRE --> DESKMAIN
  DESKMAIN --> WEBBE
  WEBBE --> CORE
  DESKMAIN --> CORE
  CORE --> DOMAIN
  CORE --> CLI
  CORE --> MCP
  CORE --> DB
  CORE --> FS
  WEBBE --> CI
```

### 4.2 分层含义

- `产品层`：用户真正感知到的工作界面与交互结构
- `能力层`：项目承诺提供的核心业务能力
- `应用层`：承载能力的前后端与桌面进程
- `领域层`：核心业务模型与编排内核
- `基础设施层`：CLI、MCP、SQLite、文件系统、CI/CD 等底座

---

## 5. 业务与能力架构

### 5.1 核心能力地图

| 能力域 | 子能力 | 目标 |
| --- | --- | --- |
| 对话工作台 | 会话、消息流、输入编排、工具可见化 | 提供主工作入口 |
| 协作编排 | Team Run、成员状态、任务 DAG、事件时间线 | 支撑多 Agent 协作 |
| 能力扩展 | Skills、Skill 市场、MCP 配置、运行时调用 | 扩展可执行能力 |
| 知识引擎 | 建议生成、保存/忽略、搜索、版本 | 让对话产出可沉淀 |
| 仓库上下文 | 仓库注册、上下文构建、文件/仓库路径约束 | 提高执行准确性 |
| 运行时治理 | Backend 健康、错误恢复、日志与调试 | 保证系统可用 |
| 发布交付 | Web 构建、桌面打包、E2E、像素门禁 | 保证可交付 |

### 5.2 能力之间的关系

- 对话工作台是主入口，其他能力围绕其服务。
- 多 Agent 编排不是独立产品，而是对复杂任务的增强执行模式。
- Skills 与 MCP 是能力来源，不是主流程本身。
- 知识引擎是结果沉淀层，承接对话与协作的产出。
- 运行时治理覆盖所有能力域，是平台稳定性的保障层。

### 5.3 当前能力现状

当前仓库已经具备以下基础：

- 基础聊天、会话、流式事件链路已存在
- Team Run、右侧协作面板、时间线与图视图已落地基础版本
- Skills 与 MCP 已有基本管理和运行调试能力
- Knowledge 已有建议保存/忽略、CRUD 与 FTS 基础
- Desktop 已有 Electron 壳、embedded backend、Windows 打包流程

但整体仍处于“功能已覆盖、产品未收敛”的阶段，尤其在：

- 界面一致性
- 信息架构
- 运行闭环
- Desktop 真正等价能力
- 多 Agent 交互显性化

上仍未达到目标产品级别。

---

## 6. 领域架构

### 6.1 核心领域对象

| 领域对象 | 含义 | 当前承载位置 |
| --- | --- | --- |
| User | 使用系统的用户 | SQLite / JWT |
| Repository | 代码仓库上下文 | SQLite |
| Session | 一次对话工作流上下文 | SQLite + Frontend Store |
| Message | 会话消息与工具元数据 | SQLite + Frontend Store |
| Agent | 可选执行角色 | Core |
| Team Run | 多 Agent 协作执行实例 | SQLite + Core 内存 |
| Skill | 可安装、可注入的高层能力 | 文件系统 + SQLite |
| MCP Server | 可启停的外部工具能力 | 文件配置 + 后端运行时 |
| Knowledge Entry | 可沉淀知识条目 | SQLite |
| Runtime Backend | Claude/Codex 等执行后端 | Core Runtime |

### 6.2 领域边界

- `Session / Message` 负责用户工作上下文
- `Agent / Team Run` 负责执行组织方式
- `Skill / MCP` 负责能力来源
- `Knowledge Entry` 负责结果沉淀
- `Repository` 负责工程上下文与文件访问边界

### 6.3 领域规则

- 一条消息必须隶属于一个会话
- 一次 Team Run 必须隶属于一个会话
- Skill 与 MCP 的启用是“本轮选择”，不应隐式污染全部会话
- 知识建议来自对话或执行结果，但保存后独立成知识资产
- Agent 是定义，Team Run 成员是实例

---

## 7. 系统架构

### 7.1 代码模块映射

| 模块 | 目录 | 角色 |
| --- | --- | --- |
| Core | `packages/core` | 领域核心与执行编排 |
| Web Backend | `packages/web-backend` | REST/WS 服务入口 |
| Web Frontend | `packages/web-frontend` | Web 交互界面 |
| Desktop | `packages/desktop` | 桌面容器与本地运行桥接 |
| Docs | `docs` | 项目文档、像素验收与运维文档 |
| OpenSpec | `openspec` | 变更驱动规格体系 |
| Scripts | `scripts` | 测试、像素、打包、烟测脚本 |

### 7.2 模块职责

#### `packages/core`

负责：

- BackendManager
- Codex / Claude CLI 接入
- AgentRunner / TeamManager
- SkillRegistry
- RepositoryContextService
- SQLite 数据层与 DAO

#### `packages/web-backend`

负责：

- Fastify App 组装
- JWT 鉴权
- REST 路由
- QA / Team WebSocket 网关
- MCP Runtime 管理 API

#### `packages/web-frontend`

负责：

- 登录页、聊天页、Skills 页、MCP 设置页
- 壳层布局、消息流、输入区、侧栏
- 前端状态管理
- HTTP + WebSocket IOProvider

#### `packages/desktop`

负责：

- BrowserWindow / Tray / Shortcut
- embedded backend 启动
- preload 桥接
- Windows 打包

### 7.3 当前系统拓扑

```mermaid
flowchart LR
  USER[User]
  USER --> WEB[Browser]
  USER --> DESK[OKK Desktop]
  WEB --> FE[web-frontend]
  DESK --> MAIN[desktop main]
  MAIN --> FE
  FE --> API[web-backend]
  MAIN --> API
  API --> CORE[@okk/core]
  CORE --> COD[Codex CLI]
  CORE --> CLA[Claude CLI]
  API --> MCPR[MCP Runtime]
  MCPR --> MCPS[MCP Servers]
  CORE --> SQLITE[(core.db)]
```

---

## 8. 应用交互架构

### 8.1 目标信息架构

| 区域 | 内容 | 说明 |
| --- | --- | --- |
| 左栏 | 全局导航、搜索、会话列表、新建入口 | 面向“切换与定位” |
| 中栏 | 聊天主舞台、消息流、输入区 | 面向“执行主任务” |
| 右栏 | 协作、知识建议、运行诊断、任务图 | 面向“上下文与反馈” |
| 全局层 | 命令面板、快捷键、主题、通知 | 面向“全局操作” |

### 8.2 交互原则

- 主流程只在中栏发生，避免噪音打断。
- 复杂过程放在右栏或展开面板，不挤占主舞台。
- 任意执行都必须可见：发送中、流式中、工具调用中、失败、重试、停止。
- 任意协作都必须可追踪：成员、任务、依赖、摘要。
- 任意能力都必须可理解：Skill/MCP 不能只是开关，必须有状态与诊断。

### 8.3 Web 与 Desktop 一致性原则

- 同一业务操作必须遵循相同契约与结果结构。
- 可允许外观与容器能力不同，但不能出现“Web 能用，Desktop 只是壳”的架构分裂。

---

## 9. 数据与状态架构

### 9.1 持久化数据

当前以 SQLite 作为主持久化介质，核心表包括：

- `users`
- `repositories`
- `sessions`
- `messages`
- `knowledge_entries`
- `knowledge_versions`
- `knowledge_tags`
- `knowledge_fts`
- `agent_runs`
- `team_runs`
- `installed_skills`

### 9.2 运行时内存状态

| 状态层 | 归属 |
| --- | --- |
| 事件缓冲 | `QaEventStore` / Backend 层 |
| 运行队列 | `BackendManager` |
| Team 执行上下文 | `TeamManager` |
| 前端视图状态 | `chat-store.tsx` |
| Electron 窗口状态 | `desktop main` |

### 9.3 文件与配置状态

| 类型 | 路径 |
| --- | --- |
| SQLite DB | `.okk/core.db` |
| MCP 配置 | `.okk/mcp-servers.json` |
| Skill 市场索引 | `.okk/skill-market.json` |
| Skills 目录 | `.codex/skills` / `.claude/skills` |

### 9.4 状态归属原则

- 要跨重启保留的状态必须持久化
- 要跨端共享的状态不能只留在本地窗口内存
- 纯 UI 状态不能下沉到数据库
- 运行缓冲与事件恢复逻辑必须留在后端或核心层

---

## 10. 运行与部署架构

### 10.1 开发模式

- Web Backend：本地启动 Fastify
- Web Frontend：Vite Dev Server
- Desktop：Electron + 本地前端 + embedded backend

### 10.2 Web 部署模式

适用于内网单机或轻量团队部署：

- 后端：Node.js 进程
- 前端：静态资源托管
- 数据：本地 SQLite
- CLI 后端：本机安装 `codex` / `claude`

### 10.3 Desktop 部署模式

适用于单机桌面使用：

- Electron 主进程启动时自动拉起 embedded backend
- 前端从本地打包资源加载
- 用户无需手工启动额外服务

### 10.4 外部依赖边界

| 依赖 | 角色 | 风险 |
| --- | --- | --- |
| Codex CLI | AI 执行后端 | 安装状态、命令兼容性 |
| Claude CLI | AI 执行后端 | 安装状态、命令兼容性 |
| MCP Server | 工具能力来源 | 第三方协议与稳定性 |
| 本地文件系统 | 仓库、Skill、配置 | 权限与路径一致性 |

---

## 11. 安全与治理架构

### 11.1 安全基线

- 身份认证：用户名密码 + JWT
- 配置安全：敏感信息通过 env 或安全输入传递
- Skill 安全：安装前风险扫描
- MCP 安全：运行在后端侧，前端仅消费接口
- 文件边界：仓库路径与工作目录必须受控

### 11.2 风险控制点

- CLI 后端不可用时必须显式告警
- Skill 高风险操作必须阻断自动安装
- MCP 工具失败必须带错误码与原因返回
- Desktop 内置后端启动失败必须可诊断，不允许静默空白页

### 11.3 治理方式

- OpenSpec 负责“变更前定义”
- Docs 负责“项目级基线与运维知识”
- 测试与 CI 负责“变更后验证”

---

## 12. 工程与交付架构

### 12.1 研发流程架构

项目采用“规格 -> 实现 -> 验证 -> 发布”的闭环：

1. 先在 `openspec` 中定义 change
2. 再在代码中实现能力
3. 再通过测试、smoke、pixel gate 验证
4. 最后通过 release / desktop package 输出可交付产物

### 12.2 质量门禁

当前门禁链路包括：

- workspace 测试
- workspace 构建
- smoke E2E
- pixel baseline / diff / report
- reference diff
- desktop Windows package CI

### 12.3 发布架构

| 产物 | 方式 |
| --- | --- |
| Web Release | `release:prepare` |
| Desktop Windows | GitHub Actions + `electron-builder` |
| 验收截图与报告 | `pixel-*` / `chrome-compare` |

---

## 13. 架构硬约束

以下内容属于项目硬约束，任何改造不得绕过：

- 问答主链路必须接入真实 CLI 后端，不能只有 mock。
- WebSocket 事件必须可恢复、可去重、可追踪。
- Skill / MCP / 多 Agent 必须纳入统一交互与诊断体系。
- Web 与 Desktop 必须共享核心业务逻辑，不允许形成两套系统。
- 新能力必须进入测试与发布闭环，否则不能视为完成。
- UI 改造必须接受像素与端到端验收，而不是仅凭人工主观判断。

---

## 14. 当前问题与整体改造方向

### 14.1 当前主要问题

当前仓库的主要矛盾不是“没有能力”，而是“能力分散且产品化不足”：

- 项目已有多数基础能力，但缺乏统一产品结构
- 前端交互层仍偏原型，不够官网级
- Desktop 仍未完全做到与 Web 等价
- 多 Agent / Skill / MCP 的关系对用户还不够直观
- 文档层面此前偏实现视角，缺少项目总架构视图

### 14.2 总体改造方向

后续整体改造应围绕以下主线推进：

- 从“页面集合”升级为“统一工作台”
- 从“功能存在”升级为“能力编排清晰可见”
- 从“工程可运行”升级为“产品可发布可体验”
- 从“单端完成”升级为“Web / Desktop 双端一致”
- 从“局部文档”升级为“项目级治理闭环”

### 14.3 优先级排序

1. 统一信息架构与交互架构
2. 收敛主工作台视觉与组件体系
3. 打通真实多 Agent / Skill / MCP 体验闭环
4. 补齐 Desktop 等价能力与端到端验证
5. 固化发布、回滚与运维闭环

---

## 15. 附录：当前实现映射

### 15.1 关键代码入口

- `packages/core/src/create-core.ts`
- `packages/core/src/backend/backend-manager.ts`
- `packages/core/src/team/team-manager.ts`
- `packages/core/src/database/schema.ts`
- `packages/web-backend/src/app.ts`
- `packages/web-backend/src/ws/qa-gateway.ts`
- `packages/web-frontend/src/App.tsx`
- `packages/web-frontend/src/pages/ChatPage.tsx`
- `packages/web-frontend/src/components/layout/ShellLayout.tsx`
- `packages/web-frontend/src/state/chat-store.tsx`
- `packages/desktop/src/main/index.ts`
- `packages/desktop/src/main/embedded-backend.ts`
- `.github/workflows/desktop-windows-package.yml`

### 15.2 相关基线文档

- `docs/pixel-clone/README.md`
- `docs/pixel-clone/acceptance-matrix.md`
- `docs/pixel-clone/progress.md`
- `docs/intranet-deployment-runbook.md`
- `docs/failure-recovery-runbook.md`
- `docs/brand-naming.md`

---

## 16. 版本记录

- `v2.2 (2026-03-06)`：完成项目内 `旧标识 -> okk` 全量命名迁移，并将命名策略更新为统一 `OKK / Open Knowledge Kernel`。
- `v2.1 (2026-03-06)`：切换项目对外品牌为 `OKK / Open Knowledge Kernel`，并明确第一阶段品牌与技术标识分离策略。
- `v2.0 (2026-03-06)`：将文档提升为项目整体架构文档，覆盖产品、业务、能力、系统、数据、部署、安全、交付与整体改造方向。
- `v1.1 (2026-03-06)`：补充目标产品信息架构、模块依赖规则、状态归属规则与架构不变量。
- `v1.0 (2026-03-05)`：首次建立项目级整体架构基线文档，覆盖当前实现、目标架构、质量门禁与治理机制。




