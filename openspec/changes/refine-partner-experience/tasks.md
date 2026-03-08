## 1. 首页视图结构

- [x] 1.1 新建 PartnerHomeView，并定义问候、最近会话、继续工作和快速操作的视图模型
- [x] 1.2 在 ChatPage 中以零消息分支渲染 PartnerHomeView，并移除 MessageList 的简单空态职责

## 2. 状态映射与交互

- [x] 2.1 复用现有 sessions、projectContext、capabilitySnapshot 和 identity 数据驱动首页展示
- [x] 2.2 接通最近会话切换、继续工作和快速操作回填 Composer 的交互

## 3. 验证与回归

- [x] 3.1 补齐零消息态、加载态和最近会话点击的前端测试或验收用例
- [x] 3.2 校验首页空态与已有消息态切换时不再回退到旧 emptyHint 逻辑

