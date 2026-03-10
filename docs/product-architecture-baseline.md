# OKK 产品与架构基线

文档版本：`v1.0`
文档状态：`Approved Baseline`
最后更新：`2026-03-07`
适用范围：`OKK 产品定义、架构形态、能力边界、后续 OpenSpec 与实施决策`

---

## 1. 文档定位

本文是 OKK 的正式产品与架构基线，用于回答以下问题：

- 我们究竟在做什么产品
- 产品默认工作模式是什么
- 本地能力、远程协作和分享能力如何组织
- 感知、记忆、执行、协作分别属于哪一层
- 后续所有 OpenSpec、UI 设计、数据结构和运行时实现应围绕哪些对象展开

本文优先级高于零散对话结论。后续功能讨论若与本文冲突，应先修订本文，再继续实现。

---

## 2. 最终产品定义

### 2.1 一句话定义

OKK 是你的**赛博合伙人**。

- 默认使用用户本地的仓库、文档、工具和运行时能力
- 通过灵魂内核与长期记忆形成持续协作关系
- 通过工作台能力完成理解、执行、沉淀与交付
- 在授权下进入远程协作、共享与多方 Agent 协作模式

### 2.1.1 术语约定

- 对外一级产品语言统一使用 `OKK 是你的赛博合伙人`。
- 内部对象模型、架构图和后续实现中保留 `Partner` 作为工程术语。
- `赛博合伙人 = Partner + Identity + Memory + Relationship`，前者是产品叙事，后者是工程对象。

### 2.2 我们不在做什么

OKK 不是：

- 纯聊天客户端
- 单一 IDE 插件
- 只负责回答问题的研究助手
- 只有前端壳、没有真实运行时的原型
- 默认云端优先、必须联网登录才可工作的 SaaS 前端

### 2.3 核心价值主张

OKK 要解决的不是“能不能跟模型聊天”，而是：

- 如何拥有一个长期稳定、理解自己工作方式的赛博合伙人
- 如何把本地仓库、文档、历史协作和工具能力组织成可工作的上下文
- 如何让 Agent 不仅会分析，还能可靠地执行、验证、交付
- 如何在本地优先的前提下，与其他人和其他 Agent 形成远程协作关系
- 如何将工作过程中的经验和判断沉淀为长期可复用资产

---

## 3. 产品形态

### 3.1 三种产品模式

#### A. Personal Mode

默认模式，主入口，面向“我和我的赛博合伙人”。

特征：

- 桌面端优先
- 默认本地自动登录
- 默认使用本地 backend、本地仓库、本地文件、本地 Skills / MCP
- 默认不要求先进入远程身份与共享流程
- 强调低摩擦、私密、本地即时可用

#### B. Collaboration Mode

增强模式，面向“我、其他人、其他 Agent”之间的协作关系。

特征：

- 可以共享任务包、会话、知识、资料范围和结果
- 可以邀请其他人加入当前任务或工作本
- 可以将任务委派给其他 Agent 或其他工作台
- 必须有明确身份、权限、共享范围与撤回机制

#### C. Publish Mode

资产化模式，面向“把经验、能力、工作流分享出去”。

特征：

- 分享 Agent 配置、Skill 组合、知识包、任务模板、协作流程
- 让个人经验成为团队或组织可复用资产
- 不要求一开始做满，但必须作为长期架构方向保留

### 3.2 模式之间的关系

- `Personal Mode` 是默认入口，不应被登录或协作配置阻塞
- `Collaboration Mode` 是增强层，不应破坏本地默认体验
- `Publish Mode` 是结果层，用于沉淀和扩散经验，而不是主流程本身

---

## 4. 核心对象模型

### 4.1 Partner

赛博合伙人本体。它不是一次性会话，而是持续存在的个体。

职责：

- 代表用户理解任务
- 调用本地与授权的远程能力执行工作
- 基于记忆和来源材料形成稳定协作风格
- 在授权下代表用户进行对外沟通与协作

### 4.2 Identity Kernel

Partner 的“灵魂内核”，用于定义长期稳定特征。

最小字段：

- `name`
- `role`
- `style`
- `principles`
- `taboos`
- `long_term_goals`
- `evolution_policy`

约束：

- 不是一段 prompt 文本，而是结构化模型
- 某些字段允许演化，某些字段必须稳定
- 必须支持用户查看与修订

### 4.3 Workspace

工作本 / 工作空间，是本地工作单元。

职责：

- 汇聚 repo、文档、文件、知识、笔记、任务和会话
- 作为本地工作的主要上下文边界
- 承载感知、记忆、协作和执行的默认作用域

### 4.4 Source Pack

一组被授权用于当前任务的来源材料。

类别：

- `canonical sources`：repo、doc、note、knowledge、web source
- `agent trace sources`：Codex / Claude Code 本地工作痕迹、tool runs、patches、test runs
- `memory sources`：偏好记忆、项目记忆、过程记忆、事件记忆

### 4.5 Mission

一项具体任务，回答“现在要完成什么”。

职责：

- 绑定目标、验收标准、约束与当前来源范围
- 驱动 Agent 拆解、执行、协作、验证与交付
- 承载一次任务的 timeline、decision、artifact 和 result

### 4.5.1 Mission 的协作模式

Mission 在体验层至少支持两种协作模式：

- `Direct Thread`：你与一个 Partner 的一对一协作模式，适合单人主导、上下文连续的小中型任务
- `Mission Room`：你与多个 Partner 的团队协作模式，适合需要拆解、并行推进、审查与交接的复杂任务

两者的差异不在于“聊天窗口数量”，而在于：

- 是否存在多个并行执行单元
- 是否存在结构化交接
- 是否需要显式用户确认点

### 4.5.2 Workstream

Mission 下的并行子任务对象，回答“这项任务当前拆成了哪些可推进单元”。

职责：

- 将 Mission 拆分为多个可分配、可追踪、可并行的执行单元
- 绑定负责人 Partner、状态、依赖与产出
- 作为团队整体进度的最小统计单位

最小字段建议：

- `id`
- `mission_id`
- `title`
- `assignee_partner_id`
- `status`
- `depends_on_workstream_ids`
- `started_at`
- `ended_at`

### 4.5.3 Checkpoint

Mission 或 Workstream 上的用户确认点，回答“当前有哪些关键问题必须等用户拍板”。

职责：

- 阻止系统在关键方向上无确认自转
- 将“等待确认”从聊天语义提升为结构化任务状态
- 为首页与任务页提供 `awaiting_user` 视角

最小字段建议：

- `id`
- `mission_id`
- `workstream_id?`
- `type`
- `title`
- `summary`
- `status`
- `requires_user_action`

### 4.5.4 Handoff

Partner 之间的结构化交接对象，回答“谁把什么交给了谁继续处理”。

职责：

- 显式表达设计、审查、实现、治理等跨角色协作
- 让“合作”体现为任务交接，而不是混杂在普通消息流中的发言
- 为任务时间线提供可审计的协作事件

最小字段建议：

- `id`
- `mission_id`
- `from_workstream_id`
- `to_partner_id`
- `reason`
- `payload_summary`
- `status`

### 4.5.5 Mission Summary

Mission 在首页与列表页的投影视图，回答“这个任务整体推进到哪里了”。

建议至少包含：

- `partner_count`
- `workstream_total`
- `workstream_completed`
- `blocked_count`
- `open_checkpoint_count`
- `phase`

### 4.6 Team Run

多 Agent 协作运行对象。

职责：

- 负责多 Agent 分工、依赖、时间线、图视图与状态流
- 用于复杂任务的并行协作，而不是默认路径
- 更适合作为 Mission Room 的一次运行实例，而不是产品层主对象本身

### 4.7 Memory

长期记忆对象，不等于原始聊天记录。

类型：

- `preference memory`
- `project memory`
- `relationship memory`
- `process memory`
- `episodic memory`

每条记忆必须至少包含：

- 内容
- 类型
- 来源
- 置信度
- 作用域
- 是否可共享
- 最近使用时间
- 是否允许编辑/删除

### 4.8 Share Link / Collaboration Link

共享与协作边界对象。

职责：

- 定义分享给谁
- 分享什么
- 权限多大
- 有效期多久
- 是否允许执行、仅聊天、还是只读查看

---

## 5. 本地优先原则

### 5.1 默认本地能力

默认应优先使用：

- 本地 backend
- 本地 repo
- 本地文件
- 本地 Agent 运行时
- 本地 Skills / MCP
- 本地 Knowledge / Memory
- 本地 Codex / Claude Code / IDE / 测试 / 构建工具链

### 5.2 本地优先不等于本地阉割版

本地模式必须是可完整工作的主形态，而不是云协作的简化壳。

### 5.3 登录策略

- Desktop：默认自动本地登录，失败时才回退到显式登录
- Web：显式登录，适合共享、部署和多用户场景

---

## 6. 感知、理解、执行、记忆、协作五段模型

### 6.1 感知

Agent 通过授权范围内的来源和运行时信号感知当前工作。

### 6.2 理解

Agent 将原始输入解释为当前任务目标、风险、上下文和建议行动。

### 6.3 执行

Agent 在授权下调用本地或远程能力完成任务。

### 6.4 记忆

Agent 将高价值工作经验提炼为长期记忆，而不是无差别保存所有历史。

### 6.5 协作

Agent 在授权下与其他人、其他 Agent 或其他工作台建立协作关系。

---

## 7. 架构形态

### 7.1 七层模型

```mermaid
flowchart TB
  subgraph P1[产品层]
    PARTNER[Partner / Workspace / Mission / Memory / Share]
  end

  subgraph P2[体验层]
    DESKUX[Desktop Workbench]
    WEBUX[Web Workbench]
    EMBODY[Embodiment Layer]
  end

  subgraph P3[应用层]
    WEBFE[Web Frontend]
    DESKRE[Desktop Renderer]
    DESKMAIN[Desktop Main]
    WEBBE[Web Backend]
  end

  subgraph P4[能力层]
    PERCEPT[Perception]
    UNDERSTAND[Understanding]
    EXEC[Execution]
    MEMORY[Memory]
    COLLAB[Collaboration]
  end

  subgraph P5[领域层]
    CORE[@okk/core]
    DOMAIN[Partner / Mission / Source / Memory / Team]
  end

  subgraph P6[基础设施层]
    CLI[Codex / Claude CLI]
    IDE[VS / VS Code / DAP / Editor Bridge]
    MCP[MCP Servers]
    DB[(SQLite)]
    FS[Workspace / Files / Config]
    ADO[Azure DevOps / Remote Systems]
  end

  subgraph P7[治理层]
    OBS[Diagnostics / Logs / Runtime State]
    CI[CI / Smoke / Packaging / Release]
    POLICY[Privacy / Scope / Approval]
  end

  PARTNER --> DESKUX
  PARTNER --> WEBUX
  PARTNER --> EMBODY
  DESKUX --> DESKRE
  WEBUX --> WEBFE
  DESKRE --> DESKMAIN
  WEBFE --> WEBBE
  DESKMAIN --> WEBBE
  WEBBE --> CORE
  DESKMAIN --> CORE
  CORE --> PERCEPT
  CORE --> UNDERSTAND
  CORE --> EXEC
  CORE --> MEMORY
  CORE --> COLLAB
  PERCEPT --> CLI
  PERCEPT --> IDE
  PERCEPT --> MCP
  PERCEPT --> FS
  EXEC --> CLI
  EXEC --> IDE
  EXEC --> ADO
  MEMORY --> DB
  COLLAB --> ADO
  CORE --> OBS
  WEBBE --> CI
  DESKMAIN --> OBS
  POLICY --> CORE
```

### 7.2 层次说明

- `产品层`：定义用户真正拥有的赛博合伙人对象模型
- `体验层`：桌面、Web、形象化交互等不同承载形态
- `应用层`：前端、后端、桌面壳层与 embedded runtime
- `能力层`：感知、理解、执行、记忆、协作五大能力域
- `领域层`：统一业务核心，不允许 Web/Desktop 各做一套
- `基础设施层`：CLI、IDE、MCP、SQLite、文件系统、远程系统
- `治理层`：诊断、测试、打包、发布、隐私和权限

---

## 8. Source 系统

### 8.1 Source 分类

#### A. Canonical Source

用于回答“事实是什么”。

包括：

- repo
- file
- doc
- note
- knowledge entry
- web capture
- meeting note
- requirement / work item

#### B. Agent Trace Source

用于回答“我们做过什么、为什么这么做”。

包括：

- Codex 本地会话
- Claude Code 本地会话
- tool runs
- diagnostics
- patch 摘要
- test runs
- build / smoke 结果

#### C. Memory Source

用于回答“它记住了什么、我们形成了什么默契”。

包括：

- preference memory
- project memory
- relationship memory
- process memory
- episodic memory

### 8.2 Source 使用优先级

- 静态事实问题：优先 `canonical source`
- 原因 / 过程问题：优先 `agent trace source`
- 个性化协作问题：优先 `memory source`

### 8.3 Source 范围控制

每次任务都必须知道：

- 当前启用了哪些 source
- 哪些 source 被排除
- 哪些 source 是私有的
- 哪些 source 可在协作中共享

---

## 9. 感知系统

### 9.1 感知目标

感知系统的目标不是“窥探一切”，而是：

- 在用户明确授权的工作范围内持续理解当前上下文
- 优先使用结构化信号，而不是屏幕识别
- 为理解、记忆、协作和执行提供可靠依据

### 9.2 感知输入层级

#### 第一优先：结构化信号

- Azure DevOps work item / board / comment / state
- Git 状态、branch、diff、commit
- test / build / lint 结果
- IDE 当前文件、选区、诊断
- Debug Adapter Protocol 信息
- tool runs / team timeline / runtime diagnostics

#### 第二优先：半结构化信号

- terminal output
- local logs
- editor diagnostics
- local command history

#### 第三优先：桌面环境信号

- 当前窗口
- 当前工作台页面
- 拖拽内容
- 文件选择器结果
- 系统通知

#### 第四优先：视觉感知

- screenshot
- OCR
- UI 区域识别
- 屏幕状态理解

约束：

- 能走 IDE / DAP / runtime API 的，不能优先走纯屏幕识别
- 视觉感知是 fallback，不是默认主路径

---

## 10. 记忆系统

### 10.1 记忆写入流水线

```mermaid
flowchart LR
  EVENT[Perception Event] --> INTERPRET[Interpretation]
  INTERPRET --> CANDIDATE[Memory Candidate]
  CANDIDATE --> REVIEW[Auto Rule / User Review]
  REVIEW --> MEMORY[Long-term Memory]
  MEMORY --> RETRIEVE[Scoped Retrieval]
  RETRIEVE --> MISSION[Mission Execution]
```

### 10.2 记忆写入原则

- 不是所有聊天和痕迹都自动写长期记忆
- 必须先形成候选记忆
- 长期记忆要带来源、置信度和作用域
- 高风险记忆必须可确认、可撤回、可删除

### 10.3 记忆作用域

- `private`：仅本地 Partner 可见
- `workspace`：当前工作本可见
- `mission`：当前任务可见
- `shared`：被授权后可用于协作
- `published`：可作为模板或知识公开分享

---

## 11. 执行系统

### 11.1 本地执行原则

默认执行面向本机能力：

- Codex CLI
- Claude Code
- Visual Studio / VS Code
- Git
- tests / build / lint
- local scripts
- MCP tools

### 11.2 执行等级

- `observe`：只观察和理解，不执行
- `suggest`：提出建议，不自动动手
- `act-with-approval`：在确认后执行
- `delegated-run`：在明确授权的规则范围内自动执行一组动作

### 11.3 执行边界

必须明确：

- 允许读哪些目录
- 允许改哪些目录
- 允许运行哪些工具
- 哪些动作必须显式确认
- 哪些结果会同步回远程系统

---

## 12. 协作架构

### 12.1 协作对象

协作对象不只包括“人”，也包括：

- 其他人的工作台
- 其他人的 Agent
- 远程任务环境
- 共享 Notebook / Source Pack / Mission Pack

### 12.2 远程协作原则

推荐模型不是“直接跨机器接管”，而是：

- 本地 Partner 负责主任务理解与授权
- 远端机器上的本地 runtime 负责本地执行
- 通过协作协议传递任务包、来源范围和约束

### 12.3 对外沟通能力

Partner 在授权下可：

- 帮你回答问题
- 解释当前工作背景
- 汇总项目状态
- 基于授权上下文与他人协作
- 发起远程任务委派

---

## 13. 体验形态

### 13.1 默认界面对象

工作台至少应围绕以下对象组织：

- Partner
- Workspace / Notebook
- Mission
- Source Panel
- Memory Panel
- Timeline
- Team / Collaboration
- Runtime / Diagnostics

### 13.1.1 默认入口与协作视图

默认入口不应是空白聊天页，而应是 `Partner Home`。

`Partner Home` 至少回答：

- 我有哪些可继续的任务
- 哪些 Partner 在线
- 哪些 Mission 正在推进
- 哪些结果等待我确认

主任务页不应只是“聊天页”，而应围绕 Mission 提供两种视图：

- `Direct Thread`：单 Partner 协作，适合作为默认轻量主路径
- `Mission Room`：多 Partner 协作，适合复杂任务的团队执行模式

其中：

- `私聊 / 群聊` 可以作为用户理解产品的隐喻
- 但最终界面语义应收敛为 `Direct Thread / Mission Room`
- 不能把产品做成社交 IM 风格的聊天工具

### 13.2 形象化交互

可选提供 `Embodiment Layer`，但不是第一优先级。

可能形态：

- 侧边角色面板
- 语音播报
- 2D avatar
- 实时状态表情 / 陪伴 UI

约束：

- 形象层不能替代能力层
- 必须先保证理解、执行、记忆和协作可靠，再增强表达形态

---

## 14. 权限与隐私

### 14.1 基本原则

- 默认私有
- 显式授权
- 可撤回共享
- 可审计执行
- 可管理记忆

### 14.2 不应默认共享的内容

- 私有偏好记忆
- 私有对话全文
- 敏感本地路径
- secrets / tokens / env
- 未脱敏的原始 agent trace

### 14.3 协作共享的最小单位

优先共享：

- Mission Pack
- Source Pack
- 允许共享的工作记忆
- 结果摘要与交付物

而不是默认共享整个本地历史。

---

## 15. 产品落地顺序

### Phase 1：本地可用 Partner

- Desktop 自动本地登录
- Workspace / Source Pack
- Chat + Skills + MCP + Team + Knowledge
- 基础 memory candidate
- 基础 runtime diagnostics

### Phase 2：长期记忆 Partner

- Identity Kernel
- 偏好 / 项目 / 过程 / 事件记忆
- 记忆候选审查与治理
- agent trace source 层

### Phase 3：远程协作 Partner

- Share Link / Mission Pack
- 多方协作
- 远程委派执行
- 作用域共享与权限控制

### Phase 4：伴随式协作与形象层

- 实时协作模式
- IDE / Debug 深度感知
- 伴随式建议与协作
- 可选的 Avatar / Voice / Embodiment

---

## 16. 后续 OpenSpec 拆分建议

建议后续以本文为母本，拆分为以下 change：

- `introduce-agent-identity-kernel`
- `build-scoped-long-term-memory`
- `add-memory-review-and-governance`
- `add-agent-trace-source-layer`
- `connect-azure-devops-mission-source`
- `add-ide-and-debug-perception-bridges`
- `enable-collaborative-memory-sharing`
- `add-partner-profile-and-memory-ui`
- `introduce-real-time-co-working-mode`
- `add-embodiment-layer`




