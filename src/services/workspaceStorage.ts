import { readReviewRecords } from '@/services/reviewStorage';
import { ReviewFinding } from '@/types/review';
import {
  AuditEventType,
  EvidenceRecord,
  GuidelineCategory,
  GuidelineRecord,
  WorkspaceAuditEvent,
  WorkspaceSettings,
} from '@/types/workspace';

export const WORKSPACE_DATA_STORAGE_KEY = 'brandlens.workspaceData.v1';
export const WORKSPACE_DATA_UPDATED_EVENT = 'brandlens:workspace-data-updated';

export const GUIDELINE_CATEGORIES: GuidelineCategory[] = [
  'Brand voice and tone',
  'Approved and prohibited terminology',
  'Messaging principles',
  'Approved factual claims and promotional statements',
  'Accessibility guidelines',
  'Visual identity guidance',
  'General brand rules',
];

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  workspaceName: 'Apex Media Global HQ',
  demoBrandName: 'BrandLens AI',
  reviewerDisplayName: 'Nitin Editor (Demo Reviewer)',
  gateStrictness: 'strict',
  requireNamedSignature: true,
  minPassScore: 80,
};

const now = (): string => new Date().toISOString();

const DEFAULT_GUIDELINES: GuidelineRecord[] = [
  {
    id: 'R-101',
    title: 'Support superlatives with evidence',
    description: 'Comparative or absolute praise needs a named, approved source or a concrete capability.',
    category: 'Brand voice and tone',
    ruleType: 'guidance',
    phrases: ['best in class', 'world leading', 'industry leading', 'revolutionary', 'unmatched', 'unprecedented', 'number one'],
    approvedPhrase: '',
    severity: 'moderate',
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'R-103',
    title: 'Qualify guarantees and quantified claims',
    description: 'Guarantees and percentage results require applicable approved evidence. Missing evidence is Unverified.',
    category: 'Approved factual claims and promotional statements',
    ruleType: 'claim_evidence',
    phrases: ['guarantee', 'guaranteed', 'guarantees', 'promise', 'promises', 'always', 'never fail', 'zero risk', 'no downtime', 'uptime'],
    approvedPhrase: '',
    severity: 'critical',
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'R-102',
    title: 'Use the approved BrandLens AI wordmark',
    description: 'Use the exact approved product name “BrandLens AI”.',
    category: 'Approved and prohibited terminology',
    ruleType: 'approved_terminology',
    phrases: ['brandlens', 'brand lens', 'BrandLens'],
    approvedPhrase: 'BrandLens AI',
    severity: 'moderate',
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'R-104',
    title: 'Avoid disallowed corporate jargon',
    description: 'Prefer direct editorial language to the disallowed terms listed here.',
    category: 'Approved and prohibited terminology',
    ruleType: 'prohibited_term',
    phrases: ['synergy', 'synergies', 'boil the ocean', 'low-hanging fruit'],
    approvedPhrase: '',
    severity: 'minor',
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'R-105',
    title: 'Verify time-sensitive statements',
    description: 'Current, latest, or dated statements need an applicable source with a review date.',
    category: 'Approved factual claims and promotional statements',
    ruleType: 'guidance',
    phrases: ['current', 'currently', 'latest', 'as of', 'today’s', 'this year’s'],
    approvedPhrase: '',
    severity: 'moderate',
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'R-106',
    title: 'Use clear, accessible calls to action',
    description: 'Link labels should describe their destination; extended all-caps text can reduce readability.',
    category: 'Accessibility guidelines',
    ruleType: 'guidance',
    phrases: ['click here', 'read more', 'learn more'],
    approvedPhrase: '',
    severity: 'minor',
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'R-107',
    title: 'Protect the editorial color palette',
    description: 'Visual materials should respect the Warm Ivory and Obsidian palette with restrained copper and forest accents.',
    category: 'Visual identity guidance',
    ruleType: 'guidance',
    phrases: [],
    approvedPhrase: '',
    severity: 'minor',
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'R-108',
    title: 'Lead with clear, human-centered messaging',
    description: 'Explain the benefit plainly and retain human accountability for final publication decisions.',
    category: 'Messaging principles',
    ruleType: 'guidance',
    phrases: [],
    approvedPhrase: '',
    severity: 'minor',
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'R-109',
    title: 'Follow general brand governance',
    description: 'Content must remain accurate, attributable, and subject to the human verification gate.',
    category: 'General brand rules',
    ruleType: 'guidance',
    phrases: [],
    approvedPhrase: '',
    severity: 'moderate',
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
];

const DEFAULT_EVIDENCE: EvidenceRecord[] = [
  {
    id: 'EVD-R102',
    title: 'BrandLens AI wordmark reference (pending verification)',
    description: 'Workspace wording reference for product name spelling; pending verification.',
    sourceName: 'Seeded workspace terminology directive',
    sourceUrl: '',
    associatedClaim: 'Brand name spelling',
    guidelineId: 'R-102',
    verificationStatus: 'unverified',
    lastReviewedAt: '',
    reviewDueAt: '',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'EVD-R103',
    title: 'Availability wording sample',
    description: 'An internal demo phrase; it is not an independent SLA or performance record.',
    sourceName: 'Seeded workspace wording example',
    sourceUrl: '',
    associatedClaim: '99.99% availability target',
    guidelineId: 'R-103',
    verificationStatus: 'unverified',
    lastReviewedAt: '',
    reviewDueAt: '',
    createdAt: now(),
    updatedAt: now(),
  },
];

interface WorkspaceData {
  schemaVersion: 1;
  guidelines: GuidelineRecord[];
  evidence: EvidenceRecord[];
  settings: WorkspaceSettings;
  auditEvents: WorkspaceAuditEvent[];
}

const defaultData = (): WorkspaceData => ({
  schemaVersion: 1,
  guidelines: DEFAULT_GUIDELINES,
  evidence: DEFAULT_EVIDENCE,
  settings: DEFAULT_WORKSPACE_SETTINGS,
  auditEvents: [],
});

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isGuidelineRecord = (value: unknown): value is GuidelineRecord => {
  if (!isPlainObject(value)) return false;
  return typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && GUIDELINE_CATEGORIES.includes(value.category as GuidelineCategory)
    && ['guidance', 'prohibited_term', 'approved_terminology', 'claim_evidence'].includes(String(value.ruleType))
    && Array.isArray(value.phrases)
    && value.phrases.every((phrase) => typeof phrase === 'string')
    && typeof value.approvedPhrase === 'string'
    && ['critical', 'moderate', 'minor'].includes(String(value.severity))
    && typeof value.isActive === 'boolean'
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string';
};

const isEvidenceRecord = (value: unknown): value is EvidenceRecord => {
  if (!isPlainObject(value)) return false;
  return typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof value.sourceName === 'string'
    && typeof value.sourceUrl === 'string'
    && typeof value.associatedClaim === 'string'
    && typeof value.guidelineId === 'string'
    && ['verified', 'unverified'].includes(String(value.verificationStatus))
    && typeof value.lastReviewedAt === 'string'
    && typeof value.reviewDueAt === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string';
};

const isWorkspaceAuditEvent = (value: unknown): value is WorkspaceAuditEvent => {
  if (!isPlainObject(value) || !isPlainObject(value.snapshot)) return false;
  return typeof value.id === 'string'
    && typeof value.type === 'string'
    && typeof value.entityId === 'string'
    && typeof value.entityTitle === 'string'
    && typeof value.timestamp === 'string'
    && typeof value.actor === 'string'
    && typeof value.description === 'string'
    && Object.values(value.snapshot).every((entry) => typeof entry === 'string');
};

const readData = (): WorkspaceData => {
  const raw = window.localStorage.getItem(WORKSPACE_DATA_STORAGE_KEY);
  if (raw === null) {
    const initial = defaultData();
    writeData(initial);
    return initial;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Workspace data could not be read: ${error instanceof Error ? error.message : 'invalid JSON'}`);
  }
  if (!isPlainObject(value)) throw new Error('Workspace data has an unsupported format.');
  const data = value as Partial<WorkspaceData> & Record<string, unknown>;
  const guidelines = data.guidelines === undefined ? DEFAULT_GUIDELINES : data.guidelines;
  const evidence = data.evidence === undefined ? DEFAULT_EVIDENCE : data.evidence;
  const auditEvents = data.auditEvents === undefined ? [] : data.auditEvents;
  if (!Array.isArray(guidelines) || !guidelines.every(isGuidelineRecord)) {
    throw new Error('Saved brand guidelines use an unsupported format. The stored data has been left unchanged.');
  }
  if (!Array.isArray(evidence) || !evidence.every(isEvidenceRecord)) {
    throw new Error('Saved evidence records use an unsupported format. The stored data has been left unchanged.');
  }
  const normalizedEvidence = evidence.map((record) => (
    record.id === 'EVD-R102'
    && record.title === 'BrandLens AI approved wordmark'
    && record.verificationStatus === 'unverified'
      ? {
        ...record,
        title: 'BrandLens AI wordmark reference (pending verification)',
        description: 'Workspace wording reference for product name spelling; pending verification.',
      }
      : record
  ));
  if (!Array.isArray(auditEvents) || !auditEvents.every(isWorkspaceAuditEvent)) {
    throw new Error('Saved workspace history uses an unsupported format. The stored data has been left unchanged.');
  }
  const storedSettings = data.settings === undefined ? {} : data.settings;
  if (!isPlainObject(storedSettings)) throw new Error('Saved workspace settings use an unsupported format. The stored data has been left unchanged.');
  const readStringSetting = (key: 'workspaceName' | 'demoBrandName' | 'reviewerDisplayName'): string => {
    const savedSetting = storedSettings[key];
    if (savedSetting !== undefined && typeof savedSetting !== 'string') {
      throw new Error(`Saved workspace setting "${key}" is invalid. The stored data has been left unchanged.`);
    }
    return typeof savedSetting === 'string' ? savedSetting : DEFAULT_WORKSPACE_SETTINGS[key];
  };
  const savedStrictness = storedSettings.gateStrictness;
  if (savedStrictness !== undefined && savedStrictness !== 'strict' && savedStrictness !== 'flexible') {
    throw new Error('Saved workspace setting "gateStrictness" is invalid. The stored data has been left unchanged.');
  }
  const savedSignature = storedSettings.requireNamedSignature;
  if (savedSignature !== undefined && typeof savedSignature !== 'boolean') {
    throw new Error('Saved workspace setting "requireNamedSignature" is invalid. The stored data has been left unchanged.');
  }
  const savedScore = storedSettings.minPassScore;
  if (savedScore !== undefined && (typeof savedScore !== 'number' || !Number.isFinite(savedScore) || savedScore < 0 || savedScore > 100)) {
    throw new Error('Saved workspace setting "minPassScore" is invalid. The stored data has been left unchanged.');
  }
  const settings: WorkspaceSettings = {
    workspaceName: readStringSetting('workspaceName'),
    demoBrandName: readStringSetting('demoBrandName'),
    reviewerDisplayName: readStringSetting('reviewerDisplayName'),
    gateStrictness: savedStrictness ?? DEFAULT_WORKSPACE_SETTINGS.gateStrictness,
    requireNamedSignature: savedSignature ?? DEFAULT_WORKSPACE_SETTINGS.requireNamedSignature,
    minPassScore: savedScore ?? DEFAULT_WORKSPACE_SETTINGS.minPassScore,
  };
  const migrated: WorkspaceData = {
    schemaVersion: 1,
    guidelines,
    evidence: normalizedEvidence,
    settings,
    auditEvents,
  };
  if (JSON.stringify(migrated) !== JSON.stringify(value)) writeData(migrated);
  return migrated;
};

const writeData = (data: WorkspaceData): void => {
  window.localStorage.setItem(WORKSPACE_DATA_STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event(WORKSPACE_DATA_UPDATED_EVENT));
};

export const readGuidelines = (): GuidelineRecord[] => readData().guidelines;
export const readEvidenceRecords = (): EvidenceRecord[] => readData().evidence;
export const readWorkspaceSettings = (): WorkspaceSettings => readData().settings;
export const readWorkspaceAuditEvents = (): WorkspaceAuditEvent[] => readData().auditEvents;

const createId = (prefix: string): string => (
  `${prefix}-${typeof window.crypto?.randomUUID === 'function' ? window.crypto.randomUUID().slice(0, 8).toUpperCase() : `${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`}`
);

const appendAudit = (
  data: WorkspaceData,
  type: AuditEventType,
  entityId: string,
  entityTitle: string,
  description: string,
  snapshot: Record<string, string>,
): void => {
  data.auditEvents = [{
    id: createId('EVT'),
    type,
    entityId,
    entityTitle,
    timestamp: now(),
    actor: data.settings.reviewerDisplayName,
    description,
    snapshot,
  }, ...data.auditEvents];
};

export const createGuideline = (
  input: Omit<GuidelineRecord, 'id' | 'createdAt' | 'updatedAt'>,
): GuidelineRecord => {
  const data = readData();
  const timestamp = now();
  const guideline: GuidelineRecord = { ...input, id: createId('R'), createdAt: timestamp, updatedAt: timestamp };
  data.guidelines = [guideline, ...data.guidelines];
  appendAudit(data, 'guideline_created', guideline.id, guideline.title, `Guideline “${guideline.title}” created.`, { category: guideline.category, ruleType: guideline.ruleType });
  writeData(data);
  return guideline;
};

export const updateGuideline = (
  id: string,
  updates: Partial<Omit<GuidelineRecord, 'id' | 'createdAt' | 'updatedAt'>>,
): GuidelineRecord => {
  const data = readData();
  const index = data.guidelines.findIndex((guideline) => guideline.id === id);
  if (index < 0) throw new Error(`Guideline ${id} was not found.`);
  const previous = data.guidelines[index];
  const updated = { ...previous, ...updates, id, createdAt: previous.createdAt, updatedAt: now() };
  data.guidelines = data.guidelines.map((item, itemIndex) => (itemIndex === index ? updated : item));
  const isStatusChange = updates.isActive !== undefined && updates.isActive !== previous.isActive;
  const type: AuditEventType = isStatusChange
    ? updates.isActive ? 'guideline_activated' : 'guideline_deactivated'
    : 'guideline_updated';
  appendAudit(data, type, id, updated.title, `Guideline “${updated.title}” ${isStatusChange ? (updated.isActive ? 'activated' : 'deactivated') : 'updated'}.`, { category: updated.category, ruleType: updated.ruleType });
  writeData(data);
  return updated;
};

export const deleteGuideline = (id: string): GuidelineRecord => {
  const data = readData();
  const guideline = data.guidelines.find((item) => item.id === id);
  if (!guideline) throw new Error(`Guideline ${id} was not found.`);
  if (data.evidence.some((item) => item.guidelineId === id)) {
    throw new Error('This guideline has linked evidence. Reassign or remove the evidence first.');
  }
  data.guidelines = data.guidelines.filter((item) => item.id !== id);
  appendAudit(data, 'guideline_deleted', id, guideline.title, `Guideline “${guideline.title}” deleted.`, { category: guideline.category, ruleType: guideline.ruleType, description: guideline.description });
  writeData(data);
  return guideline;
};

export const createEvidenceRecord = (
  input: Omit<EvidenceRecord, 'id' | 'createdAt' | 'updatedAt'>,
): EvidenceRecord => {
  const data = readData();
  if (input.guidelineId && !data.guidelines.some((guideline) => guideline.id === input.guidelineId)) {
    throw new Error(`Linked guideline ${input.guidelineId} was not found.`);
  }
  const timestamp = now();
  const evidence: EvidenceRecord = { ...input, id: createId('EVD'), createdAt: timestamp, updatedAt: timestamp };
  data.evidence = [evidence, ...data.evidence];
  appendAudit(data, 'evidence_created', evidence.id, evidence.title, `Evidence record “${evidence.title}” created.`, evidenceSnapshot(evidence));
  writeData(data);
  return evidence;
};

const evidenceSnapshot = (evidence: EvidenceRecord): Record<string, string> => ({
  description: evidence.description,
  sourceName: evidence.sourceName,
  sourceUrl: evidence.sourceUrl || 'No external source URL provided',
  associatedClaim: evidence.associatedClaim,
  guidelineId: evidence.guidelineId,
  verificationStatus: evidence.verificationStatus,
  lastReviewedAt: evidence.lastReviewedAt,
  reviewDueAt: evidence.reviewDueAt,
});

export const updateEvidenceRecord = (
  id: string,
  updates: Partial<Omit<EvidenceRecord, 'id' | 'createdAt' | 'updatedAt'>>,
): EvidenceRecord => {
  const data = readData();
  const index = data.evidence.findIndex((evidence) => evidence.id === id);
  if (index < 0) throw new Error(`Evidence record ${id} was not found.`);
  const previous = data.evidence[index];
  const updated = { ...previous, ...updates, id, createdAt: previous.createdAt, updatedAt: now() };
  if (updated.guidelineId && !data.guidelines.some((guideline) => guideline.id === updated.guidelineId)) {
    throw new Error(`Linked guideline ${updated.guidelineId} was not found.`);
  }
  data.evidence = data.evidence.map((item, itemIndex) => (itemIndex === index ? updated : item));
  appendAudit(data, 'evidence_updated', id, updated.title, `Evidence record “${updated.title}” updated.`, evidenceSnapshot(updated));
  writeData(data);
  return updated;
};

const evidenceIsReferenced = (recordId: string): boolean => {
  return readReviewRecords().some((record) => {
    const findings: ReviewFinding[] = [
      ...record.findings,
      ...record.revisionHistory.flatMap((revision) => revision.findings),
    ];
    return findings.some((finding) => finding.evidenceSnapshot?.id === recordId || finding.evidenceReference?.includes(recordId));
  });
};

export const deleteEvidenceRecord = (id: string): { evidence: EvidenceRecord; isReferenced: boolean } => {
  const data = readData();
  const evidence = data.evidence.find((item) => item.id === id);
  if (!evidence) throw new Error(`Evidence record ${id} was not found.`);
  const isReferenced = evidenceIsReferenced(id);
  data.evidence = data.evidence.filter((item) => item.id !== id);
  appendAudit(data, 'evidence_deleted', id, evidence.title, `Evidence record “${evidence.title}” deleted${isReferenced ? '; historical references are preserved in review snapshots' : ''}.`, evidenceSnapshot(evidence));
  writeData(data);
  return { evidence, isReferenced };
};

export const saveWorkspaceSettings = (settings: WorkspaceSettings): WorkspaceSettings => {
  const data = readData();
  const previousSettings = data.settings;
  data.settings = { ...settings };
  if (JSON.stringify(previousSettings) !== JSON.stringify(data.settings)) {
    appendAudit(data, 'settings_updated', 'workspace-settings', data.settings.workspaceName, 'Workspace settings updated.', {
      workspaceName: data.settings.workspaceName,
      demoBrandName: data.settings.demoBrandName,
      reviewerDisplayName: data.settings.reviewerDisplayName,
      gateStrictness: data.settings.gateStrictness,
      requireNamedSignature: String(data.settings.requireNamedSignature),
      minPassScore: String(data.settings.minPassScore),
    });
  }
  writeData(data);
  return data.settings;
};

export const restoreWorkspaceSettings = (): WorkspaceSettings => {
  const data = readData();
  data.settings = { ...DEFAULT_WORKSPACE_SETTINGS };
  appendAudit(data, 'settings_updated', 'workspace-settings', data.settings.workspaceName, 'Workspace settings restored to prototype defaults.', {
    workspaceName: data.settings.workspaceName,
    demoBrandName: data.settings.demoBrandName,
    reviewerDisplayName: data.settings.reviewerDisplayName,
  });
  writeData(data);
  return data.settings;
};

export const getEvidenceFreshness = (
  evidence: EvidenceRecord,
  today = new Date().toISOString().slice(0, 10),
): 'verified' | 'unverified' | 'expired' | 'due' => {
  const reviewDueDate = evidence.reviewDueAt.slice(0, 10);
  const lastReviewedDate = evidence.lastReviewedAt.slice(0, 10);
  if (reviewDueDate && reviewDueDate < today) return 'expired';
  if (
    evidence.verificationStatus !== 'verified'
    || !evidence.lastReviewedAt
    || !evidence.reviewDueAt
    || lastReviewedDate > today
  ) return 'unverified';
  if (reviewDueDate && reviewDueDate <= today) return 'due';
  return 'verified';
};

export const getWorkspaceAnalysisConfigHash = (): string => {
  const data = readData();
  const snapshot = JSON.stringify({
    guidelines: data.guidelines
      .filter((guideline) => guideline.isActive)
      .slice()
      .sort((left, right) => left.id.localeCompare(right.id)),
    evidence: data.evidence
      .slice()
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((evidence) => ({
        ...evidence,
        freshness: getEvidenceFreshness(evidence),
      })),
  });
  let hash = 2166136261;
  for (let index = 0; index < snapshot.length; index += 1) {
    hash ^= snapshot.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export const findEvidenceForClaim = (
  claim: string,
  guidelineId: string,
  records = readEvidenceRecords(),
): EvidenceRecord | undefined => {
  return findEvidenceCandidatesForClaim(claim, guidelineId, records)
    .find((evidence) => getEvidenceFreshness(evidence) === 'verified');
};

export const findEvidenceCandidatesForClaim = (
  claim: string,
  guidelineId: string,
  records = readEvidenceRecords(),
): EvidenceRecord[] => {
  const normalizedClaim = claim.toLowerCase();
  return records.filter((evidence) => {
    if (evidence.guidelineId && evidence.guidelineId !== guidelineId) return false;
    const associatedClaim = evidence.associatedClaim.trim().toLowerCase();
    return associatedClaim.length >= 5 && normalizedClaim.includes(associatedClaim);
  });
};
