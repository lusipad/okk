# OKClaw

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
npm run dev -w @okclaw/web-backend
npm run dev -w @okclaw/web-frontend
```

桌面端：

```bash
npm run dev -w @okclaw/desktop
```

## 发布

```bash
npm run release:prepare
```

发布产物位于 `release/`。

## 运维手册

- 部署手册：`docs/intranet-deployment-runbook.md`
- 故障恢复手册：`docs/failure-recovery-runbook.md`
