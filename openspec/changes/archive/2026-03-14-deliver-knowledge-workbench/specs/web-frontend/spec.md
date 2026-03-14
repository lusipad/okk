## ADDED Requirements

### Requirement: 知识入口成为前端一级导航
前端工作台 SHALL 将 Knowledge 作为一级导航入口暴露给用户。

#### Scenario: 渲染侧栏导航
- **WHEN** 用户进入工作台并查看左侧导航
- **THEN** 系统 SHALL 显示 Knowledge 一级导航项
- **AND** 该导航项 SHALL 可直接跳转到 `/knowledge`

### Requirement: 前端知识 IO 桥接
前端 IOProvider SHALL 暴露知识工作台所需的知识 CRUD、搜索、版本历史和状态更新方法。

#### Scenario: 页面加载知识数据
- **WHEN** `KnowledgePage` 请求列表、详情或版本历史数据
- **THEN** IOProvider SHALL 调用对应的知识接口方法
- **AND** 页面层 SHALL 不需要直接拼接底层 HTTP 请求

#### Scenario: 执行知识变更
- **WHEN** 用户在工作台中创建、更新、删除或切换知识状态
- **THEN** IOProvider SHALL 提供对应的前端方法并返回结构化结果
- **AND** 结果 SHALL 可被页面状态直接消费
