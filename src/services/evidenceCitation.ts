import { LocalEvidence } from '@/services/localReviewEngine';
import { ReviewFinding } from '@/types/review';

export interface EvidenceCitationRewrite {
  startIndex: number;
  endIndex: number;
  text: string;
}

export const getVerifiedEvidenceCitationId = (
  finding: ReviewFinding,
  evidenceCatalogue: LocalEvidence[],
): string | null => {
  if (finding.evidenceStatus !== 'matched') return null;
  const evidenceId = finding.evidenceReference?.match(/\bEVD-[A-Z0-9-]+\b/)?.[0];
  const evidence = evidenceCatalogue.find((entry) => entry.id === evidenceId);
  const snapshot = finding.evidenceSnapshot;
  if (
    !evidenceId
    || !evidence
    || !snapshot
    || snapshot.id !== evidenceId
    || snapshot.verificationStatus !== 'verified'
    || evidence.verificationStatus !== 'verified'
    || evidence.freshness !== 'verified'
    || evidence.approvedPhrase.trim().toLowerCase() !== snapshot.associatedClaim.trim().toLowerCase()
  ) return null;
  const claim = evidence.approvedPhrase.trim().toLowerCase();
  const quote = finding.quote.trim().toLowerCase();
  return claim.includes(quote) || quote.includes(claim) ? evidenceId : null;
};

export const getEvidenceCitationRewrite = (
  content: string,
  finding: ReviewFinding,
  evidenceCatalogue: LocalEvidence[],
): EvidenceCitationRewrite | null => {
  const escapedQuote = finding.quote.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const quoteMatch = new RegExp(escapedQuote, 'i').exec(content);
  if (!quoteMatch || quoteMatch.index === undefined) return null;

  const evidenceId = getVerifiedEvidenceCitationId(finding, evidenceCatalogue);
  return {
    startIndex: quoteMatch.index,
    endIndex: quoteMatch.index + quoteMatch[0].length,
    text: `${quoteMatch[0]} ${evidenceId
      ? `[Evidence citation: ${evidenceId}]`
      : '[approved evidence required]'}`,
  };
};
