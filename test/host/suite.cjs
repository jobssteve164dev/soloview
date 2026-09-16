const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, unlink, writeFile } = require('node:fs/promises');
const net = require('node:net');
const path = require('node:path');
const vscode = require('vscode');

async function run() {
  const extension = vscode.extensions.getExtension('SZLK.soloview');
  assert.ok(extension, 'SoloView extension is visible to the Extension Host');

  const api = await extension.activate();
  assert.equal(extension.isActive, true, 'SoloView extension activates');
  assert.equal(typeof api?.onDidRenderPreview, 'function', 'SoloView exposes completed preview events');

  const commands = await vscode.commands.getCommands(true);
  assert.ok(
    commands.includes('workbench.view.extension.soloview-sidebar-container'),
    'VS Code registers the SoloView activity bar container command',
  );

  await vscode.commands.executeCommand('workbench.view.extension.soloview-sidebar-container');
  await new Promise((resolve) => setTimeout(resolve, 500));

  let outboundConnections = 0;
  const networkSink = net.createServer((socket) => {
    outboundConnections += 1;
    socket.destroy();
  });
  const fixtureRoot = path.join(extension.extensionPath, 'test', 'fixtures', 'html-preview');
  const fixtureId = `soloview-html-${randomUUID()}`;
  const htmlPath = path.join(fixtureRoot, `${fixtureId}.html`);
  const stylesheetName = `${fixtureId}.css`;
  const stylesheetPath = path.join(fixtureRoot, stylesheetName);
  let htmlFixture;
  let renderSubscription;
  let renderTimeout;
  try {
    await new Promise((resolve, reject) => {
      networkSink.once('error', reject);
      networkSink.listen(0, '127.0.0.1', resolve);
    });
    const sinkAddress = networkSink.address();
    assert.ok(sinkAddress && typeof sinkAddress !== 'string', 'network sink has a local port');
    const sinkUrl = `http://127.0.0.1:${sinkAddress.port}`;
    const htmlTemplate = await readFile(path.join(fixtureRoot, 'index.html'), 'utf8');
    const stylesheetTemplate = await readFile(path.join(fixtureRoot, 'styles.css'), 'utf8');
    await writeFile(
      htmlPath,
      htmlTemplate.replaceAll('{{NETWORK_SINK}}', sinkUrl).replace('styles.css', stylesheetName),
      'utf8',
    );
    await writeFile(stylesheetPath, stylesheetTemplate.replaceAll('{{NETWORK_SINK}}', sinkUrl), 'utf8');
    htmlFixture = vscode.Uri.file(htmlPath);
    const rendered = new Promise((resolve, reject) => {
      renderTimeout = setTimeout(() => reject(new Error('HTML preview did not finish rendering')), 5_000);
      renderSubscription = api.onDidRenderPreview((preview) => {
        if (preview.uri.toString() !== htmlFixture.toString()) return;
        clearTimeout(renderTimeout);
        renderSubscription.dispose();
        resolve(preview);
      });
    });
    await vscode.commands.executeCommand('vscode.open', htmlFixture);
    const preview = await rendered;
    assert.ok(preview.localStylesheets > 0, 'HTML preview loads its local stylesheet');
    assert.equal(preview.headingText, 'HTML preview', 'HTML preview renders its body content');
    assert.equal(preview.bodyMargin, '0px', 'HTML preview applies its local stylesheet');
    assert.equal(preview.activeContentExecuted, false, 'HTML preview does not execute scripts');
    assert.equal(preview.navigableElements, 0, 'HTML preview removes navigable links and refreshes');
    assert.equal(preview.stayedOnPreview, true, 'HTML preview stays on its generated document');
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(outboundConnections, 0, 'HTML preview does not open outbound connections');

    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    assert.ok(activeTab?.input instanceof vscode.TabInputCustom, 'HTML preview opens in a custom editor tab');
    assert.equal(activeTab.input.viewType, 'soloview.documentViewer', 'SoloView owns the HTML preview tab');
    assert.equal(activeTab.input.uri.toString(), htmlFixture.toString(), 'SoloView previews the selected HTML file');
  } finally {
    clearTimeout(renderTimeout);
    renderSubscription?.dispose();
    const cleanupErrors = [];
    const clean = async (operation) => {
      try {
        await operation();
      } catch (error) {
        cleanupErrors.push(error);
      }
    };
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (htmlFixture && activeTab?.input instanceof vscode.TabInputCustom
      && activeTab.input.uri.toString() === htmlFixture.toString()) {
      await clean(() => vscode.commands.executeCommand('workbench.action.closeActiveEditor'));
    }
    if (networkSink.listening) {
      await clean(() => new Promise((resolve, reject) => networkSink.close((error) => (
        error ? reject(error) : resolve()
      ))));
    }
    await clean(() => unlinkIfPresent(htmlPath));
    await clean(() => unlinkIfPresent(stylesheetPath));
    if (cleanupErrors.length > 0) throw new AggregateError(cleanupErrors, 'HTML preview test cleanup failed');
  }
}

async function unlinkIfPresent(filePath) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

module.exports = { run };
