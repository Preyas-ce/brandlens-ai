import { supabase } from '@/services/supabaseClient';
import { getActiveWorkspace } from '@/services/workspaceSession';
import { attachFileToReviewRecord, removeAttachmentFromReviewRecord, readReviewRecords } from '@/services/reviewStorage';
import { ReviewAttachment } from '@/types/review';
import {
  MAX_ATTACHMENT_SIZE_BYTES,
  ALLOWED_EVIDENCE_MIME_TYPES,
  AllowedMimeType,
  ALLOWED_EVIDENCE_EXTENSIONS,
  EVIDENCE_STORAGE_BUCKET,
  AttachmentValidationResult,
  validateAttachmentFile,
  sanitizeFileName,
  createAttachmentId,
  formatFileSize,
  validateStoragePath,
} from '@/services/evidenceAttachmentValidation';

export {
  MAX_ATTACHMENT_SIZE_BYTES,
  ALLOWED_EVIDENCE_MIME_TYPES,
  ALLOWED_EVIDENCE_EXTENSIONS,
  EVIDENCE_STORAGE_BUCKET,
  validateAttachmentFile,
  sanitizeFileName,
  createAttachmentId,
  formatFileSize,
  validateStoragePath,
};
export type { AllowedMimeType, AttachmentValidationResult };

export interface UploadAttachmentOptions {
  file: File | { name: string; size: number; type: string; slice?: unknown };
  reviewId: string;
  revision: number;
  uploaderName?: string;
  workspaceId?: string;
}

/**
 * Uploads a file to the private Supabase storage bucket, saves attachment metadata,
 * and rolls back the storage object if metadata persistence fails.
 */
export const uploadReviewEvidenceAttachment = async (
  options: UploadAttachmentOptions,
): Promise<ReviewAttachment> => {
  const { file, reviewId, revision, uploaderName } = options;

  // 1. Client-side validation
  const validation = validateAttachmentFile(file);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const workspaceId = options.workspaceId || getActiveWorkspace() || 'local-workspace';
  const attachmentId = createAttachmentId();
  const cleanName = sanitizeFileName(file.name);
  const mimeType = file.type || (cleanName.endsWith('.pdf') ? 'application/pdf' : 'image/png');
  const storagePath = `${workspaceId}/${reviewId}/rev-${revision}/${attachmentId}-${cleanName}`;
  const now = new Date().toISOString();
  const uploader = uploaderName || 'Workspace contributor';

  const attachment: ReviewAttachment = {
    id: attachmentId,
    workspaceId,
    reviewId,
    revision,
    fileName: file.name,
    contentType: mimeType,
    fileSize: file.size,
    storagePath,
    uploadedBy: uploader,
    createdAt: now,
  };

  const client = supabase;

  // 2. Upload file to private storage bucket if remote client is configured
  if (client) {
    const { error: uploadError } = await client.storage
      .from(EVIDENCE_STORAGE_BUCKET)
      .upload(storagePath, file as File, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload file to evidence storage: ${uploadError.message}`);
    }

    // 3. Persist metadata remotely via guarded RPC with safe cleanup rollback
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('add_review_attachment', {
        target_workspace: workspaceId,
        target_review_id: reviewId,
        p_revision: revision,
        p_attachment_id: attachmentId,
        p_file_name: file.name,
        p_content_type: mimeType,
        p_file_size: file.size,
        p_storage_path: storagePath,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (rpcData && typeof rpcData === 'object' && 'uploadedBy' in (rpcData as Record<string, unknown>)) {
        attachment.uploadedBy = (rpcData as ReviewAttachment).uploadedBy;
      }
    } catch (saveError) {
      // Safe cleanup rollback: remove uploaded storage object if metadata failed
      try {
        await client.storage.from(EVIDENCE_STORAGE_BUCKET).remove([storagePath]);
      } catch (rollbackError) {
        console.warn(
          `Storage rollback cleanup warning: ${
            rollbackError instanceof Error ? rollbackError.message : 'Unknown error'
          }`,
        );
      }
      throw new Error(
        `Failed to register attachment metadata: ${
          saveError instanceof Error ? saveError.message : 'Unknown database error'
        }`,
      );
    }
  }

  // 4. Update local review records cache
  attachFileToReviewRecord(attachment);
  return attachment;
};

/**
 * Creates a short-lived signed URL for an authorized reviewer to inspect or download
 * the attachment from the private bucket.
 */
export const getAttachmentSignedUrl = async (
  storagePath: string,
  expiresInSeconds = 300,
): Promise<string> => {
  const client = supabase;
  if (!client) {
    throw new Error('Remote storage is not configured. File preview is available in remote workspace.');
  }

  const { data, error } = await client.storage
    .from(EVIDENCE_STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Could not generate secure signed URL: ${error?.message || 'Access denied'}`);
  }

  return data.signedUrl;
};

/**
 * Deletes an attachment metadata record and its storage object.
 *
 * Non-transactional boundary documentation:
 * Supabase Storage (S3-compatible object store) and PostgreSQL database are separate subsystems
 * across an HTTP boundary, meaning atomic two-phase commit is not natively possible.
 * Order of operations:
 * 1. Remove the physical file from private Supabase Storage first.
 *    If Storage removal fails (e.g. network timeout or RLS error), the database metadata
 *    is left intact so the client/editor retains the metadata necessary to retry deletion.
 * 2. Remove metadata via guarded RPC `delete_review_attachment`.
 *    If the RPC fails, the user is informed with a clear error so they can retry.
 *    Storage deletion is idempotent, so retrying will not fail if the object was already purged.
 * 3. Update the local review record cache once remote confirmation succeeds.
 */
export const deleteReviewEvidenceAttachment = async (
  reviewId: string,
  attachmentId: string,
  storagePath: string,
  workspaceId?: string,
): Promise<void> => {
  const wsId = workspaceId || getActiveWorkspace() || 'local-workspace';
  const client = supabase;

  if (client) {
    // 1. Remove storage object first so metadata remains available for retry if storage fails
    const { error: storageError } = await client.storage
      .from(EVIDENCE_STORAGE_BUCKET)
      .remove([storagePath]);

    if (storageError) {
      throw new Error(`Failed to remove file from evidence storage: ${storageError.message}`);
    }

    // 2. Remove metadata via guarded RPC
    const { error: rpcError } = await client.rpc('delete_review_attachment', {
      target_workspace: wsId,
      target_review_id: reviewId,
      p_attachment_id: attachmentId,
    });

    if (rpcError) {
      throw new Error(`Failed to remove attachment record from workspace: ${rpcError.message}`);
    }
  }

  // 3. Update local cache
  removeAttachmentFromReviewRecord(reviewId, attachmentId);
};

/**
 * Retrieves all attachments associated with a review, optionally filtered to a specific revision.
 */
export const getReviewAttachments = (
  reviewId: string,
  revision?: number,
): ReviewAttachment[] => {
  const records = readReviewRecords();
  const record = records.find((candidate) => candidate.id === reviewId);
  if (!record || !record.attachments) return [];

  if (typeof revision === 'number') {
    return record.attachments.filter((att) => att.revision === revision);
  }
  return record.attachments;
};
