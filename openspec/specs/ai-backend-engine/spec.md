# ai-backend-engine Specification

## Purpose
TBD - created by archiving change okk-architecture. Update Purpose after archive.
## Requirements
### Requirement: 统一后端接口
系统 SHALL 定义 IBackend 接口，所有 AI CLI 后端实现此接口，提供 `execute()` 返回 `AsyncGenerator<BackendEvent>`、`abort()` 方法。所有后端均通过 `child_process.spawn` 管理 CLI 子进程。

#### Scenario: 通过 Claude Code CLI 后端执行查询
- **WHEN** 提交 backend='claude-code' 的 BackendRequest
- **THEN** 系统 SHALL 通过 `child_process.spawn` 启动 `claude` CLI 子进程，传入请求的 prompt 和 workingDirectory
- **AND** 通过 stdin 传入配置参数，解析 stdout 为 BackendEvent 流式输出给调用方

#### Scenario: 通过 Codex CLI 后端执行查询
- **WHEN** 提交 backend='codex' 的 BackendRequest
- **THEN** 系统 SHALL 通过 `child_process.spawn` 启动 `codex` CLI 子进程，传入请求的 prompt 和 workingDirectory
- **AND** 解析 stdout 为 BackendEvent 流式输出给调用方

### Requirement: 会话持久化与恢复
系统 SHALL 持久化 CLI 后端的会话状态，支持通过 CLI 参数恢复之前的会话以实现多轮对话。

#### Scenario: 恢复会话
- **WHEN** BackendRequest 包含之前查询返回的 sessionId
- **THEN** 系统 SHALL 向 CLI 子进程传入会话恢复参数（如 `--resume` 或 `--session-id`）
- **AND** CLI 后端 SHALL 能访问之前的对话上下文

#### Scenario: 创建新会话
- **WHEN** BackendRequest 没有 sessionId
- **THEN** 系统 SHALL 启动新的 CLI 子进程
- **AND** 从 stdout 解析新的 sessionId，通过 `session_update` BackendEvent 返回

### Requirement: 并发执行队列
系统 SHALL 限制同时运行的 CLI 后端进程数量为可配置的最大值（默认 3），超出的请求排队等待。

#### Scenario: 队列溢出
- **WHEN** 4 个请求到达且 maxConcurrent 为 3
- **THEN** 前 3 个请求 SHALL 立即执行
- **AND** 第 4 个请求 SHALL 等待直到有槽位释放
- **AND** 第 4 个请求 SHALL 在前 3 个中任一完成后开始执行

#### Scenario: 优先级排序
- **WHEN** 多个请求在队列中等待
- **THEN** 优先级值更高的请求 SHALL 优先出队

### Requirement: 流式输出协议
系统 SHALL 为所有后端发出统一的 BackendEvent 流，包括 text_delta、thinking_delta、tool_call_start、tool_call_input_delta、tool_call_end、sub_agent_start、sub_agent_end、session_update、knowledge_suggestion、done 和 error 事件类型。

#### Scenario: 流式文本输出
- **WHEN** AI 后端生成文本
- **THEN** 系统 SHALL 在文本产生时增量发出 `text_delta` 事件
- **AND** 完整文本 SHALL 是所有 text_delta content 值的拼接

### Requirement: BackendEvent 编号与顺序保证
系统 SHALL 为每个 BackendEvent 分配 event_id，且在同一 sessionId 内单调递增。

#### Scenario: 事件生成
- **WHEN** 后端产生新的 BackendEvent
- **THEN** 系统 SHALL 分配新的 event_id
- **AND** 事件 SHALL 按 event_id 顺序输出给调用方

### Requirement: BackendEvent 缓冲与恢复
系统 SHALL 缓冲最近一段时间的 BackendEvent，支持断线恢复。

#### Scenario: 恢复输出
- **WHEN** BackendRequest 包含 resume_from_event_id
- **THEN** 系统 SHALL 从该 event_id 之后重放缓冲事件
- **AND** 重放完成后继续输出实时事件

#### Scenario: 缓冲窗口不足
- **WHEN** resume_from_event_id 早于可用缓冲窗口
- **THEN** 系统 SHALL 发出 `error` 事件（code=resume_failed）
- **AND** 调用方 SHALL 以“恢复失败”状态提示用户重新发起查询

### Requirement: 后端注册表
系统 SHALL 维护可用后端的注册表，允许在启动时注册新的后端实现。

#### Scenario: 注册新后端
- **WHEN** 注册名为 'custom-backend' 的新 IBackend 实现
- **THEN** 系统 SHALL 使其可在 BackendRequest.backend 中选择
- **AND** 系统 SHALL 通过 BackendCapabilities 暴露其能力

### Requirement: 系统提示注入
系统 SHALL 支持向 AI 后端的系统提示追加自定义上下文（仓库 CLAUDE.md、已有知识条目）。

#### Scenario: 注入仓库上下文
- **WHEN** BackendRequest 目标仓库存在 CLAUDE.md 文件
- **THEN** 系统 SHALL 将 CLAUDE.md 内容追加到系统提示
- **AND** 系统 SHALL 追加该仓库的相关已有知识条目

### Requirement: 后端能力探测与失败诊断
系统 SHALL 在会话执行前后提供结构化的后端能力探测与失败诊断，避免仅返回模糊错误文本。

#### Scenario: 会话前置能力检查
- **WHEN** 用户准备使用某个 AI 后端发起会话
- **THEN** 系统 SHALL 返回该后端是否可用、命令来源、缺失依赖和建议修复动作
- **AND** 前端 SHALL 可据此提前提示用户

#### Scenario: 结构化失败原因
- **WHEN** 后端执行失败
- **THEN** 系统 SHALL 返回结构化失败原因、失败层级和可恢复动作建议
- **AND** 不得只输出不可操作的原始错误字符串

### Requirement: 桌面本地运行时前置检查
AI 后端执行引擎 SHALL 在桌面本地运行时提供 CLI、路径和依赖的前置检查，避免在会话中途才暴露环境问题。

#### Scenario: 会话前校验 CLI 可用性
- **WHEN** 用户在 Desktop 中准备发起对话
- **THEN** 系统 SHALL 检查所选 CLI 后端是否可用
- **AND** 若不可用 SHALL 返回具体缺失项与修复建议

#### Scenario: 本地路径或权限异常
- **WHEN** 桌面本地运行所需路径、配置或权限异常
- **THEN** 系统 SHALL 在会话开始前返回结构化错误
- **AND** 不得等到流式执行中才模糊失败

### Requirement: QA Gateway 回传知识引用
AI backend SHALL 在回答链路中记录并返回本次实际使用的知识引用。

#### Scenario: 回答成功完成
- **WHEN** QA Gateway 完成一次回答
- **THEN** 系统 SHALL 将本次实际注入的知识条目作为结构化引用随结果返回
- **AND** 引用列表 SHALL 与最终上下文构建结果一致

#### Scenario: 回答过程中没有使用知识
- **WHEN** 本次上下文构建未注入任何知识条目
- **THEN** QA Gateway SHALL 返回空引用列表或等价的明确空状态
- **AND** 前端 SHALL 无需自行推断引用结果

### Requirement: QA Gateway 支持编辑后的知识建议保存
AI backend SHALL 接收知识建议保存时用户修正后的标题、内容和标签。

#### Scenario: 保存编辑后的建议
- **WHEN** 前端提交带有修正字段的知识建议保存请求
- **THEN** 系统 SHALL 按用户修正后的字段创建知识条目
- **AND** 保存结果 SHALL 返回新建知识条目的标识信息
