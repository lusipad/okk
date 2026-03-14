# knowledge-export-import Specification

## Purpose
定义知识标准文件格式、单条/批量导出与标准文件导入能力，支持跨仓库备份、离线流转与后续导入确认。

## Requirements
### Requirement: 知识标准文件格式
系统 SHALL 提供基于 Markdown 正文与 YAML frontmatter 的知识标准文件格式，用于单条和批量知识导出与导入。

#### Scenario: 导出单条知识
- **WHEN** 用户导出一条知识
- **THEN** 系统 SHALL 生成一个 Markdown 文件
- **AND** 文件 SHALL 包含 frontmatter 元数据与正文内容

#### Scenario: 导入标准知识文件
- **WHEN** 系统读取一个符合格式的知识文件
- **THEN** 系统 SHALL 解析其 frontmatter 与正文
- **AND** 解析结果 SHALL 能进入后续预览与确认流程

### Requirement: 知识格式版本兼容
系统 SHALL 在标准知识文件中声明格式版本，并在导入时执行兼容性校验。

#### Scenario: 导入受支持版本
- **WHEN** 用户导入受支持版本的标准知识文件
- **THEN** 系统 SHALL 允许该文件进入预览流程
- **AND** 响应 SHALL 标明解析后的格式版本

#### Scenario: 导入不受支持版本
- **WHEN** 用户导入未知或不受支持版本的标准知识文件
- **THEN** 系统 SHALL 拒绝导入
- **AND** 返回明确的版本兼容性错误

### Requirement: 批量知识导出
系统 SHALL 支持批量导出多个知识条目，并为导出结果生成可追溯的文件集合。

#### Scenario: 批量导出知识
- **WHEN** 用户选择多条知识执行导出
- **THEN** 系统 SHALL 为每条知识生成独立文件
- **AND** 导出结果 SHALL 附带批量清单或索引信息
