## ADDED Requirements

### Requirement: SQLite 驱动故障可诊断
系统 SHALL 在 SQLite 驱动初始化失败时输出结构化诊断，使 Web 后端与桌面端能够明确定位驱动、Node 版本和数据库路径问题。

#### Scenario: 驱动初始化失败
- **WHEN** 选定的 SQLite 驱动无法打开数据库文件或在初始化阶段抛错
- **THEN** 系统 SHALL 生成包含驱动名称、Node 版本、数据库路径和原始错误消息的结构化诊断
- **AND** 启动日志或启动结果 SHALL 保留该诊断，供上层服务展示或记录

### Requirement: SQLite 事务与全文检索行为保持一致
系统 SHALL 在新驱动下保持现有 SQLite 事务、FTS5 与知识检索语义一致，不因驱动替换而改变数据层对外行为。

#### Scenario: 事务回滚保持原子性
- **WHEN** Knowledge、Runs 或其他 DAO 在事务中途抛出错误
- **THEN** 系统 SHALL 回滚该事务中尚未提交的写入
- **AND** 数据库 SHALL 不留下半完成状态

#### Scenario: FTS 查询结果保持可用
- **WHEN** 系统执行 knowledge FTS 搜索
- **THEN** 系统 SHALL 继续使用 SQLite FTS5 查询能力返回结果
- **AND** 查询结果 SHALL 继续包含 relevance、snippet 和 highlighted title 等搜索辅助字段

## MODIFIED Requirements

### Requirement: SQLite 数据库初始化
系统 SHALL 通过仓库内的 SQLite 驱动适配层初始化 SQLite 数据库，默认使用 `node:sqlite` 的 `DatabaseSync` 实现，启用 WAL 模式并执行 schema 迁移。

#### Scenario: 首次启动
- **WHEN** 数据库文件不存在
- **THEN** 系统 SHALL 创建数据库文件并执行完整 schema 创建
- **AND** 启用 WAL 模式（`PRAGMA journal_mode=WAL`）

#### Scenario: Schema 迁移
- **WHEN** 数据库版本低于当前代码版本
- **THEN** 系统 SHALL 执行增量迁移（ALTER TABLE / CREATE TABLE）
- **AND** 迁移 SHALL 使用 try/catch 保护，跳过已存在的列/表

#### Scenario: 既有数据库兼容
- **WHEN** 系统打开由旧版本 OKK 创建的 SQLite 数据库文件
- **THEN** 系统 SHALL 在不改变现有业务表语义的前提下完成连接与迁移
- **AND** 既有 sessions、messages、knowledge_entries、team_runs 和 installed_skills 数据 SHALL 可继续读取

### Requirement: DAO 抽象层
系统 SHALL 通过 DAO 类和仓库内 SQLite driver adapter 封装所有数据库操作，不在 DAO 外部直接绑定具体 SQLite 驱动实现，以便在驱动替换时保持业务层稳定。

#### Scenario: DAO 方法调用
- **WHEN** 业务逻辑需要查询知识条目
- **THEN** SHALL 通过 KnowledgeDao.search() 方法而非直接 SQL
- **AND** DAO 方法 SHALL 返回类型安全的 TypeScript 对象

#### Scenario: 驱动实现替换
- **WHEN** 仓库内部切换 SQLite 驱动实现
- **THEN** DAO 对外方法签名和调用方式 SHALL 保持不变
- **AND** 业务层 SHALL 无需直接感知底层驱动包名变化
