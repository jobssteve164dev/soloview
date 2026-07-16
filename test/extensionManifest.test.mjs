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
  assert.equal(view?.name, '最近打开');
  assert.equal(manifest.contributes.viewsWelcome[0].view, 'soloview.sidebar');
  assert.match(extensionSource, /const sidebarViewType = 'soloview\.sidebar'/);
  assert.match(extensionSource, /registerTreeDataProvider\(sidebarViewType, recentProvider\)/);
  assert.match(activityBarIcon, /width="24" height="24" viewBox="0 0 24 24"/);
  assert.match(activityBarIcon, /stroke="currentColor"/);
  assert.doesNotMatch(activityBarIcon, /#[\dA-Fa-f]{3,8}/);
});
