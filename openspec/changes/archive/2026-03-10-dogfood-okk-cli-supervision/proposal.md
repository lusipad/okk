## Why

如果 OKK 不能先用来安排和监督自己的开发工作，它就很难证明“赛博同事系统”不是停留在概念层。当前 CLI 已经有 `partner / mission / run team` 的 MVP 雏形，最合适的下一步就是把它提升为可日常 dog-fooding 的自监督入口，让团队用 OKK 给自己建任务、发起协作、查看待确认和继续工作。

## What Changes

- 引入 CLI 工作台主路径，支持 `partner home / team`、`mission`、`run`、`checkpoint`
- 为 `run team` 提供默认的多同事协作模板
- 让 OKK 团队能用 OKK 自己来创建任务、发起协作、查看整体进度和待确认项

## Capabilities

### New Capabilities

- `cli-workbench`: 提供 CLI-first 的赛博同事工作台与自监督入口

### Modified Capabilities

- None

## Impact

- `packages/cli/*`
- `package.json`
- 与 `@okk/core` 的集成方式和后续 CLI / Desktop / Web 统一任务语义
