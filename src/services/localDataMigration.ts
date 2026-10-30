import { REVIEW_RECORDS_STORAGE_KEY } from '@/services/reviewStorage';
import { WORKSPACE_DATA_STORAGE_KEY } from '@/services/workspaceStorage';
import { getScopedStorageKey } from '@/services/storageScope';
import { ReviewRecord } from '@/types/review';

export interface LocalWorkspaceImport {
  version: 1;
  sourceId: string;
  analysisConfigHash?: string;
  records: ReviewRecord[];
  workspace: Record<string, unknown> | null;
}

export const createLocalWorkspaceImport = (storage: Storage): LocalWorkspaceImport => {
  const rawRecords = storage.getItem(REVIEW_RECORDS_STORAGE_KEY);
  const rawWorkspace = storage.getItem(WORKSPACE_DATA_STORAGE_KEY);
  let records: ReviewRecord[] = [];
  let workspace: Record<string, unknown> | null = null;
  try {
    if (rawRecords) {
      const parsed: unknown = JSON.parse(rawRecords);
      if (!Array.isArray(parsed)) throw new Error('Saved local reviews are not an array.');
      if (!parsed.every((record) => Boolean(record) && typeof record === 'object' && typeof (record as Record<string, unknown>).id === 'string')) {
        throw new Error('Saved local reviews contain an invalid record.');
      }
      records = parsed as ReviewRecord[];
    }
    if (rawWorkspace) {
      const parsed: unknown = JSON.parse(rawWorkspace);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Saved local workspace data has an unsupported format.');
      }
      workspace = parsed as Record<string, unknown>;
    }
  } catch (error) {
    throw new Error(`Local data could not be prepared for import: ${error instanceof Error ? error.message : 'invalid data'}`);
  }

  const source = JSON.stringify({ rawRecords, rawWorkspace });
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const sourceId = `local-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  return { version: 1, sourceId, records, workspace };
};

export const writeWorkspaceImportCache = (
  storage: Storage,
  records: unknown[],
  workspace: Record<string, unknown>,
): void => {
  storage.setItem(getScopedStorageKey(REVIEW_RECORDS_STORAGE_KEY), JSON.stringify(records));
  storage.setItem(getScopedStorageKey(WORKSPACE_DATA_STORAGE_KEY), JSON.stringify(workspace));
};
