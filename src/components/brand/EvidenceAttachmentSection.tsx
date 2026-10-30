import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Paperclip,
  ShieldAlert,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useLanguage } from '@/contexts/LanguageProvider';
import { ReviewAttachment } from '@/types/review';
import {
  deleteReviewEvidenceAttachment,
  formatFileSize,
  getAttachmentSignedUrl,
  uploadReviewEvidenceAttachment,
  validateAttachmentFile,
} from '@/services/evidenceAttachmentService';

export interface EvidenceAttachmentSectionProps {
  reviewId: string;
  revision: number;
  attachments?: ReviewAttachment[];
  mode: 'workbench' | 'verification_gate';
  uploaderName?: string;
  onAttachmentAdded?: (attachment: ReviewAttachment) => void;
  onAttachmentRemoved?: (attachmentId: string) => void;
  onEnsureDraftId?: () => Promise<string>;
}

export const EvidenceAttachmentSection: React.FC<EvidenceAttachmentSectionProps> = ({
  reviewId,
  revision,
  attachments = [],
  mode,
  uploaderName,
  onAttachmentAdded,
  onAttachmentRemoved,
  onEnsureDraftId,
}) => {
  const { t, language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Filter attachments for current revision
  const revisionAttachments = attachments.filter((att) => att.revision === revision);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMessage(null);

    const file = files[0];
    const validation = validateAttachmentFile(file);
    if (!validation.valid) {
      if (validation.errorCode === 'too_large') {
        setErrorMessage(t('attachmentErrorTooLarge'));
      } else if (validation.errorCode === 'invalid_type') {
        setErrorMessage(t('attachmentErrorInvalidType'));
      } else if (validation.errorCode === 'empty') {
        setErrorMessage(t('attachmentErrorEmpty'));
      } else {
        setErrorMessage(validation.message);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    try {
      let targetReviewId = reviewId;
      if (!targetReviewId && onEnsureDraftId) {
        targetReviewId = await onEnsureDraftId();
      }

      if (!targetReviewId) {
        throw new Error('A review record must be created or saved before attaching files.');
      }

      const newAttachment = await uploadReviewEvidenceAttachment({
        file,
        reviewId: targetReviewId,
        revision,
        uploaderName,
      });

      if (onAttachmentAdded) {
        onAttachmentAdded(newAttachment);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t('attachmentErrorUploadFailed'),
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInspectOrDownload = async (attachment: ReviewAttachment, download = false) => {
    setActiveActionId(attachment.id);
    setErrorMessage(null);
    try {
      const signedUrl = await getAttachmentSignedUrl(attachment.storagePath, 300);
      if (download) {
        const link = document.createElement('a');
        link.href = signedUrl;
        link.download = attachment.fileName;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t('attachmentSignedUrlError'),
      );
    } finally {
      setActiveActionId(null);
    }
  };

  const handleDelete = async (attachment: ReviewAttachment) => {
    if (!window.confirm(t('attachmentDeleteConfirm'))) return;

    setActiveActionId(attachment.id);
    setErrorMessage(null);
    try {
      await deleteReviewEvidenceAttachment(
        attachment.reviewId,
        attachment.id,
        attachment.storagePath,
        attachment.workspaceId,
      );
      if (onAttachmentRemoved) {
        onAttachmentRemoved(attachment.id);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not remove attachment.');
    } finally {
      setActiveActionId(null);
    }
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    const locale = language === 'hi' ? 'hi-IN' : language === 'gu' ? 'gu-IN' : 'en-IN';
    return date.toLocaleString(locale);
  };

  const isPdf = (mime: string) => mime === 'application/pdf';

  return (
    <div className="space-y-3 font-sans">
      {/* Header Info & Editorial Notice */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-copper" />
          <h4 className="font-serif text-sm font-semibold text-obsidian">
            {t('attachmentsTitle')}
          </h4>
          <span className="font-mono text-[10px] text-stone-500">
            ({revisionAttachments.length})
          </span>
        </div>
        <div className="text-[10px] text-stone-500">
          {t('attachmentRevisionLabel')} {revision}
        </div>
      </div>

      {/* Mandatory Human Verification Disclaimer Notice */}
      <div className="flex items-start gap-2 border-l-2 border-stone-400 bg-ivory-100/70 p-2.5 text-[11px] leading-relaxed text-stone-700">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-copper" aria-hidden="true" />
        <span>
          {mode === 'workbench' ? t('attachmentsNotice') : t('attachmentGateDisclaimer')}
        </span>
      </div>

      {/* Validation or Storage Error */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 border-l-2 border-copper bg-copper-50 p-2.5 text-xs text-copper-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-copper" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Workbench Upload Dropzone */}
      {mode === 'workbench' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFileSelect(e.dataTransfer.files);
          }}
          className={`relative flex flex-col items-center justify-center rounded-sm border border-dashed p-4 text-center transition-colors ${
            isDragging
              ? 'border-copper bg-copper-50/50'
              : 'border-stone-300 bg-ivory-50/60 hover:border-stone-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            id={`evidence-file-input-${reviewId || 'new'}`}
            onChange={(e) => handleFileSelect(e.target.files)}
            disabled={isUploading}
          />

          <UploadCloud className="h-6 w-6 text-stone-400" />
          <p className="mt-2 text-xs font-medium text-obsidian">
            {t('attachmentDropzonePrompt')}
          </p>
          <p className="mt-1 text-[10px] text-stone-500">
            {t('attachmentFileFormats')}
          </p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={isUploading}
            leftIcon={
              isUploading ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin text-copper" />
              ) : (
                <FileCheck2 className="h-3.5 w-3.5 text-forest" />
              )
            }
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? t('attachmentUploading') : t('attachmentUploadBtn')}
          </Button>
        </div>
      )}

      {/* Attachments List */}
      {revisionAttachments.length === 0 ? (
        <div className="border border-stone-200 bg-ivory-50/40 p-3 text-center text-xs text-stone-500">
          {mode === 'workbench' ? t('attachmentEmptyWorkbench') : t('attachmentEmptyGate')}
        </div>
      ) : (
        <ul className="space-y-2">
          {revisionAttachments.map((attachment) => {
            const isProcessing = activeActionId === attachment.id;
            return (
              <li
                key={attachment.id}
                className="flex flex-col gap-2 rounded-sm border border-stone-300 bg-ivory-50 p-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="grid h-7 w-7 shrink-0 place-items-center border border-stone-300 bg-ivory text-stone-700">
                    {isPdf(attachment.contentType) ? (
                      <FileText className="h-4 w-4 text-copper-800" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-forest-800" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-obsidian" title={attachment.fileName}>
                      {attachment.fileName}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500">
                      <span className="font-mono">{formatFileSize(attachment.fileSize)}</span>
                      <span>·</span>
                      <Badge variant="neutral" size="sm">
                        {isPdf(attachment.contentType) ? 'PDF' : 'IMAGE'}
                      </Badge>
                      <span>·</span>
                      <span>
                        {t('attachmentUploadedBy')} {attachment.uploadedBy}
                      </span>
                      <span>·</span>
                      <span>{formatTimestamp(attachment.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                    leftIcon={
                      isProcessing ? (
                        <LoaderCircle className="h-3 w-3 animate-spin text-copper" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )
                    }
                    onClick={() => handleInspectOrDownload(attachment, false)}
                    title={t('attachmentInspect')}
                  >
                    {t('attachmentInspect')}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isProcessing}
                    leftIcon={<Download className="h-3 w-3" />}
                    onClick={() => handleInspectOrDownload(attachment, true)}
                    title={t('attachmentDownload')}
                  >
                    {t('attachmentDownload')}
                  </Button>

                  {mode === 'workbench' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isProcessing}
                      className="text-stone-500 hover:text-copper-800"
                      leftIcon={<Trash2 className="h-3 w-3" />}
                      onClick={() => handleDelete(attachment)}
                      title={t('attachmentDelete')}
                    >
                      {t('attachmentDelete')}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};