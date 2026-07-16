import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifest = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
const activityBarIcon = await readFile(
  new URL('../resources/activitybar.svg', import.meta.url),
  'utf8',
);
const extensionSource = await readFile(
  new URL('../src/extension.ts', import.meta.url),
  'utf8',
);
const webviewSource = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
const viewerStyles = await readFile(new URL('../src/webview/viewer.css', import.meta.url), 'utf8');
const english = JSON.parse(await readFile(new URL('../package.nls.json', import.meta.url), 'utf8'));
const chinese = JSON.parse(await readFile(new URL('../package.nls.zh-cn.json', import.meta.url), 'utf8'));

test('每个需要扩展宿主代码的入口都有显式激活事件', () => {
  const activationEvents = new Set(manifest.activationEvents);

  assert.ok(activationEvents.has('onView:soloview.sidebar'));
  assert.ok(activationEvents.has('onCommand:soloview.openDocument'));
  assert.ok(activationEvents.has('onCommand:soloview.clearRecent'));
  assert.ok(activationEvents.has('onCustomEditor:soloview.documentViewer'));
});

test('侧边栏沿用 SoloMap 已验证的容器、视图与主题图标结构', () => {
  const container = manifest.contributes.viewsContainers.activitybar.find(
    ({ id }) => id === 'soloview-sidebar-container',
  );

  assert.equal(container?.icon, 'resources/activitybar.svg');
  const view = manifest.contributes.views['soloview-sidebar-container'].find(
    ({ id }) => id === 'soloview.sidebar',
  );
  assert.equal(view?.name, '%view.recent%');
  assert.equal(manifest.contributes.viewsWelcome[0].view, 'soloview.sidebar');
  assert.match(extensionSource, /const sidebarViewType = 'soloview\.sidebar'/);
  assert.match(extensionSource, /registerTreeDataProvider\(sidebarViewType, recentProvider\)/);
  assert.match(activityBarIcon, /width="24" height="24" viewBox="0 0 24 24"/);
  assert.match(activityBarIcon, /stroke="currentColor"/);
  assert.doesNotMatch(activityBarIcon, /#[\dA-Fa-f]{3,8}/);
});

test('市场信息与 VS Code 原生界面提供完整中英文资源', () => {
  assert.equal(manifest.icon, 'resources/soloview-market.png');
  assert.equal(manifest.description, '%extension.description%');
  assert.deepEqual(Object.keys(chinese).sort(), Object.keys(english).sort());
  assert.match(english['extension.description'], /local-first/i);
  assert.match(chinese['extension.description'], /本地优先/);
  assert.equal(english['view.recent'], 'Recent Documents');
  assert.equal(chinese['view.recent'], '最近打开');
});

test('文档查看器提供可记忆的中英文切换', () => {
  assert.match(extensionSource, /id="language-toggle"/);
  assert.match(extensionSource, /data-initial-locale/);
  assert.match(webviewSource, /getState\(\)\?\.locale/);
  assert.match(webviewSource, /setState\(\{ locale \}\)/);
  assert.match(webviewSource, /languageLabel: 'EN'/);
  assert.match(webviewSource, /languageLabel: '中文'/);
});

test('文档查看器只在多工作表时显示标签栏，工具栏两侧保留安全边距', () => {
  assert.match(viewerStyles, /\.sheet-tabs\[hidden\]\s*\{\s*display:\s*none;/);
  assert.match(viewerStyles, /gap:\s*16px;\s*padding:\s*0 16px;/);
  assert.match(viewerStyles, /padding:\s*8px 12px;/);
});
