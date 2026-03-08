# OKK 感知、记忆与协作架构

文档版本：`v1.0`
文档状态：`Working Architecture Baseline`
最后更新：`2026-03-07`
适用范围：`Perception / Memory / Agent Trace / Collaboration / Scope Governance`

---

## 1. 文档目标

本文专门定义以下架构问题：

- Agent 通过什么信号感知用户工作
- 感知事件如何转为长期记忆
- Codex / Claude Code 本地数据为何是重要 source
- 远程协作时哪些记忆和来源可以共享
- 如何避免长期记忆污染和隐私泄露

本文是 [product-architecture-baseline.md](/D:/Repos/okclaw/docs/product-architecture-baseline.md) 的专题延伸。

---

## 2. 感知原则

### 2.1 Source-first

Agent 的理解必须尽量基于明确来源，而不是无依据猜测。

### 2.2 Structured-first

优先使用结构化信号，再使用视觉感知。

优先级：

1. ADO / Git / IDE / DAP / runtime API
2. terminal / logs / tool output
3. desktop context
4. screenshot / OCR / visual fallback

### 2.3 Scope-first

所有感知都必须明确作用域：

- 当前工作本
- 当前任务
- 当前 repo
- 当前协作会话

超出作用域的感知不得默认进入长期记忆或远程共享。

### 2.4 Governable Memory

记忆必须：

- 可查看
- 可编辑
- 可删除
- 可溯源
- 可控制共享范围

---

## 3. 感知来源模型

### 3.1 Canonical Source

静态权威来源。

包括：

- 仓库
- 文件
- 文档
- 笔记
- Knowledge
- 需求条目
- ADO work item
- 网页摘录

适用场景：

- 事实判断
- 代码理解
- 需求解释
- 文档问答

### 3.2 Agent Trace Source

工作痕迹来源，用于回答“我们是怎么做的”。

包括：

- Codex 本地会话
- Claude Code 本地会话
- tool run
- patch / diff 摘要
- test run / build run
- diagnostics
- team timeline
- 关键错误与恢复记录

适用场景：

- 失败原因分析
- 决策过程回溯
- 重复问题避免
- 经验沉淀

### 3.3 Memory Source

长期抽象来源，用于回答“它已经记住了什么”。

包括：

- 偏好记忆
- 项目记忆
- 关系记忆
- 过程记忆
- 事件记忆

适用场景：

- 个性化协作
- 长期连续性
- 推荐工作方式
- 协作上下文恢复

---

## 4. 感知事件模型

### 4.1 原始事件

系统首先记录可授权的原始事件：

- `work_item_loaded`
- `repo_selected`
- `file_opened`
- `editor_selection_changed`
- `terminal_command_finished`
- `debug_session_started`
- `debug_breakpoint_hit`
- `test_failed`
- `tool_run_completed`
- `agent_run_completed`
- `knowledge_saved`

### 4.2 解释信号

原始事件进一步被解释为工作信号：

- 用户正在进行 bug fix
- 当前任务受 ADO work item 驱动
- 当前问题与历史失败模式相似
- 用户偏好由 CLI 完成初步修改，再由 IDE 复核
- 当前项目对桌面构建和 smoke 非常敏感

### 4.3 候选记忆

解释信号不直接进入长期记忆，而是先成为候选：

- `preference_candidate`
- `project_fact_candidate`
- `workflow_candidate`
- `incident_candidate`
- `relationship_candidate`

---

## 5. 记忆写入模型

### 5.1 写入分层

#### 自动低风险写入

适合自动写入：

- 最近使用的 repo
- 常用 agent
- 最近使用的工具组合
- 已确认的工作流状态

#### 候选确认写入

适合形成候选并请求用户确认：

- 输出风格偏好
- 项目长期规则
- 特定任务工作流
- 常见失败模式总结

#### 高风险禁止默认写入

默认不自动写入：

- 个人敏感信息
- 对他人的评价
- 未经确认的长期目标
- 敏感路径、密钥、账户信息

### 5.2 每条记忆的元数据

每条长期记忆至少包括：

- `id`
- `memory_type`
- `content`
- `source_refs`
- `confidence`
- `scope`
- `share_policy`
- `created_at`
- `last_used_at`
- `editable`
- `deletable`

### 5.3 记忆衰减与合并

长期记忆不能无限累积。

必须支持：

- 过期
- 合并
- 覆盖
- 失效
- 降权

---

## 6. Codex / Claude Code 本地数据的角色

### 6.1 为什么它们是关键 source

它们记录的是：

- 你和 Agent 的协作过程
- 试过哪些方案
- 为什么失败
- 为什么选了最终方案
- 改动、测试、修复与验证的轨迹

因此它们不只是聊天记录，而是**工作痕迹源**。

### 6.2 应如何进入系统

不应直接全量原样写进长期记忆或知识库。

推荐流程：

1. 先作为 `agent_trace_source` 保存
2. 进行脱敏与结构化摘要
3. 抽取 patch / diagnostics / decisions / tests / artifacts
4. 再从 trace 中提炼 memory candidate

### 6.3 不应默认暴露的 trace 内容

- secrets / token
- 敏感 env
- 绝对路径中的敏感信息
- 原始未脱敏日志
- 不属于当前作用域的私人会话

---

## 7. 协作共享模型

### 7.1 五级作用域

- `private`
- `workspace`
- `mission`
- `shared`
- `published`

### 7.2 默认共享规则

默认共享：

- Mission pack
- 当前 Source pack 中被授权的来源
- 允许共享的工作记忆
- 任务结果与总结

默认不共享：

- 私有偏好记忆
- 私有关系记忆
- 全量原始 agent trace
- 敏感本地桌面感知数据

### 7.3 远程执行原则

推荐模式：

- 本地 Partner 负责任务理解与授权
- 远端机器上的本地 runtime 负责本地执行
- 跨机器传递的是任务包与授权上下文，不是默认跨机器接管整机

---

## 8. 实时伴随协作模式

### 8.1 三层模式

#### A. Observe

只观察和理解，不主动执行。

#### B. Suggest

基于实时感知给出建议、查询结果和下一步。

#### C. Act

在授权下直接执行操作。

### 8.2 最佳输入来源

实时协作时优先读取：

- IDE bridge
- Debug Adapter Protocol
- editor diagnostics
- terminal output
- build/test status
- 当前任务和 source scope

只有这些拿不到时，才回退到视觉感知。

### 8.3 形象层

可选提供形象化交互，但必须在以下能力成熟后再做增强：

- 感知稳定
- 建议可靠
- 记忆可治理
- 执行可控

---

## 9. 最小可行数据结构建议

### 9.1 Agent Trace

```ts
interface AgentTrace {
  id: string;
  provider: 'codex' | 'claude-code';
  sessionId: string;
  workspaceId?: string;
  repoId?: string;
  missionId?: string;
  summary: string;
  rawExcerpt?: string;
  diagnostics: Array<{ code?: string; message: string; detail?: string }>;
  patchRefs: string[];
  testRefs: string[];
  visibility: 'private' | 'workspace' | 'shared';
  createdAt: string;
}
```

### 9.2 Memory Candidate

```ts
interface MemoryCandidate {
  id: string;
  type: 'preference' | 'project' | 'relationship' | 'process' | 'episodic';
  content: string;
  sourceRefs: string[];
  confidence: number;
  requiresReview: boolean;
  scope: 'private' | 'workspace' | 'mission';
  createdAt: string;
}
```

### 9.3 Long-term Memory

```ts
interface LongTermMemory {
  id: string;
  type: 'preference' | 'project' | 'relationship' | 'process' | 'episodic';
  content: string;
  sourceRefs: string[];
  confidence: number;
  sharePolicy: 'private' | 'workspace' | 'shared' | 'published';
  createdAt: string;
  lastUsedAt: string;
}
```

---

## 10. 后续 OpenSpec 建议

- `add-agent-trace-source-layer`
- `extract-memory-from-local-agent-history`
- `add-memory-candidate-review`
- `add-ado-work-item-perception`
- `connect-ide-and-debug-bridges`
- `add-collaborative-memory-scope`
- `introduce-real-time-co-working-mode`
