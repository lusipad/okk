## ADDED Requirements

### Requirement: 仓库上下文与知识策展主流程
前端 SHALL 让仓库上下文和知识策展成为主工作流的一部分，而不是隐藏在附属页面中。

#### Scenario: 当前仓库上下文显式可见
- **WHEN** 用户在 Chat 或 Knowledge 页面工作
- **THEN** 系统 SHALL 显示当前仓库范围与切换入口
- **AND** 用户 SHALL 能判断当前回答与知识操作作用于哪个仓库

#### Scenario: 知识建议进入审核队列
- **WHEN** 对话生成知识建议
- **THEN** 系统 SHALL 将建议纳入可审核的队列或侧栏
- **AND** 用户 SHALL 能执行保存、忽略、继续编辑和跳转知识页面等操作
