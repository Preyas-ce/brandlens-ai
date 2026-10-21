import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Clock3,
  FileEdit,
  FileSearch,
  History,
  LockKeyhole,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Panel } from '@/components/ui/Panel';
import { GuidelineGeometry } from '@/components/brand/GuidelineGeometry';
import { Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  decideReviewRecord,
  hashReviewContent,
  readReviewRecords,
  REVIEW_RECORDS_STORAGE_KEY,
  REVIEW_RECORDS_UPDATED_EVENT,
} from '@/services/reviewStorage';
import { getLocalBrandRules, getLocalEvidenceCatalogue, LocalBrandRule, LocalEvidence } from '@/services/localReviewEngine';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  getWorkspaceAnalysisConfigHash,
  readWorkspaceSettings,
  WORKSPACE_DATA_UPDATED_EVENT,
} from '@/services/workspaceStorage';
import { WorkspaceSettings } from '@/types/workspace';
import {
  ReviewDecision,
  ReviewFinding,
  ReviewRecord,
  ReviewWorkflowStatus,
} from '@/types/review';

type QueueFilter = 'awaiting_human_verification' | 'approved' | 'changes_requested' | 'rejected' | 'all';

const FILTERS: { value: QueueFilter; label: string }[] = [
  { value: 'awaiting_human_verification', label: 'Awaiting review' },
  { value: 'approved', label: 'Approved' },
  { value: 'changes_requested', label: 'Changes requested' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All reviews' },
];

const STATUS_LABELS: Record<ReviewWorkflowStatus, string> = {
  draft: 'Needs analysis',
  submitted: 'Submitted',
  analysis_complete: 'Analysis complete',
  validation_complete: 'Validation complete',
  issues_found: 'Issues found',
  awaiting_human_verification: 'Awaiting human verification',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  rejected: 'Rejected',
};

const STATUS_STYLES: Record<ReviewWorkflowStatus, string> = {
  draft: 'border-stone-300 bg-stone-100 text-stone-700',
  submitted: 'border-copper-300 bg-copper-50 text-copper-800',
  analysis_complete: 'border-copper-300 bg-copper-50 text-copper-800',
  validation_complete: 'border-forest-300 bg-forest-50 text-forest-700',
  issues_found: 'border-copper-300 bg-copper-50 text-copper-800',
  awaiting_human_verification: 'border-copper-300 bg-copper-50 text-copper-800',
  approved: 'border-forest-300 bg-forest-50 text-forest-700',
  changes_requested: 'border-copper-300 bg-copper-50 text-copper-800',
  rejected: 'border-stone-400 bg-stone-200 text-obsidian',
};

const SEVERITY_STYLES: Record<ReviewFinding['severity'], string> = {
  critical: 'border-copper-400 bg-copper-50 text-copper-900',
  moderate: 'border-copper-300 bg-ivory-100 text-copper-800',
  minor: 'border-stone-300 bg-stone-100 text-stone-700',
};

const EVIDENCE_LABELS: Record<ReviewFinding['evidenceStatus'], string> = {
  matched: 'Catalogue match',
  unverified: 'Unverified',
  'rule-only': 'Rule reference only',
};

const ERROR_MESSAGE = (error: unknown): string => (
  error instanceof Error ? error.message : 'The browser could not access local review storage.'
);

const formatDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString();
};

const getFindingCounts = (findings: ReviewFinding[]) => ({
  critical: findings.filter((finding) => finding.severity === 'critical').length,
  moderate: findings.filter((finding) => finding.severity === 'moderate').length,
  minor: findings.filter((finding) => finding.severity === 'minor').length,
});

const getLatestDecision = (record: ReviewRecord) => (
  [...record.decisionHistory].reverse().find(
    (decision) => decision.revision === record.revision && decision.contentHash === record.contentHash,
  )
);

const REVIEW_STAGES = [
  { key: 'analysis', title: 'AI Content Analysis', icon: FileSearch },
  { key: 'validation', title: 'Brand & Evidence Validation', icon: BookOpenCheck },
  { key: 'human', title: 'Human Verification', icon: UserRoundCheck },
  { key: 'publication', title: 'Publication Approval', icon: BadgeCheck },
] as const;

export const ApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const { reviewId } = useParams<{ reviewId: string }>();
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<QueueFilter>(
    FILTERS.find((item) => item.value === searchParams.get('filter'))?.value ?? 'awaiting_human_verification',
  );
  const [storageError, setStorageError] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const [activeDecision, setActiveDecision] = useState<ReviewDecision | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [suggestedDraft, setSuggestedDraft] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [reviewerName, setReviewerName] = useState(DEFAULT_WORKSPACE_SETTINGS.reviewerDisplayName);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS);
  const [analysisConfigHash, setAnalysisConfigHash] = useState('');
  const [localRules, setLocalRules] = useState<LocalBrandRule[]>([]);
  const [evidenceCatalogue, setEvidenceCatalogue] = useState<LocalEvidence[]>([]);

  useEffect(() => {
    const refreshRecords = () => {
      try {
        setRecords(readReviewRecords());
        setStorageError('');
      } catch (error) {
        setStorageError(`Reviews could not be loaded: ${ERROR_MESSAGE(error)}`);
      } finally {
        setIsLoading(false);
      }
    };
    refreshRecords();
    window.addEventListener(REVIEW_RECORDS_UPDATED_EVENT, refreshRecords);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === REVIEW_RECORDS_STORAGE_KEY) refreshRecords();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(REVIEW_RECORDS_UPDATED_EVENT, refreshRecords);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    const refreshReviewer = () => {
      try {
        const settings = readWorkspaceSettings();
        setReviewerName(settings.reviewerDisplayName);
        setWorkspaceSettings(settings);
        setAnalysisConfigHash(getWorkspaceAnalysisConfigHash());
        setLocalRules(getLocalBrandRules());
        setEvidenceCatalogue(getLocalEvidenceCatalogue());
        setWorkspaceError('');
      } catch (error) {
        setWorkspaceError(`Workspace configuration could not be loaded: ${ERROR_MESSAGE(error)}`);
      }
    };
    refreshReviewer();
    window.addEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshReviewer);
    return () => window.removeEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshReviewer);
  }, []);

  const selectedRecord = reviewId ? records.find((record) => record.id === reviewId) : undefined;
  const filteredRecords = useMemo(
    () => {
      const matchingRecords = records.filter((record) => filter === 'all' || record.status === filter);
      if (filter !== 'awaiting_human_verification') return matchingRecords;
      const requiresPriority = (record: ReviewRecord) => {
        const hasCritical = record.findings.some((finding) => finding.severity === 'critical');
        const hasElevated = record.findings.some((finding) => finding.severity === 'moderate');
        const belowScoreThreshold = record.score < workspaceSettings.minPassScore;
        return belowScoreThreshold || hasCritical || (workspaceSettings.gateStrictness === 'strict' && hasElevated);
      };
      return matchingRecords.sort((left, right) => {
        const priorityDelta = Number(requiresPriority(right)) - Number(requiresPriority(left));
        if (priorityDelta) return priorityDelta;
        return new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime();
      });
    },
    [filter, records, workspaceSettings.gateStrictness, workspaceSettings.minPassScore],
  );
  const pendingCount = records.filter((record) => record.status === 'awaiting_human_verification').length;

  const openDecision = (decision: ReviewDecision) => {
    setActiveDecision(decision);
    setReviewComment('');
    setSuggestedDraft(selectedRecord?.currentContent ?? '');
    setDecisionError('');
  };

  const confirmDecision = () => {
    if (!selectedRecord || !activeDecision || isSaving) return;
    if (workspaceSettings.requireNamedSignature && !reviewerName.trim()) {
      setDecisionError('A reviewer display name is required by the current workspace policy.');
      return;
    }
    if ((activeDecision === 'changes_requested' || activeDecision === 'rejected') && !reviewComment.trim()) {
      setDecisionError(activeDecision === 'rejected'
        ? 'A rejection reason is required.'
        : 'Explain the changes needed before submitting this decision.');
      return;
    }
    setIsSaving(true);
    setDecisionError('');
    try {
      decideReviewRecord(
        selectedRecord.id,
        activeDecision,
        reviewerName.trim() || 'Anonymous demo reviewer',
        reviewComment,
        getWorkspaceAnalysisConfigHash(),
        activeDecision === 'changes_requested' ? suggestedDraft : undefined,
      );
      setActiveDecision(null);
      setReviewComment('');
    } catch (error) {
      setDecisionError(ERROR_MESSAGE(error));
    } finally {
      setIsSaving(false);
    }
  };

  if (reviewId) {
    if (storageError) {
      return <ErrorState message={storageError} onBack={() => navigate('/approvals')} />;
    }
    if (isLoading) {
      return <p role="status" className="flex items-center gap-2 py-8 text-sm text-stone-600"><LoaderCircle className="h-4 w-4 animate-spin text-copper" />Loading review record…</p>;
    }
    if (!selectedRecord) {
      return (
        <div className="space-y-4">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />} onClick={() => navigate('/approvals')}>Back to queue</Button>
          <EmptyState kicker="HUMAN VERIFICATION" title="Review not found" description="This review is not present in the shared local review store." icon={<FileSearch className="h-5 w-5 text-stone-500" />} />
        </div>
      );
    }
    return (
      <>
        <ReviewDetail
          record={selectedRecord}
          localRules={localRules}
          evidenceCatalogue={evidenceCatalogue}
          reviewerName={reviewerName}
          analysisConfigHash={analysisConfigHash}
          gateStrictness={workspaceSettings.gateStrictness}
          storageError={workspaceError}
          onBack={() => navigate('/approvals')}
          onEdit={() => navigate(`/review?record=${encodeURIComponent(selectedRecord.id)}`)}
          onReanalyze={() => navigate(`/review?record=${encodeURIComponent(selectedRecord.id)}&reanalyze=1`)}
          onDecision={openDecision}
        />
        <Modal
          isOpen={activeDecision !== null}
          onClose={() => {
            if (!isSaving) {
              setActiveDecision(null);
              setDecisionError('');
            }
          }}
          kicker="DEMO REVIEWER · HUMAN VERIFICATION"
          title={activeDecision ? decisionTitle(activeDecision) : 'Confirm decision'}
          subtitle={`Record ${selectedRecord.id} · Revision ${selectedRecord.revision} · ${selectedRecord.contentHash}`}
          maxWidth="lg"
        >
          {activeDecision && (
            <div className="space-y-4">
              <div className={`border-l-2 px-3 py-2 text-xs leading-relaxed ${activeDecision === 'approved' ? 'border-forest bg-forest-50 text-forest-900' : 'border-copper bg-copper-50 text-copper-900'}`}>
                {decisionExplanation(activeDecision)}
              </div>
              <div className="max-h-36 overflow-y-auto whitespace-pre-wrap border border-stone-200 bg-ivory-50 p-3 text-xs leading-relaxed text-stone-700">
                {selectedRecord.currentContent}
              </div>
              {activeDecision === 'changes_requested' && (
                <div className="space-y-2">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-600">Quick reviewer directives · based on active findings</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { rule: 'R-103', label: '+ Remove unsubstantiated 100% / guarantee claim (R-103)' },
                      { rule: 'R-103', label: '+ Attach approved SLA / benchmark evidence (EVI-01)' },
                      { rule: 'R-101', label: '+ Soften unverified global superlative (R-101)' },
                      { rule: 'R-106', label: '+ Fix CTA accessibility & tone (R-106)' },
                    ]
                      .filter((directive) => selectedRecord.findings.some((finding) => finding.ruleId === directive.rule))
                      .map((directive) => (
                        <button
                          key={directive.label}
                          type="button"
                          onClick={() => setReviewComment((current) => `${current.trim()}${current.trim() ? '\n' : ''}${directive.label.replace(/^\+\s*/, '')}`)}
                          className="border border-stone-300 bg-ivory-50 px-2 py-1.5 text-left text-[9px] leading-snug text-stone-700 hover:border-copper hover:text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
                        >
                          {directive.label}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              <Textarea
                label={activeDecision === 'approved' ? 'Reviewer comment (optional)' : activeDecision === 'rejected' ? 'Rejection reason (required)' : 'Reviewer rationale (required)'}
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                rows={3}
                required={activeDecision !== 'approved'}
                placeholder={activeDecision === 'approved' ? 'Add an optional note for the decision record.' : activeDecision === 'rejected' ? 'Explain why this submission cannot proceed.' : 'Explain why revisions are needed. This note appears in Activity and Audit Records.'}
              />
              {activeDecision === 'changes_requested' && (
                <Textarea
                  label="Optional inline redline / suggested draft"
                  value={suggestedDraft}
                  onChange={(event) => setSuggestedDraft(event.target.value)}
                  rows={5}
                  helperText="This editable draft is saved separately from your rationale and does not replace the submitted revision."
                />
              )}
              {decisionError && <p role="alert" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">{decisionError}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-3">
                <span className="text-[10px] text-stone-500">Recorded as {reviewerName}. This prototype does not provide production authentication.</span>
                <Button
                  variant={activeDecision === 'approved' ? 'forest' : activeDecision === 'rejected' ? 'secondary' : 'copper'}
                  size="sm"
                  isLoading={isSaving}
                  disabled={isSaving}
                  onClick={confirmDecision}
                >
                  Confirm {decisionTitle(activeDecision)}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      <header className="border-b border-stone-300 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="mb-1 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-copper">Editorial governance / Human-owned decision</p>
            <h2 className="font-serif text-3xl font-normal tracking-tight text-obsidian sm:text-4xl">Human Verification Gate</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
              Review the submitted revision, findings, and available evidence before deciding. An AI consistency score is advisory; it is never a publication approval.
            </p>
          </div>
          <div className="border-l-2 border-copper pl-3">
            <span className="block text-[9px] font-mono uppercase tracking-wider text-stone-500">Outstanding human reviews</span>
            <span className="font-serif text-3xl leading-none text-copper-800">{pendingCount}</span>
          </div>
        </div>
      </header>

      {(storageError || workspaceError) && <p role="alert" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">{storageError || workspaceError}</p>}

      <section aria-label="Approval queue filters">
        <div className="flex flex-wrap gap-2 border-b border-stone-300 pb-3">
          {FILTERS.map((item) => {
            const count = item.value === 'all'
              ? records.length
              : records.filter((record) => record.status === item.value).length;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
                className={`border px-3 py-2 text-[10px] font-mono uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 ${filter === item.value ? 'border-obsidian bg-obsidian text-ivory' : 'border-stone-300 bg-ivory-50 text-stone-700 hover:border-copper hover:text-obsidian'}`}
              >
                {item.label} <span className="ml-1 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="approval-queue-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-copper">Review queue</p>
            <h3 id="approval-queue-heading" className="mt-1 font-serif text-2xl text-obsidian">
              {filter === 'awaiting_human_verification' ? 'Awaiting your review' : FILTERS.find((item) => item.value === filter)?.label}
            </h3>
          </div>
          <span className="text-[10px] text-stone-500">{filteredRecords.length} {filteredRecords.length === 1 ? 'record' : 'records'} · persisted locally</span>
        </div>
        {isLoading ? (
          <p role="status" className="flex items-center gap-2 border-y border-stone-300 py-8 text-sm text-stone-600"><LoaderCircle className="h-4 w-4 animate-spin text-copper" />Loading review queue…</p>
        ) : filteredRecords.length === 0 ? (
          <EmptyState
            kicker="HUMAN VERIFICATION QUEUE"
            title={filter === 'awaiting_human_verification' ? 'No reviews awaiting a decision' : 'No records in this view'}
            description={filter === 'awaiting_human_verification'
              ? 'Completed analyses appear here for human review. The analysis score alone cannot approve content.'
              : 'Records will appear in this filter as they move through the review lifecycle.'}
            icon={<ShieldCheck className="h-5 w-5 text-forest" />}
          />
        ) : (
          <div className="divide-y divide-stone-200 border-y border-stone-300">
            {filteredRecords.map((record) => (
              <QueueRow
                key={record.id}
                record={record}
                isPriority={record.status === 'awaiting_human_verification' && (
                  record.score < workspaceSettings.minPassScore
                  || record.findings.some((finding) => finding.severity === 'critical')
                  || (workspaceSettings.gateStrictness === 'strict' && record.findings.some((finding) => finding.severity === 'moderate'))
                )}
                onOpen={() => navigate(`/approvals/${encodeURIComponent(record.id)}`)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const QueueRow: React.FC<{ record: ReviewRecord; isPriority: boolean; onOpen: () => void }> = ({ record, isPriority, onOpen }) => {
  const counts = getFindingCounts(record.findings);
  const awaiting = record.status === 'awaiting_human_verification';
  return (
    <article className={`grid grid-cols-1 gap-3 border-l-2 py-4 pl-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${awaiting ? 'border-l-copper' : record.status === 'approved' ? 'border-l-forest' : 'border-l-stone-400'}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-mono font-bold tracking-wider text-stone-500">{record.id} · R{record.revision}</span>
          <span className={`inline-flex items-center border px-1.5 py-1 text-[8px] font-mono uppercase tracking-wider ${STATUS_STYLES[record.status]}`}>{STATUS_LABELS[record.status]}</span>
          <span className="text-[9px] text-stone-500">{record.contentType}</span>
          {isPriority && <Badge variant="copper" size="sm">Priority attention</Badge>}
        </div>
        <button type="button" onClick={onOpen} className="mt-1 block max-w-full text-left font-serif text-lg leading-snug text-obsidian hover:text-copper-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60">
          {record.title}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-stone-600">
          <span>By {record.author}</span>
          <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" aria-hidden="true" />{formatDate(record.submittedAt)}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px]">
          <span className="font-mono font-semibold text-obsidian">Consistency {record.score}/100</span>
          <span className="text-copper-800">{counts.critical} critical</span>
          <span className="text-copper-700">{counts.moderate} moderate</span>
          <span className="text-stone-600">{counts.minor} minor</span>
          <span className="text-stone-500">{record.findings.length} findings</span>
        </div>
      </div>
      <Button variant={awaiting ? 'copper' : 'outline'} size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />} onClick={onOpen}>
        {awaiting ? 'Open review' : 'View decision'}
      </Button>
    </article>
  );
};

const ReviewDetail: React.FC<{
  record: ReviewRecord;
  storageError: string;
  localRules: LocalBrandRule[];
  evidenceCatalogue: LocalEvidence[];
  reviewerName: string;
  analysisConfigHash: string;
  gateStrictness: WorkspaceSettings['gateStrictness'];
  onBack: () => void;
  onEdit: () => void;
  onReanalyze: () => void;
  onDecision: (decision: ReviewDecision) => void;
}> = ({ record, storageError, localRules, evidenceCatalogue, reviewerName, analysisConfigHash, gateStrictness, onBack, onEdit, onReanalyze, onDecision }) => {
  const [geometryFocus, setGeometryFocus] = useState<'rules' | 'evidence' | 'human' | null>(null);
  const decision = getLatestDecision(record);
  const contentAnalysisIsCurrent = record.analysisContentHash === record.contentHash
    && hashReviewContent(record.currentContent) === record.contentHash;
  const analysisIsCurrent = contentAnalysisIsCurrent
    && Boolean(record.analysisConfigHash)
    && record.analysisConfigHash === analysisConfigHash;
  const isAwaiting = record.status === 'awaiting_human_verification';
  const counts = getFindingCounts(record.findings);
  const hasValidation = analysisIsCurrent && record.statusHistory.some((event) => event.revision === record.revision && (event.status === 'validation_complete' || event.status === 'issues_found'));
  const hasAnalysis = analysisIsCurrent && record.statusHistory.some((event) => event.revision === record.revision && event.status === 'analysis_complete');
  const approvedThisRevision = decision?.decision === 'approved'
    && record.approvedRevision === record.revision
    && record.approvedContentHash === record.contentHash;
  const currentHumanDecision = decision
    && decision.revision === record.revision
    && decision.contentHash === record.contentHash
    ? decision
    : null;

  useEffect(() => {
    if (geometryFocus === 'rules') {
      document.getElementById('matched-copy-highlight')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('matched-rule-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (geometryFocus === 'human') {
      document.getElementById('reviewer-decision-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [geometryFocus]);

  return (
    <div className="space-y-5 font-sans">
      <div>
        <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />} onClick={onBack}>Back to queue</Button>
      </div>
      {storageError && <p role="alert" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">{storageError}</p>}

      <header className="flex flex-col gap-4 border-b border-stone-300 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-copper">Human verification / {record.id} / Revision {record.revision}</p>
          <h2 className="mt-1 break-words font-serif text-3xl font-normal tracking-tight text-obsidian">{record.title}</h2>
          <p className="mt-2 text-xs text-stone-600">{record.contentType}{record.campaign ? ` · ${record.campaign}` : ''} · Submitted by {record.author} · {formatDate(record.submittedAt)}</p>
        </div>
        <StatusBadge status={record.status} />
      </header>

      <Panel kicker="HUMAN VERIFICATION GATE" title="Decision is owned by a reviewer" subtitle="AI findings and score inform your review; neither can authorize publication." padding="md">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          {REVIEW_STAGES.map((stage, index) => {
            const isIssue = stage.key === 'validation' && counts.critical + counts.moderate + counts.minor > 0;
            const isDone = stage.key === 'analysis' ? hasAnalysis
              : stage.key === 'validation' ? hasValidation && !isIssue
                : stage.key === 'human' ? Boolean(currentHumanDecision)
                  : Boolean(approvedThisRevision);
            const isActive = stage.key === 'human' && isAwaiting;
            const style = isDone
              ? stage.key === 'publication' ? 'border-forest bg-forest text-ivory' : 'border-forest-300 bg-forest-50 text-forest-900'
              : isActive || isIssue
                ? 'border-copper bg-copper-50 text-copper-900'
                : 'border-stone-300 bg-ivory-50 text-stone-500';
            const Icon = stage.icon;
            return (
              <div key={stage.key} className={`relative flex min-h-20 items-center gap-3 border p-3 ${style}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center border ${isDone ? 'border-forest/30 bg-forest/10' : isActive || isIssue ? 'border-copper/30 bg-copper/10' : 'border-stone-300 bg-ivory'}`}>
                  {isDone ? <Check className="h-4 w-4" /> : isIssue ? <AlertTriangle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span>
                  <span className="block text-[8px] font-mono uppercase tracking-widest">{String(index + 1).padStart(2, '0')} / {isDone ? 'Complete' : isActive ? 'Your decision' : isIssue ? 'Issues flagged' : 'Pending'}</span>
                  <span className="mt-1 block text-[10px] font-semibold leading-snug">{stage.title}</span>
                </span>
                {index < REVIEW_STAGES.length - 1 && <ArrowRight className="absolute -right-2.5 z-10 hidden h-4 w-4 bg-ivory text-stone-400 md:block" aria-hidden="true" />}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-start gap-2 border-t border-stone-200 pt-3 text-[10px] leading-relaxed text-stone-600">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-copper" aria-hidden="true" />
          <span>Approval is bound to revision {record.revision} ({record.contentHash}). Any re-analysis creates a new revision and requires a new human decision; earlier decisions remain in the audit trail.</span>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel kicker="01 / SUBMITTED CONTENT" title={analysisIsCurrent ? 'Current analysed revision' : contentAnalysisIsCurrent ? 'Analysis out of date' : 'Unanalysed draft revision'} subtitle={`Revision ${record.revision} · ${record.contentHash}`} padding="md" className="xl:col-span-5">
          <p className="mb-2 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-stone-500"><FileEdit className="h-3 w-3" /> {analysisIsCurrent ? 'Exact content and active rules reviewed' : contentAnalysisIsCurrent ? 'Active rules or evidence changed since analysis' : 'Edited content awaiting analysis'}</p>
          <div className="max-h-[34rem] overflow-y-auto whitespace-pre-wrap break-words border-l-2 border-obsidian bg-ivory-50 px-4 py-3 font-serif text-sm leading-relaxed text-obsidian">
            <ReviewContentHighlights content={record.currentContent} findings={record.findings} highlight={geometryFocus === 'rules'} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3 text-[9px] text-stone-500">
            <span>{record.currentContent.trim().split(/\s+/).filter(Boolean).length} words · {record.currentContent.length} characters</span>
            <span className={`font-mono uppercase tracking-wider ${analysisIsCurrent ? 'text-forest-700' : 'text-copper-800'}`}>{analysisIsCurrent ? 'Analysis matches revision' : 'Re-analysis required'}</span>
          </div>
          {!isAwaiting && (record.status === 'changes_requested' || record.status === 'approved' || record.status === 'draft') && (
            <Button className="mt-3 w-full" variant="outline" size="sm" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={onEdit}>
              {record.status === 'approved' ? 'Create revised content' : record.status === 'draft' ? 'Continue editing and analyse' : 'Revise and re-analyse'}
            </Button>
          )}
          {isAwaiting && !analysisIsCurrent && (
            <Button className="mt-3 w-full" variant="copper" size="sm" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={onReanalyze}>
              Re-analyse with current rules
            </Button>
          )}
        </Panel>

        <Panel kicker="02 / AI FINDINGS" title={analysisIsCurrent ? `${record.findings.length} finding${record.findings.length === 1 ? '' : 's'}` : 'Analysis required'} subtitle={analysisIsCurrent ? `${counts.critical} critical · ${counts.moderate} moderate · ${counts.minor} minor · Score ${record.score}/100` : 'No current score or findings are available for this edited revision.'} padding="md" className="self-start xl:col-span-4">
          <div className="mb-3 border-l-2 border-copper bg-copper-50/70 px-3 py-2 text-[10px] leading-relaxed text-stone-700">{record.aiSummary} AI scoring is advisory and does not equal approval.</div>
          {!analysisIsCurrent ? (
            <div className="flex items-start gap-2 border-l-2 border-copper bg-copper-50 p-3 text-xs leading-relaxed text-stone-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-copper" /> This revision must be analysed before it can enter human verification.
            </div>
          ) : record.findings.length === 0 ? (
            <div className="flex items-start gap-2 border-l-2 border-forest bg-forest-50/60 p-3 text-xs leading-relaxed text-stone-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest" /> No configured local rule matched this revision. Human verification is still required.
            </div>
          ) : (
            <div className={`space-y-3 overflow-y-auto pr-1 ${record.findings.length > 5 ? 'max-h-[35rem]' : ''}`}>
              {record.findings.map((finding, index) => (
                <div key={finding.id} id={geometryFocus === 'rules' && index === 0 ? 'matched-rule-card' : undefined} className={geometryFocus === 'rules' && index === 0 ? 'rounded-sm ring-2 ring-copper/60 ring-offset-2' : ''}>
                  <FindingReview finding={finding} />
                </div>
              ))}
            </div>
          )}
          {analysisIsCurrent && record.findings.length <= 2 && <GuidelineGeometry findings={record.findings} gateStrictness={gateStrictness} onSelect={setGeometryFocus} />}
        </Panel>

        <Panel kicker="03 / EVIDENCE & GUIDELINES" title="Available references" subtitle="A rule reference is guidance, not independent proof." padding="md" className="xl:col-span-3">
          <div className="space-y-3">
            {!analysisIsCurrent ? (
              <p className="border-l-2 border-copper bg-copper-50/70 px-3 py-2 text-[10px] leading-relaxed text-stone-700">Evidence cannot be assessed until local analysis is run for this revision.</p>
            ) : record.findings.length === 0 ? (
              <p className="border-l-2 border-stone-300 pl-3 text-xs leading-relaxed text-stone-600">No findings require a reference. The current workspace catalogue contains {evidenceCatalogue.length} entries.</p>
            ) : record.findings.map((finding) => {
              const evidenceId = finding.evidenceReference?.match(/\bEVD-[A-Z0-9-]+\b/)?.[0];
              const evidence = evidenceCatalogue.find((entry) => entry.id === evidenceId);
              return (
                <article key={`ref-${finding.id}`} className="border-b border-stone-200 pb-3 last:border-b-0">
                  <p className="text-[10px] font-semibold leading-snug text-obsidian">{finding.ruleId} · {finding.ruleTitle}</p>
                  <p className={`mt-1 text-[8px] font-mono uppercase tracking-wider ${finding.evidenceStatus === 'matched' ? 'text-forest-700' : 'text-copper-800'}`}>{EVIDENCE_LABELS[finding.evidenceStatus]}</p>
                  {evidence ? (
                    <>
                      <p className="mt-1 text-[10px] font-semibold text-stone-700">{evidence.id} · {evidence.label}</p>
                      <p className="mt-1 text-[9px] leading-relaxed text-stone-600">{evidence.source}. {evidence.note} <span className="font-semibold uppercase">{evidence.verificationStatus}</span></p>
                      {evidence.sourceUrl && <a href={evidence.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-[9px] text-copper underline">{evidence.sourceUrl}</a>}
                      {finding.evidenceSnapshot && <p className="mt-1 text-[9px] text-stone-500">Snapshot at analysis: {finding.evidenceSnapshot.verificationStatus}, reviewed {finding.evidenceSnapshot.lastReviewedAt || 'not recorded'}, due {finding.evidenceSnapshot.reviewDueAt || 'not recorded'}.</p>}
                    </>
                  ) : finding.evidenceSnapshot ? (
                    <>
                      <p className="mt-1 text-[10px] font-semibold text-stone-700">{finding.evidenceSnapshot.id} · {finding.evidenceSnapshot.title} (catalogue entry later removed)</p>
                      <p className="mt-1 text-[9px] leading-relaxed text-stone-600">{finding.evidenceSnapshot.sourceName} · {finding.evidenceSnapshot.verificationStatus} at analysis. {finding.evidenceSnapshot.sourceUrl}</p>
                    </>
                  ) : finding.evidenceReference ? (
                    <p className="mt-1 text-[9px] leading-relaxed text-stone-600">{finding.evidenceReference}</p>
                  ) : (
                    <p className="mt-1 text-[9px] leading-relaxed text-stone-600">No matching approved factual evidence exists in the local catalogue.</p>
                  )}
                  {finding.evidenceStatus === 'unverified' && <p className="mt-1 text-[9px] font-semibold text-copper-800">Unverified — not determined to be false.</p>}
                </article>
              );
            })}
            <div className="border-t border-copper/30 pt-3">
              <p className="mb-2 text-[8px] font-mono font-bold uppercase tracking-wider text-copper">Configured local rules</p>
              {localRules.map((rule) => (
                <p key={rule.id} className="mb-1 text-[9px] leading-relaxed text-stone-600"><span className="font-semibold text-obsidian">{rule.id}</span> · {rule.title}</p>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {approvedThisRevision && decision && (
        <Panel kicker="HUMAN DECISION · FOREST GREEN" title="Approved for this revision" subtitle="This approval applies only to the exact content and hash shown below." padding="md" className="border-l-[3px] border-l-forest">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DecisionDatum label="Decision" value="Approved" icon={<BadgeCheck className="h-4 w-4 text-forest" />} />
            <DecisionDatum label="Reviewer" value={decision.reviewer} icon={<UserRoundCheck className="h-4 w-4 text-forest" />} />
            <DecisionDatum label="Recorded" value={formatDate(decision.decidedAt)} icon={<Clock3 className="h-4 w-4 text-forest" />} />
          </div>
          {decision.comment && <p className="mt-4 border-t border-forest-200 pt-3 text-xs leading-relaxed text-stone-700"><strong>Reviewer comment:</strong> {decision.comment}</p>}
          <div className="mt-3 border-t border-forest-200 pt-3">
            <p className="mb-1 text-[8px] font-mono uppercase tracking-wider text-forest-700">Approved revision {decision.revision} · {decision.contentHash}</p>
            <p className="max-h-36 overflow-y-auto whitespace-pre-wrap border-l-2 border-forest px-3 py-2 font-serif text-xs leading-relaxed text-stone-700">{decision.content}</p>
          </div>
        </Panel>
      )}

      {currentHumanDecision && !approvedThisRevision && (
        <Panel kicker="HUMAN DECISION" title={decisionTitle(currentHumanDecision.decision)} subtitle={`Recorded by ${currentHumanDecision.reviewer} · ${formatDate(currentHumanDecision.decidedAt)}`} padding="md" className="border-l-[3px] border-l-copper">
          <p className="text-xs leading-relaxed text-stone-700">{currentHumanDecision.comment || 'No additional reviewer comment was recorded.'}</p>
          {record.status === 'changes_requested' && <Button className="mt-3" variant="copper" size="sm" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={onEdit}>Revise and re-analyse</Button>}
        </Panel>
      )}

      <Panel id="reviewer-decision-panel" className={geometryFocus === 'human' ? 'ring-2 ring-copper/60 ring-offset-2' : ''} kicker="REVIEWER DECISION" title={isAwaiting ? 'Your decision is required' : 'Decision record'} subtitle={isAwaiting ? 'Inspect all submitted content, findings, and evidence before recording a human decision.' : 'The current workflow state is authoritative; earlier approvals remain tied to their original revision.'} padding="md">
        {isAwaiting ? (
          <>
            {!analysisIsCurrent && <p role="alert" className="mb-3 border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">The content or active rule/evidence configuration changed after analysis. No decision can be recorded until this revision is analysed again.</p>}
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <DecisionAction title="Approve" description="Approve this exact analysed revision." tone="forest" icon={<ShieldCheck className="h-4 w-4" />} disabled={!analysisIsCurrent} onClick={() => onDecision('approved')} />
              <DecisionAction title="Request Changes" description="Return the draft with mandatory feedback." tone="copper" icon={<FileEdit className="h-4 w-4" />} disabled={!analysisIsCurrent} onClick={() => onDecision('changes_requested')} />
              <DecisionAction title="Reject" description="Record a final rejection and rationale." tone="stone" icon={<XCircle className="h-4 w-4" />} disabled={!analysisIsCurrent} onClick={() => onDecision('rejected')} />
            </div>
            <p className="flex items-start gap-2 border-t border-stone-200 pt-3 text-[9px] leading-relaxed text-stone-500">
              <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Demo reviewer identity: <strong className="font-semibold text-obsidian">{reviewerName}</strong>. This local prototype does not provide production authentication or access control.
            </p>
          </>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-2xl text-xs leading-relaxed text-stone-600">
              {record.status === 'draft'
                ? 'This edited revision must be analysed before it can return to the human verification gate.'
                : record.status === 'rejected'
                ? 'Rejected content remains preserved as a record. Rejection is distinct from requesting changes.'
                : record.status === 'changes_requested'
                  ? 'The creator can revise the content, analyse the new revision, and return it for a new human decision.'
                  : approvedThisRevision
                    ? 'Human approval is confirmed for the current revision only.'
                    : 'The approval shown in the history belongs to an earlier content revision and does not approve this one.'}
            </p>
            {record.status === 'approved' && (
              <Button variant="outline" size="sm" leftIcon={<FileEdit className="h-3.5 w-3.5" />} onClick={onEdit}>Create revised revision</Button>
            )}
          </div>
        )}
      </Panel>

      <Panel kicker="AUDIT TRAIL" title="Revision and decision history" subtitle="Prior decisions are retained and never transferred to a newer revision." padding="md">
        {record.decisionHistory.length === 0 && record.revisionHistory.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-stone-600"><History className="h-4 w-4" />No earlier revisions or decisions have been recorded.</p>
        ) : (
          <ol className="space-y-3">
            {record.statusHistory.map((event, index) => {
              const decisionEvent = record.decisionHistory.find((item) => item.decidedAt === event.at && item.revision === record.revision);
              return (
                <li key={`${event.status}-${event.at}-${index}`} className="flex gap-3 border-l border-stone-300 pl-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-copper" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-obsidian">{STATUS_LABELS[event.status]} · R{decisionEvent?.revision ?? event.revision ?? record.revision}</p>
                    <p className="mt-0.5 text-[9px] text-stone-500">{event.actor} · {formatDate(event.at)}</p>
                    {event.note && <p className="mt-1 text-[10px] leading-relaxed text-stone-600">{event.note}</p>}
                  </div>
                </li>
              );
            })}
            {record.revisionHistory.map((revision) => (
              <li key={`revision-${revision.revision}-${revision.contentHash}`} className="flex gap-3 border-l border-stone-300 pl-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-stone-400" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-obsidian">Archived revision {revision.revision} · {STATUS_LABELS[revision.status]}</p>
                  <p className="mt-0.5 text-[9px] text-stone-500">{formatDate(revision.submittedAt)} · {revision.contentHash} · Score {revision.score}/100</p>
                  <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap border-l border-stone-300 pl-2 text-[9px] leading-relaxed text-stone-600">{revision.content}</p>
                  {record.decisionHistory.filter((item) => item.revision === revision.revision && item.contentHash === revision.contentHash).map((item) => (
                    <p key={`${item.decidedAt}-${item.revision}`} className="mt-1 text-[9px] leading-relaxed text-forest-800">
                      {decisionTitle(item.decision)} by {item.reviewer} · {formatDate(item.decidedAt)}{item.comment ? ` · “${item.comment}”` : ''}
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
};

const ReviewContentHighlights: React.FC<{ content: string; findings: ReviewFinding[]; highlight: boolean }> = ({ content, findings, highlight }) => {
  const ranges = findings
    .filter((finding) => finding.endIndex > finding.startIndex && finding.startIndex < content.length)
    .map((finding) => ({
      start: Math.max(0, finding.startIndex),
      end: Math.min(content.length, finding.endIndex),
    }));
  const boundaries = [...new Set([0, content.length, ...ranges.flatMap(({ start, end }) => [start, end])])]
    .sort((left, right) => left - right);
  let marked = false;
  return (
    <>
      {boundaries.slice(0, -1).map((start, index) => {
        const end = boundaries[index + 1];
        if (end <= start) return null;
        const text = content.slice(start, end);
        const isMatch = ranges.some((range) => range.start <= start && range.end >= end);
        if (!isMatch) return <React.Fragment key={`${start}-${end}`}>{text}</React.Fragment>;
        const addId = highlight && !marked;
        if (addId) marked = true;
        return (
          <mark
            key={`${start}-${end}`}
            id={addId ? 'matched-copy-highlight' : undefined}
            className={highlight ? 'bg-copper-200/80 text-obsidian ring-2 ring-copper/70 animate-pulse' : 'bg-copper-100/70 text-obsidian'}
            title="Matched by an active local guideline"
          >
            {text}
          </mark>
        );
      })}
    </>
  );
};

const FindingReview: React.FC<{ finding: ReviewFinding }> = ({ finding }) => (
  <article className="border-l-2 border-copper bg-ivory-50 p-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-[8px] font-mono uppercase tracking-wider text-copper-800">{finding.ruleId} · {finding.category}</p>
        <h4 className="mt-1 text-xs font-semibold text-obsidian">{finding.ruleTitle}</h4>
      </div>
      <span className={`border px-1.5 py-1 text-[8px] font-mono uppercase tracking-wider ${SEVERITY_STYLES[finding.severity]}`}>{finding.severity}</span>
    </div>
    <blockquote className="mt-2 border-l border-copper px-2 font-serif text-sm italic text-obsidian">“{finding.quote}”</blockquote>
    <p className="mt-2 text-[10px] leading-relaxed text-stone-700">{finding.reason}</p>
    <p className="mt-2 text-[9px] leading-relaxed text-stone-600"><strong className="text-obsidian">Guideline:</strong> {finding.guidelineSnapshot?.description ?? finding.ruleTitle}</p>
    {finding.suggestion && (
      <div className="mt-2 min-w-0 w-full text-left text-[10px] leading-relaxed text-forest-800">
        <p className="flex items-center gap-1.5">
          <MessageSquareText className="h-3 w-3 shrink-0" aria-hidden="true" />
          <strong>{finding.suggestionLabel}</strong>
        </p>
        <p className="mt-1 w-full min-w-0 break-words text-left [overflow-wrap:anywhere]">{finding.suggestion}</p>
      </div>
    )}
  </article>
);

const DecisionDatum: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="min-w-0 border-b border-forest-200 pb-2">
    <div className="flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-wider text-forest-700">{icon}{label}</div>
    <p className="mt-1 break-words text-xs font-semibold text-obsidian">{value}</p>
  </div>
);

const DecisionAction: React.FC<{
  title: string;
  description: string;
  tone: 'forest' | 'copper' | 'stone';
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}> = ({ title, description, tone, icon, disabled, onClick }) => {
  const toneStyle = {
    forest: 'border-forest-300 bg-forest-50 text-forest-900 hover:border-forest hover:shadow-[0_14px_32px_rgba(36,76,58,0.17)]',
    copper: 'border-copper-300 bg-copper-50 text-copper-900 hover:border-copper hover:shadow-[0_14px_32px_rgba(188,116,78,0.2)]',
    stone: 'border-[#c78b7c] bg-[#fbf1ed] text-[#7d342b] hover:border-[#9c3e33] hover:shadow-[0_14px_32px_rgba(156,62,51,0.18)]',
  }[tone];
  const affordance = {
    forest: 'Click to sign off',
    copper: 'Open revision drawer',
    stone: 'Record rejection',
  }[tone];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={`${title}: ${description}`}
      className={`group relative flex min-h-32 flex-col items-start justify-between gap-2 border p-3 pt-7 text-left transition duration-200 ease-out hover:-translate-y-1 hover:scale-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:shadow-none ${toneStyle}`}
    >
      <span className="absolute right-2 top-2 translate-y-1 border border-current/20 bg-white/80 px-1.5 py-1 text-[7px] font-mono uppercase tracking-wider opacity-0 transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
        {affordance} ↗
      </span>
      <span className="flex items-center gap-2 text-xs font-semibold">
        <span className="transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6">{icon}</span>
        {title}
      </span>
      <span className="text-[9px] leading-relaxed opacity-80">{description}</span>
      <span className="flex w-full items-center justify-between border-t border-current/20 pt-2 text-[8px] font-mono uppercase tracking-wider">
        <span>{disabled ? 'Analysis required first' : 'Choose this decision'}</span>
        <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
      </span>
    </button>
  );
};

const StatusBadge: React.FC<{ status: ReviewWorkflowStatus }> = ({ status }) => (
  <Badge variant={status === 'approved' ? 'forest' : status === 'rejected' ? 'stone' : 'copper'} size="sm" dot>
    {STATUS_LABELS[status]}
  </Badge>
);

const ErrorState: React.FC<{ message: string; onBack: () => void }> = ({ message, onBack }) => (
  <div className="space-y-4">
    <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />} onClick={onBack}>Back to queue</Button>
    <p role="alert" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">{message}</p>
  </div>
);

const decisionTitle = (decision: ReviewDecision): string => ({
  approved: 'Approve',
  changes_requested: 'Request Changes',
  rejected: 'Reject',
}[decision]);

const decisionExplanation = (decision: ReviewDecision): string => ({
  approved: 'You are approving the exact analysed revision displayed here. Any later content revision will require fresh analysis and human approval.',
  changes_requested: 'The content creator will see your comment and can revise this record. The revised content must be analysed before it returns to the human gate.',
  rejected: 'This content will be marked rejected and preserved with your required rationale. Rejection cannot be confused with a request for revision.',
}[decision]);
