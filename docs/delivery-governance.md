# 交付治理说明

## 已落地能力

- Windows 桌面打包工作流会输出 zip、checksum 与 release notes
- 打包后会执行 `desktop-smoke`，并将运行时证据落盘到 `packages/desktop/release/desktop-smoke`
- 内网部署手册已补充运行时诊断、发布产物与验收要求
- Desktop parity matrix 已明确 Web/Desktop 主流程等价验收项

## 强制门禁顺序

当前收敛后的交付顺序为：
- test
- build
- packaged smoke
- artifact assembly
- checksum
- release notes
- release upload / release publish

## 发布产物

- `OKK-Desktop-windows-x64-<ref>.zip`
- `OKK-Desktop-windows-x64-<ref>.sha256.txt`
- `OKK-Desktop-windows-x64-<ref>-release-notes.md`
- `packages/desktop/release/desktop-smoke/*` 运行时证据
