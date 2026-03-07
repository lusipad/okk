# OKK Desktop Parity Matrix

## 1. 主流程等价矩阵

| 主流程 | Web | Desktop | 当前验收方式 |
| --- | --- | --- | --- |
| 登录 | REST + JWT | Embedded backend + 同一登录页 | web smoke / desktop smoke |
| Chat 对话 | WS + 流式回复 | Embedded backend + 同一 ChatPage | web smoke / desktop smoke |
| Skills | 页面管理 + 选择执行 | 页面管理 + Composer 选择执行 | web smoke / desktop smoke |
| MCP | 页面管理 + 调用工具/资源 | 页面管理 + Composer 选择执行 | web smoke / desktop smoke |
| 协作侧栏 | Team timeline / graph | 同一右侧协作面板 + 桌面 runtime 警告 | web smoke / desktop smoke |
| Knowledge 建议 | 保存/忽略 | 相同工作流 | web-backend tests |
| 命令面板 | `Ctrl/Cmd + K` | 同一命令面板 + 全局搜索注入 | ShellLayout test / desktop smoke |
| 文件输入 | 浏览器拖拽 | 原生拖拽 + 文件选择注入草稿 | ShellLayout / desktop smoke |

## 2. 启动前置检查项

Desktop 启动时至少检查以下项：

1. Embedded backend 端口可分配
2. `@okk/core` 可初始化
3. CLI backend readiness 可枚举
4. Renderer 主入口可解析（dev URL 或打包后的 `web-frontend/index.html`）
5. Preload/runtime bridge 已暴露
6. 运行日志路径可写入

## 3. 可见错误态要求

以下问题不得再表现为空白页或静默失败：

- embedded backend 启动失败
- renderer `did-fail-load`
- renderer `render-process-gone`
- renderer `unresponsive`
- CLI backend 不可用
- 打包后资源缺失

对应策略：

- 启动失败切换到桌面诊断页
- 诊断页提供：`重试启动`、`重新加载窗口`、`打开日志`
- 桌面工作台加载成功后，若仍存在 CLI/路径问题，则以前端 warning bar 暴露
