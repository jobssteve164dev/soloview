import * as vscode from 'vscode';
import { documentTypeForPath } from './documentTypes.js';

export { documentTypeForPath } from './documentTypes.js';

const viewType = 'soloview.documentViewer';

class SoloViewDocument implements vscode.CustomDocument {
  constructor(readonly uri: vscode.Uri) {}
  dispose(): void {}
}

class SoloViewProvider implements vscode.CustomReadonlyEditorProvider<SoloViewDocument> {
  constructor(private readonly context: vscode.ExtensionContext) {}

  openCustomDocument(uri: vscode.Uri): SoloViewDocument {
    return new SoloViewDocument(uri);
  }

  async resolveCustomEditor(document: SoloViewDocument, panel: vscode.WebviewPanel): Promise<void> {
    const type = documentTypeForPath(document.uri.path);
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(viewType, new SoloViewProvider(context), {
      supportsMultipleEditorsPerDocument: true,
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );
}

export function deactivate(): void {}
