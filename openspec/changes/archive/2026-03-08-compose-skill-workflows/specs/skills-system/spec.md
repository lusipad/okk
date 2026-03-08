## ADDED Requirements

### Requirement: Skill 工作流Skill 运行时扩展
系统 SHALL 在 Skill 运行时与管理流程中支持允许 Skill 作为标准工作流节点被引用、配置和复用，保证安装、编排或执行过程与主题能力一致。

#### Scenario: 加载或执行 Skill
- **WHEN** 系统加载、安装、升级或执行与Skill 工作流相关的 Skill 能力
- **THEN** Skills 系统 SHALL 使用与主题一致的状态模型和元数据
- **AND** 运行结果 SHALL 可被后续界面或诊断能力消费

#### Scenario: 诊断异常状态
- **WHEN** Skill 安装、依赖检查或运行过程中发生异常
- **THEN** 系统 SHALL 返回与Skill 工作流相关的结构化诊断信息
- **AND** 用户 SHALL 能判断是否需要修复、回滚或重试
