## Context

首页空态升级之后，用户还需要第一眼感知“这个合伙人认识我”。当前 active identity、memory 列表和当前工作仓库分散在不同的接口与状态流中，前端若分别请求并拼装，不仅会增加首页首屏复杂度，也会把降级逻辑分散到多个组件。这个 change 需要把已有数据聚合成一个稳定、可降级的首页摘要卡载荷。

当前设计要在不新增数据库表、不引入后台任务的前提下，复用现有 identity、memory 和 repository 数据源，为首页提供一个单次读取的 partner summary，并以非阻塞方式渲染在 PartnerHomeView 中。

## Goals / Non-Goals

**Goals:**
- 在 core 层聚合 active identity、memoryCount、recentMemories 和 activeRepoName
- 通过认证后的 GET /api/partner/summary 暴露统一摘要载荷
- 为前端 IOProvider 增加 partner summary 读取能力
- 在首页以卡片形式展示身份、近期记忆和活跃工作仓库，并处理空数据与失败降级

**Non-Goals:**
- 不新增身份、记忆或仓库相关的数据表与持久化模型
- 不把摘要卡扩展成身份编辑器或记忆管理页
- 不在本 change 中引入全局缓存层或新的前端状态容器
- 不要求首页等待摘要接口成功后才允许其他区块可用

## Decisions

1. 在 core 中新增 partner 聚合接口，而不是让前端分别调用 identity、memory、repo 接口。这样可以把跨数据源聚合与降级策略放在服务端统一处理，减少前端编排复杂度。
2. partner summary 采用稳定的部分成功返回策略：缺失 identity、memory 或 repo 数据时返回 null 或空数组，而不是整体失败。首页需要的是尽量有信息，而不是全有或全无。
3. recentMemories 只返回首页需要的最近 3 条摘要级数据，不返回全文内容，避免首页承担管理页语义。
4. 首页摘要卡采用独立异步加载，不阻塞 PartnerHomeView 其他区块；请求失败时降级为轻量提示，而不是让整个首页空白。
5. activeRepoName 只表达当前最相关的工作仓库，不在本 change 中引入新的活跃仓库持久化机制。

## Risks / Trade-offs

- [聚合逻辑跨多个 DAO] -> 将聚合边界限制为只读摘要字段，避免演化成新的业务编排层。
- [部分数据缺失导致首页不一致] -> 使用稳定的响应结构与前端降级文案，确保缺一项不影响其它项展示。
- [首页请求增多] -> 使用单一 summary 接口替代多次前端请求，控制首屏请求数量。

## Migration Plan

- 先在 core 中补齐 partner summary 聚合能力，并明确输出字段。
- 再在 web-backend 注册 GET /api/partner/summary，并让返回结构稳定可降级。
- 最后扩展前端 IOProvider 与 PartnerHomeView，接入首页摘要卡和错误处理。

## Open Questions

- 当前无阻塞性开放问题；如后续需要把摘要卡复用到其它页面，再评估是否抽象为共享的 partner summary hook。

