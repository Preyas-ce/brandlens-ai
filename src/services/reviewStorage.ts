import {
  ReviewDecision,
  ReviewFinding,
  ReviewRecord,
  ReviewRevisionSnapshot,
  ReviewStatusEvent,
  ReviewSubmission,
  ReviewWorkflowStatus,
} from '@/types/review';

export const REVIEW_RECORDS_STORAGE_KEY = 'brandlens.reviewRecords.v1';
export const REVIEW_RECORDS_UPDATED_EVENT = 'brandlens:review-records-updated';
export const DEMO_REVIEWER_NAME = 'Nitin Editor (Demo Reviewer)';

const LEGACY_STATUS_MAP: Record<string, ReviewWorkflowStatus> = {
  pending: 'awaiting_human_verification',
  revision_requested: 'changes_requested',
};

const WORKFLOW_STATUSES: ReviewWorkflowStatus[] = [
  'draft',
  'submitted',
  'analysis_complete',
  'validation_complete',
  'issues_found',
  'awaiting_human_verification',
  'approved',
  'changes_requested',
  'rejected',
];

const isRecordObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isReviewFinding = (value: unknown): value is ReviewFinding => {
  if (!isRecordObject(value)) return false;
  return typeof value.id === 'string'
    && typeof value.ruleId === 'string'
    && typeof value.ruleTitle === 'string'
    && typeof value.category === 'string'
    && ['Voice & Claims', 'Evidence', 'Terminology', 'Current Information', 'Accessibility'].includes(value.category)
    && ['critical', 'moderate', 'minor'].includes(String(value.severity))
    && typeof value.quote === 'string'
    && typeof value.startIndex === 'number'
    && Number.isFinite(value.startIndex)
    && typeof value.endIndex === 'number'
    && Number.isFinite(value.endIndex)
    && typeof value.reason === 'string'
    && (typeof value.evidenceReference === 'string' || value.evidenceReference === null)
    && ['matched', 'unverified', 'rule-only'].includes(String(value.evidenceStatus))
    && typeof value.suggestion === 'string'
    && typeof value.suggestionLabel === 'string';
};

const isStatusEvent = (value: unknown): boolean => {
  if (!isRecordObject(value)) return false;
  return typeof value.status === 'string'
    && (WORKFLOW_STATUSES.includes(value.status as ReviewWorkflowStatus) || value.status === 'pending' || value.status === 'revision_requested')
    && typeof value.at === 'string'
    && typeof value.actor === 'string'
    && (value.revision === undefined || typeof value.revision === 'number')
    && (value.note === undefined || typeof value.note === 'string');
};

const isRevisionSnapshot = (value: unknown): boolean => {
  if (!isRecordObject(value)) return false;
  return typeof value.revision === 'number'
    && typeof value.contentHash === 'string'
    && typeof value.content === 'string'
    && typeof value.score === 'number'
    && Array.isArray(value.findings)
    && value.findings.every(isReviewFinding)
    && typeof value.status === 'string'
    && (WORKFLOW_STATUSES.includes(value.status as ReviewWorkflowStatus) || value.status === 'pending' || value.status === 'revision_requested')
    && typeof value.submittedAt === 'string'
    && (value.title === undefined || typeof value.title === 'string');
};

const isDecisionRecord = (value: unknown): boolean => {
  if (!isRecordObject(value)) return false;
  return ['approved', 'changes_requested', 'rejected', 'revision_requested'].includes(String(value.decision))
    && typeof value.reviewer === 'string'
    && typeof value.comment === 'string'
    && typeof value.decidedAt === 'string'
    && typeof value.revision === 'number'
    && typeof value.contentHash === 'string'
    && typeof value.content === 'string';
};

const isReviewRecord = (value: unknown): value is ReviewRecord => {
  if (!isRecordObject(value)) return false;
  const record = value as Partial<ReviewRecord> & Record<string, unknown>;
  return typeof record.id === 'string'
    && (record.demoScenarioId === undefined || typeof record.demoScenarioId === 'string')
    && typeof record.title === 'string'
    && typeof record.contentType === 'string'
    && typeof record.originalContent === 'string'
    && typeof record.suggestedContent === 'string'
    && typeof record.score === 'number'
    && Number.isFinite(record.score)
    && Array.isArray(record.findings)
    && record.findings.every(isReviewFinding)
    && typeof record.status === 'string'
    && (WORKFLOW_STATUSES.includes(record.status as ReviewWorkflowStatus) || String(record.status) === 'pending' || String(record.status) === 'revision_requested')
    && (record.currentContent === undefined || typeof record.currentContent === 'string')
    && (record.campaign === undefined || typeof record.campaign === 'string')
    && (record.author === undefined || typeof record.author === 'string')
    && (record.submittedAt === undefined || typeof record.submittedAt === 'string')
    && (record.aiSummary === undefined || typeof record.aiSummary === 'string')
    && (record.contentHash === undefined || typeof record.contentHash === 'string')
    && (record.analysisContentHash === undefined || typeof record.analysisContentHash === 'string')
    && (record.analysisConfigHash === undefined || typeof record.analysisConfigHash === 'string')
    && (record.statusHistory === undefined || (Array.isArray(record.statusHistory) && record.statusHistory.every(isStatusEvent)))
    && (record.revisionHistory === undefined || (Array.isArray(record.revisionHistory) && record.revisionHistory.every(isRevisionSnapshot)))
    && (record.decisionHistory === undefined || (Array.isArray(record.decisionHistory) && record.decisionHistory.every(isDecisionRecord)));
};

export const hashReviewContent = (content: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const migrateRecord = (legacy: ReviewRecord): ReviewRecord => {
  const legacyStatus = String(legacy.status);
  const status = LEGACY_STATUS_MAP[legacyStatus] ?? legacy.status;
  const currentContent = legacy.currentContent ?? legacy.originalContent;
  const contentHash = legacy.contentHash ?? hashReviewContent(currentContent);
  const submittedAt = legacy.submittedAt ?? new Date().toISOString();
  const revision = legacy.revision ?? 1;
  const existingStatusHistory: ReviewStatusEvent[] = legacy.statusHistory ?? [
    { status: 'submitted', at: submittedAt, actor: legacy.author || 'Workspace editor', revision },
    { status: 'analysis_complete', at: submittedAt, actor: 'Local demo analysis', revision },
    {
      status: legacy.findings.length ? 'issues_found' : 'validation_complete',
      at: submittedAt,
      actor: 'Local brand and evidence rules',
      revision,
    },
    { status: 'awaiting_human_verification', at: submittedAt, actor: 'Human verification gate', revision },
    ...(['approved', 'rejected', 'revision_requested'].includes(legacyStatus)
      ? [{
          status: LEGACY_STATUS_MAP[legacyStatus] ?? legacyStatus as ReviewWorkflowStatus,
          at: legacy.verifiedAt ?? submittedAt,
          actor: legacy.signedBy ?? 'Previous reviewer',
          revision,
          note: legacy.signedNote,
        }]
      : []),
  ];
  const statusHistory = existingStatusHistory.map((event, index) => ({
    ...event,
    status: LEGACY_STATUS_MAP[String(event.status)] ?? event.status,
    revision: event.revision ?? (event.status === 'submitted' && index === 0 ? 1 : revision),
  }));

  return {
    ...legacy,
    campaign: legacy.campaign ?? '',
    author: legacy.author ?? 'Workspace editor',
    aiSummary: legacy.aiSummary ?? 'Historical local review record.',
    status,
    currentContent,
    revision,
    contentHash,
    analysisContentHash: legacy.analysisContentHash ?? '',
    analysisConfigHash: legacy.analysisConfigHash ?? '',
    statusHistory,
    revisionHistory: (legacy.revisionHistory ?? []).map((snapshot) => ({
      ...snapshot,
      status: LEGACY_STATUS_MAP[String(snapshot.status)] ?? snapshot.status,
    })),
    decisionHistory: legacy.decisionHistory?.map((decision) => ({
      ...decision,
      decision: LEGACY_STATUS_MAP[String(decision.decision)] === 'changes_requested'
        ? 'changes_requested'
        : decision.decision,
    })) ?? (
      legacyStatus === 'approved' || legacyStatus === 'rejected' || legacyStatus === 'revision_requested'
        ? [{
            decision: LEGACY_STATUS_MAP[legacyStatus] === 'changes_requested'
              ? 'changes_requested'
              : legacyStatus as ReviewDecision,
            reviewer: legacy.signedBy ?? 'Previous reviewer',
            comment: legacy.signedNote ?? '',
            decidedAt: legacy.verifiedAt ?? submittedAt,
            revision: legacy.revision ?? 1,
            contentHash,
            content: currentContent,
          }]
        : []
    ),
    approvedRevision: legacy.approvedRevision ?? (legacyStatus === 'approved' ? revision : undefined),
    approvedContentHash: legacy.approvedContentHash ?? (legacyStatus === 'approved' ? contentHash : undefined),
  };
};

const ALLOWED_TRANSITIONS: Partial<Record<ReviewWorkflowStatus, ReviewWorkflowStatus[]>> = {
  draft: ['submitted'],
  submitted: ['analysis_complete'],
  analysis_complete: ['validation_complete', 'issues_found'],
  validation_complete: ['awaiting_human_verification'],
  issues_found: ['awaiting_human_verification'],
  awaiting_human_verification: ['approved', 'changes_requested', 'rejected', 'draft'],
  approved: ['submitted', 'draft'],
  changes_requested: ['submitted', 'draft'],
};

const ensureTransition = (from: ReviewWorkflowStatus, to: ReviewWorkflowStatus): void => {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`Invalid review status transition: ${from} → ${to}.`);
  }
};

const pushStatus = (
  record: ReviewRecord,
  status: ReviewWorkflowStatus,
  actor: string,
  note?: string,
): void => {
  ensureTransition(record.status, status);
  const event: ReviewStatusEvent = { status, at: new Date().toISOString(), actor, revision: record.revision, note };
  record.status = status;
  record.statusHistory = [...record.statusHistory, event];
};

const writeReviewRecords = (records: ReviewRecord[]): void => {
  window.localStorage.setItem(REVIEW_RECORDS_STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(REVIEW_RECORDS_UPDATED_EVENT));
};

export const readReviewRecords = (): ReviewRecord[] => {
  const rawRecords = window.localStorage.getItem(REVIEW_RECORDS_STORAGE_KEY);
  if (rawRecords === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawRecords);
  } catch (error) {
    throw new Error(`Saved review records could not be read: ${error instanceof Error ? error.message : 'invalid JSON'}`);
  }

  if (!Array.isArray(parsed) || !parsed.every(isReviewRecord)) {
    throw new Error('Saved review records use an unsupported format. They have been left unchanged.');
  }

  const records = parsed.map(migrateRecord);
  if (records.some((record, index) => JSON.stringify(record) !== JSON.stringify(parsed[index]))) {
    writeReviewRecords(records);
  }
  return records;
};

const appendAnalysisLifecycle = (record: ReviewRecord): void => {
  pushStatus(record, 'analysis_complete', 'Local demo analysis');
  pushStatus(record, record.findings.length ? 'issues_found' : 'validation_complete', 'Local brand and evidence rules');
  pushStatus(record, 'awaiting_human_verification', 'Human verification gate');
};

const createRecordId = (): string => (
  typeof window.crypto?.randomUUID === 'function'
    ? `DOC-${window.crypto.randomUUID().slice(0, 8).toUpperCase()}`
    : `DOC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
);

export const saveReviewRecord = (
  submission: ReviewSubmission,
  score: number,
  findings: ReviewRecord['findings'],
  aiSummary: string,
  analysisConfigHash: string,
  demoScenarioId?: string,
): ReviewRecord => {
  const records = readReviewRecords();
  const now = new Date().toISOString();
  const contentHash = hashReviewContent(submission.content);
  const record: ReviewRecord = {
    id: createRecordId(),
    demoScenarioId,
    title: submission.title,
    contentType: submission.contentType,
    campaign: submission.campaign,
    author: submission.author,
    submittedAt: now,
    originalContent: submission.content,
    currentContent: submission.content,
    suggestedContent: submission.content,
    score,
    findings,
    status: 'submitted',
    aiSummary,
    revision: 1,
    contentHash,
    analysisContentHash: contentHash,
    analysisConfigHash,
    statusHistory: [{ status: 'submitted', at: now, actor: submission.author || 'Workspace editor', revision: 1 }],
    revisionHistory: [],
    decisionHistory: [],
  };

  appendAnalysisLifecycle(record);
  writeReviewRecords([record, ...records]);
  return record;
};

export const resetDemoReviewRecords = (): number => {
  const records = readReviewRecords();
  const remainingRecords = records.filter((record) => !record.demoScenarioId);
  const removedCount = records.length - remainingRecords.length;
  if (removedCount > 0) writeReviewRecords(remainingRecords);
  return removedCount;
};

export const clearUserGeneratedReviewRecords = (): number => {
  const records = readReviewRecords();
  const remaining = records.filter((record) => Boolean(record.demoScenarioId));
  const removed = records.length - remaining.length;
  if (removed) writeReviewRecords(remaining);
  return removed;
};

export const clearAllReviewRecords = (): number => {
  const records = readReviewRecords();
  if (records.length) writeReviewRecords([]);
  return records.length;
};

export const resubmitReviewRecord = (
  id: string,
  submission: ReviewSubmission,
  score: number,
  findings: ReviewRecord['findings'],
  aiSummary: string,
  analysisConfigHash: string,
): ReviewRecord => {
  const records = readReviewRecords();
  const index = records.findIndex((record) => record.id === id);
  if (index < 0) throw new Error(`Review record ${id} was not found in local storage.`);
  const existing = records[index];
  if (existing.status !== 'changes_requested' && existing.status !== 'approved' && existing.status !== 'draft') {
    throw new Error(`A ${existing.status.replace(/_/g, ' ')} review cannot be revised and resubmitted.`);
  }
  const contentHash = hashReviewContent(submission.content);

  const now = new Date().toISOString();
  const snapshot: ReviewRevisionSnapshot = {
    revision: existing.revision,
    title: existing.title,
    contentHash: existing.contentHash,
    content: existing.currentContent,
    score: existing.score,
    findings: existing.findings,
    status: existing.status,
    submittedAt: existing.submittedAt,
  };
  const revised: ReviewRecord = {
    ...existing,
    title: submission.title,
    contentType: submission.contentType,
    campaign: submission.campaign,
    author: submission.author,
    submittedAt: now,
    originalContent: submission.content,
    currentContent: submission.content,
    suggestedContent: submission.content,
    score,
    findings,
    aiSummary,
    revision: existing.revision + (existing.status === 'draft' ? 0 : 1),
    contentHash,
    analysisContentHash: contentHash,
    analysisConfigHash,
    revisionHistory: existing.status === 'draft'
      ? existing.revisionHistory
      : [...existing.revisionHistory, snapshot],
    statusHistory: existing.statusHistory,
    status: existing.status,
  };
  pushStatus(revised, 'submitted', submission.author || 'Workspace editor', `Revision ${revised.revision} submitted for re-analysis.`);
  appendAnalysisLifecycle(revised);
  writeReviewRecords(records.map((record, recordIndex) => (recordIndex === index ? revised : record)));
  return revised;
};

export const saveReviewDraft = (
  id: string,
  content: string,
  metadata?: Pick<ReviewSubmission, 'title' | 'contentType' | 'campaign' | 'author'>,
  forceRevision = false,
): ReviewRecord => {
  const records = readReviewRecords();
  const index = records.findIndex((record) => record.id === id);
  if (index < 0) throw new Error(`Review record ${id} was not found in local storage.`);
  const existing = records[index];
  if (!['awaiting_human_verification', 'approved', 'changes_requested', 'draft'].includes(existing.status)) {
    throw new Error(`A ${existing.status.replace(/_/g, ' ')} review cannot be edited as a draft.`);
  }
  const title = metadata?.title ?? existing.title;
  const contentType = metadata?.contentType ?? existing.contentType;
  const campaign = metadata?.campaign ?? existing.campaign;
  const author = metadata?.author ?? existing.author;
  const hasChanges = content !== existing.currentContent
    || title !== existing.title
    || contentType !== existing.contentType
    || campaign !== existing.campaign
    || author !== existing.author;
  if (!hasChanges && !forceRevision) return existing;

  const contentHash = hashReviewContent(content);
  const isNewRevision = existing.status !== 'draft';
  const snapshot: ReviewRevisionSnapshot = {
    revision: existing.revision,
    title: existing.title,
    contentHash: existing.contentHash,
    content: existing.currentContent,
    score: existing.score,
    findings: existing.findings,
    status: existing.status,
    submittedAt: existing.submittedAt,
  };
  const draft: ReviewRecord = {
    ...existing,
    title,
    contentType,
    campaign,
    author,
    originalContent: content,
    currentContent: content,
    suggestedContent: content,
    score: 0,
    findings: [],
    aiSummary: 'This content revision has changed and requires local analysis before human review.',
    revision: existing.revision + (isNewRevision ? 1 : 0),
    contentHash,
    analysisContentHash: '',
    analysisConfigHash: '',
    revisionHistory: isNewRevision
      ? [...existing.revisionHistory, snapshot]
      : existing.revisionHistory,
    statusHistory: existing.statusHistory,
    status: existing.status,
  };
  if (isNewRevision) {
    pushStatus(draft, 'draft', existing.author || 'Workspace editor', `Revision ${draft.revision} edited; analysis and human verification are required.`);
  }
  writeReviewRecords(records.map((record, recordIndex) => (recordIndex === index ? draft : record)));
  return draft;
};

export const decideReviewRecord = (
  id: string,
  decision: ReviewDecision,
  reviewer: string,
  comment: string,
  currentAnalysisConfigHash: string,
  suggestedDraft?: string,
): ReviewRecord => {
  const records = readReviewRecords();
  const index = records.findIndex((record) => record.id === id);
  if (index < 0) throw new Error(`Review record ${id} was not found in local storage.`);
  const record = { ...records[index] };
  if (record.status !== 'awaiting_human_verification') {
    throw new Error(`This review is not awaiting a human decision (current status: ${record.status.replace(/_/g, ' ')}).`);
  }
  if (record.analysisContentHash !== record.contentHash || hashReviewContent(record.currentContent) !== record.contentHash) {
    throw new Error('The current content does not match the analysed revision. Analyse it again before making a decision.');
  }
  if (!record.analysisConfigHash || record.analysisConfigHash !== currentAnalysisConfigHash) {
    throw new Error('The active brand guidelines or evidence have changed since this analysis. Re-analyse the content before making a decision.');
  }
  if ((decision === 'changes_requested' || decision === 'rejected') && !comment.trim()) {
    throw new Error('A reviewer comment is required for this decision.');
  }

  const decidedAt = new Date().toISOString();
  const decisionRecord = {
    decision,
    reviewer,
    comment: comment.trim(),
    decidedAt,
    revision: record.revision,
    contentHash: record.contentHash,
    content: record.currentContent,
    suggestedDraft: suggestedDraft?.trim() || undefined,
  };
  pushStatus(record, decision, reviewer, comment.trim());
  record.decisionHistory = [...record.decisionHistory, decisionRecord];
  record.signedBy = reviewer;
  record.signedNote = comment.trim();
  record.verifiedAt = decidedAt;
  if (decision === 'approved') {
    record.approvedRevision = record.revision;
    record.approvedContentHash = record.contentHash;
  }
  writeReviewRecords(records.map((candidate, candidateIndex) => (candidateIndex === index ? record : candidate)));
  return record;
};

export const updateReviewRecord = (
  id: string,
  updates: Partial<Pick<ReviewRecord, 'suggestedContent'>>,
): ReviewRecord => {
  const records = readReviewRecords();
  const index = records.findIndex((record) => record.id === id);
  if (index < 0) throw new Error(`Review record ${id} was not found in local storage.`);
  const updatedRecord: ReviewRecord = { ...records[index], ...updates };
  const nextRecords = records.slice();
  nextRecords[index] = updatedRecord;
  writeReviewRecords(nextRecords);
  return updatedRecord;
};
