# VS Code 多格式文档查看插件 GitHub 调研报告

调研日期：2026-07-16

## 结论

这个产品可行，而且 GitHub 上已经有一个非常接近目标的成熟参考实现：[`cweijan/vscode-office`](https://github.com/cweijan/vscode-office)。它已经通过 VS Code Custom Editor 在编辑器标签页内支持 PDF、Word、Excel、PowerPoint 等格式，是最值得先读源码、验证体验的项目。

但不建议直接复制它的全部代码继续开发。更稳妥的产品架构是保留一个统一的 VS Code 阅读界面，在内部按格式接入四套渲染器：

- PDF：PDF.js
- DOCX：docxjs
- XLSX：SheetJS 解析，配合表格渲染层；若后续要深度编辑，可评估 Univer
- PPTX：独立 PPTX 渲染器；当前开源成熟度明显低于另外三类，应先做真实文件集验证

首版应明确定位为“本地、只读、统一查看器”。不要一开始承诺 Office 完整编辑或与 Microsoft Office 像素级一致，这会把项目从轻量 VS Code 插件变成一套 Office 引擎。

## 最值得参考的现成 VS Code 插件

### 1. cweijan/vscode-office：首选参考

- GitHub：[`cweijan/vscode-office`](https://github.com/cweijan/vscode-office)
- 当前约 1.5k Stars、205 Forks，MIT；仓库近期仍持续更新
- 已支持 `.pdf`、`.docx/.dotx`、`.xls/.xlsx/.xlsm/.csv/.ods`、`.pptx/.pptm`
- 使用 VS Code `contributes.customEditors` 注册二进制文档查看器
- 上游组合与本项目目标高度一致：PDF.js、docxjs、SheetJS + x-spreadsheet、pptxviewjs
- Excel 已支持保存，但项目明确警告保存 XLSX 可能丢失格式

它的价值不是某一个渲染算法，而是已经验证了完整的插件壳：文件关联、Custom Editor 生命周期、Webview、资源加载、消息通信、各格式路由和打包。它也是“一个插件、四种文档、一套打开方式”能够成立的直接证据。

需要注意：该项目目前还包含 Markdown、压缩包、图片、字体、Git History 等大量额外功能。若做新产品，不应继承这些无关范围；同时要逐项审计它的传递依赖和遥测实现，而不是只依据仓库的 MIT 主许可证。

### 2. tomoki1207/vscode-pdfviewer：PDF 插件结构参考

- GitHub：[`tomoki1207/vscode-pdfviewer`](https://github.com/tomoki1207/vscode-pdfviewer)
- 当前约 420 Stars、125 Forks
- 专注于在 VS Code 内预览 PDF
- 代码与功能范围小，适合阅读 PDF 文件关联和 Webview 集成方式

该仓库最后代码更新较久，适合作为结构参考，不适合作为整个产品的主基座。PDF 渲染本身应直接跟随 PDF.js 上游。

## 分格式方案评估

| 格式 | 推荐项目 | 成熟度判断 | 主要能力 | 主要缺口 |
|---|---|---:|---|---|
| PDF | [`mozilla/pdf.js`](https://github.com/mozilla/pdf.js) | 高 | 页面渲染、缩放、搜索、目录、密码文档、打印等 | 需正确打包 worker、字体、CMap 和 WASM 资源 |
| DOCX | [`VolodymyrBaydalka/docxjs`](https://github.com/VolodymyrBaydalka/docxjs) | 中高 | 浏览器中按 Word 页面布局渲染 DOCX | 复杂浮动布局、分页和特殊字体不能保证完全一致 |
| DOCX 备选 | [`mwilliamson/mammoth.js`](https://github.com/mwilliamson/mammoth.js) | 高，但目标不同 | 把 DOCX 转成语义化 HTML，适合阅读和内容抽取 | 不追求 Word 原版式，不适合高保真预览主路径 |
| XLSX | [`SheetJS/sheetjs`](https://github.com/SheetJS/sheetjs) + 表格 UI | 解析高、显示取决于 UI | 工作簿解析、单元格和工作表数据读取 | GitHub 镜像不是当前主开发入口；公式计算、图表和高保真样式需另补 |
| XLSX 深度能力 | [`dream-num/univer`](https://github.com/dream-num/univer) | 中高 | Web 端电子表格/文档/演示框架，编辑能力完整 | 体积和集成复杂度明显更高，首版只读查看可能过重 |
| PPTX | [`aiden0z/pptx-renderer`](https://github.com/aiden0z/pptx-renderer) | 新兴 | 浏览器原生解析 OOXML，HTML/SVG 渲染，强调形状和 SmartArt | 项目较新、采用面仍小，必须做文件集实测 |
| PPTX 旧参考 | [`meshesha/PPTXjs`](https://github.com/meshesha/PPTXjs) | 低 | PPTX 转 HTML | 多年未活跃、依赖 jQuery，不建议用于新产品主路径 |

### PDF

[`mozilla/pdf.js`](https://github.com/mozilla/pdf.js) 是毫无争议的首选：Apache-2.0、约 53.5k Stars，由 Mozilla 支持，也是 Firefox 内置 PDF 阅读器的基础。官方提供可直接集成的通用 Viewer 和 `pdfjs-dist` 包。产品层无需重新做分页、搜索、缩放、目录等基础阅读能力，只需把 Viewer 收敛成符合 VS Code 的界面。

推荐直接使用 PDF.js，而不是把另一个 VS Code PDF 插件作为运行时依赖。这样能减少版本滞后，并掌控 Content Security Policy、worker 和本地文件加载。

扫描型 PDF 还需要单独保证图像解码链路。PDF.js 5 及后续版本使用 WASM 解码 JPEG2000（`JPXDecode`）、JBIG2 和部分色彩空间；只复制 worker 并不足够。插件必须把 `pdfjs-dist/wasm` 作为 Webview 本地资源提供给 `getDocument({ wasmUrl })`，并在 CSP 中允许 `wasm-unsafe-eval`。CMap 与标准字体也应通过 `cMapUrl`、`standardFontDataUrl` 一并接线，避免扫描图层之外的文字层或混合型文档出现缺字。该约束已用 PDF.js issue #18457 的公开 JPEG2000 样本在 Chromium 中验证。

### DOCX

高保真预览优先选 [`docxjs`](https://github.com/VolodymyrBaydalka/docxjs)：Apache-2.0、约 2k Stars，近期仍活跃，目标就是在浏览器中渲染 DOCX。`vscode-office` 也明确采用它，说明这条组合路径已经过实际插件验证。

[`Mammoth.js`](https://github.com/mwilliamson/mammoth.js) 约 6.3k Stars、BSD-2-Clause，项目更成熟，但它的目标是生成干净、语义化的 HTML，而不是复刻 Word 页面。适合增加“专注阅读/无分页阅读”模式，不适合替代默认版式视图。

### Excel

Excel 应拆成“文件解析”和“表格呈现”两个职责。SheetJS 适合解析 `.xlsx/.xls/.csv`，但其 GitHub 仓库明确说明主开发已迁至自有 Git 服务，因此依赖版本、许可证与安全更新必须从实际发行源再次核对，不能只看 GitHub 镜像。

显示层可以参考 `vscode-office` 采用的 [`myliang/x-spreadsheet`](https://github.com/myliang/x-spreadsheet)，但该项目更新频率已降低。若产品只查看，建议做受控的虚拟化网格；若目标升级为接近 Excel 的编辑体验，再评估 Apache-2.0 的 [`Univer`](https://github.com/dream-num/univer)。已经归档的 Luckysheet 不应作为新项目基座。

必须提前定义“不支持”的边界：宏不执行、外部链接不自动访问、公式默认显示缓存结果、复杂图表和数据透视表可能降级。

### PowerPoint

PPTX 是最大风险项。旧项目 PPTXjs 已不活跃；`vscode-office` 使用的 `pptxviewjs` 能证明基本预览可行，但其上游透明度和生态规模不如 PDF.js/docxjs。

新项目 [`aiden0z/pptx-renderer`](https://github.com/aiden0z/pptx-renderer) 采用 Apache-2.0，目标是原生解析 Office Open XML 并用 HTML/SVG 渲染，对形状和 SmartArt 的覆盖声明较强，值得作为技术验证候选；但截至本次调研仅约 77 Stars，尚不能称为经过广泛生产验证的成熟基础设施。

因此 PPTX 应设置双路径：默认使用浏览器原生渲染器；若未来要求高保真，可选本地 LibreOffice 转 PDF 后交给 PDF.js。转换路径不应成为首版强依赖，因为它要求用户安装额外软件，且会增加启动时延和跨平台维护成本。

## 重型完整 Office 方案

若产品目标不是“查看”，而是完整编辑、批注与协作，可评估：

- [`ONLYOFFICE/DocumentServer`](https://github.com/ONLYOFFICE/DocumentServer)：约 6.7k Stars，支持 DOCX/XLSX/PPTX/PDF 查看与协作编辑，但需要独立服务，主项目为 AGPL-3.0；部署和商业授权边界远重于普通插件。
- [`CollaboraOnline/online`](https://github.com/CollaboraOnline/online)：LibreOffice 技术路线，适合自托管在线办公；GitHub 仓库只是 issue tracker，实际开发在 Gerrit，同样是服务端集成，不是轻量离线插件库。

这两套适合企业版或远程协作版，不适合本地轻量 MVP。

## 推荐产品架构

```text
VS Code CustomReadonlyEditorProvider
        │
        ├── 统一阅读器壳：工具栏、缩放、搜索、主题、错误状态
        │
        ├── PDF adapter  ── PDF.js
        ├── DOCX adapter ── docxjs
        ├── XLSX adapter ── parser + virtualized grid
        └── PPTX adapter ── PPTX renderer
```

采用 `CustomReadonlyEditorProvider` 是最合适的首版边界。VS Code 官方说明它面向二进制文件的只读自定义编辑器，仍可交互，但无需承担保存、撤销、热退出和多视图编辑同步的复杂度。每种格式只暴露统一能力：打开、缩放、搜索、页/工作表/幻灯片导航、复制、在系统应用中打开。

文件数据应留在本机：扩展侧读取 `Uint8Array`，通过 Webview 消息传递或受控资源 URI 交给渲染器；默认禁止上传、远程字体、外部图片和 Office 外部链接。Webview 必须使用严格 CSP、nonce，并限制 `localResourceRoots`。

对压缩型 Office Open XML 文件还要设置解压上限、文件大小上限和解析取消机制，防止 zip bomb 或超大文件拖死 Extension Host。宏格式 `.xlsm/.pptm` 可以只读打开，但绝不能执行宏。

## 建议实施顺序

1. 先克隆并运行 `cweijan/vscode-office`，用真实样本文档确认四种格式的用户体验与缺口。
2. 建立一个聚焦四种格式的 VS Code Custom Readonly Editor 壳，先接 PDF.js。
3. 接入 docxjs，并增加 Mammoth.js“专注阅读”模式的可行性实验。
4. 接入 XLSX 解析与虚拟化表格，只做查看、工作表切换和搜索。
5. 对 PPTX 同时验证 `pptxviewjs` 与 `pptx-renderer`，用固定测试集比较后再锁定实现。
6. 最后补统一搜索、快捷键、深浅主题、超大文件保护和安全测试。

测试集至少应覆盖：中英文字体、密码 PDF、百页 PDF、带批注 DOCX、复杂表格 DOCX、公式/合并单元格/图表 XLSX、母版/动画/SmartArt/嵌入媒体 PPTX，以及损坏文件和超大压缩文件。

## 最终建议

建议立项，但把第一阶段承诺收敛为：**在 VS Code 标签页内，本地、只读、统一地打开 PDF、DOCX、XLSX 和 PPTX，并提供稳定的基础阅读操作。**

技术上以 `cweijan/vscode-office` 为最重要的产品与插件结构参考，以各格式上游库作为实际依赖。PDF、DOCX、XLSX 可以较快达到可用；PPTX 应被当作单独的技术风险进行样本验收。只有当用户真实需求证明“编辑”不可缺少时，再引入 Univer 或 ONLYOFFICE/Collabora 这类重型方案。

## 调研口径与风险

- Star、Fork、Issue 和更新时间来自 2026-07-16 的 GitHub 页面/API 快照，会随时间变化。
- “成熟度”综合考虑采用面、维护活跃度、目标匹配、许可证与集成复杂度，不等同于 Star 排名。
- 本报告完成了仓库、README、主许可证和 VS Code 官方扩展模型核对；尚未对候选库做源码级安全审计、依赖许可证扫描和真实文档渲染对比。
- 在决定商业发布前，必须对最终锁定版本做完整 SBOM、传递许可证和漏洞审计，尤其是 SheetJS 发行源、PPTX 渲染依赖及任何字体资源。
