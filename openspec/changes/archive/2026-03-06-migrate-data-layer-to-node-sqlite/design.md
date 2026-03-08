## Context

当前 `SqliteDatabase` 直接持有 `better-sqlite3` 连接对象，所有 DAO 也都以该同步 API 为事实标准。这个选择在最初实现上很直接，但它把数据层和一个原生模块绑定到了一起；一旦本地 Node major 版本变化，就可能因为 ABI 不匹配导致 `createCore()` 失败，进一步影响 `web-backend`、桌面版启动、smoke 与 E2E。

仓库当前仍然明确依赖 SQLite 文件数据库、WAL、FTS5 和同步 DAO 调用风格。`node:sqlite` 已能在当前 Node 运行时提供 `DatabaseSync`、`prepare/get/all/run/exec` 等能力，因此可以在不改业务语义的前提下替换底层驱动，但需要通过适配层吸收 API 差异和实验性风险。

## Goals / Non-Goals

**Goals:**
- 移除 `@okk/core` 对 `better-sqlite3` 的直接依赖
- 引入仓库内 SQLite driver adapter，让 DAO 与迁移逻辑不再依赖具体第三方包
- 默认使用 `node:sqlite` 的 `DatabaseSync`，同时保持现有数据库文件、schema、WAL、FTS5 与事务行为一致
- 为既有数据库兼容、事务回滚、知识检索和启动失败诊断提供可回归验证

**Non-Goals:**
- 不迁移到 PostgreSQL、libsql 或远程数据库
- 不调整业务表结构、知识模型或搜索排序策略
- 不在本 change 中重写 DAO 为异步风格
- 不保留长期双驱动运行模式

## Decisions

1. 引入最小 SQLite adapter 边界，而不是让 DAO 直接导入 `node:sqlite`。
原因：当前 DAO 数量已经不少，且同步 `prepare/get/all/run/transaction` 形态被广泛使用。通过 adapter 收敛差异，可以把驱动切换控制在 `database/` 内部，并给未来再次更换驱动保留稳定边界。
备选方案：
- 直接把所有 DAO 调用点改写为 `node:sqlite` API：改动面过大，且会再次把 DAO 绑死到底层实现。
- 保留 `better-sqlite3` 仅修环境：无法解决桌面打包和 CI 对原生模块的长期脆弱性。

2. 保持同步数据层模型，使用 `DatabaseSync` 而不是引入异步驱动。
原因：当前 `create-core -> DAO -> 路由` 链路建立在同步数据访问上，若切换为异步驱动会把影响扩散到整个 core 与 web-backend。`node:sqlite` 提供同步 API，能以最小代价保持现有调用模型。
备选方案：
- `sqlite3`：依然是原生模块，且 API 风格不匹配。
- ORM/Query Builder：会显著扩大本次范围，不符合 KISS/YAGNI。

3. 保留现有 schema 与 SQL，优先做行为兼容而不是查询重写。
原因：本次迁移目标是换驱动而不是换数据库能力。知识库当前依赖 FTS5、`bm25/snippet/highlight`、事务与触发器；只要底层驱动仍是 SQLite，就没有必要重写这些 SQL。
备选方案：
- 顺手重构 schema 或 search SQL：收益低，回归面大。

4. 事务语义通过 adapter 统一包装，并要求关键写路径具备回滚测试。
原因：当前迁移和 Knowledge DAO 使用 `db.transaction(...)`。`node:sqlite` 需要仓库自行提供等价包装，因此必须把事务能力纳入 adapter 合约，并用测试锁住行为。
备选方案：
- 在各 DAO 手写 `BEGIN/COMMIT/ROLLBACK`：重复且容易遗漏。

5. 接受 `node:sqlite` 仍属实验特性的现实，但把风险封装在 adapter 和 Node 基线里。
原因：当前项目已经要求 `node >=22`，桌面与后端运行时由仓库控制。相比继续承受原生 ABI 问题，使用内建 SQLite 并在 adapter 边界隔离风险更可控。
备选方案：
- 保持原生依赖直到 `node:sqlite` 完全稳定：会继续阻塞本地开发和 CI 体验。

## Risks / Trade-offs

- [实验性 API 仍可能变化] → 将 `node:sqlite` 访问集中在 adapter 文件内，并在文档与 CI 中固定受支持的 Node major。
- [`better-sqlite3` 与 `node:sqlite` 的返回值/错误语义存在细微差异] → 用 DAO 集成测试覆盖 CRUD、迁移、FTS、事务回滚与现有数据库打开场景。
- [Windows / 桌面环境下 WAL 或文件锁行为差异] → 把桌面构建和本地 smoke 作为迁移验收的一部分。
- [一次性移除原生依赖后，回退窗口变窄] → 保持 adapter 边界清晰；若上线验证失败，可在下一版快速恢复到旧驱动实现。

## Migration Plan

1. 在 `packages/core/src/database/` 下定义统一 adapter 接口与 `node:sqlite` 实现。
2. 让 migrations、`SqliteDatabase` 与所有 DAO 只依赖 adapter，而非具体驱动类型。
3. 先补齐数据库回归测试，再切换 `create-core` 到新 adapter。
4. 更新 `web-backend` 与桌面端启动链路，确保驱动初始化错误带有结构化诊断。
5. 移除 `better-sqlite3` 依赖，更新 lockfile、运行文档和 CI。
6. 验证 `web-backend`、`desktop`、knowledge FTS、既有数据库打开和 smoke 流程。

## Open Questions

- 当前不保留长期双驱动特性开关；若迁移过程中发现 `node:sqlite` 在特定平台上存在不可接受问题，再单独评估是否需要短期回退开关。
