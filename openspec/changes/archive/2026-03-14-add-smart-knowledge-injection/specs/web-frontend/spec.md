## ADDED Requirements

### Requirement: Chat UI 展示知识引用
前端聊天界面 SHALL 展示本次回答实际使用的知识引用。

#### Scenario: 回答包含知识引用
- **WHEN** 回答结果带有知识引用列表
- **THEN** 前端 SHALL 在聊天界面渲染对应的知识引用信息
- **AND** 用户 SHALL 能明确区分这些信息属于本次回答的引用来源

#### Scenario: 回答不包含知识引用
- **WHEN** 回答结果没有知识引用
- **THEN** 前端 SHALL 隐藏或清空知识引用展示区域
- **AND** 不得展示过期的上一轮引用信息

### Requirement: 知识建议卡支持编辑与跳转
前端 SHALL 允许用户在知识建议卡中编辑建议内容，并在保存后跳转到对应知识条目。

#### Scenario: 编辑建议草稿
- **WHEN** 用户在知识建议卡中修改标题、内容或标签
- **THEN** 前端 SHALL 在当前卡片中保留这些修改
- **AND** 修改 SHALL 在提交前保持可见

#### Scenario: 保存后跳转
- **WHEN** 用户保存知识建议且后端返回新建知识条目标识
- **THEN** 前端 SHALL 可跳转到对应的知识条目路由
- **AND** 该跳转 SHALL 指向新保存的知识记录
