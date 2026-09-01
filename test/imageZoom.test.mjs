import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

class FakeStyle {
  width = '';
  properties = new Map();

  setProperty(name, value) {
    this.properties.set(name, value);
  }
}

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.children = [];
    this.dataset = {};
    this.hidden = false;
    this.innerHTML = '';
    this.options = [];
    this.style = new FakeStyle();
    this.value = '';
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  append(child) {
    this.children.push(child);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  querySelectorAll() {
    return [];
  }

  click() {
    this.listeners.get('click')?.();
  }
}

class FakeImage extends FakeElement {
  naturalWidth = 1600;

  set src(value) {
    this.source = value;
    queueMicrotask(() => this.listeners.get('load')?.());
  }
}

test('图片缩放按适配窗口后的宽度真实改变显示尺寸', async () => {
  const ids = [
    'viewer', 'status', 'sheet-tabs', 'zoom-value', 'csv-encoding-control', 'csv-encoding',
    'zoom-in', 'zoom-out', 'reload', 'open-external', 'language-toggle',
  ];
  const elements = new Map(ids.map((id) => [id, new FakeElement(id)]));
  elements.get('viewer').clientWidth = 648;
  let messageListener;
  let resizeListener;

  globalThis.acquireVsCodeApi = () => ({
    getState: () => undefined,
    postMessage: () => undefined,
    setState: () => undefined,
  });
  globalThis.document = {
    body: { dataset: { initialLocale: 'zh' } },
    documentElement: { lang: '' },
    getElementById: (id) => elements.get(id),
    querySelectorAll: () => [],
  };
  globalThis.window = {
    addEventListener: (type, listener) => {
      if (type === 'message') messageListener = listener;
      if (type === 'resize') resizeListener = listener;
    },
  };
  globalThis.Image = FakeImage;
  globalThis.getComputedStyle = () => ({ paddingLeft: '24px', paddingRight: '24px' });

  const viewerStyles = await readFile(new URL('../dist/viewer.css', import.meta.url), 'utf8');
  assert.match(viewerStyles, /\.viewer > :not\(\.image-preview\)\s*\{\s*zoom:\s*var\(--viewer-zoom\)/);

  await import(`../dist/webview/main.js?image-zoom=${Date.now()}`);
  messageListener({ data: { kind: 'open', type: 'png', name: 'large.png', src: 'large.png' } });
  await new Promise((resolve) => setImmediate(resolve));

  const image = elements.get('viewer').children[0];
  assert.equal(image.style.width, '600px');

  for (let index = 0; index < 5; index += 1) elements.get('zoom-in').click();
  assert.equal(elements.get('zoom-value').value, '150%');
  assert.equal(image.style.width, '900px');

  for (let index = 0; index < 10; index += 1) elements.get('zoom-out').click();
  assert.equal(elements.get('zoom-value').value, '50%');
  assert.equal(image.style.width, '300px');

  elements.get('viewer').clientWidth = 448;
  resizeListener();
  assert.equal(image.style.width, '200px');
});
