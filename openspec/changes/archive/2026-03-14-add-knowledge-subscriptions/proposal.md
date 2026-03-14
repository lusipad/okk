_来源：拆分自 `knowledge-sharing-expansion`。本 change 只负责知识源订阅、更新通知和订阅内容导入。_

## Why

即使团队已经具备共享知识库，用户仍需要一个持续接收更新的机制，否则共享内容只会停留在“偶尔人工浏览”的被动模式。订阅能力需要独立建模，因为它关注的是来源跟踪、更新发现、通知和导入节奏，而不是共享审批本身。

## What Changes

- 支持订阅团队、项目或主题级知识源，并记录订阅关系与同步状态
- 提供知识源更新通知，让用户看到最近新增或变更的共享内容
- 支持将订阅内容一键导入到个人知识库或工作区视图
- 提供订阅列表、启停和最近同步记录，便于管理长期知识流入

## Capabilities

### New Capabilities

- `knowledge-subscriptions`: 定义知识源订阅、更新通知和订阅内容导入能力

### Modified Capabilities

- `knowledge-engine`: 增加知识来源跟踪、订阅同步状态和导入映射
- `data-layer`: 增加订阅关系、同步状态和更新记录模型
- `web-backend`: 增加订阅 CRUD、更新查询和导入触发 API
- `web-frontend`: 增加订阅管理、更新列表和一键导入交互

## Impact

- `packages/core/`：新增 subscription 模型、同步状态和导入关联逻辑
- `packages/core/src/database/`：新增订阅关系、更新记录和同步游标持久化
- `packages/web-backend/`：新增订阅管理和更新通知相关 routes
- `packages/web-frontend/`：新增订阅管理视图、更新流和导入动作
