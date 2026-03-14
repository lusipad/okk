## 1. 对象模型与数据层

- [x] 1.1 定义 Mission / Workstream / Checkpoint / Handoff / Mission Summary 的核心类型
- [x] 1.2 为 Mission 编排对象补充数据层持久化与读取接口

## 2. 运行时与后端收敛

- [x] 2.1 将 Team Run 的运行状态映射到 Mission 编排模型
- [x] 2.2 在 web-backend 中暴露 Mission 查询、团队进度与待确认接口

## 3. 交互表面接入

- [x] 3.1 在 CLI 中为 Mission 编排补充展示与操作入口
- [x] 3.2 在前端 `Partner Home / Mission Room` 中接入团队进度、workstreams 与 checkpoints

## 4. 验证与迁移

- [x] 4.1 验证已有 Session 与 Team Run 在引入 Mission 后仍可兼容工作
- [x] 4.2 设计后续从 Session 主对象向 Mission 主对象收敛的迁移策略
