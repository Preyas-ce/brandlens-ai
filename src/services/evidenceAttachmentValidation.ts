export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_EVIDENCE_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type AllowedMimeType = typeof ALLOWED_EVIDENCE_MIME_TYPES[number];

export const ALLOWED_EVIDENCE_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'] as const;

export const EVIDENCE_STORAGE_BUCKET = 'review-evidence';

export interface AttachmentValidationResult {
  valid: boolean;
  errorCode?: 'too_large' | 'invalid_type' | 'empty';
  message: string;
}

export const validateAttachmentFile = (file: { name: string; size: number; type: string }): AttachmentValidationResult => {
  if (file.size <= 0) {
    return {
      valid: false,
      errorCode: 'empty',
      message: 'Selected file is empty.',
    };
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      valid: false,
      errorCode: 'too_large',
      message: 'File size exceeds the 10 MB limit.',
    };
  }

  const normalizedType = file.type.toLowerCase();
  const lowerName = file.name.toLowerCase();
  const matchesExt = ALLOWED_EVIDENCE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const matchesMime = (ALLOWED_EVIDENCE_MIME_TYPES as readonly string[]).includes(normalizedType);

  // Check MIME or extension match
  if (!matchesMime && !matchesExt) {
    return {
      valid: false,
      errorCode: 'invalid_type',
      message: 'Unsupported file type. Allowed formats: PDF, PNG, JPEG, WebP.',
    };
  }

  return { valid: true, message: 'Valid file.' };
};

export const sanitizeFileName = (fileName: string): string => {
  return fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
};

export const createAttachmentId = (): string => {
  if (typeof window !== 'undefined' && typeof window.crypto?.randomUUID === 'function') {
    return `att-${window.crypto.randomUUID().slice(0, 8)}`;
  }
  return `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, index);
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

/**
 * Validates that an evidence attachment storage path strictly adheres to the structure:
 * <workspace_id>/<review_id>/rev-<revision>/<attachment_id>-<filename>
 */
export const validateStoragePath = (
  path: unknown,
  workspaceId: string,
  reviewId: string,
  revision: number,
  attachmentId?: string,
): boolean => {
  if (typeof path !== 'string' || !path.trim()) return false;
  if (!workspaceId || !reviewId || !revision || revision <= 0) return false;

  const segments = path.trim().split('/');
  if (segments.length !== 4) return false;

  const [ws, revId, revSeg, fileSeg] = segments;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ws);
  if (!isUuid || ws !== workspaceId) return false;
  if (revId !== reviewId) return false;
  if (revSeg !== `rev-${revision}`) return false;
  if (!fileSeg || !fileSeg.trim()) return false;

  if (attachmentId && !fileSeg.startsWith(`${attachmentId}-`)) {
    return false;
  }

  return true;
};