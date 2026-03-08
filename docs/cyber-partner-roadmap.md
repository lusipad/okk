# OKK 路线图整理（2026-03-08）

## 1. 当前判断

OKK 已经从“工程聊天原型”跨过了最危险阶段，当前更准确的状态是：

- **平台底座已成型**
- **高级能力已落地**
- **产品主流程仍需继续收敛**

这意味着下一阶段最重要的工作，不再是“再补几个点状功能”，而是把已有能力组织成更稳定、更可理解、更可持续使用的产品。

## 2. 已完成的阶段

### Phase A：基础运行时闭环

已完成：

- 真实 CLI backend 接入
- 统一事件语义与恢复链路
- Web 前后端基本闭环
- SQLite 数据层与 DAO 基线

### Phase B：知识、记忆与能力治理

已完成：

- Long-term Memory
- Project Context Persistence
- Session Search & Archive
- Skill Lifecycle / Marketplace
- Identity Kernel

### Phase C：高级工作台

已完成：

- Agent Trace Visualization
- Knowledge Governance
- Multi-Repo Workspace
- Cross-Agent Knowledge Imports
- Skill Workflows
- Memory Sharing

### Phase D：桌面与交付

已完成：

- Desktop parity 基线
- runtime diagnostics / fallback
- Windows 打包链路
- smoke / release governance

## 3. 当前产品成熟度判断

### 已经成熟的部分

- 工程底座
- OpenSpec 流程
- Web / Backend / Core / Desktop 四层联动
- 多个高级工作台已经从规格落到实现

### 仍在成长的部分

- Partner 关系感与主流程体验
- 团队级共享与协作策略
- 工作流模板生态
- 桌面安装 / 升级 / 恢复体验

## 4. 下一阶段建议路线图

## Phase 1：Partner Experience 收敛（最高优先级）

目标：把“赛博合伙人”体验从能力集合收敛成单一稳定主流程。

建议主题：

- 首页 / 空态 / 最近工作统一入口
- Identity + Memory + Context 联动视图
- 自动生成下一步建议
- 继续工作入口稳定化
- 主舞台信息密度与默认路径收敛

成功标准：

- 用户第一次进入能理解“我现在能做什么”
- 老用户回来能无缝进入“继续上次工作”
- Partner 感来自连续关系，而不是页面堆叠

## Phase 2：Team & Sharing 产品化

目标：让共享、治理与协作真正进入团队使用场景。

建议主题：

- 团队视角权限模型
- 共享审批与审计视图
- 团队级知识推荐与看板
- 冲突与治理的运营流程
- 多用户协作约束与恢复策略

成功标准：

- 共享不再只是“记录能流转”，而是“团队能放心使用”
- 审核、发布、回滚、追溯形成闭环

## Phase 3：Workflow 产品深化

目标：把工作流从“可运行”推进到“可复用、可沉淀、可交付”。

建议主题：

- 模板库扩展
- 输入输出映射增强
- 条件分支与失败恢复增强
- 执行结果沉淀到知识 / 记忆 / 交付物
- 与质量门禁结合

成功标准：

- 工作流成为“团队资产”而不只是演示功能
- 常见研发流程可以模板化运行

## Phase 4：Desktop 产品级闭环

目标：把桌面端从“开发可用”推进到“真实分发可用”。

建议主题：

- 安装 / 首启 / 升级体验
- 桌面运行时恢复路径
- packaged smoke 常态化
- 日志 / 诊断 / 自助恢复动作
- 桌面专属入口与共享工作台的边界优化

成功标准：

- 非开发者也能稳定启动并恢复
- 桌面端成为默认主入口，而不是附属壳层

## 5. 不建议当前优先投入的方向

以下方向不建议在当前阶段排到最前面：

- 过早扩展通用办公/日历/邮件型 Agent 能力
- 在没有主流程收敛前继续横向铺更多页面
- 在团队治理规则未稳定前引入过复杂的权限矩阵
- 在模板生态不足时过度追求可视化流程编辑器复杂度

## 6. 建议的新 change 方向

如果现在继续开下一批 OpenSpec change，建议优先从以下方向选：

1. `refine-partner-home-and-continue-flow`
2. `productize-team-sharing-governance`
3. `strengthen-workflow-template-ecosystem`
4. `stabilize-desktop-distribution-experience`
5. `unify-partner-memory-identity-surface`

## 7. 结论

当前仓库最缺的不是能力数量，而是：

- 更强的产品主线
- 更清晰的默认工作路径
- 更稳定的团队治理闭环
- 更成熟的桌面产品体验

下一阶段应以“**收敛、深化、产品化**”为主，而不是继续无节制铺新点。 