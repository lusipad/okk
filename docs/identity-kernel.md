# Identity Kernel 说明

## 当前已落地范围

- `identity_profiles` 持久化身份配置
- 当前激活身份查询与切换
- 会话前将 active identity 注入 system prompt
- `Identity` 页面用于查看、创建并激活身份
- 后端 API：列出、当前激活、创建、激活切换

## 画像策略

当前 `profileJson` 作为轻量画像容器，后续可继续扩展常用 backend、常用 agent、语气偏好等信息。
