## ADDED Requirements

### Requirement: 规则驱动的下一步建议
系统 SHALL 在聊天主舞台中基于当前会话上下文提供规则驱动的下一步建议，帮助用户顺畅继续对话。

#### Scenario: 回答完成后显示建议
- **WHEN** 最后一条 assistant 回复已经完成且规则命中可用建议
- **THEN** 前端 SHALL 展示 2 到 3 个下一步建议按钮
- **AND** 建议内容 SHALL 基于当前会话已知上下文生成，而不是依赖额外模型调用

#### Scenario: 不应展示建议的时机
- **WHEN** 当前会话仍在流式输出或规则未命中可用建议
- **THEN** 前端 SHALL 隐藏下一步建议区
- **AND** 不得显示占位性的无意义按钮

### Requirement: 建议注入 Composer 而非自动发送
系统 SHALL 在用户点击建议时将内容注入 Composer 草稿，并保留最终发送控制权。

#### Scenario: 点击建议按钮
- **WHEN** 用户点击任一下一步建议
- **THEN** 前端 SHALL 将建议文本注入 Composer 输入区
- **AND** 不得自动立即发送该消息

#### Scenario: 用户编辑建议
- **WHEN** 建议文本已注入 Composer
- **THEN** 用户 SHALL 可以继续编辑、删除或替换该草稿
- **AND** 建议系统不得锁定 Composer 内容

