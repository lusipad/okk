_来源：拆分自 `knowledge-sharing-expansion`。本 change 只负责标准化知识文件格式与导入导出，不负责团队共享审批或订阅。_

## Why

当前知识主要困在本地数据库和工作台流程里，缺少稳定、可携带、可落地到其他工具的标准格式。若没有独立的可移植格式，知识共享会被绑定在单一产品内，跨仓库备份、离线流转和外部导入都会持续依赖临时脚本。

## What Changes

- 定义知识条目的 Markdown + YAML frontmatter 标准格式
- 提供单条和批量知识导出能力，保留标题、标签、分类、来源和状态等核心元数据
- 提供基于该标准格式的导入能力，并与现有知识导入/确认链路对齐
- 明确格式版本与兼容策略，确保后续字段扩展不破坏既有文件

## Capabilities

### New Capabilities

- `knowledge-export-import`: 定义知识的标准文件格式、导出和标准文件导入能力

### Modified Capabilities

- `knowledge-engine`: 增加标准格式序列化与反序列化逻辑
- `web-backend`: 增加导出、标准文件导入和兼容性校验接口
- `web-frontend`: 增加导出操作、标准文件导入入口和结果反馈

## Impact

- `packages/core/`：新增 frontmatter 序列化、格式版本和解析逻辑
- `packages/web-backend/`：新增知识导出与标准文件导入 endpoints，并复用现有导入预览/确认链路
- `packages/web-frontend/`：补齐导出按钮、文件导入和结果确认界面
