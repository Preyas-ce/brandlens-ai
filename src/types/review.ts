export type ReviewSeverity = 'critical' | 'moderate' | 'minor';

export type ReviewCategory =
  | 'Voice & Claims'
  | 'Evidence'
  | 'Terminology'
  | 'Current Information'
  | 'Accessibility';

export interface ReviewFinding {
  id: string;
  ruleId: string;
  ruleTitle: string;
  category: ReviewCategory;
  severity: ReviewSeverity;
  quote: string;
  startIndex: number;
  endIndex: number;
  reason: string;
  evidenceReference: string | null;
  evidenceStatus: 'matched' | 'unverified' | 'rule-only';
  suggestion: string;
  suggestionLabel: string;
  safeRewrite?: string;
  evidencePlaceholder?: string;
  guidelineSnapshot?: {
    id: string;
    title: string;
    description: string;
    category: string;
  };
  evidenceSnapshot?: {
    id: string;
    title: string;
    sourceName: string;
    sourceUrl: string;
    associatedClaim: string;
    verificationStatus: 'verified' | 'unverified';
    lastReviewedAt: string;
    reviewDueAt: string;
  };
}

export type ReviewWorkflowStatus =
  | 'draft'
  | 'submitted'
  | 'analysis_complete'
  | 'validation_complete'
  | 'issues_found'
  | 'awaiting_human_verification'
  | 'approved'
  | 'changes_requested'
  | 'rejected';

export type ReviewDecision = 'approved' | 'changes_requested' | 'rejected';

export interface ReviewStatusEvent {
  status: ReviewWorkflowStatus;
  at: string;
  actor: string;
  revision?: number;
  note?: string;
}

export interface ReviewDecisionRecord {
  decision: ReviewDecision;
  reviewer: string;
  comment: string;
  decidedAt: string;
  revision: number;
  contentHash: string;
  content: string;
  suggestedDraft?: string;
}

export interface ReviewRevisionSnapshot {
  revision: number;
  title?: string;
  contentHash: string;
  content: string;
  score: number;
  findings: ReviewFinding[];
  status: ReviewWorkflowStatus;
  submittedAt: string;
}

export interface ReviewRecord {
  id: string;
  demoScenarioId?: string;
  title: string;
  contentType: string;
  campaign: string;
  author: string;
  submittedAt: string;
  originalContent: string;
  currentContent: string;
  suggestedContent: string;
  score: number;
  findings: ReviewFinding[];
  status: ReviewWorkflowStatus;
  aiSummary: string;
  revision: number;
  contentHash: string;
  analysisContentHash: string;
  analysisConfigHash: string;
  statusHistory: ReviewStatusEvent[];
  revisionHistory: ReviewRevisionSnapshot[];
  decisionHistory: ReviewDecisionRecord[];
  signedBy?: string;
  signedNote?: string;
  verifiedAt?: string;
  approvedRevision?: number;
  approvedContentHash?: string;
}

export interface ReviewSubmission {
  title: string;
  contentType: string;
  campaign: string;
  author: string;
  content: string;
}
