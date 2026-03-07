# Skill 市场说明

## 当前已落地范围

- 市场索引读取（本地 `skill-market.json` 或配置源）
- 市场列表与关键字搜索
- 市场安装与失败回滚
- 安装来源、来源类型与版本状态持久化
- Skills 页面中的市场浏览与一键安装

## 已支持的来源

- `folder`
- `git`

## 运行行为

- 市场安装会先下载到临时目录，再复制到目标 Skill 目录
- 安装完成后会回写已安装 Skill 状态与来源信息
- 失败时会清理临时目录并返回结构化错误

## 与 Skill 系统升级的关系

Skill 市场依赖已安装 Skill 的生命周期状态：
- `source_type`
- `enabled`
- `status`
- `dependency_errors_json`

因此市场功能默认与升级后的 Skill 生命周期模型一起工作。
