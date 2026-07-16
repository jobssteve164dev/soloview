const assert = require('node:assert/strict');
const vscode = require('vscode');

async function run() {
  const extension = vscode.extensions.getExtension('SZLK.soloview');
  assert.ok(extension, 'SoloView extension is visible to the Extension Host');

  await extension.activate();
  assert.equal(extension.isActive, true, 'SoloView extension activates');

  const commands = await vscode.commands.getCommands(true);
  assert.ok(
    commands.includes('workbench.view.extension.soloview-sidebar-container'),
    'VS Code registers the SoloView activity bar container command',
  );

  await vscode.commands.executeCommand('workbench.view.extension.soloview-sidebar-container');
  await new Promise((resolve) => setTimeout(resolve, 500));
}

module.exports = { run };
