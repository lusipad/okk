# OKK 命名方案

文档版本：`v2.0`
最后更新：`2026-03-06`

## 1. 最终结论

- 对外品牌短名：`OKK`
- 正式全称：`Open Knowledge Kernel`
- 中文名称：`开放知识内核`
- 桌面应用名：`OKK Desktop`

## 2. 当前状态

项目内代码、配置、脚本、文档中的主命名标识已统一完成迁移：

- 品牌名：`OKK`
- 包 scope：`@okk/*`
- 配置目录：`.okk/`
- 全局桥接名：`okkDesktop` / `okkDesktopRuntime`
- 环境变量前缀：`OKK_*`
- Electron 应用标识：`com.okk.desktop`

## 3. 使用规范

- 面向用户的所有新文案统一使用 `OKK`。
- 面向正式说明的全称统一使用 `Open Knowledge Kernel`。
- 新增包名、脚本、配置键、目录名统一使用 `okk` / `OKK` 前缀。
- 不再新增任何 `旧项目标识` 相关标识。

## 4. 当前映射表

| 维度 | 当前值 |
| --- | --- |
| 品牌名 | `OKK` |
| 正式全称 | `Open Knowledge Kernel` |
| 根包名 | `okk` |
| 包 scope | `@okk/*` |
| 配置目录 | `.okk/` |
| 全局桥接名 | `okkDesktop` / `okkDesktopRuntime` |
| appId | `com.okk.desktop` |
| 桌面应用名 | `OKK` |

## 5. 兼容性说明

- 本次迁移已将本地项目配置目录统一调整为 `.okk/`。
- 当前工作区代码中不再保留旧项目标识文本。
- 若外部脚本、CI 缓存或本地手工命令仍依赖旧名称，需要同步改为 `okk` / `OKK`。
