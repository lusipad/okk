# Pixel Clone 进度

## 里程碑状态

- M1 验收框架：已完成
  - 已交付验收矩阵：`docs/pixel-clone/acceptance-matrix.md`
  - 已交付审计脚本：`scripts/pixel-audit.mjs`
  - 已交付审计报告脚本：`scripts/pixel-report.mjs`

- M2 骨架对齐：已完成
  - 左栏 + 主舞台 + 底部 Dock 完成几何收敛
  - 空态视图切换为中心文案与弱化引导

- M3 视觉对齐：已完成
  - 已完成暗色层级、圆角、边框密度统一
  - 已完成顶栏品牌比例与侧栏噪音收敛

- M4 交互对齐：已完成
  - 已完成输入区主交互（发送/重试/停止）
  - 已补充 Enter / Shift+Enter / Esc 行为测试
  - 已补充侧栏/协作抽屉开启动画与状态可达性标记
  - 已补充 Ctrl/Cmd + K 命令面板快捷路径测试

- M5 封板发布：进行中
  - 已具备基线/对比脚本（`ui:pixel:baseline` + `ui:pixel:diff`）
  - 已新增官方参考对比脚本（`ui:pixel:reference-diff`）
  - 已新增官方参考严格校验（`ui:pixel:reference-diff:strict`）
  - 已新增一键验收闸门（`ui:pixel:gate`）
  - 已新增严格闸门（`ui:pixel:gate:strict`，无官方参考图会失败）
  - 待完成官方基线图导入与最终验收报告

## 最近一次自检

- 一键闸门：通过（`npm run ui:pixel:gate`）
- 严格参考校验：命令已可用（`npm run ui:pixel:reference-diff:strict`，当前因无参考图会失败）
- 前端测试：通过
- 前端构建：通过
- 后端测试/构建：通过
- Core 测试/构建：通过
- Smoke E2E：通过
- Pixel Audit：通过（见 `output/pixel/audit-report.json`）
- Pixel Diff：通过（见 `output/pixel/diff-report.json`）
- Pixel Reference Diff：已接入，当前缺少官方参考图（`pixel_reference_diff_skipped=true`）
- 截图基线：`output/pixel/current/chat-empty-1600x900.png`
- 对比截图：`output/playwright/chat-page-v16.png`
