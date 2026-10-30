import { Session, User } from '@supabase/supabase-js';
import { readReviewRecords, REVIEW_RECORDS_STORAGE_KEY, REVIEW_RECORDS_UPDATED_EVENT } from '@/services/reviewStorage';
import { WORKSPACE_DATA_STORAGE_KEY, WORKSPACE_DATA_UPDATED_EVENT } from '@/services/workspaceStorage';
import {
  createLocalWorkspaceImport,
  LocalWorkspaceImport,
  writeWorkspaceImportCache,
} from '@/services/localDataMigration';
import { getActiveWorkspaceId, setActiveWorkspaceStorageScope } from '@/services/storageScope';
import { setActiveWorkspace } from '@/services/workspaceSession';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  createDefaultWorkspaceData,
  getWorkspaceAnalysisConfigHash,
  readEvidenceRecords,
  readGuidelines,
  readWorkspaceAuditEvents,
  readWorkspaceSettings,
} from '@/services/workspaceStorage';
import { cloudPersistWorkspaceSnapshot } from '@/services/cloudStorage';
import { supabase, supabaseConfigurationError } from '@/services/supabaseClient';
import { ReviewRecord } from '@/types/review';
import { EvidenceRecord, GuidelineRecord, WorkspaceAuditEvent } from '@/types/workspace';

export type WorkspaceRole = 'workspace_admin' | 'writer' | 'reviewer';

export interface AuthenticatedWorkspace {
  id: string;
  name: string;
  role: WorkspaceRole;
}

export interface WorkspaceSnapshot {
  records: ReviewRecord[];
  workspace: {
    schemaVersion: 1;
    guidelines: GuidelineRecord[];
    evidence: EvidenceRecord[];
    settings: typeof DEFAULT_WORKSPACE_SETTINGS;
    auditEvents: WorkspaceAuditEvent[];
  };
}

export const getLocalImportPayload = (): LocalWorkspaceImport => (
  (() => {
    const workspaceId = getActiveWorkspaceId();
    setActiveWorkspaceStorageScope(null);
    setActiveWorkspace(null);
    try {
      createLocalWorkspaceImport(window.localStorage);
      readReviewRecords();
      readGuidelines();
      readEvidenceRecords();
      readWorkspaceSettings();
      readWorkspaceAuditEvents();
      return {
        ...createLocalWorkspaceImport(window.localStorage),
        analysisConfigHash: getWorkspaceAnalysisConfigHash(),
      };
    } finally {
      setActiveWorkspaceStorageScope(workspaceId);
      setActiveWorkspace(workspaceId);
    }
  })()
);

export const hasLocalWorkspaceData = (): boolean => Boolean(
  window.localStorage.getItem(REVIEW_RECORDS_STORAGE_KEY)
  || window.localStorage.getItem(WORKSPACE_DATA_STORAGE_KEY),
);

const requiredClient = () => {
  if (!supabase) throw new Error(supabaseConfigurationError || 'Supabase is not configured.');
  return supabase;
};

export const initializeWorkspace = async (user: User): Promise<AuthenticatedWorkspace> => {
  const client = requiredClient();
  const { data, error } = await client.rpc('bootstrap_workspace', {
   p_workspace_name: user.user_metadata?.workspace_name ?? 'BrandLens Workspace',
});
  if (error) throw new Error(`Workspace access could not be initialized: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.workspace_id || !row?.member_role) throw new Error('The authenticated account has no workspace membership.');
  const workspace = { id: row.workspace_id as string, name: row.workspace_name as string, role: row.member_role as WorkspaceRole };
  setActiveWorkspaceStorageScope(workspace.id);
  setActiveWorkspace(workspace.id);
  return workspace;
};

export const loadWorkspaceSnapshot = async (workspaceId: string): Promise<WorkspaceSnapshot> => {
  const client = requiredClient();
  const [reviewsResult, guidelinesResult, evidenceResult, settingsResult, auditResult] = await Promise.all([
    client.from('reviews').select('record_data').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
    client.from('guidelines').select('record_data').eq('workspace_id', workspaceId),
    client.from('evidence_records').select('record_data').eq('workspace_id', workspaceId),
    client.from('workspace_settings').select('settings').eq('workspace_id', workspaceId).maybeSingle(),
    client.from('workspace_audit_events').select('record_data').eq('workspace_id', workspaceId).order('event_at', { ascending: false }),
  ]);
  for (const result of [reviewsResult, guidelinesResult, evidenceResult, settingsResult, auditResult]) {
    if (result.error) throw new Error(`Workspace data could not be loaded: ${result.error.message}`);
  }

  const snapshot: WorkspaceSnapshot = {
    records: (reviewsResult.data ?? []).map((row) => row.record_data as ReviewRecord),
    workspace: {
      schemaVersion: 1,
      guidelines: (guidelinesResult.data ?? []).map((row) => row.record_data as GuidelineRecord),
      evidence: (evidenceResult.data ?? []).map((row) => row.record_data as EvidenceRecord),
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        ...((settingsResult.data?.settings ?? {}) as Partial<typeof DEFAULT_WORKSPACE_SETTINGS>),
      },
      auditEvents: (auditResult.data ?? []).map((row) => row.record_data as WorkspaceAuditEvent),
    },
  };
  let initializeDefaults = false;
  if (!settingsResult.data && snapshot.workspace.guidelines.length === 0 && snapshot.workspace.evidence.length === 0) {
    const defaults = createDefaultWorkspaceData();
    snapshot.workspace.guidelines = defaults.guidelines;
    snapshot.workspace.evidence = defaults.evidence;
    snapshot.workspace.settings = defaults.settings;
    snapshot.workspace.auditEvents = defaults.auditEvents;
    initializeDefaults = true;
  }
  writeWorkspaceImportCache(window.localStorage, snapshot.records, snapshot.workspace);
  if (initializeDefaults) await cloudPersistWorkspaceSnapshot(snapshot.workspace);
  window.dispatchEvent(new Event(REVIEW_RECORDS_UPDATED_EVENT));
  window.dispatchEvent(new Event(WORKSPACE_DATA_UPDATED_EVENT));
  return snapshot;
};

export const importLocalWorkspace = async (
  workspaceId: string,
): Promise<{ alreadyImported: boolean; importedRecords: number }> => {
  const client = requiredClient();
  const payload = getLocalImportPayload();
  const { data, error } = await client.rpc('import_local_workspace_data', {
    target_workspace: workspaceId,
    source: payload.sourceId,
    payload: {
      version: payload.version,
      analysisConfigHash: payload.analysisConfigHash,
      records: payload.records,
      workspace: payload.workspace,
    },
  });
  if (error) throw new Error(`Local data import failed. Your browser data is unchanged. ${error.message}`);
  const result = Array.isArray(data) ? data[0] : data;
  return {
    alreadyImported: Boolean(result?.alreadyImported),
    importedRecords: Number(result?.importedRecords ?? 0),
  };
};

export const isSupabaseConfigured = (): boolean => !supabaseConfigurationError;

export const getCurrentSession = async (): Promise<Session | null> => {
  const client = requiredClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(`Authentication session could not be read: ${error.message}`);
  return data.session;
};

export const clearWorkspaceScope = (): void => {
  setActiveWorkspaceStorageScope(null);
  setActiveWorkspace(null);
};
