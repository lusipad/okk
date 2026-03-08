## 1. 驱动适配层

- [x] 1.1 定义统一的 SQLite driver adapter 接口，覆盖 exec、prepare、get/all/run、transaction、pragma、close 等同步能力
- [x] 1.2 基于 `node:sqlite` 实现默认驱动，并让 migrations 与 `SqliteDatabase` 切换到 adapter

## 2. 数据层集成

- [x] 2.1 让各 DAO 仅依赖 adapter 接口，移除对 `better-sqlite3` 具体类型的直接耦合
- [x] 2.2 保持 Knowledge DAO 的事务、FTS5、`bm25/snippet/highlight` 和既有数据库兼容行为不变
- [x] 2.3 更新 `create-core`、web-backend 与桌面启动链路，补齐驱动初始化失败的结构化诊断

## 3. 验证与清理

- [x] 3.1 增补数据库迁移、事务回滚、FTS 搜索和旧库兼容的自动化测试
- [x] 3.2 更新依赖、文档与 CI，移除 `better-sqlite3` 并验证 `@okk/web-backend`、`@okk/desktop` 的构建与 smoke

