# PROJECT_MEMORY.md

This file stores stable project facts future agents should reuse. Do not paste run logs, prompts, terminal output, or one-off debugging notes here.

## Project Identity

- Name: soloview
- Type: Infrastructure / tooling foundation
- Users: 需要在 VS Code 内本地查看 PDF 与 Office 文档的用户
- Current stage: `0.1.5` 已发布到 Visual Studio Marketplace 与 Open VSX

## Stable Decisions

- 首版保持本地只读查看，不执行宏、不上传文档。
- `main` 上影响插件的提交自动触发 patch 版本递增、语义化 Tag、GitHub Release 与双市场发布；失败重跑复用当前 Tag，不重复升版。
- 市场表达以“文档不离开 VS Code、本地优先、只读安全”为核心价值；市场页与插件界面同时提供中英文。
- 市场 logo 使用圆角矩形外轮廓，保留蓝色文档折角与眼睛识别符号。

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
- PDF.js 6 的扫描件链路必须随 VSIX 打包 `wasm`、`cmaps`、`standard_fonts`，Webview CSP 允许 `wasm-unsafe-eval`，并向 `getDocument` 提供三类资源 URL；否则 JPEG2000/JBIG2 扫描页可能为空白。GitHub PDF.js issue #18457 的 JPEG2000 样本是固定回归样本。
- Webview 渲染器必须按文档格式动态加载，不能让 DOCX/PDF/XLSX/PPTX 共用一个全量首屏 bundle；DOCX 纸张固定为浅色背景和深色正文，不继承 VS Code 深色主题。PDF 首页面渲染后立即撤掉加载层，后续页继续追加。
- PPTX 长文稿必须启用上游 `lazySlides`、`lazyMedia` 和 windowed list，首张幻灯片渲染后立即显示；禁止使用默认 eager 模式等待全部幻灯片解析、媒体解压和 DOM 挂载。60 页、9.8 MB 媒体样本在 Chromium 中首张可见约 1.88 秒，滚动到末页可继续增量渲染。
