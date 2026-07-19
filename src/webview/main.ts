export {};

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): { locale?: Locale } | undefined;
  setState(state: { locale: Locale }): void;
};

type Locale = 'zh' | 'en';

const messages = {
  zh: {
    skip: '跳到文档内容', toolbar: '文档工具栏', zoomOut: '缩小', zoomIn: '放大', reload: '重新载入',
    reveal: '在文件夹中显示', sheets: '工作表', opening: '正在打开文档…', content: '文档内容',
    unsupported: 'SoloView 暂不支持这种文件格式。', language: '切换为英文', languageLabel: 'EN',
    openFailed: '无法打开这个文档', retry: '重新尝试', genericError: '文档无法打开。',
    canvasError: '当前环境无法创建 PDF 画布。', emptyWorkbook: '文件中没有可显示的工作表。',
    page: (number: number, total: number) => `第 ${number} 页，共 ${total} 页`,
  },
  en: {
    skip: 'Skip to document', toolbar: 'Document toolbar', zoomOut: 'Zoom out', zoomIn: 'Zoom in', reload: 'Reload',
    reveal: 'Show in folder', sheets: 'Worksheets', opening: 'Opening document…', content: 'Document content',
    unsupported: 'SoloView does not support this file format yet.', language: 'Switch to Chinese', languageLabel: '中文',
    openFailed: 'Unable to open this document', retry: 'Try again', genericError: 'The document could not be opened.',
    canvasError: 'PDF canvas is unavailable in this environment.', emptyWorkbook: 'This file has no worksheets to display.',
    page: (number: number, total: number) => `Page ${number} of ${total}`,
  },
};

type OpenMessage = {
  kind: 'open';
  type: 'pdf' | 'docx' | 'xlsx' | 'xls' | 'csv' | 'pptx';
  name: string;
  bytes: Uint8Array | { data: number[] } | number[];
};

const vscode = acquireVsCodeApi();
let locale: Locale = vscode.getState()?.locale ?? (document.body.dataset.initialLocale === 'zh' ? 'zh' : 'en');
const viewer = requiredElement<HTMLDivElement>('viewer');
const status = requiredElement<HTMLElement>('status');
const tabs = requiredElement<HTMLDivElement>('sheet-tabs');
const zoomValue = requiredElement<HTMLOutputElement>('zoom-value');
let zoom = 1;
let renderGeneration = 0;

requiredElement<HTMLButtonElement>('zoom-in').addEventListener('click', () => setZoom(zoom + 0.1));
requiredElement<HTMLButtonElement>('zoom-out').addEventListener('click', () => setZoom(zoom - 0.1));
requiredElement<HTMLButtonElement>('reload').addEventListener('click', () => vscode.postMessage({ kind: 'reload' }));
requiredElement<HTMLButtonElement>('open-external').addEventListener('click', () => vscode.postMessage({ kind: 'openExternal' }));
requiredElement<HTMLButtonElement>('language-toggle').addEventListener('click', () => {
  const next = locale === 'zh' ? 'en' : 'zh';
  setLocale(next);
  vscode.postMessage({ kind: 'setLanguage', locale: next });
});
setLocale(locale);

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
  status.innerHTML = `<div class="spinner" aria-hidden="true"></div><p data-i18n="opening">${messages[locale].opening}</p>`;
  viewer.replaceChildren();
  tabs.replaceChildren();
  tabs.hidden = true;
  setZoom(1);

  try {
    const bytes = normalizeBytes(message.bytes);
    if (message.type === 'pdf') await showPdf(bytes, generation);
    else if (message.type === 'docx') await showDocx(bytes);
    else if (message.type === 'pptx') await showPptx(bytes, generation);
    else await showWorkbook(bytes, message.type);
    if (generation === renderGeneration) status.hidden = true;
  } catch (error) {
    if (generation === renderGeneration) {
      showError(error instanceof Error ? error.message : messages[locale].genericError);
    }
  }
}

async function showPdf(bytes: Uint8Array, generation: number): Promise<void> {
  const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc = document.body.dataset.pdfWorker ?? '';
  const resourceRoot = document.body.dataset.pdfResourceRoot;
  if (!resourceRoot) throw new Error(messages[locale].genericError);
  const pdf = await getDocument({
    data: bytes,
    cMapUrl: `${resourceRoot}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${resourceRoot}/standard_fonts/`,
    wasmUrl: `${resourceRoot}/wasm/`,
  }).promise;
  for (let number = 1; number <= pdf.numPages; number += 1) {
    if (generation !== renderGeneration) return;
    const page = await pdf.getPage(number);
    const viewport = page.getViewport({ scale: 1.35 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.className = 'pdf-page';
    canvas.setAttribute('aria-label', messages[locale].page(number, pdf.numPages));
    canvas.dataset.page = String(number);
    canvas.dataset.totalPages = String(pdf.numPages);
    const context = canvas.getContext('2d');
    if (!context) throw new Error(messages[locale].canvasError);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    viewer.append(canvas);
    if (number === 1 && generation === renderGeneration) status.hidden = true;
  }
}

async function showDocx(bytes: Uint8Array): Promise<void> {
  const { renderAsync } = await import('docx-preview');
  await renderAsync(bytes.buffer, viewer, undefined, { inWrapper: true, breakPages: true });
}

async function showPptx(bytes: Uint8Array, generation: number): Promise<void> {
  const { PptxViewer, RECOMMENDED_ZIP_LIMITS } = await import('@aiden0z/pptx-renderer');
  await PptxViewer.open(bytes, viewer, {
    renderMode: 'list',
    fitMode: 'contain',
    lazySlides: true,
    lazyMedia: true,
    listOptions: {
      windowed: true,
      initialSlides: 2,
      batchSize: 2,
    },
    onSlideRendered: () => {
      if (generation === renderGeneration) status.hidden = true;
    },
    zipLimits: RECOMMENDED_ZIP_LIMITS,
  });
}

async function showWorkbook(bytes: Uint8Array, type: 'xlsx' | 'xls' | 'csv'): Promise<void> {
  const XLSX = await import('xlsx');
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
  if (!first) throw new Error(`${type.toUpperCase()}: ${messages[locale].emptyWorkbook}`);
  renderSheet(first);
}

function setZoom(next: number): void {
  zoom = Math.min(2.5, Math.max(0.5, Math.round(next * 10) / 10));
  viewer.style.setProperty('--viewer-zoom', String(zoom));
  zoomValue.value = `${Math.round(zoom * 100)}%`;
}

function showError(message: string): void {
  status.hidden = false;
  status.innerHTML = `<div class="error-symbol" aria-hidden="true">!</div><h1 data-i18n="openFailed">${messages[locale].openFailed}</h1><p>${escapeHtml(message)}</p><button id="retry" type="button" data-i18n="retry">${messages[locale].retry}</button>`;
  requiredElement<HTMLButtonElement>('retry').addEventListener('click', () => vscode.postMessage({ kind: 'reload' }));
}

function setLocale(next: Locale): void {
  locale = next;
  vscode.setState({ locale });
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  const copy = messages[locale];
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n as keyof typeof copy;
    const value = copy[key];
    if (typeof value === 'string') element.textContent = value;
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((element) => {
    const key = element.dataset.i18nAria as keyof typeof copy;
    const value = copy[key];
    if (typeof value === 'string') element.setAttribute('aria-label', value);
  });
  document.querySelectorAll<HTMLCanvasElement>('.pdf-page[data-page][data-total-pages]').forEach((canvas) => {
    canvas.setAttribute('aria-label', copy.page(Number(canvas.dataset.page), Number(canvas.dataset.totalPages)));
  });
  requiredElement<HTMLButtonElement>('language-toggle').textContent = copy.languageLabel;
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
