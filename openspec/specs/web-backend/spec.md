# web-backend Specification

## Purpose
TBD - created by archiving change okk-architecture. Update Purpose after archive.
## Requirements
### Requirement: REST API 路由
系统 SHALL 提供 Fastify REST API，包括认证（/api/auth）、仓库管理（/api/repos）、会话管理（/api/sessions）、Q&A（/api/qa）、知识库（/api/knowledge）、Agent（/api/agents）、Skills（/api/skills）路由。

#### Scenario: API 路由响应
- **WHEN** 客户端发送 GET /api/repos 请求（带有效 JWT）
- **THEN** 系统 SHALL 返回当前用户可访问的仓库列表（JSON 格式）

#### Scenario: 未认证请求
- **WHEN** 客户端发送请求但未携带有效 JWT
- **THEN** 系统 SHALL 返回 401 Unauthorized

### Requirement: Skill 市场 API
系统 SHALL 提供 Skill 市场 API，支持列表/搜索与市场安装闭环。

#### Scenario: 查询市场列表
- **WHEN** 客户端调用 `GET /api/skills/market?q=<keyword>`
- **THEN** 系统 SHALL 返回市场 Skill 列表并按关键字过滤
- **AND** 返回项 SHALL 包含版本、来源、下载类型、安装状态

#### Scenario: 市场安装
- **WHEN** 客户端调用 `POST /api/skills/market/install` 并传入 `skillId`
- **THEN** 系统 SHALL 下载 Skill 到临时目录并执行安装
- **AND** 成功后 SHALL 返回已安装 Skill 信息

#### Scenario: 市场安装失败回滚
- **WHEN** 市场安装发生异常
- **THEN** 系统 SHALL 回滚目标目录状态并返回错误信息
- **AND** 临时下载目录 SHALL 被清理

### Requirement: JWT 认证
系统 SHALL 使用用户名密码 + JWT 进行认证，支持登录、登出、获取当前用户信息。

#### Scenario: 用户登录
- **WHEN** 用户提交正确的用户名和密码到 POST /api/auth/login
- **THEN** 系统 SHALL 返回 JWT token
- **AND** token SHALL 包含 userId 和 role

#### Scenario: 密码错误
- **WHEN** 用户提交错误的密码
- **THEN** 系统 SHALL 返回 401 错误，不泄露具体原因

### Requirement: WebSocket 流式 Q&A
系统 SHALL 提供 WebSocket 端点 /ws/qa/:sessionId，将 AI 后端的 BackendEvent 流实时推送给客户端。

#### Scenario: 流式 Q&A 会话
- **WHEN** 客户端连接 WebSocket 并发送问题
- **THEN** 系统 SHALL 将问题提交给 AI 后端
- **AND** 将 BackendEvent 流（text_delta、thinking_delta、tool_call_start、tool_call_input_delta、tool_call_end、sub_agent_start、sub_agent_end、session_update、knowledge_suggestion、done、error）实时推送给客户端

#### Scenario: 客户端中止
- **WHEN** 客户端发送 `{ type: 'abort' }` 命令
- **THEN** 系统 SHALL 调用 AI 后端的 abort() 方法终止当前查询

#### Scenario: 追问（多轮对话）
- **WHEN** 客户端在同一 WebSocket 连接上发送 `{ type: 'follow_up', content: '...' }`
- **THEN** 系统 SHALL 使用同一 sessionId 恢复会话并提交新问题

### Requirement: Q&A 请求负载契约
系统 SHALL 为 WebSocket Q&A 请求定义统一消息结构，支持后端选择、Agent 选择和幂等键。

#### Scenario: 发送新问题
- **WHEN** 客户端发送 `{ type: 'ask', content, repo_id, backend, agent_name?, mode?, client_message_id }`
- **THEN** 系统 SHALL 校验必填字段（content、repo_id、backend、client_message_id）
- **AND** backend SHALL 支持 claude-code 与 codex

#### Scenario: 发送追问
- **WHEN** 客户端发送 `{ type: 'follow_up', content, client_message_id }`
- **THEN** 系统 SHALL 绑定当前 sessionId 延续上下文
- **AND** 若消息携带 agent_name，SHALL 覆盖本轮执行 Agent

### Requirement: WebSocket 事件封装
系统 SHALL 将后端事件封装为统一格式再推送给前端。

#### Scenario: 事件推送格式
- **WHEN** 系统向客户端推送任意 BackendEvent
- **THEN** 系统 SHALL 使用 `{ type, sessionId, event_id, timestamp, payload }` 格式
- **AND** event_id SHALL 与后端 event_id 保持一致

### Requirement: WebSocket 断线恢复
系统 SHALL 支持客户端基于 last_event_id 恢复事件流。

#### Scenario: 重连恢复
- **WHEN** 客户端连接后发送 `{ type: 'resume', last_event_id }`
- **THEN** 系统 SHALL 重放该 event_id 之后的缓冲事件
- **AND** 重放完成后继续推送实时事件

#### Scenario: 恢复失败
- **WHEN** last_event_id 不在缓冲窗口
- **THEN** 系统 SHALL 返回 `{ type: 'resume_failed' }`
- **AND** 客户端 SHALL 进入可重试状态

### Requirement: WebSocket 客户端消息幂等
系统 SHALL 对同一 session 的重复 client_message_id 执行幂等处理。

#### Scenario: 重复消息
- **WHEN** 系统收到相同 sessionId + client_message_id 的重复 ask/follow_up
- **THEN** 系统 SHALL 只执行一次
- **AND** 重复请求 SHALL 返回已存在执行状态

### Requirement: WebSocket Team 事件流
系统 SHALL 提供 WebSocket 端点 /ws/team/:teamId，将 Team 事件实时推送给客户端。

#### Scenario: Team 事件推送
- **WHEN** TeamManager 发出 TeamEvent
- **THEN** 系统 SHALL 将事件推送给所有订阅该 teamId 的 WebSocket 客户端

### Requirement: Backend 运行时健康诊断 API
系统 SHALL 提供后端运行时健康诊断接口，暴露 Claude/Codex 可用性与命令信息。

#### Scenario: 查询后端健康
- **WHEN** 客户端调用 `GET /api/agents/runtime/backends`
- **THEN** 系统 SHALL 返回 backend 列表（`backend`、`command`、`available`、`reason?`）
- **AND** 列表 SHALL 至少覆盖 `codex` 与 `claude-code`

### Requirement: Team Run 编排 API
系统 SHALL 提供 Team Run 的创建、查询与会话维度列表能力，用于驱动多 Agent 协作执行。

#### Scenario: 创建 Team Run
- **WHEN** 客户端调用 `POST /api/agents/teams/runs` 并传入 sessionId、teamName、members
- **THEN** 系统 SHALL 创建 Team Run 记录并返回 `running` 状态
- **AND** 系统 SHALL 异步启动 TeamManager 执行并持续写入运行结果

#### Scenario: 查询 Team Run 详情
- **WHEN** 客户端调用 `GET /api/agents/teams/runs/:runId`
- **THEN** 系统 SHALL 返回指定 run 的最新状态与成员结果
- **AND** run 不存在时 SHALL 返回 404

#### Scenario: 查询会话 Team Runs
- **WHEN** 客户端调用 `GET /api/agents/teams/runs?sessionId=<id>`
- **THEN** 系统 SHALL 返回该 session 下所有 Team Run 列表（按最近更新时间排序）

### Requirement: 请求频率限制
系统 SHALL 对 Q&A 请求实施频率限制，防止单用户占用过多资源。

#### Scenario: 超出频率限制
- **WHEN** 用户在 1 分钟内发送超过 10 次 Q&A 请求
- **THEN** 系统 SHALL 返回 429 Too Many Requests
- **AND** 响应 SHALL 包含 Retry-After 头
