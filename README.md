# OKK

企业内网代码仓库知识平台（MVP）。

## 环境

- Node.js 22+

## 快速开始

```bash
npm install
npm run test
npm run build
```

启动：

```bash
npm run dev -w @okk/web-backend
npm run dev -w @okk/web-frontend
```

桌面端：

```bash
npm run dev -w @okk/desktop
```

## 发布

```bash
npm run release:prepare
```

发布产物位于 `release/`。`npm run package:win -w @okk/desktop` 会在 `packages/desktop/release/win-unpacked/` 生成原始 Windows 桌面产物；GitHub Actions 会额外生成 `OKK-Desktop-windows-x64-<ref>.zip`、对应 `.sha256.txt` 校验文件，以及同名 release notes Markdown。手动触发 `workflow_dispatch` 时只上传 artifact；推送 `v*` tag 时还会自动创建 GitHub Release 并挂载这三份文件。

## 运维手册

- 部署手册：`docs/intranet-deployment-runbook.md`
- 故障恢复手册：`docs/failure-recovery-runbook.md`




