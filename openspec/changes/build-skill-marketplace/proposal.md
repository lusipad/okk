## Why

Skill 生态是合伙人持续成长的关键来源，但“只能扫描本地目录”的模式严重限制了可发现性、可安装性和生态复用。既然外部生态已经沉淀了大量可复用 Skills，OKK 需要一个正式的市场能力来完成发现、安装、更新和反馈闭环，让用户不必手动搬运脚本，也让 Skill 成为可运营的产品能力而不是隐藏功能。

## What Changes

- 建立远程 Skill 注册表接入：拉取并缓存市场元数据，支持版本、来源、标签和下载类型等字段
- 建立安装与更新闭环：支持一键安装、升级、卸载和失败回滚，保留来源与版本状态
- 建立发现与筛选体验：支持按分类、用途、评分、兼容性和关键字浏览与搜索 Skills
- 建立评价与使用反馈：展示安装量、使用频率、评分或推荐信息，帮助用户判断 Skill 质量
- 建立市场与本地系统联动：已安装 Skill 的状态、来源和可升级信息在市场与本地管理页保持一致

## Capabilities

### New Capabilities

- `skill-marketplace`: 定义 Skill 注册表接入、市场浏览、远程安装与反馈闭环能力

### Modified Capabilities

- `skills-system`: 增加远程来源、版本状态、安装回滚和市场联动能力
- `data-layer`: 扩展已安装 Skill 的来源、版本、统计和升级元数据
- `web-backend`: 暴露市场列表、详情、安装、升级和卸载 API
- `web-frontend`: 增加市场浏览、筛选、安装和升级提示界面

## Impact

- `packages/core/src/skills/` — 新增 registry 客户端、下载/安装编排和来源管理模块
- `packages/core/src/database/dao/installed-skills-dao.ts` — 扩展来源、版本与使用统计字段
- `packages/core/src/database/migrations.ts` — 增加市场来源与升级状态迁移
- `packages/web-backend/src/routes/skills.ts` — 增加市场查询、安装与升级 API
- `packages/web-frontend/src/pages/SkillsPage.tsx` — 合并本地管理与市场浏览体验
- `packages/web-frontend/src/components/` — 增加市场卡片、筛选器和安装状态组件
