import assert from 'node:assert/strict';
import test from 'node:test';
import recentModule from '../dist/recentDocuments.cjs';

const { RecentDocuments } = recentModule;

class MemoryState {
  values = new Map();
  get(key, fallback) { return this.values.has(key) ? this.values.get(key) : fallback; }
  async update(key, value) { this.values.set(key, value); }
}

const item = (name, openedAt) => ({
  uri: `file:///workspace/${name}`,
  name,
  parentPath: '/workspace',
  openedAt,
});

test('keeps the newest document first and removes duplicate paths', async () => {
  const recent = new RecentDocuments(new MemoryState());
  await recent.add(item('brief.pdf', 1));
  await recent.add(item('sheet.xlsx', 2));
  await recent.add(item('brief.pdf', 3));
  assert.deepEqual(recent.list().map(({ name }) => name), ['brief.pdf', 'sheet.xlsx']);
});

test('keeps only the configured number of documents', async () => {
  const recent = new RecentDocuments(new MemoryState(), 2);
  await recent.add(item('one.pdf', 1));
  await recent.add(item('two.pdf', 2));
  await recent.add(item('three.pdf', 3));
  assert.deepEqual(recent.list().map(({ name }) => name), ['three.pdf', 'two.pdf']);
});

test('clears saved history', async () => {
  const recent = new RecentDocuments(new MemoryState());
  await recent.add(item('brief.pdf', 1));
  await recent.clear();
  assert.deepEqual(recent.list(), []);
});
