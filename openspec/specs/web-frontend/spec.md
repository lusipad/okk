# web-frontend Specification

## Purpose
TBD - created by archiving change okk-architecture. Update Purpose after archive.
## Requirements
### Requirement: 双栏主布局与协作抽屉
系统 SHALL 提供“左栏 + 中栏”的主舞台布局，并将协作信息收纳为按需展开的右侧抽屉，以保持 Chat 主流程聚焦。

#### Scenario: 默认布局
- **WHEN** 用户打开应用
- **THEN** 系统 SHALL 显示左栏导航与中栏聊天主区
- **AND** 右侧协作面板 SHALL 默认收起，仅在用户触发时展开

#### Scenario: 响应式收缩
- **WHEN** 浏览器宽度小于 768px
- **THEN** 左栏和协作面板 SHALL 统一收敛为抽屉模式

### Requirement: 商业化统一视觉系统
系统 SHALL 提供统一的商业化视觉语言（类似 ChatGPT/Claude 级别），覆盖顶栏、面板、状态、输入与反馈组件。

#### Scenario: 全局视觉一致性
- **WHEN** 用户在 Chat、MCP、Skills 页面间切换
- **THEN** 系统 SHALL 维持一致的颜色语义、圆角、阴影、间距和交互动效
- **AND** 左中右栏与顶栏 SHALL 使用统一层级与密度规则

#### Scenario: 主题切换
- **WHEN** 用户切换浅色/深色主题
- **THEN** 系统 SHALL 即时切换主题并持久化用户偏好
- **AND** 所有核心组件 SHALL 保持可读性与对比度

#### Scenario: 命令面板导航
- **WHEN** 用户通过 `Ctrl/Cmd + K` 打开命令面板
- **THEN** 系统 SHALL 提供页面跳转与主题切换等高频命令
- **AND** 执行命令后 SHALL 自动关闭面板并保留当前会话上下文

#### Scenario: 聊天主舞台优先
- **WHEN** 用户进入 Chat 页面
- **THEN** 系统 SHALL 让消息流与输入区占据主要视觉层级
- **AND** 运行指标与协作信息 SHALL 以弱化或按需展开方式呈现，避免喧宾夺主

#### Scenario: 能力入口轻量化
- **WHEN** 用户在 Chat 主界面查看 Skills / MCP 能力状态
- **THEN** 系统 SHALL 以紧凑能力条展示已安装/启用比例
- **AND** 用户 SHALL 可一跳进入对应管理页，不打断当前对话阅读

#### Scenario: 暗色官网风格对齐
- **WHEN** 用户首次进入应用且未设置主题偏好
- **THEN** 系统 SHALL 默认采用暗色主题与高对比内容排版
- **AND** 左栏、主舞台与输入区 SHALL 使用低噪音边框与克制强调色，保持阅读优先

#### Scenario: 顶栏极简模式
- **WHEN** 用户在 Chat 主流程中操作
- **THEN** 顶栏 SHALL 保持极简信息密度（品牌、当前页签、少量高频动作）
- **AND** 非核心控制项 SHALL 收敛到命令面板或抽屉，减少视觉干扰

#### Scenario: 顶栏与输入控件样式隔离
- **WHEN** 用户在输入区切换“工具”开关或编辑模型选择器
- **THEN** 输入区控件 SHALL 使用独立样式类，不受顶栏按钮状态样式影响
- **AND** 输入区按钮宽度和内边距 SHALL 在激活态保持稳定

#### Scenario: 左栏官网式分层
- **WHEN** 用户浏览左侧导航
- **THEN** 系统 SHALL 采用“New chat / Search / Primary links / Chats”分层结构
- **AND** 会话列表 SHALL 使用低噪音样式与时间分组，确保长列表可扫读

#### Scenario: 左栏平面化视觉
- **WHEN** 用户在暗色主题下查看左栏
- **THEN** 会话项 SHALL 采用平面列表样式（无重阴影卡片）
- **AND** 仅当前会话 SHALL 使用轻量高亮底色，不影响长列表阅读节奏

#### Scenario: 消息主舞台无边框阅读流
- **WHEN** 用户进入 Chat 页面并浏览消息
- **THEN** assistant 消息 SHALL 以文档流样式展示，弱化容器边框
- **AND** user 消息 SHALL 使用右侧胶囊气泡，形成清晰对话层次

#### Scenario: 输入 Dock 极简化
- **WHEN** 用户在底部输入区发起提问
- **THEN** 输入区 SHALL 采用单一圆角 Dock（文本输入 + 模型选择 + 工具入口 + 发送）
- **AND** 非核心提示（冗长快捷键说明/营销文案）SHALL 默认隐藏，降低视觉噪音

#### Scenario: 空态与输入区同屏可见
- **WHEN** 用户在桌面分辨率（1600x900）打开空会话
- **THEN** 空态主文案 SHALL 在主舞台居中展示
- **AND** 输入 Dock SHALL 在同一视窗内完整可见，不得被裁切

#### Scenario: 专注模式切换
- **WHEN** 用户通过顶栏按钮、命令面板或 `Ctrl/Cmd + Shift + L` 快捷键切换专注模式
- **THEN** 系统 SHALL 隐藏左右侧栏并聚焦中栏会话区域
- **AND** 专注模式偏好 SHALL 持久化并在刷新后恢复

### Requirement: 像素对齐验收闸门
系统 SHALL 提供自动化像素验收闸门，确保官网风格对齐在迭代中可回归、可量化。

#### Scenario: 标准像素闸门
- **WHEN** 研发执行 `npm run ui:pixel:gate`
- **THEN** 系统 SHALL 串行执行 frontend/backend/core 的 test + build、pixel audit/diff/report、smoke e2e
- **AND** 所有阶段通过后才允许标记本轮 UI 变更为验收通过

#### Scenario: 官方参考严格校验
- **WHEN** 研发执行 `npm run ui:pixel:gate:strict` 或 `npm run ui:pixel:reference-diff:strict`
- **THEN** 系统 SHALL 要求存在官方参考图并执行参考差异比对
- **AND** 若参考图缺失或差异超阈值 SHALL 直接失败并输出原因

#### Scenario: 参考图预处理与尺寸一致性
- **WHEN** 研发导入官方参考图后执行 `npm run ui:pixel:reference:prepare`
- **THEN** 系统 SHALL 输出与验收分辨率一致的参考图（1600x900、1920x1080、1280x800）
- **AND** 在 strict 校验下 SHALL 对尺寸不一致直接判定失败（dimension_mismatch）

#### Scenario: Chrome 对比抓图
- **WHEN** 研发执行 `npm run ui:chrome:compare`
- **THEN** 系统 SHALL 通过 Chrome 通道抓取官方页面与本地页面截图
- **AND** SHALL 输出结构化报告供人工对照视觉差异

#### Scenario: 本地 Chrome 对比失败快返
- **WHEN** 研发执行 `npm run ui:chrome:compare:local` 且本地页面抓图失败
- **THEN** 系统 SHALL 返回非 0 退出码并在报告中标记失败目标
- **AND** 报告 SHALL 包含 `localUrl` 与 `okk-local` 关键几何指标

#### Scenario: 像素差异阈值可配置
- **WHEN** 研发在不同平台执行 `ui:pixel:diff`
- **THEN** 系统 SHALL 支持通过环境变量配置 full/key/pixelmatch 阈值
- **AND** SHALL 在报告中输出实际使用阈值，便于回溯验收标准

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

#### Scenario: 协作面板多视图切换
- **WHEN** 用户在协作侧栏切换“概览 / 时间线 / 任务图 / 知识”
- **THEN** 系统 SHALL 在不丢失当前会话上下文的前提下切换视图
- **AND** 时间线 SHALL 展示事件顺序，任务图 SHALL 展示任务依赖关系

#### Scenario: 任务图节点跳转
- **WHEN** 用户在任务图中点击某个任务节点
- **THEN** 系统 SHALL 切换到时间线并定位该任务关联事件
- **AND** 被定位事件 SHALL 显式高亮，便于回溯执行过程

#### Scenario: 时间线事件筛选
- **WHEN** 用户在时间线输入筛选关键词
- **THEN** 系统 SHALL 基于事件类型与摘要实时过滤列表
- **AND** 支持一键清空筛选条件恢复完整事件流

#### Scenario: 任务图交互控制
- **WHEN** 用户在任务图中执行缩放、拖拽和“关键路径”操作
- **THEN** 系统 SHALL 更新任务图视口状态（scale/offset）并保持节点可点击
- **AND** 关键路径节点与连线 SHALL 以增强样式高亮显示

#### Scenario: 任务图缩略图与批量定位
- **WHEN** 用户在任务图缩略图中点击目标区域，或使用多选节点后触发“批量定位”
- **THEN** 系统 SHALL 调整 DAG 视口并切换到时间线定位相关事件
- **AND** 时间线 SHALL 保持多事件高亮，支持问题回放

#### Scenario: 任务图节点拖拽与布局持久化
- **WHEN** 用户拖拽任务图节点调整布局后刷新页面
- **THEN** 系统 SHALL 按 team 维度持久化并恢复节点位置、缩放与视口偏移
- **AND** 当任务集合变化时 SHALL 自动清理无效节点布局数据

#### Scenario: 任务图布局重置
- **WHEN** 用户点击“重置布局”
- **THEN** 系统 SHALL 清空手动节点布局并清空当前节点多选状态
- **AND** 后续任务图 SHALL 回退到自动布局结果

#### Scenario: 导出 Team 协作报告
- **WHEN** 用户在协作概览点击“导出报告”
- **THEN** 系统 SHALL 生成包含后端健康、Team Runs、成员、任务与近期事件的 Markdown 报告文件
- **AND** 文件名 SHALL 包含时间戳以避免覆盖历史报告

### Requirement: Team Run 启动与结果追踪
系统 SHALL 提供 Team Run 启动入口，并在右栏展示运行中与历史运行结果。

#### Scenario: 启动 Team Run
- **WHEN** 用户在会话中点击“启动 Team Run”
- **THEN** 系统 SHALL 创建 Team Run 并显示 `running` 状态
- **AND** 团队执行 SHALL 复用当前会话上下文与已选 Agent 能力

#### Scenario: 轮询并展示 Team Run 状态
- **WHEN** 当前 Team Run 处于 `running`
- **THEN** 系统 SHALL 周期性拉取 run 详情直到 `done/error`
- **AND** 右栏 SHALL 显示成员数、摘要、更新时间与历史 run 列表

### Requirement: 后端健康可视化
系统 SHALL 在协作侧栏展示 Codex/Claude 后端可用性，帮助用户诊断为何无法触发真实执行。

#### Scenario: 渲染健康状态
- **WHEN** 页面加载完成并请求 runtime backends
- **THEN** 系统 SHALL 显示每个 backend 的 available/unavailable 状态与执行命令
- **AND** unavailable 时 SHALL 展示原因摘要（如 command_not_found）

### Requirement: 会话管理交互
系统 SHALL 提供会话的新建、重命名、删除与撤销删除交互。

#### Scenario: 新建会话
- **WHEN** 用户点击“新会话”或在首页发送第一条消息
- **THEN** 系统 SHALL 创建新会话并聚焦输入框

#### Scenario: 重命名会话
- **WHEN** 用户在会话列表触发重命名
- **THEN** 系统 SHALL 支持内联编辑标题并即时保存

#### Scenario: 会话列表筛选
- **WHEN** 用户在左侧会话搜索框输入关键词
- **THEN** 系统 SHALL 按会话标题实时筛选结果
- **AND** 无匹配结果时 SHALL 显示明确空态提示

#### Scenario: 会话分组浏览
- **WHEN** 左侧栏渲染会话历史
- **THEN** 系统 SHALL 以“今天 / 昨天 / 近 7 天 / 更早”进行时间分组
- **AND** 每个分组内 SHALL 保持可点击切换与相对时间展示

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

### Requirement: 协作侧栏与步骤时间线
前端 SHALL 提供统一协作侧栏与步骤时间线，承载 backend、tool、skill、agent、team、mcp 的运行信息。

#### Scenario: 时间线分层展示
- **WHEN** 当前会话发生多类协作运行
- **THEN** 系统 SHALL 按时间线展示各运行节点
- **AND** 用户 SHALL 能区分来源类型、运行状态与上下游关系

#### Scenario: 失败默认放大
- **WHEN** 某个协作节点失败或属于高风险操作
- **THEN** 系统 SHALL 默认展开其详情
- **AND** 提供重试、查看配置或复制诊断信息的入口

### Requirement: 统一工作台导航层级
系统 SHALL 提供稳定的工作台导航层级，将高频入口、主能力页面与会话历史明确分层，避免页面集合式跳转。

#### Scenario: 左栏分层导航
- **WHEN** 用户进入主工作台
- **THEN** 系统 SHALL 在左栏按 `New chat / Search / Primary links / Chats` 分层展示入口
- **AND** 会话历史 SHALL 独立于一级能力入口展示

#### Scenario: 路由上下文保持
- **WHEN** 用户从 Chat 切换到 Skills、MCP 或 Knowledge 页面后再返回
- **THEN** 系统 SHALL 保留当前仓库、当前会话和最近一次上下文面板状态
- **AND** 不得将用户重置到默认空页面

### Requirement: 上下文侧栏与专注模式
系统 SHALL 提供按需展开的上下文侧栏与专注模式，使主任务舞台始终保持阅读优先。

#### Scenario: 右侧上下文面板按需展开
- **WHEN** 用户打开步骤、知识建议、Team 状态或诊断信息
- **THEN** 系统 SHALL 在右侧统一上下文面板中展示对应内容
- **AND** 默认状态下 SHALL 保持收起，避免干扰主对话

#### Scenario: 专注模式
- **WHEN** 用户通过快捷键或命令面板切换专注模式
- **THEN** 系统 SHALL 隐藏左右侧栏并仅保留中间主舞台
- **AND** 刷新后 SHALL 恢复上次专注模式偏好

### Requirement: Chat UI 展示知识引用
前端聊天界面 SHALL 展示本次回答实际使用的知识引用。

#### Scenario: 回答包含知识引用
- **WHEN** 回答结果带有知识引用列表
- **THEN** 前端 SHALL 在聊天界面渲染对应的知识引用信息
- **AND** 用户 SHALL 能明确区分这些信息属于本次回答的引用来源

#### Scenario: 回答不包含知识引用
- **WHEN** 回答结果没有知识引用
- **THEN** 前端 SHALL 隐藏或清空知识引用展示区域
- **AND** 不得展示过期的上一轮引用信息

### Requirement: 知识建议卡支持编辑与跳转
前端 SHALL 允许用户在知识建议卡中编辑建议内容，并在保存后跳转到对应知识条目。

#### Scenario: 编辑建议草稿
- **WHEN** 用户在知识建议卡中修改标题、内容或标签
- **THEN** 前端 SHALL 在当前卡片中保留这些修改
- **AND** 修改 SHALL 在提交前保持可见

#### Scenario: 保存后跳转
- **WHEN** 用户保存知识建议且后端返回新建知识条目标识
- **THEN** 前端 SHALL 可跳转到对应的知识条目路由
- **AND** 该跳转 SHALL 指向新保存的知识记录

### Requirement: 知识入口成为前端一级导航
前端工作台 SHALL 将 Knowledge 作为一级导航入口暴露给用户。

#### Scenario: 渲染侧栏导航
- **WHEN** 用户进入工作台并查看左侧导航
- **THEN** 系统 SHALL 显示 Knowledge 一级导航项
- **AND** 该导航项 SHALL 可直接跳转到 `/knowledge`

### Requirement: 前端知识 IO 桥接
前端 IOProvider SHALL 暴露知识工作台所需的知识 CRUD、搜索、版本历史和状态更新方法。

#### Scenario: 页面加载知识数据
- **WHEN** `KnowledgePage` 请求列表、详情或版本历史数据
- **THEN** IOProvider SHALL 调用对应的知识接口方法
- **AND** 页面层 SHALL 不需要直接拼接底层 HTTP 请求

#### Scenario: 执行知识变更
- **WHEN** 用户在工作台中创建、更新、删除或切换知识状态
- **THEN** IOProvider SHALL 提供对应的前端方法并返回结构化结果
- **AND** 结果 SHALL 可被页面状态直接消费

### Requirement: 知识共享发起与状态反馈
Web Frontend SHALL 允许作者从知识工作台发起共享请求，并实时展示共享状态和审核反馈。

#### Scenario: 作者提交共享
- **WHEN** 作者在知识详情面板中点击共享
- **THEN** 前端 SHALL 展示共享表单并提交请求
- **AND** 提交成功后 SHALL 在界面中显示当前共享状态

#### Scenario: 作者查看审核反馈
- **WHEN** 某条共享请求被驳回或退回修改
- **THEN** 前端 SHALL 在对应知识条目上显示最新审核结论
- **AND** 用户 SHALL 能查看审核备注

### Requirement: 审核工作台与团队浏览界面
Web Frontend SHALL 提供审核队列和团队知识浏览界面，分别承载审核动作和团队复用入口。

#### Scenario: 审核人处理待审请求
- **WHEN** 审核人打开知识共享审核队列
- **THEN** 前端 SHALL 展示待审共享列表和详情
- **AND** 审核人 SHALL 能执行批准、驳回或退回修改

#### Scenario: 团队成员浏览已发布知识
- **WHEN** 团队成员进入团队知识页
- **THEN** 前端 SHALL 展示已发布共享知识列表
- **AND** 用户 SHALL 能按标签、分类或来源进行筛选

### Requirement: 工作流编辑器支持知识输入节点配置
系统 SHALL 在工作流编辑界面中提供 `knowledge_ref` 节点的创建、编辑和预览能力。

#### Scenario: 创建知识输入节点
- **WHEN** 用户在工作流编辑器中选择添加知识输入节点
- **THEN** 前端 SHALL 提供用于录入 `entryIds`、筛选条件和 `outputKey` 的配置入口
- **AND** 节点预览 SHALL 明确显示该节点为知识输入类型

#### Scenario: 预览知识输入节点配置
- **WHEN** 用户查看已保存的 `knowledge_ref` 节点
- **THEN** 前端 SHALL 展示节点的引用方式、筛选条件和输出键
- **AND** 用户 SHALL 能在不直接手改 JSON 的情况下理解节点行为

### Requirement: 工作流运行详情展示知识输入结果
系统 SHALL 在运行详情中展示知识输入节点的命中结果和执行状态。

#### Scenario: 查看知识节点运行结果
- **WHEN** 用户打开包含 `knowledge_ref` 节点的运行详情
- **THEN** 前端 SHALL 展示该节点的执行状态、命中条目数量和条目摘要
- **AND** 节点失败时 SHALL 展示结构化错误信息
