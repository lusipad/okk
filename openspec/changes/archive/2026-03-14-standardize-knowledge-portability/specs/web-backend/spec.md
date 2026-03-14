## ADDED Requirements

### Requirement: 知识标准文件导出接口
Web Backend SHALL 提供知识标准文件的单条与批量导出接口。

#### Scenario: 导出单条知识文件
- **WHEN** 前端请求导出单条知识
- **THEN** 后端 SHALL 返回一个符合标准格式的文件响应
- **AND** 响应元数据 SHALL 指明文件名和格式版本

#### Scenario: 导出批量知识文件
- **WHEN** 前端请求批量导出多个知识
- **THEN** 后端 SHALL 返回包含多个知识文件的导出结果
- **AND** 结果 SHALL 包含批量清单信息

### Requirement: 知识标准文件导入接口
Web Backend SHALL 提供标准文件导入预览与确认接口，并复用现有导入确认链路。

#### Scenario: 预览标准文件导入
- **WHEN** 前端上传标准知识文件请求预览
- **THEN** 后端 SHALL 解析文件并返回结构化预览数据
- **AND** 预览结果 SHALL 可直接进入现有确认导入流程

#### Scenario: 标准文件格式校验失败
- **WHEN** 上传的标准知识文件缺失必填 frontmatter 或格式非法
- **THEN** 后端 SHALL 拒绝预览请求
- **AND** 返回明确的校验错误信息
