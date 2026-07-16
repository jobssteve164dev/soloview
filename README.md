# SoloView

SoloView 是一个本地优先的 VS Code 文档查看器。双击文件即可在编辑器标签页中查看：

- PDF：`.pdf`
- Word：`.docx`
- Excel：`.xlsx`、`.xls`、`.csv`
- PowerPoint：`.pptx`

首版只负责查看，不会执行 Office 宏，也不会把文档上传到远程服务。

活动栏中的 SoloView 图标会打开“最近打开”侧边栏。列表最多保留 12 个文档，点击即可重新打开；记录只保存在本机。

## 本地开发

```bash
npm install
npm run check
```

在 VS Code 中打开本目录，按 `F5` 启动 Extension Development Host，然后打开受支持的文档。

## 首版边界

- 提供统一的打开、缩放、重新载入和工作表切换体验。
- PDF、DOCX、XLSX、PPTX 使用独立渲染适配器。
- 复杂字体、Office 图表、动画、SmartArt 和第三方插件对象可能与桌面 Office 存在差异。
- `.doc`、`.ppt` 等旧二进制格式暂不支持。

技术调研见 [GitHub 文档查看方案调研](docs/research/github-document-viewer-landscape.md)。
