## ADDED Requirements

### Requirement: 知识标准文件导出交互
Web Frontend SHALL 允许用户从知识列表或详情视图导出单条或批量知识为标准文件。

#### Scenario: 从详情页导出知识
- **WHEN** 用户在知识详情页点击导出
- **THEN** 前端 SHALL 触发标准文件下载
- **AND** 用户 SHALL 能看到导出成功或失败反馈

#### Scenario: 从列表批量导出知识
- **WHEN** 用户在知识列表中选择多条知识并执行批量导出
- **THEN** 前端 SHALL 发起批量导出请求
- **AND** 用户 SHALL 获得对应的导出结果文件

### Requirement: 知识标准文件导入交互
Web Frontend SHALL 提供标准文件上传、预览校验和确认导入界面。

#### Scenario: 预览标准文件内容
- **WHEN** 用户上传标准知识文件
- **THEN** 前端 SHALL 展示解析后的标题、摘要、标签和正文预览
- **AND** 用户 SHALL 能决定继续导入或取消

#### Scenario: 显示格式校验错误
- **WHEN** 标准文件解析失败
- **THEN** 前端 SHALL 展示结构化错误信息
- **AND** 不得继续进入确认导入步骤
