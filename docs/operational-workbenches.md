# 高级工作台与治理能力

本文汇总 OKK 新增的 6 组高级工作台能力，覆盖 Trace、治理、多仓库、导入、工作流和共享。

## Agent Trace

- 入口：聊天页内联 Trace 面板，后端接口位于 `/api/agents/traces/*`
- 能力：时间线、详情、失败节点、文件变更与 diff 查看
- 运维建议：若仓库不是 Git 工作树，仍会保留结构化步骤，但文件 diff 可能退化为文件级摘要

## Knowledge Governance

- 入口：`/governance`
- 能力：健康度、过时检测、冲突发现、审核、合并、回滚
- 运维建议：治理刷新会根据标题冲突与更新时间生成队列；大规模批量治理前建议先导出版本历史

## Multi-Repo Workspace

- 入口：`/workspaces`
- 能力：工作区 CRUD、活跃仓库切换、跨仓库搜索、异常仓库提示
- 运维建议：活跃仓库会作为主上下文，其余存在的仓库路径会被注入 `additionalDirectories`

## Cross-Agent Imports

- 入口：`/imports`
- 能力：来源预览、证据保留、去重确认、批次历史与回放
- 当前来源：`memory`、`sessions`、`knowledge`
- 限制：导入预览默认只抓取最近一批样本，超大数据集建议分批执行

## Skill Workflows

- 入口：`/workflows`
- 能力：模板库、工作流 CRUD、执行、失败重试、运行历史
- 内置沉淀模板：代码审查沉淀、上下文整理沉淀、知识健康检查，模板会附带默认分类、标签和推荐保存模式
- 节点类型：`prompt`、`skill`、`agent`、`condition`、`knowledge_ref`
- `knowledge_ref` 节点支持两种输入方式：固定 `entryIds`，或基于 `query`、`repoId`、`category`、`tags`、`status`、`limit` 的筛选解析
- 运行结果会在步骤详情中保留命中的知识条目、汇总摘要和输出键，便于回放时判断本次工作流实际消费了哪些知识
- 已完成的工作流运行支持“保存为知识”：前端会先加载默认草稿，允许在摘要/完整结果两种模式间切换，并编辑标题、摘要、正文、分类、标签和 repoId 后再落库
- 由工作流沉淀出的知识会在 `metadata.workflow` 中保留 `workflowId`、`runId`、`templateId`、`sourceStepIds` 和发布模式，后续可直接追溯来源
- 运维建议：优先把代码规范、治理规则、常见排障手册沉淀为知识，再通过 `knowledge_ref` 复用到模板工作流；若节点校验失败，先检查 `outputKey` 是否缺失，或是否同时遗漏 `entryIds` 与筛选条件

## Memory Sharing

- 入口：`/memory-sharing`
- 能力：可见性分级、审核队列、团队推荐、发布与回滚
- 安全规则：命中 `api key`、`token`、`password`、`secret` 等敏感模式时会直接拦截共享
- 运维建议：发布后会生成或关联知识条目；回滚会把已发布知识归档，而不是直接物理删除
