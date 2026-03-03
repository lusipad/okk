# Pixel Clone 验收矩阵

## 1. 布局几何（必须）
- 顶栏高度：`42 +/- 2 px`
- 左栏宽度：`266 +/- 4 px`
- 主舞台最大宽度：`960 +/- 8 px`
- 输入 Dock 圆角：`28 +/- 2 px`
- 用户消息起始左边距（桌面）：`26% +/- 2%`
- 助手消息结束右边距（桌面）：`19% +/- 2%`

## 2. 字体与密度（必须）
- 空态主文案字号：`36 +/- 2 px`
- 输入占位字号：`34 +/- 2 px`
- 侧栏一级导航字号：`13 +/- 1 px`

## 3. 状态与交互（必须）
- Enter 发送、Shift+Enter 换行、Esc 停止（流式中）
- 顶栏按钮 hover / active 可见
- 新消息按钮在非底部时出现，回到底部后消失
- 协作面板可通过顶栏按钮与 Esc 关闭

## 4. 自动化检查命令
- `npm run test -w @okclaw/web-frontend`
- `npm run build -w @okclaw/web-frontend`
- `npm run ui:pixel:baseline`
- `npm run ui:pixel:audit`
- `npm run ui:pixel:diff`
- `npm run ui:pixel:reference-diff`
- `npm run ui:pixel:report`
- `npm run ui:pixel:gate`
- `bash scripts/run-smoke-local.sh`

## 5. 像素对比（最终封板）
- 基线目录：`docs/pixel-clone/baseline/`
- 当前目录：`output/pixel/current/`
- Diff 目录：`output/pixel/diff/`
- 通过阈值：
  - 单图差异像素比例 `< 2.0%`
  - 关键区域（顶栏/左栏/输入区）差异像素比例 `< 1.0%`
