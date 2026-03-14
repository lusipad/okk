## Why

当前顶栏承担了品牌和全局动作，但没有持续告诉用户“我现在在哪个页面、以谁的身份工作”。当首页、Identity、Memory、Workspaces 等页面越来越多时，缺少轻量上下文面包屑会让用户在切换后失去方向，也弱化了“合伙人始终在线且有身份”的产品感知。需要在不增加视觉噪音的前提下补齐这一层导航语义。

## What Changes

- 在顶栏中心区域展示当前页面名称，并在可用时附加活跃身份名称
- 允许各页面显式向 `ShellLayout` 传入当前页面的上下文标签，避免顶栏只能显示静态文案
- 保持顶栏信息密度克制，在桌面与移动态都不引入重型 breadcrumb 组件
- 不新增路由层级或全局状态框架，仅补齐页面上下文表达

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `web-frontend`: 为顶栏增加页面与身份上下文面包屑，提升跨页面切换时的定位感

## Impact

- `packages/web-frontend/src/components/layout/ShellLayout.tsx` — 渲染顶栏上下文面包屑
- `packages/web-frontend/src/pages/*` — 显式传入页面名与可选身份上下文
- 顶栏响应式布局与页面上下文展示验证
