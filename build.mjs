import { build, context } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const shared = { bundle: true, sourcemap: false, logLevel: 'info' };
const builds = [
  {
    ...shared,
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
    platform: 'node',
    format: 'cjs',
    external: ['vscode'],
  },
  {
    ...shared,
    entryPoints: ['src/webview/main.ts'],
    outfile: 'dist/webview.js',
    platform: 'browser',
    format: 'iife',
  },
  {
    ...shared,
    entryPoints: ['src/documentTypes.ts'],
    outfile: 'dist/documentTypes.cjs',
    platform: 'node',
    format: 'cjs',
  },
  {
    ...shared,
    entryPoints: ['src/recentDocuments.ts'],
    outfile: 'dist/recentDocuments.cjs',
    platform: 'node',
    format: 'cjs',
  },
];

await mkdir('dist', { recursive: true });
await cp('src/webview/viewer.css', 'dist/viewer.css');
await cp('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'dist/pdf.worker.min.mjs');
await Promise.all([
  cp('node_modules/pdfjs-dist/wasm', 'dist/pdfjs/wasm', { recursive: true }),
  cp('node_modules/pdfjs-dist/cmaps', 'dist/pdfjs/cmaps', { recursive: true }),
  cp('node_modules/pdfjs-dist/standard_fonts', 'dist/pdfjs/standard_fonts', { recursive: true }),
]);

if (watch) {
  const contexts = await Promise.all(builds.map((options) => context(options)));
  await Promise.all(contexts.map((item) => item.watch()));
  console.log('SoloView 正在监听源码变化。');
} else {
  await Promise.all(builds.map((options) => build(options)));
}
