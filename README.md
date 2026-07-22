# SoloView — 文档不离开 VS Code

**双击即看 PDF、Word、Excel、CSV、PowerPoint 和常见图片。无需切换应用，无需上传文件。**

SoloView 把日常文档直接放进 VS Code 编辑器标签页。需求说明、数据表、演示稿和参考资料都留在你的工作流里：打开、查看、缩放，然后继续手头的工作。

## 为什么安装 SoloView

- **少一次应用切换**：像打开代码一样打开文档，不再往返于 Office、浏览器和文件管理器。
- **常用格式一个入口**：支持 PDF、Word、Excel、CSV、PowerPoint，以及 PNG、JPEG、GIF、WebP、BMP、SVG、ICO 和 AVIF 图片。
- **文件留在本机**：本地读取和渲染，不把文档上传到远程服务。
- **安心查看**：只读模式，不执行 Office 宏，也不会意外改动原文件。
- **快速回到上下文**：活动栏保留最近打开的 12 个文档，点击即可继续查看。
- **中英文界面**：跟随 VS Code 显示侧栏与命令，并可在查看器内一键切换中文 / English。

## 立刻开始

1. 在 VS Code 中双击受支持的文档；或打开 SoloView 活动栏，点击“打开文档”。
2. 使用工具栏缩放、重新载入，或在文件夹中定位原文件。
3. 查看 Excel 工作簿时，直接切换工作表标签。

> SoloView 适合快速、私密的日常查看。复杂字体、Office 图表、动画、SmartArt 和第三方插件对象可能与桌面 Office 存在差异；`.doc`、`.ppt` 等旧二进制格式暂不支持。

---

# SoloView — Keep documents inside VS Code

**Open PDF, Word, Excel, CSV, PowerPoint, and common images with a double-click. No app switching. No uploads.**

SoloView brings everyday documents into a VS Code editor tab. Keep specs, spreadsheets, slide decks, and references inside your workflow: open, inspect, zoom, and get straight back to work.

## Why developers choose SoloView

- **Stay in flow**: open documents like source files instead of bouncing between Office, a browser, and Finder or Explorer.
- **One viewer for everyday formats**: PDF, Word, Excel, CSV, PowerPoint, plus PNG, JPEG, GIF, WebP, BMP, SVG, ICO, and AVIF images.
- **Local-first privacy**: files are read and rendered locally, never uploaded to a remote service.
- **Safe by design**: read-only viewing does not run Office macros or modify the original file.
- **Return to context fast**: reopen any of your 12 most recent documents from the Activity Bar.
- **Bilingual interface**: sidebar and commands follow VS Code, while the viewer switches between 中文 and English in one click.

## Get started

1. Double-click a supported document in VS Code, or open SoloView in the Activity Bar and choose “Open Document.”
2. Zoom, reload, or reveal the original file from the viewer toolbar.
3. For Excel workbooks, move between worksheets with the built-in tabs.

> SoloView is designed for fast, private everyday viewing. Complex fonts, Office charts, animations, SmartArt, and third-party embedded objects may differ from desktop Office. Legacy binary formats such as `.doc` and `.ppt` are not currently supported.

## Development

```bash
npm install
npm run check
```

Technical research: [GitHub document viewer landscape](docs/research/github-document-viewer-landscape.md).
