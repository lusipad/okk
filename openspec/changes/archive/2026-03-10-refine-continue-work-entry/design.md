## Context

继续上次工作本质上是老用户回流后的主入口，但当前入口层级偏低，而且 continueProjectContext 只有在 currentRepoId 存在时才会工作。对于只有历史会话、没有当前仓库上下文的用户，这个入口几乎等于不存在。与此同时，即使存在 repoId，后端 continue 提示也过于依赖 snapshot 中已经写好的 summary 或 continuePrompt，缺少更稳健的 fallback。

当前 change 需要把继续工作从附属动作提升为首页和侧栏的一等入口，并在前后端两侧分别补齐 repo 内 fallback 与无 repo 回流场景。

## Goals / Non-Goals

**Goals:**
- 将继续工作入口提升到首页核心卡片和侧栏高优先级位置
- 在 repo 上下文存在但摘要不完整时，由后端根据 recent activities 生成稳定 fallback
- 在没有 currentRepoId 但仍有最近会话时，由前端生成可执行的继续工作候选
- 统一首页与侧栏中的 continue 视图模型与展示语义

**Non-Goals:**
- 不新增独立的恢复工作流引擎或新的后台任务
- 不为 continue 入口引入新的全局持久化模型
- 不在本 change 中重写 recent sessions 的完整排序策略
- 不把继续工作扩展为跨多个仓库的多步向导

## Decisions

1. 继续工作候选分为两类来源：repo context candidate 和 recent session fallback candidate。前者继续复用现有 continueRepoContext；后者只在没有当前 repo 时从最近会话生成回流入口。
2. 后端继续工作接口保持 repo 维度不变，但在 snapshot 缺少 continuePrompt 或 lastActivitySummary 时，必须利用 recentActivities 生成可用的 prompt 与 summary。
3. 前端首页与侧栏共用同一套 continue candidate view model，避免两处入口展示不同标题、摘要或动作语义。
4. 当 fallback 来源于 recent session 时，继续动作优先切回该会话并恢复上下文，而不是伪造新的 repo continue 请求。
5. 当既没有 repo context 也没有 recent session 时，继续工作入口直接隐藏，避免制造无法执行的假入口。

## Risks / Trade-offs

- [前后端 continue 来源不同步] -> 统一候选 view model，并明确 repo candidate 与 session candidate 的来源优先级。
- [fallback 摘要质量参差] -> 仅使用已有的 title、summary 和 recentActivities 生成简洁提示，不引入新的推理链路。
- [入口提权后抢占首页空间] -> 继续工作卡片只保留单一主行动作和简短摘要，避免变成第二个历史列表。

## Migration Plan

- 先增强 repo 级 continue fallback，确保有 repo 的场景先稳定。
- 再在 ChatPage 中增加 recent session fallback candidate，并让首页与侧栏共享展示逻辑。
- 最后调整入口位置和视觉优先级，并完成有 repo、无 repo、有历史、无历史四类回流验证。

## Open Questions

- 当前无阻塞性开放问题；若后续需要跨仓库 continue，再通过新的 capability 单独建模。

