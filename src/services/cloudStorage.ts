import {
  clearAllReviewRecords,
  clearUserGeneratedReviewRecords,
  createReviewDraftRecord,
  decideReviewRecord,
  readReviewRecords,
  resetDemoReviewRecords,
  resubmitReviewRecord,
  saveReviewDraft,
  saveReviewRecord,
  updateReviewRecord,
  REVIEW_RECORDS_STORAGE_KEY,
  REVIEW_RECORDS_UPDATED_EVENT,
} from '@/services/reviewStorage';
import {
  createEvidenceRecord,
  createGuideline,
  deleteEvidenceRecord,
  deleteGuideline,
  getWorkspaceAnalysisConfigHash,
  readEvidenceRecords,
  readGuidelines,
  readWorkspaceAuditEvents,
  readWorkspaceSettings,
  restoreWorkspaceSettings,
  saveWorkspaceSettings,
  updateEvidenceRecord,
  updateGuideline,
  WORKSPACE_DATA_STORAGE_KEY,
  WORKSPACE_DATA_UPDATED_EVENT,
} from '@/services/workspaceStorage';
import { ReviewRecord, ReviewSubmission } from '@/types/review';
import { EvidenceRecord, GuidelineRecord, WorkspaceSettings } from '@/types/workspace';
import { dispatchStorageUpdated, getScopedStorageKey, setStorageEventsDeferred } from '@/services/storageScope';
import { supabase } from '@/services/supabaseClient';
import { getActiveWorkspace } from '@/services/workspaceSession';

const clientOrThrow = () => {
  const client = supabase;
  if (!client) throw new Error('Supabase is not configured. No remote save was attempted.');
  return client;
};

const workspaceIdOrThrow = (): string => {
  const workspaceId = getActiveWorkspace();
  if (!workspaceId) throw new Error('No authenticated workspace is active. Sign in before changing workspace data.');
  return workspaceId;
};

let mutationQueue: Promise<void> = Promise.resolve();

const serializeMutation = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(() => undefined, () => undefined);
  return result;
};

const restoreKey = (key: string, previous: string | null, eventName: string): void => {
  if (previous === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, previous);
  window.dispatchEvent(new Event(eventName));
};

const persistReview = async (record: ReviewRecord): Promise<void> => {
  const { error } = await clientOrThrow().rpc('save_review_record', {
    target_workspace: workspaceIdOrThrow(),
    payload: record,
  });
  if (error) throw new Error(`Review could not be saved to the workspace: ${error.message}`);
};

const runReviewMutation = <T extends ReviewRecord>(operation: () => T): Promise<T> => serializeMutation(async () => {
  const key = getScopedStorageKey(REVIEW_RECORDS_STORAGE_KEY);
  const previous = window.localStorage.getItem(key);
  setStorageEventsDeferred(true);
  try {
    const record = operation();
    await persistReview(record);
    setStorageEventsDeferred(false);
    dispatchStorageUpdated(REVIEW_RECORDS_UPDATED_EVENT);
    return record;
  } catch (error) {
    setStorageEventsDeferred(false);
    restoreKey(key, previous, REVIEW_RECORDS_UPDATED_EVENT);
    throw error;
  } finally {
    setStorageEventsDeferred(false);
  }
});

export const cloudCreateReviewDraftRecord = (
  submission: ReviewSubmission,
  configHash: string,
): Promise<ReviewRecord> => runReviewMutation(() => (
  createReviewDraftRecord(submission, configHash)
));

export const cloudSaveReviewRecord = (
  submission: ReviewSubmission,
  score: number,
  findings: ReviewRecord['findings'],
  summary: string,
  configHash: string,
  demoScenarioId?: string,
): Promise<ReviewRecord> => runReviewMutation(() => (
  saveReviewRecord(submission, score, findings, summary, configHash, demoScenarioId)
));

export const cloudResubmitReviewRecord = (
  id: string,
  submission: ReviewSubmission,
  score: number,
  findings: ReviewRecord['findings'],
  summary: string,
  configHash: string,
): Promise<ReviewRecord> => runReviewMutation(() => (
  resubmitReviewRecord(id, submission, score, findings, summary, configHash)
));

export const cloudSaveReviewDraft = (
  id: string,
  content: string,
  metadata?: Pick<ReviewSubmission, 'title' | 'contentType' | 'campaign' | 'author'>,
  forceRevision = false,
): Promise<ReviewRecord> => runReviewMutation(() => saveReviewDraft(id, content, metadata, forceRevision));

export const cloudUpdateReviewRecord = (
  id: string,
  updates: Partial<Pick<ReviewRecord, 'suggestedContent'>>,
): Promise<ReviewRecord> => runReviewMutation(() => updateReviewRecord(id, updates));

export const cloudDecideReviewRecord = (
  id: string,
  decision: Parameters<typeof decideReviewRecord>[1],
  reviewer: string,
  comment: string,
  suggestedDraft?: string,
): Promise<ReviewRecord> => serializeMutation(async () => {
  const current = readReviewRecords().find((record) => record.id === id);
  if (!current) throw new Error(`Review record ${id} was not found in this workspace.`);
  const { data, error } = await clientOrThrow().rpc('decide_review_record', {
    target_workspace: workspaceIdOrThrow(),
    target_review_id: id,
    chosen_decision: decision,
    reviewer_name: reviewer,
    reviewer_comment: comment,
    reviewed_content_hash: current.contentHash,
    suggested_draft: suggestedDraft ?? null,
  });
  if (error) throw new Error(`The human decision could not be saved: ${error.message}`);
  const result = data as ReviewRecord;
  const next = readReviewRecords().map((record) => record.id === id ? result : record);
  window.localStorage.setItem(getScopedStorageKey(REVIEW_RECORDS_STORAGE_KEY), JSON.stringify(next));
  dispatchStorageUpdated(REVIEW_RECORDS_UPDATED_EVENT);
  return result;
});

const readCurrentWorkspaceData = () => ({
  schemaVersion: 1,
  guidelines: readGuidelines(),
  evidence: readEvidenceRecords(),
  settings: readWorkspaceSettings(),
  auditEvents: readWorkspaceAuditEvents(),
});

const runWorkspaceMutation = <T>(operation: () => T): Promise<T> => serializeMutation(async () => {
  const key = getScopedStorageKey(WORKSPACE_DATA_STORAGE_KEY);
  const previous = window.localStorage.getItem(key);
  setStorageEventsDeferred(true);
  try {
    const result = operation();
    const { error } = await clientOrThrow().rpc('save_workspace_data', {
      target_workspace: workspaceIdOrThrow(),
      payload: {
        ...readCurrentWorkspaceData(),
        analysisConfigHash: getWorkspaceAnalysisConfigHash(),
      },
    });
    if (error) throw new Error(`Workspace changes could not be saved remotely: ${error.message}`);
    setStorageEventsDeferred(false);
    dispatchStorageUpdated(WORKSPACE_DATA_UPDATED_EVENT);
    return result;
  } catch (error) {
    setStorageEventsDeferred(false);
    restoreKey(key, previous, WORKSPACE_DATA_UPDATED_EVENT);
    throw error;
  } finally {
    setStorageEventsDeferred(false);
  }
});

export const cloudCreateGuideline = (input: Parameters<typeof createGuideline>[0]): Promise<GuidelineRecord> => (
  runWorkspaceMutation(() => createGuideline(input))
);
export const cloudUpdateGuideline = (id: string, input: Parameters<typeof updateGuideline>[1]): Promise<GuidelineRecord> => (
  runWorkspaceMutation(() => updateGuideline(id, input))
);
export const cloudDeleteGuideline = (id: string): Promise<GuidelineRecord> => (
  runWorkspaceMutation(() => deleteGuideline(id))
);
export const cloudCreateEvidenceRecord = (input: Parameters<typeof createEvidenceRecord>[0]): Promise<EvidenceRecord> => (
  runWorkspaceMutation(() => createEvidenceRecord(input))
);
export const cloudUpdateEvidenceRecord = (id: string, input: Parameters<typeof updateEvidenceRecord>[1]): Promise<EvidenceRecord> => (
  runWorkspaceMutation(() => updateEvidenceRecord(id, input))
);
export const cloudDeleteEvidenceRecord = (id: string): Promise<ReturnType<typeof deleteEvidenceRecord>> => (
  runWorkspaceMutation(() => deleteEvidenceRecord(id))
);
export const cloudSaveWorkspaceSettings = (settings: WorkspaceSettings): Promise<WorkspaceSettings> => (
  runWorkspaceMutation(() => saveWorkspaceSettings(settings))
);
export const cloudRestoreWorkspaceSettings = (): Promise<WorkspaceSettings> => (
  runWorkspaceMutation(() => restoreWorkspaceSettings())
);

export const cloudDeleteReviews = (records: ReviewRecord[], operation: () => number): Promise<number> => serializeMutation(async () => {
  const key = getScopedStorageKey(REVIEW_RECORDS_STORAGE_KEY);
  const previous = window.localStorage.getItem(key);
  setStorageEventsDeferred(true);
  try {
    const removed = operation();
    const ids = records.map((record) => record.id);
    if (ids.length) {
      const { error } = await clientOrThrow().rpc('delete_review_records', {
        target_workspace: workspaceIdOrThrow(),
        review_ids: ids,
      });
      if (error) throw new Error(`Review history could not be removed from the workspace: ${error.message}`);
    }
    setStorageEventsDeferred(false);
    dispatchStorageUpdated(REVIEW_RECORDS_UPDATED_EVENT);
    return removed;
  } catch (error) {
    setStorageEventsDeferred(false);
    restoreKey(key, previous, REVIEW_RECORDS_UPDATED_EVENT);
    throw error;
  } finally {
    setStorageEventsDeferred(false);
  }
});

export const cloudResetDemoReviews = (): Promise<number> => {
  const demoRecords = readReviewRecords().filter((record) => Boolean(record.demoScenarioId));
  return cloudDeleteReviews(demoRecords, resetDemoReviewRecords);
};
export const cloudClearUserReviews = (): Promise<number> => {
  const userRecords = readReviewRecords().filter((record) => !record.demoScenarioId);
  return cloudDeleteReviews(userRecords, clearUserGeneratedReviewRecords);
};
export const cloudClearAllReviews = (): Promise<number> => {
  const records = readReviewRecords();
  return cloudDeleteReviews(records, clearAllReviewRecords);
};

export const cloudPersistAllReviews = async (): Promise<void> => {
  const records = readReviewRecords();
  for (const record of records) await persistReview(record);
};

export const cloudPersistReviewRecords = async (records: ReviewRecord[]): Promise<void> => {
  for (const record of records) await persistReview(record);
};

export const cloudPersistWorkspaceSnapshot = async (workspace: {
  guidelines: GuidelineRecord[];
  evidence: EvidenceRecord[];
  settings: WorkspaceSettings;
  auditEvents: ReturnType<typeof readWorkspaceAuditEvents>;
}): Promise<void> => {
  const { error } = await clientOrThrow().rpc('save_workspace_data', {
    target_workspace: workspaceIdOrThrow(),
    payload: {
      schemaVersion: 1,
      ...workspace,
      analysisConfigHash: getWorkspaceAnalysisConfigHash(),
    },
  });
  if (error) throw new Error(`Default workspace rules could not be initialized remotely: ${error.message}`);
};

export const cloudAssignWorkspaceMember = async (
  email: string,
  role: 'workspace_admin' | 'writer' | 'reviewer',
): Promise<string> => {
  const { data, error } = await clientOrThrow().rpc('assign_workspace_member', {
    target_workspace: workspaceIdOrThrow(),
    member_email: email.trim(),
    chosen_role: role,
  });
  if (error) throw new Error(`Workspace member could not be assigned: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.user_id) throw new Error('The member assignment completed without returning a user ID.');
  return row.user_id as string;
};
