## ADDED Requirements

### Requirement: Agent 定义格式
系统 SHALL 支持通过 Markdown 文件定义 Agent，包含 YAML frontmatter（name、description、icon、allowedTools、maxIterations、model、temperature）和系统提示正文。

#### Scenario: 加载 Agent 定义
- **WHEN** 系统启动时扫描 `resources/agents/` 目录
- **THEN** 系统 SHALL 解析每个 .md 文件的 frontmatter 和正文
- **AND** 将解析结果注册到 AgentRegistry

#### Scenario: Agent 定义缺少必填字段
- **WHEN** Agent .md 文件缺少 name 或 description
- **THEN** 系统 SHALL 跳过该文件并记录警告日志

### Requirement: Agent 注册表
系统 SHALL 维护 AgentRegistry，提供 register()、get()、getAll()、has() 方法管理 AgentDefinition。

#### Scenario: 查询可用 Agent
- **WHEN** 调用 AgentRegistry.getAll()
- **THEN** 系统 SHALL 返回所有已注册 Agent 的定义列表，包含 name、description、allowedTools

### Requirement: Sub-Agent 执行器
系统 SHALL 提供 AgentRunner，使用聚焦系统提示和受限工具集执行 Sub-Agent 任务，返回 AgentResult。

#### Scenario: 执行 Sub-Agent 任务
- **WHEN** 调用 AgentRunner.run() 传入 AgentDefinition 和输入 prompt
- **THEN** 系统 SHALL 使用该 Agent 的 systemPrompt 和 allowedTools 调用 AI 后端
- **AND** 收集输出文本和工具调用计数
- **AND** 返回 AgentResult（success、output、toolCallCount、iterations、usage）

#### Scenario: Sub-Agent 工具权限
- **WHEN** Sub-Agent 执行过程中尝试调用不在 allowedTools 列表中的工具
- **THEN** 系统 SHALL 拒绝该工具调用
- **AND** 所有 Sub-Agent SHALL 自动获得 Skill 工具的访问权限

### Requirement: Agent Teams 应用层编排
系统 SHALL 提供 TeamManager，支持创建 Team、添加成员（启动独立 CLI 子进程作为 Sub-Agent）、并行执行、汇总结果。

#### Scenario: 创建并执行 Team
- **WHEN** 调用 TeamManager.createTeam() 后添加多个成员
- **THEN** 每个成员 SHALL 作为独立的 CLI 子进程并行执行
- **AND** TeamManager SHALL 通过 TeamEventBus 发出 team_start、team_member_add、team_member_update、team_end 事件

#### Scenario: Team 成员使用不同后端
- **WHEN** Team 中的成员 A 配置使用 claude-code，成员 B 配置使用 codex
- **THEN** 系统 SHALL 分别通过对应的 AI 后端执行各成员任务

#### Scenario: 等待 Team 结果
- **WHEN** 调用 TeamManager.awaitResults()
- **THEN** 系统 SHALL 等待所有成员完成（或失败）
- **AND** 返回 TeamResult 包含每个成员的 AgentResult

### Requirement: Team 事件总线
系统 SHALL 提供 TeamEventBus，支持 on() 订阅和 emit() 发布 TeamEvent。

#### Scenario: 订阅 Team 事件
- **WHEN** 调用 TeamEventBus.on(handler)
- **THEN** handler SHALL 在每个 TeamEvent 发出时被调用
- **AND** on() SHALL 返回取消订阅函数

### Requirement: TeamEvent 结构化载荷
系统 SHALL 为 Team 事件定义结构化 payload，支持前端展示成员、任务依赖和消息流。

#### Scenario: 成员状态事件
- **WHEN** TeamManager 发出 team_member_add 或 team_member_update
- **THEN** payload SHALL 包含 member_id、agent_name、status、current_task、backend、started_at、updated_at

#### Scenario: 任务依赖事件
- **WHEN** Team 内部任务开始、更新或结束
- **THEN** 系统 SHALL 发出 team_task_update 事件
- **AND** payload SHALL 包含 task_id、title、status、depends_on、owner_member_id

#### Scenario: Team 消息事件
- **WHEN** Team 成员产生可见消息
- **THEN** 系统 SHALL 发出 team_message 事件
- **AND** payload SHALL 包含 message_id、member_id、content、created_at

### Requirement: 内置 Agent 定义
系统 SHALL 提供以下内置 Agent：knowledge-extractor（知识提取）、code-reviewer（代码审查）、repo-explorer（仓库探索）、architecture-analyst（架构分析）、cross-repo-analyst（跨仓库分析）。

#### Scenario: knowledge-extractor Agent 提取知识
- **WHEN** knowledge-extractor Agent 接收一段 Q&A 对话
- **THEN** Agent SHALL 分析对话内容，识别可复用知识
- **AND** 返回结构化的知识建议（title、content、tags、quality_confidence、related_files）
