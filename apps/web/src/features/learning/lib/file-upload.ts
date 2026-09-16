/**
 * Kurs materiallariga umumiy fayl yuklash konfiguratsiyasi.
 * Backend ([materials.service.ts](../../../../../../apps/api/src/modules/courses/materials.service.ts))
 * bilan sinxron bo'lishi shart.
 */

export const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB
export const MAX_FILE_SIZE_LABEL = '30 MB';

// Backend ALLOWED_MIME dagi barcha kengaytmalar
export const ACCEPT_ATTR = [
  '.pdf', '.doc', '.docx', '.odt', '.rtf', '.txt',
  '.xls', '.xlsx', '.csv',
  '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.zip', '.rar', '.7z',
  '.mp3', '.mp4',
].join(',');

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
