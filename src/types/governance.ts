export type VerificationStatus = 
  | 'uninspected'
  | 'inspection_pending'
  | 'issues_detected'
  | 'human_gate_ready'
  | 'approved'
  | 'rejected'
  | 'revisions_requested';

export type IssueSeverity = 'critical' | 'warning' | 'advisory';

export type GuidelineCategory = 
  | 'voice_and_tone'
  | 'terminology'
  | 'verifiable_facts'
  | 'compliance'
  | 'asset_usage';

export interface IssueEvidence {
  id: string;
  ruleId: string;
  ruleTitle: string;
  category: GuidelineCategory;
  severity: IssueSeverity;
  quote: string;
  startIndex: number;
  endIndex: number;
  explanation: string;
  suggestion?: string;
}

export interface ContentInspection {
  id: string;
  title: string;
  sourceType: 'ai_generated' | 'agency_submission' | 'internal_draft';
  author: string;
  timestamp: string;
  content: string;
  status: VerificationStatus;
  overallScore: number; // 0 - 100
  issues: IssueEvidence[];
  humanReviewerNote?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}
