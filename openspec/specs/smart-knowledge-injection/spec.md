# smart-knowledge-injection Specification

## Purpose
定义查询相关知识注入、知识引用可见性和建议卡编辑保存的产品能力边界。

## Requirements
### Requirement: 查询相关知识注入
系统 SHALL 基于当前用户问题选择要注入的知识，而不是仅依赖固定数量的仓库知识摘要。

#### Scenario: 构建对话上下文
- **WHEN** 用户发起新的提问或追问
- **THEN** 系统 SHALL 基于当前问题检索相关知识条目
- **AND** 生成的知识上下文 SHALL 同时区分背景知识与问题相关知识

#### Scenario: 控制注入范围
- **WHEN** 检索候选知识数量超过本次上下文允许范围
- **THEN** 系统 SHALL 对候选结果进行裁剪
- **AND** 最终注入结果 SHALL 保持可解释且受控的条目数量

### Requirement: 知识引用可见性
系统 SHALL 让用户看到本次回答实际使用了哪些知识条目。

#### Scenario: 回答完成后展示引用
- **WHEN** 一次回答完成并返回前端
- **THEN** 系统 SHALL 同步返回本次实际使用的知识引用列表
- **AND** 前端 SHALL 能显示每条引用的标题、分类或其他可识别信息

### Requirement: 建议卡保存前编辑
系统 SHALL 支持用户在保存知识建议前修正标题、内容和标签。

#### Scenario: 编辑后保存建议
- **WHEN** 用户在知识建议卡中修改标题、内容或标签并点击保存
- **THEN** 系统 SHALL 按修改后的内容保存知识条目
- **AND** 保存结果 SHALL 可用于后续跳转或引用
