# Skill 系统升级说明

## 本次目标

本次升级聚焦四个最小闭环：
- 已安装 Skill 生命周期状态持久化
- 兼容性与依赖异常诊断
- 启用 / 禁用切换
- 详情页中的状态与诊断可视化

## 数据模型

`installed_skills` 现支持：
- `source_type`
- `enabled`
- `status`
- `dependency_errors_json`
- `updated_at`

## 诊断规则

当前诊断优先做结构级检查：
- 若 Skill 内容声明了 `scripts/` 引用但目录不存在，记为依赖异常
- `compatibility` 作为元数据展示给用户，不在本阶段做强阻断

## API

- `PATCH /api/skills/:skillId/enabled`
- `POST /api/skills/:skillId/diagnose`

## 前端行为

Skills 页面新增：
- 状态展示
- 依赖异常展示
- 已安装 Skill 的启用 / 禁用按钮
- 详情面板中的兼容性与诊断结果

## 兼容边界

- 保持对 OpenClaw / NanoClaw 常见 `SKILL.md + scripts/` 结构的兼容
- 当前不做复杂依赖安装，只提供诊断提示和状态记录
