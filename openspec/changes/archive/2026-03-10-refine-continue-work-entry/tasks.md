## 1. Continue fallback 逻辑

- [x] 1.1 增强仓库级 continue 结果生成，在 snapshot 缺少摘要时基于 recentActivities 回退
- [x] 1.2 定义首页与侧栏共用的 continue candidate 数据模型，覆盖 repo candidate 与 session fallback candidate

## 2. 入口提权与交互

- [x] 2.1 在 PartnerHomeView 中将继续工作渲染为核心卡片，并接通继续动作
- [x] 2.2 在 LeftSidebar 中将继续工作提升为与 New chat 同级的高优先级入口

## 3. 回流验证

- [x] 3.1 验证有 repo、无 repo 但有 recent session、以及无历史三类继续工作场景
- [x] 3.2 补齐 continue fallback 的前后端测试或验收用例，确保入口不出现空白或误导状态

