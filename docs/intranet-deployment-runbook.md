# OKK 内网部署手册

## 1. 目标与范围

本手册用于单机内网部署 `OKK`（<20 人团队），覆盖：

- Web Backend（Fastify + WebSocket）
- Web Frontend（Vite 静态资源）
- SQLite 数据与本地 Skill/MCP 配置目录

## 2. 环境要求

- Windows 11 / Linux
- Node.js `>=22`
- npm `>=10`
- 可用 CLI 后端（至少一个）：
  - `codex`（推荐）
  - `claude`

## 3. 部署前检查

```bash
node -v
npm -v
codex --help
claude --help
```

若某个 CLI 不可用，系统会自动降级到可用后端，但建议至少保证一个稳定可用。

## 4. 安装与构建

```bash
npm install
npm run test
npm run build
```

## 5. 关键目录

- 数据库：`.okk/core.db`
- 技能目录：
  - `.codex/skills/`
  - `.claude/skills/`
- 发布产物：`release/`

## 6. 启动方式（开发/内网服务）

### 6.1 本地联调

```bash
npm run dev -w @okk/web-backend
npm run dev -w @okk/web-frontend
```

### 6.2 生产方式（推荐）

1. 先构建：`npm run build`
2. 启动后端（示例）：

```bash
node packages/web-backend/dist/server.js
```

3. 使用静态文件服务托管 `packages/web-frontend/dist`

## 7. 环境变量（建议）

- `JWT_SECRET`：JWT 密钥（生产必须修改）
- `OKK_CORE_MODE`：`real|auto|memory`（生产建议 `real`）
- `OKK_CODEX_COMMAND`：Codex CLI 命令路径
- `OKK_CLAUDE_COMMAND`：Claude CLI 命令路径
- `OKK_CORE_DB_PATH`：SQLite 路径（可选）
- `OKK_SKILL_MARKET_PATH`：Skill 市场索引文件（可选）

CLI 命令来源优先级：

1. `createCore({ codexCommand / claudeCommand })`
2. 环境变量 `OKK_CODEX_COMMAND` / `OKK_CLAUDE_COMMAND`
3. 默认命令 `codex` / `claude`

部署后若要确认实际生效的是哪一层配置，登录后查看 `GET /api/agents/runtime/backends` 返回的 `diagnostics.detail`，其中会包含命令来源与建议动作。

## 8. 发布流程

```bash
npm run release:prepare
npm run package -w @okk/desktop
```

验收建议：

- `bash -lc "./scripts/run-smoke-local.sh"` 返回 `login_ok/chat_ok/mcp_ok/skills_ok=true`
- `npm run smoke -w @okk/desktop` 返回 `desktop_smoke_ok=true`，并在 `output/desktop-smoke/` 留存 runtime state、stdout/stderr 与日志文件
- Web 发布产物位于 `release/`，桌面 Windows 原始产物位于 `packages/desktop/release/win-unpacked/`。`OKK Desktop Windows Package` 工作流会输出 `OKK-Desktop-windows-x64-<ref>.zip`、对应 `.sha256.txt`，以及同名 release notes Markdown。手动触发时仅上传 artifact；当仓库收到 `v*` tag push 时，workflow 还会自动创建 GitHub Release 并附带这些文件。

## 9. 运行时诊断建议

- 登录后优先检查 `GET /api/agents/runtime/backends`
- 可用后端应返回：`available=true`、`runtimeStatus=ready`
- 不可用后端应返回结构化 `diagnostics` 与 `actions`
- 若 `diagnostics.code` 为 `command_not_found_or_not_executable`，优先修正 CLI 安装或 PATH
- 若 `diagnostics.code` 为 `command_probe_timeout`，优先排查杀软、网络盘或卡死的 shell wrapper

## 10. 上线验收清单

- 登录可用，JWT 校验正常
- 会话创建/流式对话正常
- Skill 安装/删除/市场安装正常
- MCP 启停、工具调用、资源读取正常
- WebSocket 断开可恢复
- Desktop 启动异常可切换到诊断页并支持打开日志/重试启动
- SQLite 数据可持久化重启后恢复
