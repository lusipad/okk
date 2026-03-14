## 1. 聚合接口与契约

- [x] 1.1 在 core 中新增 partner summary 聚合能力，复用 identity、memory 和 repository 数据源
- [x] 1.2 在 web-backend 中新增 GET /api/partner/summary，并保证响应结构可部分降级

## 2. 首页摘要卡接入

- [x] 2.1 扩展前端 IOProvider 与对应实现，新增 partner summary 读取方法
- [x] 2.2 在 PartnerHomeView 中渲染身份与记忆摘要卡，并处理加载、空态和失败降级

## 3. 校验与回归

- [x] 3.1 为摘要接口补齐成功、空数据和部分缺失场景的契约测试
- [x] 3.2 验证首页在摘要卡失败时仍能正常展示最近会话、继续工作和快速操作

