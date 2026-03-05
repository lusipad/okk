## Why

公司内网缺乏针对代码仓库的结构化知识库。现有的技术 Q&A 散落在聊天记录、文档和 Wiki 中，无法沉淀为高质量的可搜索知识。开发者反复回答相同问题，新人 onboarding 效率低。需要一个工具将 AI 驱动的代码 Q&A 与知识沉淀结合，让团队知识持续积累而非流失。

## What Changes

- 构建 okk 平台：基于 NanoClaw 架构的公司内网代码仓库知识库
- 新增 AI 后端执行引擎：对接 Claude Code CLI 和 OpenAI Codex CLI 作为后端子进程（均通过 `child_process.spawn` 管理），而非直接 API 调用
- 新增 Web 版（Phase 1）：Fastify + WebSocket 后端 + React SPA 前端，支持多用户（<20 人团队）
- 新增桌面端（Phase 2）：Electron 应用，类似 OpenCowork / Codex App 形态，个人本地使用
- 新增知识库引擎：从 Q&A 对话中提取、编辑、发布、搜索知识条目，支持版本历史和质量评分
- 新增 Skills 系统：可扩展的专家技能（代码分析、仓库统计、API 文档生成等），复用 OpenCowork SKILL.md 格式
- 新增多 Agent 系统：Sub-Agent 执行器 + Agent Teams 编排，支持跨仓库分析等复杂任务
- 采用 Monorepo 结构（pnpm workspaces）：`core`（纯逻辑）+ `web`（Phase 1）+ `desktop`（Phase 2），业务逻辑只写一次
- 新增交互质量目标：Web UI 需达到 ChatGPT / Claude 官网同等级体验（信息层级、动效反馈、输入体验、错误恢复、可访问性）
- 新增 Skill 目标对齐：Skill/MCP 能力需对齐 OpenCowork 的“市场 + 安装 + 风险扫描 + 启用注入 + 运行时状态”闭环

## Current Status (2026-02-27)

### 已完成（可交付）

- Monorepo 基线与多包构建、测试、打包链路已跑通
- Web 登录/会话/流式消息链路已打通，接口契约统一并支持恢复
- Skill/MCP 全生命周期闭环已落地（配置-启用-注入-执行-审计）
- 知识引擎已完成 CRUD、版本历史、状态流转、FTS 搜索、建议 save/ignore 流程
- Agent/Team 能力已完成（AgentRegistry、AgentRunner、TeamManager、Team 结构化事件与前端可视化）
- 发布与质量保障闭环完成（单测/集成/冒烟/打包/运维手册）

## Capabilities

### New Capabilities

- `ai-backend-engine`: AI 后端执行引擎 — 统一的 IBackend 接口，Claude Code CLI 和 Codex CLI 均通过 `child_process.spawn` 管理子进程、stdout/stdin 流式通信、并发队列控制、会话持久化与恢复、流式输出解析
- `agent-system`: 多 Agent 系统 — Agent 定义加载（Markdown 格式）、Agent 注册表、Sub-Agent 执行器（借鉴 OpenCowork runner.ts）、Agent Teams 编排（应用层编排模式）、Team 事件总线和消息队列
- `skills-system`: 双层 Skills 系统 — 底层：MCP servers 集成（默认集成 Azure DevOps MCP、Git MCP、SQLite MCP、Web Search MCP），为 CLI 子进程动态生成 MCP 配置；上层：okk 自建 Skills（SKILL.md + scripts/ 格式），提供知识库特有功能（knowledge-export、repo-stats、code-analysis、dependency-audit）；MCP server 管理 UI
- `knowledge-engine`: 知识库引擎 — 知识条目 CRUD、FTS5 全文搜索、从 Q&A 自动提取知识建议（knowledge-extractor Agent）、版本历史、质量评分（用户反馈 + 时效性）、过时检测（Git diff 比对）
- `repo-management`: 代码仓库管理 — 仓库注册与路径验证（移植 NanoClaw mount-security）、仓库上下文构建（workingDir + CLAUDE.md + 已有知识注入）、Git 变更监听
- `web-backend`: Web 后端服务 — Fastify + JWT 认证、REST API 路由、WebSocket 流式 Q&A 和 Team 事件推送、请求频率限制
- `web-frontend`: Web 前端 — React 19 SPA、三栏布局（借鉴 OpenCowork Layout）、Q&A 对话界面（流式渲染）、知识编辑器（Monaco）、Agent/Team 状态展示、Skill 浏览
- `desktop-app`: 桌面端应用（Phase 2）— Electron 壳 + IPC 桥接、复用 web-frontend 组件、系统托盘 + 全局快捷键搜索、文件拖拽、本地仓库自动发现
- `data-layer`: 数据层 — SQLite + better-sqlite3 + WAL 模式、完整 Schema（users, repositories, sessions, messages, knowledge_entries, knowledge_versions, agent_runs, team_runs, installed_skills）、DAO 抽象层

### Modified Capabilities

- `web-frontend`: 由“功能可用”升级为“产品级体验”，以 ChatGPT/Claude 为质量基准
- `skills-system`: 由“列表式管理”升级为“OpenCowork 对齐的全生命周期管理”
- `web-backend`: 由“mock 驱动”升级为“真实 CLI 驱动（Claude Code/Codex）”

## Impact

- **技术栈**: TypeScript 5.x, Node.js 22+, pnpm/npm workspaces monorepo
- **核心依赖**: `better-sqlite3`、`fastify`、`react` 19、`zustand` 5、`electron` 36（Phase 2）
- **复用来源**: NanoClaw（子进程管理模式、并发队列、路径安全、IPC 协议、stdout 标记符解析）、OpenCowork（Agent Loop 架构、Sub-Agent/Team 类型系统、Skills 格式、UI 布局模式、Zustand store 划分）
- **部署**: Phase 1 为单机 Node.js 服务（内网部署），Phase 2 为 Electron 桌面应用
- **数据**: SQLite 单文件数据库，<20 人团队无需外部数据库服务
- **安全**: JWT 认证、仓库路径白名单验证、CLI 后端凭据隔离（stdin 传递，不写磁盘）
- **验收门槛更新**: 若未满足“真实 CLI 调用 + Skill/MCP 闭环 + 官网级交互质量”，本变更不得标记完成
