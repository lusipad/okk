## ADDED Requirements

### Requirement: 继续工作主入口提权
系统 SHALL 将继续工作作为 Chat 首页与左侧导航中的高优先级入口，降低老用户回流成本。

#### Scenario: 首页优先展示继续工作
- **WHEN** 当前用户存在可用的继续工作候选
- **THEN** 合伙人首页 SHALL 以核心卡片形式展示上次工作标题、摘要和继续动作
- **AND** 该入口 SHALL 位于最近会话与快速操作之前或同级的主视觉区域

#### Scenario: 侧栏高优先级入口
- **WHEN** 左侧导航渲染 New chat 区块
- **THEN** 继续工作入口 SHALL 以与 New chat 同级的高优先级动作呈现
- **AND** 用户 SHALL 无需进入会话历史列表即可触发继续动作

### Requirement: 无仓库上下文的会话回流
系统 SHALL 在没有当前 repo 上下文时，仍然能基于最近会话提供继续工作的回流入口。

#### Scenario: 使用最近会话作为 fallback
- **WHEN** 当前没有 currentRepoId 但存在最近会话记录
- **THEN** 前端 SHALL 从最近会话生成 continue candidate
- **AND** 用户触发继续动作后 SHALL 切回该会话或恢复对应上下文，而不是显示无效按钮

#### Scenario: 没有可继续的历史
- **WHEN** 当前既没有 repo continue candidate 也没有最近会话可回流
- **THEN** 前端 SHALL 隐藏继续工作入口
- **AND** 不得展示不可执行的空按钮或误导性文案

