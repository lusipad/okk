## Why

Skill 是合伙人“成长”支柱的核心载体，但当前 Skill 系统仍停留在“扫描目录 + 解析 `SKILL.md`”的初级阶段，既缺少渐进式加载和版本状态管理，也难以兼容外部生态中已存在的大量 Skill 包结构。若不先把 Skill 运行时、安装流程和生态兼容能力打牢，后续市场、工作流和团队复用都会建立在脆弱基础之上。需要把 Skill 系统从本地脚本发现机制升级为正式的平台能力。

## What Changes

- 建立渐进式加载策略：区分元数据、文档、脚本和运行依赖的加载阶段，按需展开，减少 token 和 I/O 开销
- 建立完整的安装生命周期：补齐安装、升级、卸载、启用/禁用、依赖检查和失败回滚流程
- 建立生态兼容层：兼容 OpenClaw/NanoClaw 等 Skill 目录结构、frontmatter 规范和脚本组织方式
- 建立 Skill 调试与诊断能力：支持查看输入输出、运行日志、依赖异常和版本来源，便于定位问题
- 建立更完整的管理体验：在 Skills 页面中提供分类浏览、搜索、筛选、状态切换和调试入口

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `skills-system`: 增加渐进式加载、安装生命周期、生态兼容和调试诊断契约
- `data-layer`: 扩展已安装 Skill 的版本、来源、状态、依赖和调试元数据
- `web-backend`: 暴露 Skill 安装、升级、诊断和状态切换 API
- `web-frontend`: 升级 Skills 管理页，支持筛选、状态切换和调试入口

## Impact

- `packages/core/src/skills/skill-registry.ts` — 重构为渐进式加载和兼容性适配架构
- `packages/core/src/skills/` — 增加安装生命周期、依赖校验和调试支持模块
- `packages/core/src/database/dao/installed-skills-dao.ts` — 扩展版本、来源、状态和依赖字段
- `packages/core/src/database/migrations.ts` — 新增 Skill 状态和来源迁移
- `packages/web-backend/src/routes/skills.ts` — 增加诊断、升级和状态切换 API
- `packages/web-frontend/src/pages/SkillsPage.tsx` — 升级管理体验并补齐调试入口
