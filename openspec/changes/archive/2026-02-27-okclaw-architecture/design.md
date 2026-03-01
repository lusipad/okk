## Context

okclaw 是一个全新项目，目标是构建公司内网的代码仓库知识库平台。当前状态：

- **已有参考实现**：NanoClaw（D:\Repos\nanoclaw）提供了 Claude Code SDK 的容器化执行引擎；OpenCowork（D:\Repos\OpenCowork）提供了成熟的 Electron 桌面 AI 协作平台架构
- **技术约束**：AI 后端必须是 CLI 工具（Claude Code SDK / Codex CLI）作为子进程运行，而非直接 API 调用
- **部署约束**：Phase 1 为公司内网单机部署，<20 人团队使用
- **开发环境**：Windows 11，需要确保子进程管理的跨平台兼容性

## Goals / Non-Goals

**Goals:**

- 建立可复用的 Monorepo 架构，core 包在 Web 和 Desktop 之间零重写共享
- 移植 NanoClaw agent-runner 的 Claude Code SDK 调用模式，作为核心 AI 执行引擎
- 借鉴 OpenCowork 的 Sub-Agent/Team/Skill 系统设计，适配知识库场景
- Phase 1 交付可用的 Web 版 Q&A + 知识库
- 设计 IOProvider 抽象层，使 Phase 2 桌面端可直接复用前端组件

**Non-Goals:**

- 不实现 Docker 容器隔离（NanoClaw 的容器模式对内网场景过重，直接子进程即可）
- 不实现消息平台集成（OpenCowork 的飞书/钉钉/Telegram 插件不在 okclaw 范围内）
- 不实现向量搜索/语义搜索（Phase 1 用 FTS5 关键词搜索，语义搜索留待后续）
- 不实现 SSO/LDAP 认证（内网可信环境，用户名密码 + JWT 足够）
- 不实现多机分布式部署（单机 SQLite 足够 <20 人团队）

## Decisions

### D1: Monorepo 结构 — pnpm workspaces

**选择**: `packages/core` + `packages/web` + `packages/desktop` 三包结构

**替代方案**:
- 单体应用（所有代码在一个包中）→ 拒绝：Web 和 Desktop 的构建工具链差异大，耦合会导致构建复杂度爆炸
- 独立仓库（core/web/desktop 各自独立 repo）→ 拒绝：跨仓库类型同步和版本管理成本高

**理由**: pnpm workspaces 提供包级隔离 + 依赖共享 + 类型安全的包间引用。OpenCowork 虽然是单包 Electron 项目，但其 main/renderer/preload 的分离模式验证了进程间代码隔离的可行性。

### D2: AI 后端 — 统一 CLI 子进程管理

**选择**: Claude Code CLI 和 Codex CLI 均通过 `child_process.spawn` 管理子进程，通过 stdin/stdout 流式通信，复用 NanoClaw 的 stdout 标记符解析协议

**替代方案**:
- 使用 Claude Code SDK 的 query() API → 拒绝：用户明确要求以 CLI 工具形式运行，保持与 Codex CLI 一致的执行模式，降低架构复杂度
- 直接调用 Anthropic API / OpenAI API → 拒绝：CLI 工具自带工具执行能力（Read/Write/Bash 等），直接 API 无此能力

**理由**: 两个后端统一为 CLI 子进程模式，IBackend 接口更简洁。NanoClaw 的 container-runner.ts 已验证了 spawn + stdout 标记符解析（OUTPUT_START_MARKER/OUTPUT_END_MARKER）的可靠性。统一模式意味着未来接入其他 CLI 工具（如 Aider、Continue 等）也只需实现同一接口。

### D3: 不使用 Docker 容器隔离

**选择**: 直接子进程执行，通过路径白名单控制文件访问

**替代方案**:
- 使用 Docker（NanoClaw 模式）→ 拒绝：Windows 上需要 Docker Desktop/WSL2，增加部署复杂度；内网可信环境不需要 OS 级隔离
- 使用 VM 隔离 → 拒绝：过重

**理由**: NanoClaw 的 mount-security.ts 提供了路径白名单验证机制，可以在不使用 Docker 的情况下控制 AI 后端的文件访问范围。对于内网可信环境，这已经足够。

### D4: Agent 系统 — 应用层编排

**选择**: 使用应用层编排，okclaw 自己管理 Team 生命周期，通过 AgentRunner 调度多个 CLI 后端子进程

**替代方案**:
- 依赖 CLI 工具内置的 Teams 功能 → 拒绝：无法跨不同 CLI 后端（Claude Code + Codex）协调；且 CLI 工具的 Teams 功能是实验性的，稳定性不可控

**理由**:
- **应用层 Teams**（借鉴 OpenCowork `team-manager`）：okclaw 创建 Team → 分配任务 → 每个 Sub-Agent 通过 AgentRunner 启动独立的 CLI 子进程 → 汇总结果。优点是可以混合使用 Claude Code 和 Codex 后端，且 okclaw 完全控制编排逻辑。

### D5: Skills 架构 — 双层结合（MCP + okclaw Skills）

**选择**: 底层利用 CLI 原生 MCP servers 生态扩展 AI 后端能力，上层 okclaw 自建少量知识库特有 Skills

**替代方案**:
- 完全自建 Skills 系统 → 拒绝：重复造轮子，忽略了 MCP 生态中大量成熟的 servers（Azure DevOps、Git、SQLite、Web Search）
- 仅依赖 CLI 原生插件 → 拒绝：知识库特有功能（knowledge-export、repo-stats）没有现成 MCP server
- 仅 MCP 为主 → 拒绝：某些轻量级 Skills（脚本工具）不值得包装为 MCP server

**理由**:
- **底层 MCP**：Claude Code CLI 和 Codex CLI 都原生支持 MCP。okclaw 在启动 CLI 子进程前动态生成 MCP 配置文件（Claude Code 用 `.mcp.json`，Codex 用 TOML），注入已启用的 MCP servers。默认集成：
  - `@azure-devops/mcp`（微软官方）— Work Items、Repos、Pipelines、Wiki、PR
  - `mcp-server-git` — Git 历史分析、diff、blame
  - `@modelcontextprotocol/server-sqlite` — 直接查询 okclaw 知识库数据库
  - Brave/Tavily Search MCP — Web 搜索补充外部文档
- **上层 okclaw Skills**：知识库特有的轻量级脚本工具，通过 SKILL.md + scripts/ 模式管理，通过系统提示注入给 AI 后端。包括 knowledge-export、repo-stats、code-analysis、dependency-audit。

### D6: 数据库 — SQLite + DAO 抽象

**选择**: SQLite + better-sqlite3 + WAL 模式，通过 DAO 层抽象数据库操作

**替代方案**:
- 直接 PostgreSQL → 拒绝：<20 人团队不需要，增加部署依赖
- ORM（Prisma/Drizzle）→ 拒绝：SQLite 场景下 ORM 的价值有限，手写 DAO 更轻量可控
- 无抽象层 → 拒绝：未来可能需要迁移 PostgreSQL，DAO 层提供迁移路径

**理由**: NanoClaw 和 OpenCowork 都使用 better-sqlite3 + WAL，验证了此方案在类似场景的可靠性。WAL 模式支持并发读 + 单写入者，<20 人团队的写入量远低于 SQLite 瓶颈。

### D7: Web 前端 — React SPA + Vite（非 Next.js）

**选择**: React 19 + Vite 6 构建的 SPA

**替代方案**:
- Next.js → 拒绝：okclaw 是交互密集型 SPA（WebSocket 实时通信、流式渲染），不需要 SSR；且 Next.js 与 Phase 2 Electron 集成更复杂
- Vue.js → 拒绝：与 NanoClaw/OpenCowork 技术栈不一致，无法复用 OpenCowork 组件模式

**理由**: React SPA + Vite 与 OpenCowork 技术栈完全一致，Phase 2 可直接通过 electron-vite 集成。Zustand store 在浏览器和 Electron renderer 中行为一致。

### D8: Web/Desktop 组件复用 — IOProvider 抽象

**选择**: 定义 IOProvider 接口，Web 端实现为 HTTP+WS 客户端，Desktop 端实现为 Electron IPC 调用

**替代方案**:
- 完全独立的前端代码 → 拒绝：大量重复代码
- Desktop 内嵌 Web 服务器 → 拒绝：不必要的网络开销

**理由**: 通过 React Context 注入 IOProvider，UI 组件无需关心底层通信方式。这是从第一天就建立的抽象，确保 Phase 2 迁移成本最小。

```typescript
interface IOProvider {
  // Q&A
  askQuestion(sessionId: string, content: string, backend: string): void;
  onStreamEvent(handler: (event: BackendEvent) => void): () => void;
  // Knowledge
  searchKnowledge(query: string): Promise<KnowledgeEntry[]>;
  saveKnowledge(entry: Partial<KnowledgeEntry>): Promise<KnowledgeEntry>;
  // Repos
  listRepos(): Promise<Repository[]>;
  // Agents
  listAgents(): Promise<AgentDefinition[]>;
  // Skills
  listSkills(): Promise<SkillInfo[]>;
}
```

### D9: 知识提取 — Agent 驱动建议而非规则引擎

**选择**: 使用 knowledge-extractor Agent 分析 Q&A 对话，生成知识建议供用户审核

**替代方案**:
- 规则引擎（关键词匹配、长度阈值）→ 拒绝：无法理解语义，误报率高
- 全自动提取（无人工审核）→ 拒绝：质量无法保证
- 纯手动（用户自己复制粘贴）→ 拒绝：摩擦太大，知识沉淀率低

**理由**: Agent 驱动 + 人工审核是质量和效率的平衡点。knowledge-extractor Agent 使用聚焦系统提示，专门训练识别可复用知识，但最终决定权在用户手中。

### D10: 信息架构与交互状态显式化

**选择**: 采用三栏信息架构（左导航与会话、中主任务、右上下文面板），并将流式状态、工具状态、连接状态做显式可见。

**替代方案**:
- 单栏消息流承载全部信息 → 拒绝：工具调用、Team 状态、知识建议会严重干扰主对话
- 全屏视图切换模式 → 拒绝：上下文来回切换成本高，影响连续工作流

**理由**: 借鉴 OpenCowork 的布局与卡片化交互，主流程保持在中栏，复杂过程放入右栏和可折叠卡片。该模式在交互密度高的 AI 协作场景更易理解，也更适配 Web 与 Desktop 复用。

## Interaction Principles

### P1: 状态显式化
- 流式响应、工具执行、子 Agent 执行、连接中断都必须可见且可操作
- 每个状态必须有清晰的用户动作（停止、重试、重连、查看详情）

### P2: 上下文分区
- 中栏只承载主任务（问答/编辑）
- 右栏承载上下文信息（工具步骤、知识建议、Agent/Team）

### P3: 默认降噪，异常放大
- 工具调用默认摘要展示，支持手动展开
- 失败、高风险、变更型操作默认展开并高亮，优先暴露风险

### P4: 可恢复性优先
- WebSocket 断线重连、事件去重、消息幂等必须闭环
- 用户编辑重发、删除撤销、重试上一条作为基础恢复能力

## Risks / Trade-offs

**[Claude Code SDK 版本破坏性更新]** → 不再依赖 SDK，改为 CLI 子进程模式；CLI 工具的命令行接口通常比 SDK API 更稳定；锁定 CLI 工具版本

**[CLI 工具输出格式不稳定]** → 两个 CLI 后端统一使用 stdout 解析；output-parser.ts 做好容错处理，未知格式降级为纯文本；Phase 1 以 Claude Code CLI 为主力后端

**[Windows 子进程管理差异]** → 开发环境即 Windows 11，从第一天就在 Windows 上测试；注意信号处理（SIGTERM vs taskkill）、路径分隔符、shell 参数差异

**[Agent Teams 稳定性]** → 使用应用层 Teams（okclaw 自己控制编排），不依赖 CLI 工具内置的实验性 Teams 功能

**[知识聚合质量参差]** → 人工审核为主，自动提取仅做建议；引入 quality_score 机制，低分条目不进入搜索结果

**[Skill 脚本安全风险]** → skill-scanner 在安装前检查风险（参考 OpenCowork ScanResult.risks）；内置 Skills 经过审核；用户自定义 Skills 需要管理员批准

**[SQLite 并发写入]** → WAL 模式 + 写入操作序列化（通过 queue）；监控写入延迟；DAO 抽象层预留 PostgreSQL 迁移路径

**[Phase 1→2 组件复用失败]** → IOProvider 抽象从第一天建立；每个 Zustand store 不直接依赖 fetch/WebSocket，而是通过注入的 IOProvider 通信

## Open Questions

1. **Claude Code CLI 的交互协议**：Claude Code CLI 的 stdout 输出格式、支持的命令行参数、是否支持 JSON 模式输出？需要实际测试确认
2. **Codex CLI 的交互协议**：Codex CLI 的 stdout 输出格式是否有文档？是否支持流式输出？需要实际测试确认
3. **CLI 工具的 Windows 兼容性**：两个 CLI 工具在 Windows 上的子进程行为是否一致（信号处理、路径分隔符）？需要早期验证
4. **知识条目的粒度标准**：一个知识条目应该多大？一个函数的用法？一个模块的架构？需要在使用中逐步建立标准
5. **Phase 2 的离线模式范围**：桌面端离线时能做什么？仅搜索本地知识库？还是需要缓存 AI 模型？
