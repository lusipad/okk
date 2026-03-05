## ADDED Requirements

### Requirement: 仓库注册与验证
系统 SHALL 支持注册本地代码仓库，验证路径存在性和安全性（路径白名单）。

#### Scenario: 注册有效仓库
- **WHEN** 用户提交仓库路径且路径存在且为 Git 仓库
- **THEN** 系统 SHALL 创建 Repository 记录，status 为 active

#### Scenario: 注册无效路径
- **WHEN** 用户提交的路径不存在或不是 Git 仓库
- **THEN** 系统 SHALL 返回错误信息，拒绝注册

#### Scenario: 路径安全验证
- **WHEN** 用户提交的路径匹配禁用模式（.ssh、.gnupg、credentials 等）
- **THEN** 系统 SHALL 拒绝注册并返回安全警告

### Requirement: 仓库上下文构建
系统 SHALL 为 AI 后端构建仓库上下文，包括 workingDirectory、CLAUDE.md 内容、已有知识条目。

#### Scenario: 构建带知识增强的上下文
- **WHEN** 用户对某仓库提问
- **THEN** 系统 SHALL 将仓库路径设为 AI 后端的 workingDirectory
- **AND** 如果仓库根目录存在 CLAUDE.md，SHALL 追加到系统提示
- **AND** SHALL 查询该仓库的已发布知识条目，将相关条目摘要追加到系统提示

### Requirement: Git 变更监听
系统 SHALL 监听已注册仓库的 Git 变更，用于知识过时检测。

#### Scenario: 检测文件变更
- **WHEN** 系统执行定期检查
- **THEN** 系统 SHALL 对每个活跃仓库执行 git diff，获取自上次检查以来的变更文件列表
- **AND** 将变更文件列表传递给知识过时检测模块

### Requirement: 多仓库支持
系统 SHALL 支持注册和管理多个代码仓库，每个仓库可配置默认 AI 后端。

#### Scenario: 切换仓库
- **WHEN** 用户在 Q&A 中切换目标仓库
- **THEN** 系统 SHALL 使用新仓库的上下文（workingDirectory、CLAUDE.md、知识）

#### Scenario: 跨仓库查询
- **WHEN** 用户的问题涉及多个仓库
- **THEN** 系统 SHALL 支持将多个仓库路径作为 additionalDirectories 传递给 AI 后端
