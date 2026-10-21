import { ReviewSeverity } from '@/types/review';

export type GuidelineCategory =
  | 'Brand voice and tone'
  | 'Approved and prohibited terminology'
  | 'Messaging principles'
  | 'Approved factual claims and promotional statements'
  | 'Accessibility guidelines'
  | 'Visual identity guidance'
  | 'General brand rules';

export type GuidelineRuleType =
  | 'guidance'
  | 'prohibited_term'
  | 'approved_terminology'
  | 'claim_evidence';

export interface GuidelineRecord {
  id: string;
  title: string;
  description: string;
  category: GuidelineCategory;
  ruleType: GuidelineRuleType;
  phrases: string[];
  approvedPhrase: string;
  severity: ReviewSeverity;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EvidenceVerificationStatus = 'verified' | 'unverified';

export interface EvidenceRecord {
  id: string;
  title: string;
  description: string;
  sourceName: string;
  sourceUrl: string;
  associatedClaim: string;
  guidelineId: string;
  verificationStatus: EvidenceVerificationStatus;
  lastReviewedAt: string;
  reviewDueAt: string;
  createdAt: string;
  updatedAt: string;
}

export type AuditEventType =
  | 'guideline_created'
  | 'guideline_updated'
  | 'guideline_activated'
  | 'guideline_deactivated'
  | 'guideline_deleted'
  | 'evidence_created'
  | 'evidence_updated'
  | 'evidence_deleted'
  | 'settings_updated';

export interface WorkspaceAuditEvent {
  id: string;
  type: AuditEventType;
  entityId: string;
  entityTitle: string;
  timestamp: string;
  actor: string;
  description: string;
  snapshot: Record<string, string>;
}

export interface WorkspaceSettings {
  workspaceName: string;
  demoBrandName: string;
  reviewerDisplayName: string;
  gateStrictness: 'strict' | 'flexible';
  requireNamedSignature: boolean;
  minPassScore: number;
}
