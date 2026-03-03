# Reference Baseline

把官方参考截图放在这个目录中，文件名需要与当前产物一致：

- `chat-empty-1600x900.png`
- `chat-empty-1920x1080.png`
- `chat-empty-1280x800.png`

生成当前产物后执行：

1. `bash scripts/run-pixel-audit-local.sh`
2. `npm run ui:pixel:reference-diff`

可选阈值（默认 `full=8`, `key=5`）：

- `OKCLAW_PIXEL_REFERENCE_FULL_THRESHOLD`
- `OKCLAW_PIXEL_REFERENCE_KEY_THRESHOLD`

严格模式（无参考图时直接失败）：

- `OKCLAW_PIXEL_REFERENCE_REQUIRED=1`
