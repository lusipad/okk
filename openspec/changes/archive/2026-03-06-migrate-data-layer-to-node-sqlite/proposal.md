## Why

当前数据层把 `better-sqlite3` 写死为实现约束，但它是原生 Node 模块，随着本地 Node 版本升级会频繁出现 ABI 不匹配，直接阻塞 Web 后端、桌面端启动与端到端验证。OKK 实际需要的是稳定的同步 SQLite 语义，而不是绑定某一个第三方原生包，因此需要把数据层迁移到 `node:sqlite` 并把驱动依赖收敛到仓库内适配层。

## What Changes

- 将 SQLite 初始化约束从 `better-sqlite3` 调整为仓库内的 SQLite driver adapter，默认使用 `node:sqlite` 的 `DatabaseSync`
- 保留现有数据库文件格式、schema、迁移、WAL、FTS5、DAO 语义与知识检索行为，不改变业务表结构
- 为事务、全文检索、既有数据库兼容和驱动初始化失败补齐可回归的验收约束
- 移除 `@okk/core` 对 `better-sqlite3` 的直接依赖，降低本地开发、CI 与桌面打包的原生模块风险

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `data-layer`: 将 SQLite 驱动要求从 `better-sqlite3` 调整为仓库内驱动适配层，并要求 `node:sqlite` 默认实现下保持迁移、事务、FTS 与诊断行为一致

## Impact

- `packages/core/src/database/*`
- `packages/core/src/create-core.ts`
- `packages/web-backend/src/core/*`
- `packages/desktop/*`
- `@okk/core` 依赖与 lockfile
- 数据库迁移、FTS、桌面启动、后端启动与 CI 验证链路
