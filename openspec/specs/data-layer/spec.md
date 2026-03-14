# data-layer Specification

## Purpose
TBD - created by archiving change okk-architecture. Update Purpose after archive.
## Requirements
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
系统 SHALL 通过 DAO 类和仓库内 SQLite driver adapter 封装所有数据库操作，不在 DAO 外部直接绑定具体 SQLite 驱动实现，以便在驱动替换时保持业务层稳定。

#### Scenario: DAO 方法调用
- **WHEN** 业务逻辑需要查询知识条目
- **THEN** SHALL 通过 KnowledgeDao.search() 方法而非直接 SQL
- **AND** DAO 方法 SHALL 返回类型安全的 TypeScript 对象

#### Scenario: 驱动实现替换
- **WHEN** 仓库内部切换 SQLite 驱动实现
- **THEN** DAO 对外方法签名和调用方式 SHALL 保持不变
- **AND** 业务层 SHALL 无需直接感知底层驱动包名变化

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

### Requirement: 知识共享流转持久化
数据层 SHALL 为知识共享提供独立的共享记录、审核记录和查询索引，并保持与既有知识主表的引用完整性。

#### Scenario: 写入共享请求
- **WHEN** 系统创建知识共享请求
- **THEN** 数据层 SHALL 持久化共享记录并引用对应 KnowledgeEntry
- **AND** 若知识条目不存在，写入 SHALL 失败

#### Scenario: 写入审核动作
- **WHEN** 审核人执行批准、驳回或退回修改
- **THEN** 数据层 SHALL 追加一条审核记录
- **AND** 共享记录的最新状态 SHALL 与审核动作保持一致

### Requirement: 团队共享查询索引
数据层 SHALL 为团队知识浏览和审核列表提供可排序、可过滤的索引能力。

#### Scenario: 查询待审共享列表
- **WHEN** 后端请求待审共享记录
- **THEN** 数据层 SHALL 按更新时间倒序返回待审条目
- **AND** 结果 SHALL 支持按状态过滤

### Requirement: 订阅关系与同步记录持久化
数据层 SHALL 为知识订阅提供订阅关系、同步游标和更新记录模型，并保持与共享知识来源的引用完整性。

#### Scenario: 创建订阅记录
- **WHEN** 系统创建新的知识订阅
- **THEN** 数据层 SHALL 持久化来源类型、来源标识、订阅状态和最近同步信息
- **AND** 记录 SHALL 可按用户与来源检索

#### Scenario: 写入订阅更新记录
- **WHEN** 系统同步到新的知识更新
- **THEN** 数据层 SHALL 持久化更新项及其消费状态
- **AND** 更新项 SHALL 能关联回对应的订阅和共享知识来源

### Requirement: 订阅关系与同步记录持久化
数据层 SHALL 为知识订阅提供订阅关系、同步游标和更新记录模型，并保持与共享知识来源的引用完整性。

#### Scenario: 创建订阅记录
- **WHEN** 系统创建新的知识订阅
- **THEN** 数据层 SHALL 持久化来源类型、来源标识、订阅状态和最近同步信息
- **AND** 记录 SHALL 可按用户与来源检索

#### Scenario: 写入订阅更新记录
- **WHEN** 系统同步到新的知识更新
- **THEN** 数据层 SHALL 持久化更新项及其消费状态
- **AND** 更新项 SHALL 能关联回对应的订阅和共享知识来源
