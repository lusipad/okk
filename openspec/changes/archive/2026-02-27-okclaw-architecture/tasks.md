## P0 验收门槛（必须全部完成）

- [x] G1 真实对话必须由 Claude Code CLI / Codex CLI 子进程执行（禁止 mock 回答）
- [x] G2 Skill/MCP 必须形成“配置-启用-注入-执行-审计”闭环
- [x] G3 Web 端交互质量达到 ChatGPT / Claude 官网同等级（视觉、反馈、可恢复性）

## 主线 A（P0）：官网级 Web 交互重构

- [x] A1 建立设计系统（色板、字体层级、间距、圆角、阴影、动效、暗色）
- [x] A2 重构三栏布局与导航信息架构（桌面优先，窄屏抽屉）
- [x] A3 重构消息流（用户/助手消息、流式态、错误态、重试态、停止态）
- [x] A4 重构输入区（自动增高、快捷键、发送中反馈、可中断）
- [x] A5 完成代码块/工具卡片/知识建议卡片的高可读展示与交互
- [x] A6 完成空态/加载态/异常态统一规范与文案体系
- [x] A7 完成无障碍与可用性检查（键盘操作、焦点管理、对比度）
- [x] A8 产出视觉回归基线（关键页面截图对比）

## 主线 B（P0）：真实 Claude/Codex CLI 接入

- [x] B1 在 `@okclaw/core` 导出可被 web-backend 动态加载的 createCore 工厂
- [x] B2 在 core 内注册 Claude Code CLI / Codex CLI backend（spawn + 流式解析）
- [x] B3 将 web-backend 从 in-memory mock 切换到真实 core 工厂加载
- [x] B4 完成 ask/follow_up/abort/resume 全链路联调（含 event_id 幂等与重放）
- [x] B5 完成 Windows 子进程可靠性处理（超时、终止、僵尸进程回收）
- [x] B6 增加失败可观测性（stderr、退出码、会话关联日志）
- [x] B7 增加端到端测试：登录后真实调用 backend 并返回可见流式结果

## 主线 C（P0）：Skill/MCP 对齐 OpenCowork 的闭环

- [x] C1 Skill 本地仓库管理：扫描、读取、详情、删除、导入目录
- [x] C2 Skill 安装前风险扫描（命令执行/网络访问/凭据/破坏性操作）
- [x] C3 Skill 安装后持久化（数据库记录 installed_skills，含版本与来源）
- [x] C4 Skill 运行时注入：将选中 Skill 上下文注入到会话执行链路
- [x] C5 Skill 市场能力：列表、搜索、下载、安装、失败回滚、临时目录清理
- [x] C6 MCP 配置管理：增删改、启停、持久化、连接状态
- [x] C7 MCP 运行能力：工具列表、工具调用、资源读取、错误提示
- [x] C8 聊天区统一入口：Skills/MCP 选择器与启用状态可见化

## 主线 D（P1）：数据层与知识引擎完善

- [x] D1 SQLite 初始化、迁移管理、WAL 模式与 DAO 抽象
- [x] D2 users/repositories/sessions/messages/knowledge_entries 等表完整落地
- [x] D3 知识条目 CRUD、版本历史、状态流转（draft/published/stale/archived）
- [x] D4 FTS5 搜索（关键词 + 标签 + repo/category 过滤）
- [x] D5 knowledge-extractor 异步建议流（save/ignore）

## 主线 E（P1）：Agent/Team 编排

- [x] E1 Agent Markdown 定义加载与 AgentRegistry
- [x] E2 AgentRunner（allowedTools 限制 + 结果统计）
- [x] E3 TeamManager 并行执行与结果汇总
- [x] E4 TeamEventBus 标准化 payload 与前端可视化

## 主线 F（P1）：发布与质量保障

- [x] F1 单元测试覆盖关键域（契约、幂等、恢复、扫描器）
- [x] F2 集成测试覆盖关键链路（真实 CLI、Skill/MCP、断线重连）
- [x] F3 冒烟脚本与发布产物校验（checksum、release notes）
- [x] F4 内网部署手册与故障恢复手册
