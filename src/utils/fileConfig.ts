export const FILE_CONFIG = {
  MAX_FILE_SIZE_MB: 25,
  USER_QUOTA_MB: 1024,
  PROJECT_QUOTA_MB: 10240,
  TENANT_QUOTA_MB: 51200,

  ALLOWED_MIME_TYPES: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/json',
    'application/zip',
    'application/x-7z-compressed',
    'application/x-rar-compressed',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
  ] as readonly string[],

  ALLOWED_EXTENSIONS: [
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.csv', '.json', '.zip', '.7z', '.rar',
    '.mp4', '.webm', '.mp3', '.wav',
  ] as readonly string[],
} as const;

export const MAX_FILE_SIZE_BYTES = FILE_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024;
export const USER_QUOTA_BYTES = FILE_CONFIG.USER_QUOTA_MB * 1024 * 1024;
export const PROJECT_QUOTA_BYTES = FILE_CONFIG.PROJECT_QUOTA_MB * 1024 * 1024;
export const TENANT_QUOTA_BYTES = FILE_CONFIG.TENANT_QUOTA_MB * 1024 * 1024;

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.substring(dot).toLowerCase() : '';
}

export function isAllowedFileType(fileName: string): boolean {
  const ext = getFileExtension(fileName);
  return (FILE_CONFIG.ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

export function isAllowedMimeType(mimeType: string): boolean {
  return (FILE_CONFIG.ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'spreadsheet';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'presentation';
  if (mimeType === 'text/plain' || mimeType === 'text/csv') return 'text';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return 'archive';
  return 'other';
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File exceeds maximum size of ${FILE_CONFIG.MAX_FILE_SIZE_MB} MB` };
  }
  if (!isAllowedFileType(file.name)) {
    const ext = getFileExtension(file.name);
    return { valid: false, error: `File type "${ext || 'unknown'}" is not allowed` };
  }
  return { valid: true };
}

export function getStorageUsageWarningLevel(usedBytes: number, quotaBytes: number): 'ok' | 'warning' | 'exceeded' {
  const pct = (usedBytes / quotaBytes) * 100;
  if (pct >= 100) return 'exceeded';
  if (pct >= 80) return 'warning';
  return 'ok';
}

export function canPreviewFile(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf' ||
    mimeType === 'text/plain' ||
    mimeType === 'text/csv' ||
    mimeType === 'application/json'
  );
}

export function detectDuplicateFile(
  fileName: string,
  fileSize: number,
  existingFiles: { fileName: string; fileSize: number }[]
): { isDuplicate: boolean; isVersion: boolean; existingFile?: { fileName: string; fileSize: number } } {
  const exactMatch = existingFiles.find(
    (f) => f.fileName === fileName && f.fileSize === fileSize
  );
  if (exactMatch) {
    return { isDuplicate: true, isVersion: false, existingFile: exactMatch };
  }

  const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
  const versionMatch = existingFiles.find((f) => {
    const existingBase = f.fileName.substring(0, f.fileName.lastIndexOf('.')) || f.fileName;
    return existingBase === baseName;
  });
  if (versionMatch) {
    return { isDuplicate: false, isVersion: true, existingFile: versionMatch };
  }

  return { isDuplicate: false, isVersion: false };
}
