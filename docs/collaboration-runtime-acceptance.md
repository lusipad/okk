# OKK 协作运行时验收说明

## 1. 范围

本文档用于验收 `unify-agent-skill-mcp-experience` 变更，关注以下目标：

- Chat 工作台右侧使用统一协作侧栏承载 backend、team、agent、skill、mcp 的运行状态
- Skill 与 MCP 在实际对话执行时产生结构化能力证据，而不是只有配置页状态
- 失败或不可用状态提供明确恢复动作：`重试`、`刷新状态`、`复制诊断`、`跳转配置`

## 2. 自动化冒烟覆盖

执行：

```bash
bash -lc "./scripts/run-smoke-local.sh"
```

若当前机器只需要验证前端/协作交互，而不希望依赖本地真实数据库文件时，可临时执行：

```bash
bash -lc "OKK_CORE_MODE=memory OKK_EXPECT_CORE_MODE=memory ./scripts/run-smoke-local.sh"
```

注意：该模式仅用于验证前端/协作交互链路，不替代正式 `real` 模式验收。

期望输出至少包含：

- `login_ok=true`
- `chat_ok=true`
- `mcp_ok=true`
- `skills_ok=true`
- `collaboration_ok=true`

其中 `collaboration_ok=true` 表示 smoke 已验证以下链路：

1. 创建并启动 mock MCP server
2. 导入可见 Skill
3. 回到 Chat 页，在 Composer 中勾选该 Skill 与 MCP
4. 发送消息后，在右侧 `时间线` 中看到两条 `capability_status` 证据
5. 时间线中出现 `打开 Skills` 与 `打开 MCP 配置` 动作
6. 点击 `打开 Skills` 后成功跳转到 Skills 页

## 3. 人工验收示例

### 3.1 Skill / MCP 参与执行

前置条件：

- 至少安装 1 个 Skill
- 至少启动 1 个 MCP server
- 登录后进入 Chat 页

步骤：

1. 在 Composer 展开 `Skills`，勾选目标 Skill
2. 在 Composer 展开 `MCP`，勾选目标服务
3. 发送一条普通请求
4. 在右侧切换到 `时间线`

预期：

- 出现两条 `capability_status` 事件
- 事件摘要分别类似 `Skill <id> 已加入当前请求`、`MCP <id> 已加入当前请求`
- 事件标签分别显示 `Skill` / `MCP`
- 事件状态显示 `Ready`
- 每条事件都可看到至少一个恢复动作或配置动作

### 3.2 后端不可用或诊断失败

步骤：

1. 让某个 backend 不可用，或使用无效命令配置触发失败
2. 刷新 Chat 页或重新发起请求
3. 查看右侧 `Overview` 与 `时间线`

预期：

- backend / team / agent 对应卡片出现结构化诊断文案
- 失败项默认被放大，而不是埋在普通事件里
- 操作区至少出现 `重试`、`刷新状态`、`复制诊断` 之一

### 3.3 跳转配置恢复

步骤：

1. 在 `时间线` 中定位 skill 或 mcp 的能力证据事件
2. 点击 `打开 Skills` 或 `打开 MCP 配置`

预期：

- 页面直接跳转到对应配置页
- 跳转后仍保留当前应用登录态
- 用户无需手工拼接 URL 或重新查找入口

## 4. 验收失败时的优先排查

1. 先执行 `docs/failure-recovery-runbook.md` 中的快速排障流程
2. 若右侧没有能力证据，优先检查 `/ws/team/:teamId` 是否收到 `capability_status`
3. 若有事件但页面无动作，检查前端是否正确解析 `actions[].kind/route`
4. 若仅桌面版异常，优先比较 Desktop 内嵌后端与 Web 环境变量是否一致


