## Why

即使信息架构收敛，如果视觉语言仍停留在“功能原型”级别，产品仍无法达到 ChatGPT / Claude / OpenCowork 那种商业化完成度。当前界面在颜色语义、组件密度、消息舞台、输入区和空态体验上仍不统一，需要独立 change 作为长期视觉基线。

## What Changes

- 建立工作台视觉系统：颜色语义、间距、圆角、边框、阴影、排版和动效令牌
- 收敛主舞台、消息流、输入 Dock、列表项、空态和状态反馈的组件表达
- 明确默认暗色风格、主题切换规则和可访问性对比要求
- 将像素对齐目标从“单次优化”升级为“持续维护的视觉基线”

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `web-frontend`: 将视觉表现从功能原型升级为统一商业化视觉系统

## Impact

- `packages/web-frontend/src/components/**/*`
- `packages/web-frontend/src/pages/**/*`
- `packages/web-frontend/src/styles` 或主题变量定义
- `docs/pixel-clone/*`
- 像素参考图、视觉回归脚本与界面验收标准
