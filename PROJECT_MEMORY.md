# PROJECT_MEMORY.md

This file stores stable project facts future agents should reuse. Do not paste run logs, prompts, terminal output, or one-off debugging notes here.

## Project Identity

- Name: soloview
- Type: Infrastructure / tooling foundation
- Users: 需要在 VS Code 内本地查看 PDF 与 Office 文档的用户
- Current stage: `0.1.4` 已发布到 Visual Studio Marketplace 与 Open VSX

## Stable Decisions

- 首版保持本地只读查看，不执行宏、不上传文档。
- `main` 上影响插件的提交自动触发 patch 版本递增、语义化 Tag、GitHub Release 与双市场发布；失败重跑复用当前 Tag，不重复升版。

## Architecture Boundaries

- VS Code `CustomReadonlyEditorProvider` 是文档查看主入口。
- 最近打开列表使用 VS Code 原生 Tree View 与 `globalState`，不另建远程存储。
- `.solopreneur`、`AGENTS.md` 和 `PROJECT_MEMORY.md` 属于项目治理文件，必须排除在 VSIX 外。

## Verification

- Default CI: `.github/workflows/ci.yml`
- Default security checks: `.github/workflows/security.yml`
- Release workflow: `.github/workflows/publish.yml`
- 发布完成必须验证 GitHub Release、Visual Studio Marketplace 和 Open VSX 均暴露目标版本。

## Handoff Notes

- `0.1.2` 只补齐了侧边栏入口的显式激活事件，未解决用户安装后看不到活动栏图标的问题。
- `0.1.3` 只替换了固定白色 SVG，用户真实安装后仍看不到活动栏入口，不得视为闭环。
- `0.1.4` 参照 SoloMap 的已验证实现统一侧边栏容器与视图 ID，图标使用 `currentColor`，并增加干净 VS Code Extension Host 入口测试；最终市场 VSIX 已直接下载解包核验。
- 后续功能提交推送 `main` 即可，不再人工打 Tag；自动发布工作流负责升版和 Release。
