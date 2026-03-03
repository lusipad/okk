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
  - 已完成 v8 收敛（顶栏动作弱化、左栏强调色降噪、输入 Dock 居中约束）
  - 已完成 v9 收敛（顶部/侧栏强调色中性化，输入 Dock 商业化克制风格）

- M4 交互对齐：已完成
  - 已完成输入区主交互（发送/重试/停止）
  - 已补充 Enter / Shift+Enter / Esc 行为测试
  - 已补充侧栏/协作抽屉开启动画与状态可达性标记
  - 已补充 Ctrl/Cmd + K 命令面板快捷路径测试
  - 已补充 Ctrl/Cmd + Shift + L 专注模式快捷路径测试

- M5 封板发布：进行中
  - 已具备基线/对比脚本（`ui:pixel:baseline` + `ui:pixel:diff`）
  - 已新增参考图预处理脚本（`ui:pixel:reference:prepare`）
  - 已新增官方参考对比脚本（`ui:pixel:reference-diff`）
  - 已新增官方参考严格校验（`ui:pixel:reference-diff:strict`）
  - 已新增一键验收闸门（`ui:pixel:gate`）
  - 已新增严格闸门（`ui:pixel:gate:strict`，当前已验证可通过）
  - 官方参考图可替换当前 seed 参考后再次 strict 验证

## 最近一次自检

- 一键闸门：通过（`npm run ui:pixel:gate`）
- 严格闸门：通过（`npm run ui:pixel:gate:strict`）
- 前端测试：通过（6 files / 20 tests）
- 严格参考校验：通过（`npm run ui:pixel:reference-diff:strict`）
- 参考图预处理：命令已可用（`npm run ui:pixel:reference:prepare`）
- 前端构建：通过
- 后端测试/构建：通过
- Core 测试/构建：通过
- Smoke E2E：通过
- Pixel Audit：通过（见 `output/pixel/audit-report.json`）
- Pixel Diff：通过（见 `output/pixel/diff-report.json`）
- Pixel Reference Diff：通过（见 `output/pixel/reference-diff-report.json`）
- 截图基线：`output/pixel/current/chat-empty-1600x900.png`
- E2E 截图：`output/playwright/e2e-success.png`
