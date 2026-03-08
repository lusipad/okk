## Why

赛博合伙人如果每次对话都只依赖当轮 prompt，就无法形成稳定的角色感、行为边界和用户适配能力。用户不仅需要一个“会回答问题的模型”，还需要一个能长期保持语气、偏好、协作方式和专业侧重点一致的合伙人。Identity Kernel 要解决的不是简单的 prompt 编辑，而是把“身份、风格、画像和注入方式”沉淀为可配置、可演进、可复用的正式能力。

## What Changes

- 建立身份配置模型：支持定义角色定位、语气风格、行为约束、专业偏好和禁用项，并保存多个版本
- 建立 System Prompt 编辑与切换能力：允许用户创建、预览、切换和回滚不同身份配置，适配不同工作场景
- 建立用户画像积累：从长期交互中提取用户技术栈、协作偏好和沟通习惯，作为身份的一部分持续优化输出
- 建立身份可见性与说明：提供 Partner Profile 视图，让用户明确看到当前身份配置、来源和最近变更
- 建立请求期注入机制：把身份配置和画像信息稳定注入后端请求，而不是散落在临时 prompt 中

## Capabilities

### New Capabilities

- `identity-kernel`: 定义身份建模、配置管理、用户画像积累、版本切换和请求注入能力

### Modified Capabilities

- `ai-backend-engine`: 支持在请求构建阶段稳定注入身份配置与用户画像
- `data-layer`: 增加身份配置、版本、画像和变更记录模型
- `web-backend`: 暴露身份配置、预览、切换和画像管理 API
- `web-frontend`: 增加 Partner Profile、身份编辑器和版本切换界面

## Impact

- `packages/core/src/identity/` — 新增 Identity Kernel、画像提取和注入模块
- `packages/core/src/backend/` — 调整 system prompt 构建与身份上下文拼装逻辑
- `packages/core/src/database/` — 新增 identity DAO、画像表与迁移
- `packages/web-backend/src/routes/` — 增加身份配置和画像管理接口
- `packages/web-frontend/src/pages/` — 新增 Partner Profile 与身份编辑页面
- `packages/web-frontend/src/components/` — 新增身份版本切换、画像摘要和预览组件
