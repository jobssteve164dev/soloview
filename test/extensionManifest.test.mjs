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

test('每个需要扩展宿主代码的入口都有显式激活事件', () => {
  const activationEvents = new Set(manifest.activationEvents);

  assert.ok(activationEvents.has('onView:soloview.recentDocuments'));
  assert.ok(activationEvents.has('onCommand:soloview.openDocument'));
  assert.ok(activationEvents.has('onCommand:soloview.clearRecent'));
  assert.ok(activationEvents.has('onCustomEditor:soloview.documentViewer'));
});

test('活动栏使用 24 像素单色实心 SVG 图标', () => {
  const container = manifest.contributes.viewsContainers.activitybar.find(
    ({ id }) => id === 'soloview.sidebar',
  );

  assert.equal(container?.icon, 'resources/activitybar.svg');
  const view = manifest.contributes.views['soloview.sidebar'].find(
    ({ id }) => id === 'soloview.recentDocuments',
  );
  assert.equal(view?.icon, 'resources/activitybar.svg');
  assert.match(activityBarIcon, /width="24" height="24" viewBox="0 0 24 24"/);
  assert.match(activityBarIcon, /fill="#FFFFFF"/);
  assert.doesNotMatch(activityBarIcon, /stroke=/);
});
