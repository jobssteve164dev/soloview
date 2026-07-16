import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifest = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);

test('每个需要扩展宿主代码的入口都有显式激活事件', () => {
  const activationEvents = new Set(manifest.activationEvents);

  assert.ok(activationEvents.has('onView:soloview.recentDocuments'));
  assert.ok(activationEvents.has('onCommand:soloview.openDocument'));
  assert.ok(activationEvents.has('onCommand:soloview.clearRecent'));
  assert.ok(activationEvents.has('onCustomEditor:soloview.documentViewer'));
});
