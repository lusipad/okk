## ADDED Requirements

### Requirement: 知识共享发起与状态反馈
Web Frontend SHALL 允许作者从知识工作台发起共享请求，并实时展示共享状态和审核反馈。

#### Scenario: 作者提交共享
- **WHEN** 作者在知识详情面板中点击共享
- **THEN** 前端 SHALL 展示共享表单并提交请求
- **AND** 提交成功后 SHALL 在界面中显示当前共享状态

#### Scenario: 作者查看审核反馈
- **WHEN** 某条共享请求被驳回或退回修改
- **THEN** 前端 SHALL 在对应知识条目上显示最新审核结论
- **AND** 用户 SHALL 能查看审核备注

### Requirement: 审核工作台与团队浏览界面
Web Frontend SHALL 提供审核队列和团队知识浏览界面，分别承载审核动作和团队复用入口。

#### Scenario: 审核人处理待审请求
- **WHEN** 审核人打开知识共享审核队列
- **THEN** 前端 SHALL 展示待审共享列表和详情
- **AND** 审核人 SHALL 能执行批准、驳回或退回修改

#### Scenario: 团队成员浏览已发布知识
- **WHEN** 团队成员进入团队知识页
- **THEN** 前端 SHALL 展示已发布共享知识列表
- **AND** 用户 SHALL 能按标签、分类或来源进行筛选
