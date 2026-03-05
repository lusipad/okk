# data-layer Specification

## Purpose
TBD - created by archiving change okk-architecture. Update Purpose after archive.
## Requirements
### Requirement: SQLite 数据库初始化
系统 SHALL 使用 better-sqlite3 初始化 SQLite 数据库，启用 WAL 模式，执行 schema 迁移。

#### Scenario: 首次启动
- **WHEN** 数据库文件不存在
- **THEN** 系统 SHALL 创建数据库文件并执行完整 schema 创建
- **AND** 启用 WAL 模式（`PRAGMA journal_mode=WAL`）

#### Scenario: Schema 迁移
- **WHEN** 数据库版本低于当前代码版本
- **THEN** 系统 SHALL 执行增量迁移（ALTER TABLE / CREATE TABLE）
- **AND** 迁移 SHALL 使用 try/catch 保护，跳过已存在的列/表

### Requirement: 用户表
系统 SHALL 维护 users 表，包含 id、username（唯一）、password_hash、display_name、role（admin/user）、created_at。

#### Scenario: 创建用户
- **WHEN** 管理员创建新用户
- **THEN** 系统 SHALL 对密码进行 bcrypt 哈希后存储
- **AND** 分配默认 role 为 user

### Requirement: 仓库表
系统 SHALL 维护 repositories 表，包含 id、name、path、description、default_backend、status、created_at。

#### Scenario: 仓库 CRUD
- **WHEN** 执行仓库的增删改查操作
- **THEN** 系统 SHALL 通过 repos-dao 操作 repositories 表

### Requirement: 会话和消息表
系统 SHALL 维护 sessions 表（id、user_id、repo_id、title、backend、backend_session_id、mode、status）和 messages 表（id、session_id、role、content、metadata JSON、created_at）。

#### Scenario: 存储 Q&A 消息
- **WHEN** Q&A 对话产生新消息
- **THEN** 系统 SHALL 将消息存入 messages 表，metadata 字段存储 tool_calls、thinking、tokens 等 JSON 数据

#### Scenario: 按会话查询消息
- **WHEN** 查询某会话的消息列表
- **THEN** 系统 SHALL 按 created_at 升序返回该 session_id 的所有消息

### Requirement: 知识条目表
系统 SHALL 维护 knowledge_entries 表（id、title、content、summary、repo_id、category、source_session_id、quality_score、view_count、upvote_count、version、status、metadata JSON、created_by、created_at、updated_at）、knowledge_versions 表和 knowledge_tags 表。

#### Scenario: FTS5 索引同步
- **WHEN** 知识条目被创建或更新
- **THEN** 系统 SHALL 同步更新 knowledge_fts 虚拟表

#### Scenario: 分类字段迁移
- **WHEN** 数据库从旧版本迁移到包含分类字段的新版本
- **THEN** 系统 SHALL 为 knowledge_entries 添加 category 列
- **AND** 既有数据 SHALL 使用默认分类（`general`）

### Requirement: Agent 和 Team 执行记录表
系统 SHALL 维护 agent_runs 表（id、session_id、agent_name、input、output、status、tool_call_count、iterations、usage tokens、时间戳）和 team_runs 表（id、session_id、team_name、status、member_count、时间戳）。

#### Scenario: 记录 Agent 执行
- **WHEN** Sub-Agent 执行完成
- **THEN** 系统 SHALL 将执行结果存入 agent_runs 表

### Requirement: Skill 安装记录表
系统 SHALL 维护 installed_skills 表（name、description、source、version、installed_at）。

#### Scenario: 记录 Skill 安装
- **WHEN** 用户安装新 Skill
- **THEN** 系统 SHALL 在 installed_skills 表中创建记录

### Requirement: DAO 抽象层
系统 SHALL 通过 DAO 类封装所有数据库操作，不在 DAO 外部直接执行 SQL，为未来迁移 PostgreSQL 预留路径。

#### Scenario: DAO 方法调用
- **WHEN** 业务逻辑需要查询知识条目
- **THEN** SHALL 通过 KnowledgeDao.search() 方法而非直接 SQL
- **AND** DAO 方法 SHALL 返回类型安全的 TypeScript 对象

