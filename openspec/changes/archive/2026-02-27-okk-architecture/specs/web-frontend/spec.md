## ADDED Requirements

### Requirement: 三栏响应式布局
系统 SHALL 提供三栏布局：左栏（导航 + 仓库 + 会话历史）、中栏（Q&A 对话 / 知识编辑）、右栏（工具步骤 / 知识 / Agent 状态 / Team）。

#### Scenario: 默认布局
- **WHEN** 用户打开应用
- **THEN** 系统 SHALL 显示三栏布局，左栏 240px、中栏 flex-1、右栏 360px
- **AND** 右栏 SHALL 支持 Tab 切换（步骤、知识、Agent、Team）

#### Scenario: 响应式收缩
- **WHEN** 浏览器宽度小于 768px
- **THEN** 左栏和右栏 SHALL 可收缩为抽屉模式

### Requirement: 全局信息架构与空态
系统 SHALL 定义仓库、会话、知识三个主视图层级，并提供一致的空态引导。

#### Scenario: 首次进入无仓库
- **WHEN** 用户首次打开应用且尚未注册仓库
- **THEN** 系统 SHALL 在中栏显示“添加仓库”引导
- **AND** 左栏 SHALL 隐藏会话历史并显示仓库注册入口

#### Scenario: 切换仓库
- **WHEN** 用户在左栏切换目标仓库
- **THEN** 系统 SHALL 刷新该仓库下的会话与知识上下文
- **AND** 中栏 SHALL 跳转到该仓库最近活跃会话或空态页

### Requirement: Q&A 对话界面
系统 SHALL 提供 Q&A 对话界面，支持流式文本渲染、工具调用展示、Markdown 代码高亮。

#### Scenario: 流式文本渲染
- **WHEN** 收到 text_delta WebSocket 事件
- **THEN** 系统 SHALL 实时追加文本到当前消息气泡
- **AND** 文本 SHALL 以 Markdown 格式渲染（代码高亮、表格、链接）

#### Scenario: 工具调用展示
- **WHEN** 收到 tool_call_start 事件
- **THEN** 系统 SHALL 在消息流中显示工具调用块（工具名 + 输入参数）
- **AND** 工具调用块 SHALL 可展开/收起

#### Scenario: Sub-Agent 执行展示
- **WHEN** 收到 sub_agent_start 事件
- **THEN** 系统 SHALL 在消息流中显示 Sub-Agent 执行块（Agent 名称 + 任务描述 + 流式输出）

### Requirement: 流式会话状态管理
系统 SHALL 维护每条助手消息的状态（streaming/done/aborted/error）并在 UI 中显式展示。

#### Scenario: 结束状态落地
- **WHEN** 收到 done 事件
- **THEN** 系统 SHALL 将当前消息标记为 done
- **AND** 输入框 SHALL 立即恢复可编辑状态

#### Scenario: 主动中止
- **WHEN** 用户点击“停止生成”或按下 Esc
- **THEN** 系统 SHALL 发送 `{ type: 'abort' }` 命令
- **AND** 当前消息 SHALL 标记为 aborted

#### Scenario: 生成失败
- **WHEN** 收到 error 事件
- **THEN** 系统 SHALL 在当前消息块显示错误状态与失败原因摘要
- **AND** 提供“重试上一条”操作

### Requirement: 消息列表滚动与编辑重发
系统 SHALL 在流式场景下提供自动跟随、回到底部与最后一条用户消息编辑重发能力。

#### Scenario: 自动跟随
- **WHEN** 当前视图位于消息列表底部且收到流式事件
- **THEN** 系统 SHALL 自动滚动保持最新内容可见

#### Scenario: 非底部提示
- **WHEN** 用户浏览历史消息时收到新事件
- **THEN** 系统 SHALL 显示“回到底部”快捷按钮
- **AND** 不强制打断用户当前阅读位置

#### Scenario: 编辑重发
- **WHEN** 用户编辑最后一条 user 消息并确认重发
- **THEN** 系统 SHALL 以新内容发起请求
- **AND** 保留原会话历史以便追溯

### Requirement: 工具调用卡片交互
系统 SHALL 以工具卡片展示工具调用，支持分组、状态徽标和自动展开策略。

#### Scenario: 工具卡片状态展示
- **WHEN** 收到 tool_call_start 或 tool_call_end 事件
- **THEN** 系统 SHALL 在卡片上显示 running/completed/error 状态
- **AND** 展示工具名称、摘要参数和耗时

#### Scenario: 自动展开高风险与失败调用
- **WHEN** 工具调用失败或属于变更型工具（Write/Edit/MultiEdit/Delete）
- **THEN** 系统 SHALL 默认展开详情
- **AND** 展示可复制的输入/输出内容

#### Scenario: 同类工具分组
- **WHEN** 连续出现可分组的同类工具调用
- **THEN** 系统 SHALL 以分组卡片折叠展示
- **AND** 分组头 SHALL 展示调用次数与整体状态

### Requirement: 后端选择器
系统 SHALL 在消息输入框旁提供 AI 后端选择器，允许用户在 Claude Code 和 Codex 之间切换。

#### Scenario: 切换后端
- **WHEN** 用户在选择器中切换到 Codex
- **THEN** 后续 Q&A 请求 SHALL 使用 Codex 后端
- **AND** 选择器 SHALL 显示当前选中的后端名称

### Requirement: 知识编辑器
系统 SHALL 提供知识条目编辑器，支持 Markdown 编辑和实时预览。

#### Scenario: 编辑知识条目
- **WHEN** 用户打开知识编辑器
- **THEN** 系统 SHALL 显示 Monaco Editor（左侧编辑）和 Markdown 预览（右侧）
- **AND** 支持标签编辑、分类选择

### Requirement: 知识搜索界面
系统 SHALL 提供知识搜索界面，支持关键词搜索、标签过滤、仓库过滤。

#### Scenario: 搜索知识
- **WHEN** 用户在搜索框输入关键词
- **THEN** 系统 SHALL 实时显示匹配的知识条目卡片（标题 + 摘要 + 标签 + 评分）
- **AND** 支持按仓库和标签进一步过滤

#### Scenario: 搜索排序与空态
- **WHEN** 搜索结果返回后用户切换排序方式（相关度/评分/更新时间）
- **THEN** 系统 SHALL 在保持过滤条件不变的前提下重排结果
- **AND** 无结果时 SHALL 显示空态与“清除过滤”入口

### Requirement: 知识建议卡片
系统 SHALL 在 Q&A 完成后显示知识建议卡片，提供"保存为知识"和"忽略"操作。

#### Scenario: 显示知识建议
- **WHEN** 收到 knowledge_suggestion WebSocket 事件
- **THEN** 系统 SHALL 在对话界面底部显示知识建议卡片
- **AND** 卡片 SHALL 包含建议的标题、摘要、标签
- **AND** 提供"保存为知识"和"忽略"按钮

### Requirement: Agent 选择器
系统 SHALL 在消息输入框中提供 Agent 选择器，允许用户指定使用特定 Agent 处理问题。

#### Scenario: 选择 Agent
- **WHEN** 用户在输入框中通过 @ 触发 Agent 选择器
- **THEN** 系统 SHALL 显示可用 Agent 列表（名称 + 描述）
- **AND** 选中后 SHALL 使用该 Agent 的系统提示和工具集处理问题

### Requirement: Team 协作视图
系统 SHALL 在右栏 Team Tab 中显示 Agent Team 的实时状态。

#### Scenario: 显示 Team 状态
- **WHEN** 有活跃的 Agent Team
- **THEN** 系统 SHALL 显示 Team 成员列表（名称 + 状态 + 当前任务）
- **AND** 显示 Team 任务列表（状态 + 依赖关系）
- **AND** 显示 Team 消息流

#### Scenario: Team 快速跳转
- **WHEN** 用户点击 Team 成员或任务项
- **THEN** 系统 SHALL 跳转到关联的消息位置或 Agent 日志
- **AND** 右栏 SHALL 保持当前 Team 上下文

### Requirement: 会话管理交互
系统 SHALL 提供会话的新建、重命名、删除与撤销删除交互。

#### Scenario: 新建会话
- **WHEN** 用户点击“新会话”或在首页发送第一条消息
- **THEN** 系统 SHALL 创建新会话并聚焦输入框

#### Scenario: 重命名会话
- **WHEN** 用户在会话列表触发重命名
- **THEN** 系统 SHALL 支持内联编辑标题并即时保存

#### Scenario: 删除会话
- **WHEN** 用户删除会话
- **THEN** 系统 SHALL 显示确认提示
- **AND** 删除成功后 SHALL 提供“撤销”入口

### Requirement: 认证与连接状态
系统 SHALL 提供登录界面和连接状态提示，确保交互可恢复。

#### Scenario: 未登录访问
- **WHEN** 用户未携带有效 JWT 访问应用
- **THEN** 系统 SHALL 重定向到登录界面
- **AND** 登录成功后恢复到目标页面

#### Scenario: WebSocket 连接断开
- **WHEN** WebSocket 连接中断
- **THEN** 系统 SHALL 显示“已断开，正在重连”提示并禁用发送按钮
- **AND** 连接恢复后 SHALL 自动恢复可发送状态

#### Scenario: 去重渲染
- **WHEN** 重连后收到已处理的 event_id
- **THEN** 系统 SHALL 忽略重复事件
- **AND** 消息内容 SHALL 保持一致

### Requirement: MCP Server 管理界面
系统 SHALL 提供 MCP Server 配置 UI，支持启用/禁用、认证信息配置和自定义服务添加。

#### Scenario: 启用 MCP Server
- **WHEN** 用户在设置页启用某个 MCP Server
- **THEN** 系统 SHALL 保存配置并提示将在后续会话生效

#### Scenario: 配置敏感认证信息
- **WHEN** 用户输入 PAT 或 API Key
- **THEN** 系统 SHALL 使用安全输入控件展示
- **AND** 不在界面上明文回显已保存值

### Requirement: Skill 浏览与安装反馈
系统 SHALL 提供 Skill 列表、详情查看和安装安全提示。

#### Scenario: 浏览 Skill
- **WHEN** 用户进入 Skill 页面
- **THEN** 系统 SHALL 展示 Skill 名称、描述、来源与版本

#### Scenario: 安装前风险提示
- **WHEN** 安装 Skill 扫描发现 danger 风险
- **THEN** 系统 SHALL 显示风险详情并阻止直接安装
- **AND** 提示需要管理员确认

### Requirement: Skill 市场交互
系统 SHALL 在 Skill 页面提供市场列表、搜索与一键安装交互，并确保失败可恢复。

#### Scenario: 市场搜索
- **WHEN** 用户在 Skill 市场输入关键词并点击搜索
- **THEN** 系统 SHALL 请求市场 API 并展示匹配结果
- **AND** 每个市场项 SHALL 显示名称、版本、来源、标签与安装状态

#### Scenario: 一键安装
- **WHEN** 用户在市场项点击“一键安装”
- **THEN** 系统 SHALL 触发市场安装接口并显示安装中反馈
- **AND** 安装成功后 SHALL 同步本地 Skill 列表与市场安装状态

#### Scenario: 安装失败恢复
- **WHEN** 市场安装接口返回错误
- **THEN** 系统 SHALL 显示明确错误原因
- **AND** 用户 SHALL 可直接重试或修改参数后再次安装

### Requirement: IOProvider 抽象
系统 SHALL 通过 React Context 注入 IOProvider 接口，UI 组件通过 IOProvider 与后端通信，不直接依赖 HTTP/WebSocket。

#### Scenario: Web 端 IOProvider
- **WHEN** 应用在浏览器中运行
- **THEN** IOProvider SHALL 使用 HTTP REST API + WebSocket 实现

#### Scenario: Desktop 端 IOProvider（Phase 2）
- **WHEN** 应用在 Electron 中运行
- **THEN** IOProvider SHALL 使用 Electron IPC 实现
- **AND** UI 组件代码 SHALL 无需修改
