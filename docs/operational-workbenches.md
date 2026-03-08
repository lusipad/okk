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
- 节点类型：`prompt`、`skill`、`agent`、`condition`
- 运维建议：当前执行器强调结构化编排和状态传递，适合流程验证与模板沉淀

## Memory Sharing

- 入口：`/memory-sharing`
- 能力：可见性分级、审核队列、团队推荐、发布与回滚
- 安全规则：命中 `api key`、`token`、`password`、`secret` 等敏感模式时会直接拦截共享
- 运维建议：发布后会生成或关联知识条目；回滚会把已发布知识归档，而不是直接物理删除
