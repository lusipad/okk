# Reference Baseline

把官方参考截图放在这个目录中，文件名需要与当前产物一致：

- `chat-empty-1600x900.png`
- `chat-empty-1920x1080.png`
- `chat-empty-1280x800.png`

生成当前产物后执行：

1. `bash scripts/run-pixel-audit-local.sh`
2. `npm run ui:pixel:reference:prepare`
3. `npm run ui:pixel:reference-diff`

可选阈值（默认 `full=8`, `key=5`）：

- `OKK_PIXEL_REFERENCE_FULL_THRESHOLD`
- `OKK_PIXEL_REFERENCE_KEY_THRESHOLD`
- `OKK_PIXEL_REFERENCE_EXACT_DIMENSIONS`（`1` 表示强制参考图与当前图尺寸一致）

严格模式（无参考图时直接失败）：

- `OKK_PIXEL_REFERENCE_REQUIRED=1`
- `npm run ui:pixel:reference-diff:strict`
- `npm run ui:pixel:gate:strict`
