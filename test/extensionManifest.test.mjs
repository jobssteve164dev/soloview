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
const buildSource = await readFile(new URL('../build.mjs', import.meta.url), 'utf8');
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
  assert.equal(view?.name, 'SoloView');
  assert.equal(manifest.contributes.viewsWelcome[0].view, 'soloview.sidebar');
  assert.match(extensionSource, /const sidebarViewType = 'soloview\.sidebar'/);
  assert.match(extensionSource, /createTreeView\(sidebarViewType, \{ treeDataProvider: recentProvider \}\)/);
  assert.match(extensionSource, /recentView\.title = 'SoloView'/);
  assert.match(extensionSource, /recentView\.description = hostCopy\(\)\.recent/);
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
  assert.match(webviewSource, /kind: 'setLanguage', locale: next/);
  assert.equal(manifest.contributes.configuration.properties['soloview.language'].default, 'auto');
  assert.match(extensionSource, /affectsConfiguration\('soloview\.language'\)/);
});

test('文档查看器首屏样式同步注入，页面壳完整覆盖 Webview', () => {
  assert.match(viewerStyles, /\.sheet-tabs\[hidden\]\s*\{\s*display:\s*none;/);
  assert.match(extensionSource, /readFileSync\([\s\S]*viewer\.css/);
  assert.match(extensionSource, /<style nonce="\$\{nonce\}">\$\{styles\}<\/style>/);
  assert.doesNotMatch(extensionSource, /<link rel="stylesheet"/);
  assert.match(viewerStyles, /html, body \{ width:\s*100%; height:\s*100%; margin:\s*0; padding:\s*0;/);
  assert.match(viewerStyles, /body \{ width:\s*100vw; height:\s*100vh; overflow:\s*hidden;/);
  assert.match(viewerStyles, /min-height:\s*100%;\s*padding:\s*24px;/);
});

test('PDF 查看器带齐扫描件解码资源并允许 PDF.js 执行 WASM', () => {
  assert.match(buildSource, /pdfjs-dist\/wasm[\s\S]*dist\/pdfjs\/wasm/);
  assert.match(buildSource, /pdfjs-dist\/cmaps[\s\S]*dist\/pdfjs\/cmaps/);
  assert.match(buildSource, /pdfjs-dist\/standard_fonts[\s\S]*dist\/pdfjs\/standard_fonts/);
  assert.match(extensionSource, /data-pdf-resource-root="\$\{pdfResourceRoot\}"/);
  assert.match(extensionSource, /script-src[^;]*'wasm-unsafe-eval'/);
  assert.match(webviewSource, /cMapUrl: `\$\{resourceRoot\}\/cmaps\/`/);
  assert.match(webviewSource, /standardFontDataUrl: `\$\{resourceRoot\}\/standard_fonts\/`/);
  assert.match(webviewSource, /wasmUrl: `\$\{resourceRoot\}\/wasm\/`/);
});
