## ADDED Requirements

### Requirement: Desktop 主流程等价与启动诊断
Desktop 应用 SHALL 对主流程提供与 Web 一致的可用性，并在启动失败时返回结构化诊断信息。

#### Scenario: 启动失败可诊断
- **WHEN** embedded backend、预载桥接或渲染主入口启动失败
- **THEN** 系统 SHALL 展示可见错误态
- **AND** 提供失败层级、原因摘要和建议恢复动作

#### Scenario: 主流程等价
- **WHEN** 用户在 Desktop 中执行登录、对话、Skills、MCP、Knowledge 或 Team 主流程
- **THEN** 系统 SHALL 与 Web 端保持相同的业务语义和结果
- **AND** 桌面增强能力不得破坏共享工作台交互

### Requirement: 桌面原生增强接入共享工作台
Desktop 应用 SHALL 将托盘、全局搜索、拖拽和文件选择等原生能力接入共享工作台，而不是形成独立流程。

#### Scenario: 全局搜索回到当前工作台
- **WHEN** 用户通过全局搜索或托盘入口唤起应用
- **THEN** 系统 SHALL 回到当前工作台上下文
- **AND** 将搜索或文件输入注入现有工作流，而不是跳转到独立功能页
