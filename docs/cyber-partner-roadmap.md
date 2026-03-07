# OKK 全面重新规划：赛博合伙人路线图

## Context

OKK（Open Knowledge Kernel）的产品定位是**赛博合伙人**——不是工具，不是助手，而是一个有身份、有记忆、有持续关系的工程合伙人。当前处于 Phase 1 收尾阶段，代码实现约 75-80%。

**为什么需要重新规划：**
- 当前三个变更（视觉系统、知识工作流、交付治理）同时推进，精力分散
- 赛博合伙人的三个核心支柱（记忆/理解、执行/交付、成长/进化）在代码中落地不足
- OpenClaw / NanoClaw 生态爆发，需要重新定位差异化
- 很多底层能力可以直接复用 CLI，不需要从零构建

---

## 一、产品定位：赛博合伙人

### 1.1 核心定义

OKK 是你的**赛博合伙人（Partner）**，不是用完即走的工具。

三个同等重要的支柱：

| 支柱 | 含义 | 对应能力 |
|------|------|---------|
| **记住我、理解我** | 长期记忆、偏好学习、项目上下文积累 | Identity Kernel + Memory System |
| **帮我做事、交付结果** | 真正执行任务、产出交付物 | CLI Backend + Skill System |
| **持续成长、越用越强** | 通过 Skill 学习新能力、通过知识沉淀变聪明 | Skill Ecosystem + Knowledge Engine |

### 1.2 与 OpenClaw / NanoClaw 的差异化

**定位差异：工程深度 vs 通用广度**

| 维度 | OpenClaw | NanoClaw | OKK |
|------|----------|----------|-----|
| 定位 | 通用 AI Agent 编排 | 极简安全 AI 助手 | 工程研发赛博合伙人 |
| 广度 | WhatsApp/邮件/日历/任何事 | 多渠道消息 | 专注工程研发场景 |
| 深度 | 浅——什么都能做但不够深 | 极简核心 | 深——理解代码、仓库、工程上下文 |
| 关系 | 用完即走 | 用完即走 | 长期持续、越用越强 |
| 核心优势 | 编排执行能力 | 安全隔离+极简 | 工程记忆+知识沉淀+Skill 成长 |

### 1.3 NanoClaw 启示：核心精简，能力复用

NanoClaw 用 ~3,900 行代码实现了完整个人助手，核心哲学是：
- **不重新造轮子** — 执行能力直接用 Claude Code
- **Skills 通过让 AI 修改代码来添加功能** — 而非传统插件架构
- **极简核心 + 强大扩展** — 代码少到可以完整审计

**OKK 应借鉴的原则：**
- 执行能力继续复用 Claude CLI / Codex CLI，不自建 Agent 引擎
- OKK 的价值在 CLI 之上：**记忆、知识、Skill 管理、工程上下文、可视化**
- 保持核心精简，通过 Skill 系统扩展能力

### 1.4 模式规划

- **Phase 1-2：** 只做 Personal Mode（本地优先）
- **Phase 3+：** 在验证后逐步引入 Collaboration / Publish Mode

---

## 二、架构

### 2.1 分层

保持当前三层架构，但明确每层的"合伙人"职责：

```
Frontend (React 19 + Vite)
  → 合伙人的"面孔"：聊天、知识展示、Skill 管理、Agent Trace 可视化

Backend (Fastify 5 + WebSocket)
  → 合伙人的"神经系统"：事件流、会话管理、记忆检索

Core (SQLite + CLI Backend)
  → 合伙人的"大脑与双手"：记忆存储、知识引擎、Skill 注册、CLI 执行
```

五段认知模型（感知-理解-执行-记忆-协作）保留作为**产品思考框架**，指导功能设计但不强制映射到代码模块。

### 2.2 后端引擎

**核心原则：站在 CLI 的肩膀上，不重新造轮子。**

- Claude CLI + Codex CLI 继续作为执行引擎
- OKK 的价值不在执行本身，而在执行之上的记忆、知识、上下文管理
- 优化方向：解析容错、事件模型统一、进程生命周期管理
- 未来：API 可用后增加直接调用路径；关注 Agent SDK 成熟度

### 2.3 Desktop

保持当前可用状态，不主动投入新功能。优先保证 Web 体验。

---

## 三、路线图

### 3.1 当前变更处置

| 变更 | 处置 | 说明 |
|------|------|------|
| ship-workbench-visual-system | 收窄为暗色主题变量统一 | 合伙人体验优先于视觉完美 |
| strengthen-knowledge-repo-workflows | 保留并聚焦 | 知识是合伙人的核心能力 |
| harden-quality-gates-and-release-governance | 简化：e2e 优先，砍像素比对 | 保证可交付 |

### 3.2 路线图：让合伙人逐步成熟

按**合伙人成熟度**而非功能模块来划分阶段：

#### Phase 1.5：能干活的合伙人（4 周）

> 目标：合伙人能稳定地帮你完成工程任务，并开始记住你。

| 任务 | 支柱 | 说明 |
|------|------|------|
| 聊天体验打磨 | 执行 | 流式稳定、工具调用卡片、错误恢复 |
| Skill 系统升级 | 成长 | 渐进式加载、安装/启用优化、兼容 OpenClaw Skill 格式 |
| 知识自动提取 | 记忆 | 对话结束自动生成知识候选，一键保存 |
| 基础 e2e 测试 | 交付 | 核心路径验证 |
| 暗色主题统一 | 体验 | CSS 变量收敛 |

#### Phase 2：有记忆的合伙人（4-12 周）

> 目标：合伙人记住你的偏好、理解你的项目、越用越聪明。

| 任务 | 支柱 | 说明 |
|------|------|------|
| 长期记忆系统 | 记忆 | 五种记忆类型（偏好/项目/关系/过程/事件）的存储与检索 |
| Identity Kernel（最小版） | 记忆 | System Prompt 编辑器 + 用户画像积累 |
| Skill 市场与发现 | 成长 | 社区 Skill 浏览、安装、评价 |
| 会话搜索与归档 | 记忆 | 全文检索、跨会话上下文引用 |
| Agent Trace 可视化 | 执行 | 文件修改、工具调用链路展示 |
| CLI 后端加固 | 执行 | 解析容错、事件模型统一 | 已完成 |
| 项目上下文持久化 | 记忆 | 仓库偏好、常用操作记录 | 已完成 |

#### Phase 3：有成长的合伙人（12-20 周）

> 目标：合伙人能自主学习新能力，帮你积累和复用工程知识资产。

| 任务 | 支柱 | 说明 |
|------|------|------|
| Skill 组合与工作流 | 成长 | agent + skill + prompt 组合模板 |
| 知识治理与版本 | 记忆 | 过时检测、来源追踪、知识版本管理 |
| 多仓库工作空间 | 执行 | 统一管理多个项目上下文 |
| 跨 Agent 知识聚合 | 记忆 | 导入 Claude Code / OpenClaw 会话数据 |
| 记忆审核与共享 | 协作 | 记忆治理、团队知识共享（Collaboration Mode 入口） |

### 3.3 OpenSpec 方向对齐

| 方向 | Phase | 对应支柱 |
|------|-------|---------|
| build-scoped-long-term-memory | **Phase 2 核心** | 记忆 |
| introduce-agent-identity-kernel | **Phase 2** | 记忆 |
| add-partner-profile-and-memory-ui | **Phase 2** | 记忆 |
| add-agent-trace-source-layer | **Phase 2** | 执行 |
| add-memory-review-and-governance | **Phase 3** | 记忆 |
| enable-collaborative-memory-sharing | **Phase 3** | 协作 |
| connect-azure-devops-mission-source | 推迟 | — |
| add-ide-and-debug-perception-bridges | 推迟 | — |
| introduce-real-time-co-working-mode | 推迟 | — |
| add-embodiment-layer | 推迟 | — |

---

## 四、NanoClaw 复用策略

### 4.1 复用什么，不复用什么

| 维度 | 复用 | 说明 |
|------|------|------|
| **Skill 生态** | **直接兼容** | 格式几乎相同（SKILL.md + 脚本），共享 13,729+ 社区 Skills |
| **极简哲学** | **借鉴** | 核心精简，执行复用 CLI，专注合伙人层 |
| **Memory 格式** | **互通** | 都用 CLAUDE.md + SQLite，可实现双向同步 |
| 多渠道消息 | 不复用 | 赛博合伙人有专属 Web 界面 |
| 容器隔离 | 不复用 | CLI 进程隔离已够用 |
| Agent SDK 引擎 | 不复用 | 没有 API 访问，CLI 是当前路径 |

### 4.2 Skill 生态兼容

OKK 和 NanoClaw/OpenClaw 的 Skill 格式高度一致：
- 都基于 SKILL.md（YAML frontmatter + Markdown 正文）
- 都支持脚本目录
- OKK 已有 SkillRegistry 解析基础

**目标：** 确保 OKK 能直接安装和使用 OpenClaw/NanoClaw 生态的 Skills，共享生态红利。

### 4.3 Memory 互通

两者都用 CLAUDE.md 作为记忆载体，OKK 还有 SQLite 结构化存储：
- OKK 的 `RepositoryContextService` 已经读取 CLAUDE.md
- 需要增加双向同步：Knowledge 表 ↔ CLAUDE.md
- 用户可以同时用 NanoClaw（日常事务）+ OKK（工程研发），记忆共享

---

## 五、Skill 系统策略

Skill 是合伙人"成长"支柱的核心载体。

### 5.1 当前基础

OKK 已有：SKILL.md frontmatter 解析、目录加载、SkillRegistry、InstalledSkillsDao、SkillsPage

### 5.2 升级方向

| 能力 | 当前 | 目标 |
|------|------|------|
| 加载方式 | 目录扫描 | 渐进式加载（元数据→SKILL.md→脚本） |
| 安装体验 | 基础 | 一键安装 + 版本管理 + 依赖检查 |
| 格式兼容 | 自有格式 | 兼容 OpenClaw Skill 格式，共享生态 |
| 调试 | 无 | Skill 调试面板：输入/输出/日志 |
| 市场 | skill-market.json | 社区 Skill 浏览与安装 |

### 5.3 借鉴 NanoClaw 的 Skill 理念

NanoClaw 的 Skill 是"让 AI 修改代码来添加功能"——极简但强大。OKK 可以取其精华：

- Skill 不只是配置文件，可以是**让合伙人学会新工作流的教程**
- Skill 安装不只是下载文件，还包括**让合伙人理解如何使用**的过程
- Skill 与记忆系统联动：合伙人记住哪些 Skill 在什么场景下效果好

---

## 六、执行策略

### 6.1 核心原则

1. **站在 CLI 肩膀上** — 执行能力复用 CLI，OKK 专注合伙人层
2. **每周一个可感知交付** — 聚焦单一目标，不并行推进
3. **Dogfooding** — 用 OKK 开发 OKK
4. **Skill 优先于代码** — 能用 Skill 实现的能力不写死在代码里

### 6.2 AI 工具加速

- Claude Code 写 OKK 代码（dogfooding）
- Claude Code 批量生成测试
- Claude Code 代码审查

### 6.3 发布节奏

每两周一个内部版本，focus 在可感知的合伙人能力提升。

---

## 七、关键文件

| 文件 | 作用 |
|------|------|
| `packages/core/src/create-core.ts` | Core 初始化入口 |
| `packages/core/src/backend/cli-backend.ts` | CLI 执行引擎 |
| `packages/core/src/database/dao/knowledge-dao.ts` | 知识存储 |
| `packages/core/src/skills/skill-registry.ts` | Skill 注册表 |
| `packages/web-frontend/src/state/chat-store.tsx` | 前端状态 |
| `packages/web-frontend/src/pages/ChatPage.tsx` | 聊天主页 |
| `packages/web-frontend/src/pages/SkillsPage.tsx` | Skill 管理页 |
| `packages/web-backend/src/ws/qa-gateway.ts` | WebSocket 网关 |

---

## 八、验证方式

1. **合伙人体验测试：** 连续使用 OKK 一周开发，合伙人是否记住了你的偏好？
2. **Skill 成长测试：** 安装新 Skill 后，合伙人是否能自然地在相关场景使用？
3. **知识复用测试：** 第 N 次对话中，合伙人是否引用了之前沉淀的知识？
4. **e2e 路径：** 登录→聊天→Skill 调用→知识保存→下次复用

---

## 九、一句话总结

**OKK 不是一个更好的 AI 工具，而是一个专注工程研发的赛博合伙人。** 站在 CLI 的肩膀上，通过记忆让它理解你，通过 Skill 让它成长，通过知识沉淀让它越用越强。

Sources:
- [NanoClaw GitHub](https://github.com/qwibitai/nanoclaw)
- [NanoClaw 官网](https://nanoclaw.dev/)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [NanoClaw vs OpenClaw - The Register](https://www.theregister.com/2026/03/01/nanoclaw_container_openclaw/)
- [Skills vs MCP vs Plugins](https://openclaw.rocks/blog/mcp-skills-plugins)
- [NanoClaw Architecture Analysis](https://fumics.in/posts/2026-02-02-nanoclaw-agent-architecture)

