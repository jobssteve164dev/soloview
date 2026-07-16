import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import { renderAsync as renderDocx } from 'docx-preview';
import * as XLSX from 'xlsx';
import { PptxViewer, RECOMMENDED_ZIP_LIMITS } from '@aiden0z/pptx-renderer';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

type OpenMessage = {
  kind: 'open';
  type: 'pdf' | 'docx' | 'xlsx' | 'xls' | 'csv' | 'pptx';
  name: string;
  bytes: Uint8Array | { data: number[] } | number[];
};

const vscode = acquireVsCodeApi();
const viewer = requiredElement<HTMLDivElement>('viewer');
const status = requiredElement<HTMLElement>('status');
const tabs = requiredElement<HTMLDivElement>('sheet-tabs');
const zoomValue = requiredElement<HTMLOutputElement>('zoom-value');
let zoom = 1;
let renderGeneration = 0;

GlobalWorkerOptions.workerSrc = document.body.dataset.pdfWorker ?? '';

requiredElement<HTMLButtonElement>('zoom-in').addEventListener('click', () => setZoom(zoom + 0.1));
requiredElement<HTMLButtonElement>('zoom-out').addEventListener('click', () => setZoom(zoom - 0.1));
requiredElement<HTMLButtonElement>('reload').addEventListener('click', () => vscode.postMessage({ kind: 'reload' }));
requiredElement<HTMLButtonElement>('open-external').addEventListener('click', () => vscode.postMessage({ kind: 'openExternal' }));

window.addEventListener('message', (event: MessageEvent<OpenMessage | { kind: 'error'; message: string }>) => {
  if (event.data.kind === 'error') {
    showError(event.data.message);
    return;
  }
  if (event.data.kind === 'open') {
    void openDocument(event.data);
  }
});

async function openDocument(message: OpenMessage): Promise<void> {
  const generation = ++renderGeneration;
  status.hidden = false;
  status.innerHTML = '<div class="spinner" aria-hidden="true"></div><p>正在打开文档…</p>';
  viewer.replaceChildren();
  tabs.replaceChildren();
  tabs.hidden = true;
  setZoom(1);

  try {
    const bytes = normalizeBytes(message.bytes);
    if (message.type === 'pdf') await showPdf(bytes, generation);
    else if (message.type === 'docx') await renderDocx(bytes.buffer, viewer, undefined, { inWrapper: true, breakPages: true });
    else if (message.type === 'pptx') await PptxViewer.open(bytes, viewer, {
      renderMode: 'list',
      fitMode: 'contain',
      zipLimits: RECOMMENDED_ZIP_LIMITS,
    });
    else showWorkbook(bytes, message.type);
    if (generation === renderGeneration) status.hidden = true;
  } catch (error) {
    if (generation === renderGeneration) {
      showError(error instanceof Error ? error.message : '文档无法打开。');
    }
  }
}

async function showPdf(bytes: Uint8Array, generation: number): Promise<void> {
  const pdf = await getDocument({ data: bytes }).promise;
  const fragment = document.createDocumentFragment();
  for (let number = 1; number <= pdf.numPages; number += 1) {
    if (generation !== renderGeneration) return;
    const page = await pdf.getPage(number);
    const viewport = page.getViewport({ scale: 1.35 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.className = 'pdf-page';
    canvas.setAttribute('aria-label', `第 ${number} 页，共 ${pdf.numPages} 页`);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('当前环境无法创建 PDF 画布。');
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    fragment.append(canvas);
  }
  viewer.append(fragment);
}

function showWorkbook(bytes: Uint8Array, type: 'xlsx' | 'xls' | 'csv'): void {
  const workbook = XLSX.read(bytes, { type: 'array' });
  const renderSheet = (name: string): void => {
    const sheet = workbook.Sheets[name];
    if (!sheet) return;
    viewer.innerHTML = XLSX.utils.sheet_to_html(sheet, { id: 'workbook-table' });
    tabs.querySelectorAll('button').forEach((button) => {
      const selected = button.textContent === name;
      button.setAttribute('aria-selected', String(selected));
      button.classList.toggle('active', selected);
    });
  };

  tabs.hidden = workbook.SheetNames.length < 2;
  workbook.SheetNames.forEach((name) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.textContent = name;
    button.addEventListener('click', () => renderSheet(name));
    tabs.append(button);
  });
  const first = workbook.SheetNames[0];
  if (!first) throw new Error(`${type.toUpperCase()} 文件中没有可显示的工作表。`);
  renderSheet(first);
}

function setZoom(next: number): void {
  zoom = Math.min(2.5, Math.max(0.5, Math.round(next * 10) / 10));
  viewer.style.setProperty('--viewer-zoom', String(zoom));
  zoomValue.value = `${Math.round(zoom * 100)}%`;
}

function showError(message: string): void {
  status.hidden = false;
  status.innerHTML = `<div class="error-symbol" aria-hidden="true">!</div><h1>无法打开这个文档</h1><p>${escapeHtml(message)}</p><button id="retry" type="button">重新尝试</button>`;
  requiredElement<HTMLButtonElement>('retry').addEventListener('click', () => vscode.postMessage({ kind: 'reload' }));
}

function normalizeBytes(value: OpenMessage['bytes']): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return new Uint8Array(value);
  return new Uint8Array(value.data);
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`缺少界面元素：${id}`);
  return element as T;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

vscode.postMessage({ kind: 'ready' });
