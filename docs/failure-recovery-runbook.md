# OKClaw 故障恢复手册

## 1. 故障分级

- **P0**：无法登录、无法对话、数据损坏
- **P1**：Skill/MCP 功能异常、部分页面不可用
- **P2**：性能退化、偶发错误

## 2. 快速排障流程

1. 先看进程是否存活（backend/frontend）
2. 检查 `JWT_SECRET` 与关键环境变量
3. 检查 CLI 后端可用性：`codex --help` / `claude --help`
4. 执行冒烟：`bash -lc "./scripts/run-smoke-local.sh"`
5. 若仍异常，进入对应专项处理

## 3. 常见故障与处理

### 3.1 无法登录

- 检查后端服务是否启动
- 检查 JWT 密钥是否为空/变更不一致
- 用默认账号验证（初始化环境）：`admin/admin`

### 3.2 对话无法流式返回

- 检查 WebSocket `/ws/qa/:sessionId` 连通性
- 检查 CLI 命令是否可执行
- 检查后端日志中 `core_backend_unavailable` 或 `core_qa_backend_error`

### 3.3 MCP server 状态异常

- 在 MCP 设置页执行 stop/start
- 核对 server command/args/cwd/env 配置
- 通过 `/api/mcp/servers/:id/tools` 验证连接

### 3.4 Skill 安装失败

- 查看 `risk-scan` 是否阻断
- 查看市场安装返回错误（下载/校验/回滚）
- 失败后可重试，系统会清理临时目录

### 3.5 数据库异常

- 停服务后备份 `.okclaw/core.db`
- 检查磁盘权限与可用空间
- 必要时从最近备份恢复（见第 4 节）

## 4. 数据备份与恢复

## 4.1 备份

停止写入后执行文件级备份：

```bash
cp .okclaw/core.db .okclaw/core.db.bak-$(date +%Y%m%d%H%M%S)
```

## 4.2 恢复

1. 停止后端服务
2. 替换数据库文件为备份版本
3. 启动服务并执行冒烟验证

## 5. 断线恢复验证

- 强制断开浏览器网络后恢复
- 确认前端自动重连
- 确认 `event_id` 去重生效且无重复消息

## 6. 回滚策略

若新版本异常：

1. 回滚到上一版构建产物
2. 恢复最近稳定数据库备份
3. 执行全链路冒烟验证
4. 记录故障窗口与根因

## 7. 故障关闭标准

- 冒烟脚本通过
- 核心链路（登录/对话/Skill/MCP）恢复
- 无新增 P0/P1 报警
- 已补充复盘与预防动作

