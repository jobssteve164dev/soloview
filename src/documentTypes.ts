export const supportedDocumentTypes = [
  'pdf', 'docx', 'xlsx', 'xls', 'csv', 'pptx',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif',
] as const;

export type DocumentType = (typeof supportedDocumentTypes)[number];

export function documentTypeForPath(path: string): DocumentType | undefined {
  const extension = path.toLowerCase().split('.').pop();
  return supportedDocumentTypes.find((type) => type === extension);
}
