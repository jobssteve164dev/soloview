import * as vscode from 'vscode';
import { documentTypeForPath } from './documentTypes.js';
import { RecentDocuments, type RecentDocument } from './recentDocuments.js';

export { documentTypeForPath } from './documentTypes.js';

const viewType = 'soloview.documentViewer';
const sidebarViewType = 'soloview.sidebar';

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
    panel.webview.html = this.html(panel.webview, document.uri, type);

    if (!type) {
      return;
    }

    const sendDocument = async (): Promise<void> => {
      try {
        const bytes = await vscode.workspace.fs.readFile(document.uri);
        await panel.webview.postMessage({
          kind: 'open',
          type,
          name: document.uri.path.split('/').pop() ?? '文档',
          bytes,
        });
      } catch (error) {
        await panel.webview.postMessage({
          kind: 'error',
          message: error instanceof Error ? error.message : '无法读取文档。',
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

  private html(webview: vscode.Webview, uri: vscode.Uri, type: string | undefined): string {
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js'));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'viewer.css'));
    const worker = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'pdf.worker.min.mjs'));
    const nonce = crypto.randomUUID().replaceAll('-', '');
    const title = escapeHtml(uri.path.split('/').pop() ?? '文档');
    const unsupported = type ? '' : '<p class="error-copy">SoloView 暂不支持这种文件格式。</p>';
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: blob:; font-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; worker-src ${webview.cspSource} blob:;">
  <link rel="stylesheet" href="${style}">
  <title>${title}</title>
</head>
<body data-pdf-worker="${worker}">
  <a class="skip-link" href="#document-content">跳到文档内容</a>
  <header class="toolbar" aria-label="文档工具栏">
    <div class="document-identity">
      <span class="file-mark" aria-hidden="true">${(type ?? '?').toUpperCase()}</span>
      <span class="document-title" title="${title}">${title}</span>
    </div>
    <div class="toolbar-actions">
      <button id="zoom-out" type="button" aria-label="缩小">−</button>
      <output id="zoom-value" aria-live="polite">100%</output>
      <button id="zoom-in" type="button" aria-label="放大">+</button>
      <button id="reload" type="button">重新载入</button>
      <button id="open-external" type="button">在文件夹中显示</button>
    </div>
  </header>
  <div id="sheet-tabs" class="sheet-tabs" role="tablist" aria-label="工作表" hidden></div>
  <main id="document-content" tabindex="-1">
    <section id="status" class="status" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <p>正在打开文档…</p>
      ${unsupported}
    </section>
    <div id="viewer" class="viewer" aria-label="文档内容"></div>
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
      title: '打开文档',
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
  const recordOpened = (uri: vscode.Uri): void => {
    void recent.add(recentDocumentForUri(uri)).then(() => recentProvider.refresh());
  };

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(viewType, new SoloViewProvider(context, recordOpened), {
      supportsMultipleEditorsPerDocument: true,
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.registerTreeDataProvider(sidebarViewType, recentProvider),
    vscode.commands.registerCommand('soloview.openDocument', async () => {
      const selected = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: '在 SoloView 中打开',
        filters: {
          '支持的文档': ['pdf', 'docx', 'xlsx', 'xls', 'csv', 'pptx'],
        },
      });
      const uri = selected?.[0];
      if (uri) {
        await vscode.commands.executeCommand('vscode.openWith', uri, viewType);
      }
    }),
    vscode.commands.registerCommand('soloview.clearRecent', async () => {
      if (recent.list().length === 0) return;
      const answer = await vscode.window.showInformationMessage('清空 SoloView 最近打开记录？', { modal: true }, '清空');
      if (answer === '清空') {
        await recent.clear();
        recentProvider.refresh();
      }
    }),
  );
}

export function deactivate(): void {}
