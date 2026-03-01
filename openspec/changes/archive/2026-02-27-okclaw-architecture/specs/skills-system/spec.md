## ADDED Requirements

### Requirement: 双层 Skills 架构
系统 SHALL 采用双层 Skills 架构：底层通过 MCP servers 和 CLI 原生插件扩展 AI 后端能力，上层通过 okclaw 自建 Skills（SKILL.md + scripts/）提供知识库特有功能。

#### Scenario: 底层 MCP 扩展
- **WHEN** okclaw 启动 CLI 子进程
- **THEN** 系统 SHALL 为子进程动态生成 MCP 配置文件（Claude Code 用 `.mcp.json`，Codex 用 TOML）
- **AND** 配置中 SHALL 包含已启用的 MCP servers

#### Scenario: 上层 okclaw Skills
- **WHEN** AI 后端需要知识库特有功能（如知识导出、仓库统计）
- **THEN** 系统 SHALL 通过系统提示注入 SKILL.md 内容，由 AI 后端自主调用脚本

### Requirement: MCP Server 管理
系统 SHALL 管理 MCP servers 的生命周期，包括配置、启动、停止，并为每个 CLI 子进程动态注入 MCP 配置。

#### Scenario: 动态生成 MCP 配置
- **WHEN** 启动 Claude Code CLI 子进程
- **THEN** 系统 SHALL 在子进程工作目录下生成 `.mcp.json`，包含所有已启用的 MCP servers 配置
- **AND** 配置 SHALL 包含 server 的 command、args、env 字段

#### Scenario: 动态生成 Codex MCP 配置
- **WHEN** 启动 Codex CLI 子进程
- **THEN** 系统 SHALL 生成对应的 TOML 格式 MCP 配置文件

#### Scenario: MCP Server 认证
- **WHEN** MCP server 需要认证信息（如 Azure DevOps PAT、API keys）
- **THEN** 系统 SHALL 通过环境变量传递认证信息给 MCP server 进程
- **AND** 认证信息 SHALL 不写入磁盘配置文件

### Requirement: 默认 MCP Servers
系统 SHALL 默认集成以下 MCP servers，用户可在设置中启用/禁用：

#### Scenario: Azure DevOps MCP Server
- **WHEN** 用户启用 Azure DevOps MCP
- **THEN** 系统 SHALL 配置 `@azure-devops/mcp`（微软官方）
- **AND** 提供 Work Items 查询、Repos 浏览、Pipelines 状态、Wiki 读写、PR 管理等能力
- **AND** 用户 SHALL 配置 organization name 和 PAT

#### Scenario: Git MCP Server
- **WHEN** 用户启用 Git MCP
- **THEN** 系统 SHALL 配置 `mcp-server-git`
- **AND** 提供 Git 历史分析、diff、blame、branch 管理等能力

#### Scenario: SQLite MCP Server
- **WHEN** 用户启用 SQLite MCP
- **THEN** 系统 SHALL 配置 `@modelcontextprotocol/server-sqlite`，指向 okclaw 的知识库数据库
- **AND** AI 后端 SHALL 能直接查询知识条目、会话历史等数据

#### Scenario: Web Search MCP Server
- **WHEN** 用户启用 Web Search MCP
- **THEN** 系统 SHALL 配置搜索 MCP server（Brave Search 或 Tavily）
- **AND** 提供 Web 搜索能力，补充外部文档和 Stack Overflow 信息

### Requirement: MCP Server 配置 UI
系统 SHALL 提供 MCP Server 管理界面，允许用户启用/禁用 MCP servers、配置认证信息、添加自定义 MCP servers。

#### Scenario: 启用 MCP Server
- **WHEN** 用户在设置中启用某个 MCP server
- **THEN** 系统 SHALL 保存配置到数据库
- **AND** 后续启动的 CLI 子进程 SHALL 自动加载该 MCP server

#### Scenario: 添加自定义 MCP Server
- **WHEN** 用户添加自定义 MCP server（填写 command、args、env）
- **THEN** 系统 SHALL 将配置保存并在后续 CLI 子进程中加载

### Requirement: Skill 定义格式
系统 SHALL 支持通过 SKILL.md 文件定义 okclaw 上层 Skill，包含 YAML frontmatter（name、description、compatibility）和使用说明正文（脚本列表、用法步骤、示例）。

#### Scenario: 加载 Skill 定义
- **WHEN** 系统启动时扫描 `resources/skills/` 目录
- **THEN** 系统 SHALL 解析每个子目录中的 SKILL.md 文件
- **AND** 将 name 和 description 注册到 SkillRegistry

#### Scenario: Skill 目录结构
- **WHEN** 一个 Skill 目录包含 SKILL.md 和 scripts/ 子目录
- **THEN** 系统 SHALL 将 scripts/ 目录作为该 Skill 的 workingDirectory

### Requirement: Skill 注册表
系统 SHALL 维护 SkillRegistry，提供 register()、get()、getAll()、has() 方法管理 SkillInfo。

#### Scenario: 列出可用 Skills
- **WHEN** 调用 SkillRegistry.getAll()
- **THEN** 系统 SHALL 返回所有已注册 Skill 的 name 和 description 列表

### Requirement: Skill 执行器（知识注入模式）
系统 SHALL 提供 SkillExecutor，当 AI 后端调用 Skill 工具时，返回 SKILL.md 完整内容和 workingDirectory，由 AI 后端自主决定如何使用脚本。

#### Scenario: AI 后端调用 Skill 工具
- **WHEN** AI 后端在执行过程中调用 Skill 工具，传入 SkillName
- **THEN** 系统 SHALL 返回该 Skill 的 SKILL.md 完整内容
- **AND** 返回 workingDirectory（Skill 脚本所在目录的绝对路径）
- **AND** AI 后端 SHALL 根据 SKILL.md 的指导，使用 Bash 工具执行脚本

#### Scenario: Skill 不存在
- **WHEN** AI 后端调用 Skill 工具传入不存在的 SkillName
- **THEN** 系统 SHALL 返回错误信息，包含可用 Skill 列表

### Requirement: Skill 安全扫描
系统 SHALL 在安装第三方 Skill 前执行安全扫描，检查脚本中的风险操作。

#### Scenario: 扫描发现高风险操作
- **WHEN** 扫描 Skill 脚本发现 danger 级别的风险（如网络请求到外部地址、文件系统删除操作）
- **THEN** 系统 SHALL 返回 ScanResult 包含 risks 数组，每项含 severity、category、detail、file
- **AND** 系统 SHALL 阻止自动安装，要求管理员确认

#### Scenario: 扫描通过
- **WHEN** 扫描 Skill 脚本未发现 danger 级别风险
- **THEN** 系统 SHALL 允许安装并记录到 installed_skills 表

### Requirement: Skill 市场闭环
系统 SHALL 提供 Skill 市场能力，覆盖列表、搜索、下载、安装、失败回滚与临时目录清理。

#### Scenario: 市场列表与搜索
- **WHEN** 用户访问 Skill 市场并输入关键词
- **THEN** 系统 SHALL 返回市场 Skill 列表并按名称/描述/标签过滤
- **AND** 每个市场项 SHALL 包含版本、来源、下载类型和安装状态

#### Scenario: 从市场下载并安装 Skill
- **WHEN** 用户选择市场 Skill 并执行安装
- **THEN** 系统 SHALL 将 Skill 下载到临时目录并校验 `SKILL.md`
- **AND** 安装成功后 SHALL 写入本地 Skill 目录并更新 installed_skills 记录

#### Scenario: 安装失败回滚与清理
- **WHEN** 市场 Skill 安装过程中发生异常（下载失败、复制失败、校验失败）
- **THEN** 系统 SHALL 回滚目标目录到安装前状态
- **AND** 临时下载目录 SHALL 被清理，避免残留

### Requirement: 内置 Skills
系统 SHALL 提供以下内置 okclaw Skills：knowledge-export（知识库导出为 Markdown/PDF/Confluence）、repo-stats（仓库统计：语言分布、提交频率、贡献者）、code-analysis（代码复杂度分析）、dependency-audit（依赖安全审计）。

#### Scenario: 使用 knowledge-export Skill
- **WHEN** AI 后端加载 knowledge-export Skill
- **THEN** SKILL.md SHALL 包含知识库导出脚本的使用说明
- **AND** scripts/ 目录 SHALL 包含导出为 Markdown、PDF 等格式的可执行脚本

#### Scenario: 使用 repo-stats Skill
- **WHEN** AI 后端加载 repo-stats Skill
- **THEN** SKILL.md SHALL 包含仓库统计脚本的使用说明
- **AND** 脚本 SHALL 输出语言分布、提交频率、热点文件等统计数据
