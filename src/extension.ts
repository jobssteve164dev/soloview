import * as vscode from 'vscode';
import { readFileSync } from 'node:fs';
import { documentTypeForPath } from './documentTypes.js';
import { RecentDocuments, type RecentDocument } from './recentDocuments.js';

export { documentTypeForPath } from './documentTypes.js';

const viewType = 'soloview.documentViewer';
const sidebarViewType = 'soloview.sidebar';
type Locale = 'zh' | 'en';

function resolveLocale(): Locale {
  const configured = vscode.workspace.getConfiguration('soloview').get<string>('language', 'auto').toLowerCase();
  if (configured === 'zh' || configured === 'zh-cn') return 'zh';
  if (configured === 'en') return 'en';
  return vscode.env.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function hostCopy() {
  return resolveLocale() === 'zh' ? {
  open: '打开文档', openInSoloView: '在 SoloView 中打开', supported: '支持的文档',
  clearQuestion: '清空 SoloView 最近打开记录？', clear: '清空', recent: '最近文件',
} : {
  open: 'Open Document', openInSoloView: 'Open in SoloView', supported: 'Supported documents',
  clearQuestion: 'Clear SoloView recent documents?', clear: 'Clear', recent: 'Recent Files',
};
}

class SoloViewDocument implements vscode.CustomDocument {
  constructor(readonly uri: vscode.Uri) {}
  dispose(): void {}
}

class SoloViewProvider implements vscode.CustomReadonlyEditorProvider<SoloViewDocument> {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onOpened: (uri: vscode.Uri) => void,
  ) {}

  openCustomDocument(uri: vscode.Uri): SoloViewDocument {
    return new SoloViewDocument(uri);
  }

  async resolveCustomEditor(document: SoloViewDocument, panel: vscode.WebviewPanel): Promise<void> {
    const type = documentTypeForPath(document.uri.path);
    if (type) {
      this.onOpened(document.uri);
    }
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
    };
    panel.webview.html = this.html(panel.webview, document.uri, type, resolveLocale());

    if (!type) {
      return;
    }

    const sendDocument = async (): Promise<void> => {
      try {
        const bytes = await vscode.workspace.fs.readFile(document.uri);
        await panel.webview.postMessage({
          kind: 'open',
          type,
          name: document.uri.path.split('/').pop() ?? 'Document',
          bytes,
        });
      } catch (error) {
        await panel.webview.postMessage({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unable to read the document.',
        });
      }
    };

    const messageSubscription = panel.webview.onDidReceiveMessage((message) => {
      if (message?.kind === 'ready' || message?.kind === 'reload') {
        void sendDocument();
      }
      if (message?.kind === 'openExternal') {
        void vscode.commands.executeCommand('revealFileInOS', document.uri);
      }
      if (message?.kind === 'setLanguage' && (message.locale === 'zh' || message.locale === 'en')) {
        void vscode.workspace.getConfiguration('soloview').update('language', message.locale, vscode.ConfigurationTarget.Global);
      }
    });

    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(document.uri.path.replace(/\/[^/]+$/, ''), document.uri.path.split('/').pop() ?? ''),
    );
    watcher.onDidChange(() => void sendDocument());
    panel.onDidDispose(() => {
      messageSubscription.dispose();
      watcher.dispose();
    });
  }

  private html(webview: vscode.Webview, uri: vscode.Uri, type: string | undefined, locale: 'zh' | 'en'): string {
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js'));
    const styles = readFileSync(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'viewer.css').fsPath, 'utf8');
    const worker = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'pdf.worker.min.mjs'));
    const nonce = crypto.randomUUID().replaceAll('-', '');
    const title = escapeHtml(uri.path.split('/').pop() ?? 'Document');
    const copy = locale === 'zh' ? {
      skip: '跳到文档内容', toolbar: '文档工具栏', zoomOut: '缩小', zoomIn: '放大', reload: '重新载入',
      reveal: '在文件夹中显示', sheets: '工作表', opening: '正在打开文档…', content: '文档内容',
      unsupported: 'SoloView 暂不支持这种文件格式。', language: '切换为英文', languageLabel: 'EN',
    } : {
      skip: 'Skip to document', toolbar: 'Document toolbar', zoomOut: 'Zoom out', zoomIn: 'Zoom in', reload: 'Reload',
      reveal: 'Show in folder', sheets: 'Worksheets', opening: 'Opening document…', content: 'Document content',
      unsupported: 'SoloView does not support this file format yet.', language: 'Switch to Chinese', languageLabel: '中文',
    };
    const unsupported = type ? '' : `<p class="error-copy" data-i18n="unsupported">${copy.unsupported}</p>`;
    return `<!doctype html>
<html lang="${locale === 'zh' ? 'zh-CN' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: blob:; font-src ${webview.cspSource} data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}' ${webview.cspSource}; worker-src ${webview.cspSource} blob:;">
  <style nonce="${nonce}">${styles}</style>
  <title>${title}</title>
</head>
<body data-pdf-worker="${worker}" data-initial-locale="${locale}">
  <a class="skip-link" href="#document-content" data-i18n="skip">${copy.skip}</a>
  <header class="toolbar" aria-label="${copy.toolbar}" data-i18n-aria="toolbar">
    <div class="document-identity">
      <span class="file-mark" aria-hidden="true">${(type ?? '?').toUpperCase()}</span>
      <span class="document-title" title="${title}">${title}</span>
    </div>
    <div class="toolbar-actions">
      <button id="zoom-out" type="button" aria-label="${copy.zoomOut}" data-i18n-aria="zoomOut">−</button>
      <output id="zoom-value" aria-live="polite">100%</output>
      <button id="zoom-in" type="button" aria-label="${copy.zoomIn}" data-i18n-aria="zoomIn">+</button>
      <button id="reload" type="button" data-i18n="reload">${copy.reload}</button>
      <button id="open-external" type="button" data-i18n="reveal">${copy.reveal}</button>
      <button id="language-toggle" class="language-toggle" type="button" aria-label="${copy.language}" data-i18n-aria="language">${copy.languageLabel}</button>
    </div>
  </header>
  <div id="sheet-tabs" class="sheet-tabs" role="tablist" aria-label="${copy.sheets}" data-i18n-aria="sheets" hidden></div>
  <main id="document-content" tabindex="-1">
    <section id="status" class="status" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <p data-i18n="opening">${copy.opening}</p>
      ${unsupported}
    </section>
    <div id="viewer" class="viewer" aria-label="${copy.content}" data-i18n-aria="content"></div>
  </main>
  <script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
  }
}

class RecentDocumentsProvider implements vscode.TreeDataProvider<RecentDocument> {
  private readonly changes = new vscode.EventEmitter<RecentDocument | undefined>();
  readonly onDidChangeTreeData = this.changes.event;

  constructor(private readonly recent: RecentDocuments) {}

  refresh(): void {
    this.changes.fire(undefined);
  }

  getChildren(): RecentDocument[] {
    return this.recent.list();
  }

  getTreeItem(document: RecentDocument): vscode.TreeItem {
    const uri = vscode.Uri.parse(document.uri);
    const item = new vscode.TreeItem(document.name, vscode.TreeItemCollapsibleState.None);
    item.resourceUri = uri;
    item.description = document.parentPath.split('/').filter(Boolean).pop() ?? '';
    item.tooltip = new vscode.MarkdownString(`**${escapeMarkdown(document.name)}**\n\n${escapeMarkdown(uri.fsPath || uri.path)}`);
    item.command = {
      command: 'vscode.openWith',
      title: hostCopy().open,
      arguments: [uri, viewType],
    };
    item.contextValue = 'soloview.recentDocument';
    return item;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}\[\]()<>#+\-.!]/g, '\\$&');
}

function recentDocumentForUri(uri: vscode.Uri): RecentDocument {
  const parts = uri.path.split('/');
  const name = parts.pop() || '文档';
  const parentPath = parts.join('/') || '/';
  return { uri: uri.toString(), name, parentPath, openedAt: Date.now() };
}

export function activate(context: vscode.ExtensionContext): void {
  const recent = new RecentDocuments(context.globalState);
  const recentProvider = new RecentDocumentsProvider(recent);
  const recentView = vscode.window.createTreeView(sidebarViewType, { treeDataProvider: recentProvider });
  const localizeSidebar = (): void => {
    recentView.title = 'SoloView';
    recentView.description = hostCopy().recent;
    recentProvider.refresh();
  };
  localizeSidebar();
  const recordOpened = (uri: vscode.Uri): void => {
    void recent.add(recentDocumentForUri(uri)).then(() => recentProvider.refresh());
  };

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(viewType, new SoloViewProvider(context, recordOpened), {
      supportsMultipleEditorsPerDocument: true,
      webviewOptions: { retainContextWhenHidden: true },
    }),
    recentView,
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('soloview.language')) localizeSidebar();
    }),
    vscode.commands.registerCommand('soloview.openDocument', async () => {
      const selected = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: hostCopy().openInSoloView,
        filters: {
          [hostCopy().supported]: ['pdf', 'docx', 'xlsx', 'xls', 'csv', 'pptx'],
        },
      });
      const uri = selected?.[0];
      if (uri) {
        await vscode.commands.executeCommand('vscode.openWith', uri, viewType);
      }
    }),
    vscode.commands.registerCommand('soloview.clearRecent', async () => {
      if (recent.list().length === 0) return;
      const copy = hostCopy();
      const answer = await vscode.window.showInformationMessage(copy.clearQuestion, { modal: true }, copy.clear);
      if (answer === copy.clear) {
        await recent.clear();
        recentProvider.refresh();
      }
    }),
  );
}

export function deactivate(): void {}
