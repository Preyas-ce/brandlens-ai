import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  Check,
  CircleAlert,
  Clock3,
  ScanSearch,
  ShieldCheck,
  UserRoundCheck,
  Pause,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SeverityIndicator } from '@/components/ui/SeverityIndicator';
import { BrandOrbit } from '@/components/brand/BrandOrbit';
import { readReviewRecords, REVIEW_RECORDS_STORAGE_KEY, REVIEW_RECORDS_UPDATED_EVENT } from '@/services/reviewStorage';
import { getWorkspaceAnalysisConfigHash, WORKSPACE_DATA_STORAGE_KEY, WORKSPACE_DATA_UPDATED_EVENT } from '@/services/workspaceStorage';
import { ILLUMINATION_REPLAY_EVENT } from '@/services/uiPreferences';
import { ReviewRecord } from '@/types/review';
import { RiskSpotlight, SystemShowcase, GovernanceDeck, KineticCallToAction } from '@/components/brand/OverviewExperience';
import { MOTION_PAUSE_EVENT, QUICK_SCAN_OPEN_EVENT } from '@/services/uiPreferences';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type ReviewStatus = 'awaiting_review' | 'revision_requested' | 'approved' | 'rejected' | 'draft';
type IssueSeverity = 'critical' | 'warning' | 'advisory';

interface DemoReview {
  id: string;
  title: string;
  creator: string;
  submittedAt: string;
  score: number;
  status: ReviewStatus;
  issues: IssueSeverity[];
  recordId?: string;
  requiresAnalysis?: boolean;
}

const STATUS_LABELS: Record<ReviewStatus, string> = {
  awaiting_review: 'Awaiting review',
  revision_requested: 'Revision requested',
  approved: 'Human approved',
  rejected: 'Rejected',
  draft: 'Needs analysis',
};

const STATUS_STYLES: Record<ReviewStatus, string> = {
  awaiting_review: 'border-copper-300 bg-copper-50 text-copper-800',
  revision_requested: 'border-stone-300 bg-stone-100 text-stone-700',
  approved: 'border-forest-300 bg-forest-50 text-forest-700',
  rejected: 'border-stone-400 bg-stone-200 text-obsidian',
  draft: 'border-copper-300 bg-ivory-100 text-copper-800',
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [liveRecords, setLiveRecords] = useState<ReviewRecord[]>([]);
  const [analysisConfigHash, setAnalysisConfigHash] = useState('');
  const [recordsError, setRecordsError] = useState('');
  const [motionPaused, setMotionPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const pauseAllMotion = motionPaused || prefersReducedMotion;
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(MOTION_PAUSE_EVENT, { detail: pauseAllMotion }));
  }, [pauseAllMotion]);

  useEffect(() => {
    const refreshRecords = () => {
      try {
        setLiveRecords(readReviewRecords());
        setAnalysisConfigHash(getWorkspaceAnalysisConfigHash());
        setRecordsError('');
      } catch (error) {
        setRecordsError(error instanceof Error ? error.message : 'Local review records could not be loaded.');
      }
    };
    refreshRecords();
    window.addEventListener(REVIEW_RECORDS_UPDATED_EVENT, refreshRecords);
    window.addEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshRecords);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === REVIEW_RECORDS_STORAGE_KEY || event.key === WORKSPACE_DATA_STORAGE_KEY) refreshRecords();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(REVIEW_RECORDS_UPDATED_EVENT, refreshRecords);
      window.removeEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshRecords);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const localReviews = useMemo(() => liveRecords.map((record) => ({
    id: record.id,
    recordId: record.id,
    title: record.title,
    creator: record.author,
    submittedAt: new Date(record.submittedAt).toLocaleString(),
    score: record.score,
    status: record.status === 'awaiting_human_verification'
      && (record.analysisContentHash !== record.contentHash || record.analysisConfigHash !== analysisConfigHash)
        ? 'draft' as const
      : record.status === 'approved'
      ? 'approved' as const
      : record.status === 'changes_requested'
        ? 'revision_requested' as const
        : record.status === 'rejected'
          ? 'rejected' as const
          : record.status === 'draft'
            ? 'draft' as const
            : 'awaiting_review' as const,
    issues: record.findings.map((finding) => (
      finding.severity === 'critical' ? 'critical' as const
        : finding.severity === 'moderate' ? 'warning' as const
          : 'advisory' as const
    )),
    requiresAnalysis: record.analysisContentHash !== record.contentHash
      || (record.status === 'awaiting_human_verification' && record.analysisConfigHash !== analysisConfigHash),
  })), [liveRecords, analysisConfigHash]);
  const reviews = localReviews;
  const activeReviews = reviews.filter((review) => review.status !== 'approved' && review.status !== 'rejected');
  const pendingReviews = localReviews.filter((review) => review.status === 'awaiting_review' && !review.requiresAnalysis);
  const approvedReviews = localReviews.filter((review) => review.status === 'approved');
  const issueCount = localReviews.reduce((total, review) => total + review.issues.length, 0);
  const scoredReviews = localReviews.filter((review) => !review.requiresAnalysis);
  const consistencyScore = scoredReviews.length
    ? Math.round(scoredReviews.reduce((total, review) => total + review.score, 0) / scoredReviews.length)
    : null;
  const inspectedCount = scoredReviews.length;
  const resolvedReviews = localReviews.filter((review) => ['revision_requested', 'approved', 'rejected'].includes(review.status)).length;
  const flaggedReviews = localReviews.filter((review) => review.issues.length > 0).length;

  const openReview = (review: DemoReview) => {
    if (review.recordId) {
      navigate(`/approvals/${encodeURIComponent(review.recordId)}`);
      return;
    }
    navigate(review.status === 'awaiting_review' ? '/approvals' : review.status === 'approved' ? '/history' : '/review');
  };

  return (
    <div className="space-y-8 font-sans">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setMotionPaused((paused) => !paused)}
          aria-pressed={pauseAllMotion}
          disabled={prefersReducedMotion}
          className="inline-flex items-center gap-1.5 border border-stone-300 bg-ivory-50/80 px-2.5 py-1.5 text-[8px] font-mono uppercase tracking-wider text-stone-600 transition-colors hover:border-copper hover:text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 disabled:cursor-default"
          title={prefersReducedMotion ? 'Reduced motion preference is active' : undefined}
        >
          {pauseAllMotion ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          {prefersReducedMotion ? 'Reduced motion' : pauseAllMotion ? 'Resume motion' : 'Pause motion'}
        </button>
      </div>
      <section className="grid grid-cols-1 items-center gap-6 border-b border-stone-300 pb-7 lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.75fr)] lg:gap-8">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-copper">
              Brand governance · At a glance
            </span>
            <span className="inline-flex items-center gap-1.5 border border-stone-300 bg-ivory-50/80 px-2 py-1 text-[9px] font-mono uppercase tracking-[0.14em] text-stone-600">
              <span className="h-1.5 w-1.5 rounded-full bg-forest" aria-hidden="true" />
              Local review records
            </span>
          </div>
          <h2 className="max-w-2xl font-serif text-4xl font-normal leading-[1.05] tracking-tight text-obsidian sm:text-5xl lg:text-[3.5rem]">
            Every word. On brand. Before it goes live.
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-stone-700 sm:text-base">
            BrandLens AI checks content against your brand rules and approved evidence, then routes it through human review before publication.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              variant="primary"
              size="md"
              leftIcon={<ScanSearch className="h-4 w-4 text-copper" />}
              rightIcon={<ArrowUpRight className="h-3.5 w-3.5" />}
              onClick={() => navigate('/review')}
            >
              Start Content Review
            </Button>
            <button
              type="button"
              onClick={() => navigate('/guidelines')}
              className="inline-flex items-center gap-1.5 rounded-sm px-2 py-2 text-xs font-medium text-stone-700 transition-colors hover:text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
            >
              Browse brand rules <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(ILLUMINATION_REPLAY_EVENT))}
              title="Replay the BrandLens illumination introduction"
              className="inline-flex items-center gap-1.5 rounded-sm border border-stone-300 bg-ivory-50 px-2.5 py-2 text-[10px] font-mono uppercase tracking-wider text-stone-600 transition duration-150 hover:-translate-y-px hover:border-copper hover:text-obsidian hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 active:scale-[0.98]"
            >
              Replay illumination
            </button>
          </div>
          <div className="flex items-center gap-2 border-t border-copper/30 pt-3 text-[10px] text-stone-600">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-forest" aria-hidden="true" />
            <span>AI analysis is advisory. A named human reviewer retains final approval.</span>
          </div>
        </div>
        <BrandOrbit records={liveRecords} motionPaused={pauseAllMotion} />
      </section>

      <RiskSpotlight
        paused={pauseAllMotion}
        onTest={(sample) => navigate(`/review?spotlight=${encodeURIComponent(sample)}`)}
      />

      <section aria-labelledby="brand-health-heading">
        {recordsError && <p role="alert" className="mb-3 border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">Live review records could not be loaded: {recordsError}</p>}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-copper">01 / Brand health</p>
            <h3 id="brand-health-heading" className="mt-1 font-serif text-2xl text-obsidian">Consistency, with evidence.</h3>
          </div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-stone-500">
            Calculated from {localReviews.length} saved review records
          </p>
        </div>

        <MetricBento
          consistency={consistencyScore}
          pending={pendingReviews.length}
          issues={issueCount}
          flagged={flaggedReviews}
          decisions={resolvedReviews}
          approvals={approvedReviews.length}
          inspected={inspectedCount}
          onNavigate={navigate}
        />
        <div className="mt-2 flex items-center justify-between gap-4">
          <p className="text-[10px] leading-relaxed text-stone-500">
            Every metric comes from shared local review records. Prepare the marked demo submissions in Settings to explore the full workflow.
          </p>
          {localReviews.length === 0 && (
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-copper-800 underline decoration-copper/40 underline-offset-2 hover:text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
            >
              Prepare demo records
            </button>
          )}
        </div>
      </section>

      <SystemShowcase onNavigate={navigate} paused={pauseAllMotion} />

      <section aria-labelledby="pipeline-heading" className="border-y border-stone-300 bg-ivory-100/55 px-4 py-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-copper">02 / Verification pipeline</p>
            <h3 id="pipeline-heading" className="mt-1 font-serif text-2xl text-obsidian">From draft to decision.</h3>
          </div>
          <p className="text-[10px] text-stone-500">A person always owns the final call.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          <PipelineStep
            number="01"
            title="AI Content Analysis"
            count={`${inspectedCount} analyzed`}
            icon={ScanSearch}
            description="Run the local deterministic analysis against active brand rules and the evidence catalogue."
            onClick={() => navigate('/review')}
          />
          <PipelineStep
            number="02"
            title="Brand & Evidence Validation"
            count={`${flaggedReviews} with findings`}
            icon={BookOpenCheck}
            description="Explore active guidelines and the sources used to validate claims."
            onClick={() => navigate('/guidelines?tab=evidence')}
          />
          <PipelineStep
            number="03"
            title="Human Verification"
            count={`${pendingReviews.length} awaiting review`}
            icon={UserRoundCheck}
            featured
            description="Open the human review queue. A named reviewer makes every final decision."
            onClick={() => navigate('/approvals')}
          />
          <PipelineStep
            number="04"
            title="Publication Approval"
            count={`${approvedReviews.length} approved`}
            icon={ShieldCheck}
            last
            description="View review records with a human approval decision."
            onClick={() => navigate('/approvals?filter=approved')}
          />
        </div>
      </section>

      <GovernanceDeck />

      <section aria-labelledby="review-queue-heading">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-copper">03 / Review queue</p>
              <h3 id="review-queue-heading" className="mt-1 font-serif text-2xl text-obsidian">Submissions in motion</h3>
            </div>
            <button
              type="button"
              onClick={() => navigate('/approvals')}
              className="inline-flex shrink-0 items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-stone-600 hover:text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
            >
              Open queue <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="border-t-2 border-obsidian">
            {activeReviews.length === 0 ? (
              <EmptyState
                kicker="REVIEW QUEUE"
                title="Nothing waiting for review"
                description="There are no saved local submissions in the active queue. Start a review or prepare the marked demo submissions in Settings."
                icon={<Check className="h-5 w-5 text-forest" />}
                action={{ label: 'Start Content Review', onClick: () => navigate('/review') }}
                className="my-4"
              />
            ) : (
              activeReviews.map((review) => (
                <ReviewQueueRow
                  key={review.id}
                  review={review}
                  onOpen={() => openReview(review)}
                />
              ))
            )}
            <div className="flex items-center justify-between border-t border-stone-200 pt-3 text-[10px] text-stone-500">
              <span>{activeReviews.length} active local submissions</span>
              <span className="font-mono uppercase tracking-wider">Critical · Warning · Advisory</span>
            </div>
          </div>
      </section>

      <KineticCallToAction
        paused={pauseAllMotion}
        onLaunch={() => navigate('/review')}
        onQuickScan={() => window.dispatchEvent(new Event(QUICK_SCAN_OPEN_EVENT))}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-copper/35 pt-4 text-[10px] text-stone-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-forest" aria-hidden="true" />
          Local deterministic analysis · Human approval required
        </span>
        <button
          type="button"
          onClick={() => navigate('/history')}
          className="inline-flex items-center gap-1 font-mono uppercase tracking-wider hover:text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
        >
          View audit records <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

const MetricBento: React.FC<{
  consistency: number | null;
  pending: number;
  issues: number;
  flagged: number;
  decisions: number;
  approvals: number;
  inspected: number;
  onNavigate: (path: string) => void;
}> = ({ consistency, pending, issues, flagged, decisions, approvals, inspected, onNavigate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const [bracket, setBracket] = useState<React.CSSProperties>({ opacity: 0 });
  const metrics = [
    { id: 'consistency', label: 'Average Consistency', value: consistency === null ? '—' : consistency, note: 'Mean alignment · /100', icon: ScanSearch, color: 'text-forest', path: '/review', bar: consistency ?? 0 },
    { id: 'pending', label: 'Pending Reviews', value: pending, note: 'Awaiting human review', icon: Clock3, color: 'text-copper', path: '/approvals', bar: Math.min(100, pending * 14) },
    { id: 'issues', label: 'Detected Issues', value: issues, note: `Across ${flagged} flagged submissions`, icon: CircleAlert, color: 'text-copper', path: '/history', bar: Math.min(100, issues * 8) },
    { id: 'decisions', label: 'Human Decisions', value: decisions, note: `${approvals} approvals · ${inspected} analysed`, icon: UserRoundCheck, color: 'text-forest', path: '/approvals?filter=all', bar: inspected ? Math.min(100, (decisions / inspected) * 100) : 0 },
  ];
  const focusMetric = (id: string, element: HTMLElement) => {
    const bounds = element.getBoundingClientRect();
    const parent = containerRef.current?.getBoundingClientRect();
    if (!parent) return;
    setActiveMetric(id);
    setBracket({
      opacity: 1,
      width: bounds.width,
      height: bounds.height,
      transform: `translate3d(${bounds.left - parent.left}px, ${bounds.top - parent.top}px, 0)`,
      transition: 'transform 220ms cubic-bezier(.2,.8,.2,1), width 220ms, height 220ms',
    });
  };

  return (
    <div ref={containerRef} className="relative grid grid-cols-1 border-y border-stone-300 sm:grid-cols-2">
      <div className="pointer-events-none absolute z-10 hidden sm:block" style={bracket} aria-hidden="true">
        <span className="metric-bracket-corner left-0 top-0 border-l border-t" />
        <span className="metric-bracket-corner right-0 top-0 border-r border-t" />
        <span className="metric-bracket-corner bottom-0 left-0 border-b border-l" />
        <span className="metric-bracket-corner bottom-0 right-0 border-b border-r" />
      </div>
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <button
            key={metric.id}
            type="button"
            onMouseEnter={(event) => focusMetric(metric.id, event.currentTarget)}
            onFocus={(event) => focusMetric(metric.id, event.currentTarget)}
            onMouseLeave={() => setActiveMetric(null)}
            onBlur={() => setActiveMetric(null)}
            onClick={() => onNavigate(metric.path)}
            className="group relative min-h-28 border-b border-stone-200 p-4 text-left transition-colors hover:bg-ivory-100/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 sm:even:border-l sm:odd:border-l-0 sm:[&:nth-child(n+3)]:border-b-0"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-mono font-semibold uppercase tracking-[0.14em] text-stone-600">{metric.label}</span>
              <Icon className={`h-3.5 w-3.5 ${metric.color}`} aria-hidden="true" />
            </span>
            <span className="mt-2 flex items-baseline gap-2">
              <span className={`font-serif text-3xl leading-none ${metric.color}`}>{metric.value}</span>
              <span className="text-[9px] text-stone-500">{metric.note}</span>
            </span>
            <span className="mt-3 block h-[2px] overflow-hidden bg-stone-200">
              <span className={`block h-full ${metric.id === 'issues' || metric.id === 'pending' ? 'bg-copper' : 'bg-forest'} transition-[width] duration-500`} style={{ width: `${metric.bar}%` }} />
            </span>
            <span className={`absolute bottom-2 right-3 text-[7px] font-mono uppercase tracking-wider text-copper transition-opacity ${activeMetric === metric.id ? 'opacity-100' : 'opacity-0'}`}>Open register ↗</span>
          </button>
        );
      })}
    </div>
  );
};

interface PipelineStepProps {
  number: string;
  title: string;
  count: string;
  icon: typeof ScanSearch;
  description: string;
  onClick: () => void;
  featured?: boolean;
  last?: boolean;
}

const PipelineStep: React.FC<PipelineStepProps> = ({ number, title, count, icon: Icon, description, onClick, featured = false, last = false }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`${title}. ${description}`}
    aria-describedby={`pipeline-stage-${number}`}
    className={`group relative flex min-h-[5.5rem] w-full items-center gap-3 border px-3 py-3 text-left transition duration-150 hover:z-20 hover:scale-[1.02] hover:border-copper hover:shadow-sm focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper focus-visible:ring-offset-2 focus-visible:ring-offset-ivory active:scale-[0.99] lg:mr-3 ${featured ? 'border-forest bg-forest text-ivory hover:bg-forest-700' : 'border-stone-300 bg-ivory-50/70 text-obsidian hover:bg-ivory-100'}`}
  >
    <span id={`pipeline-stage-${number}`} role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] right-0 z-30 hidden w-56 max-w-[calc(100vw-3rem)] border border-stone-300 bg-ivory px-3 py-2 text-left text-[10px] font-sans font-normal leading-relaxed text-stone-700 shadow-sm group-hover:block group-focus-visible:block">
      {description}
    </span>
    {!last && (
      <span
        className={`absolute -bottom-2.5 left-[29px] z-10 h-3 w-px lg:-right-2.5 lg:left-auto lg:top-1/2 lg:h-px lg:w-3 lg:-translate-y-1/2 ${featured ? 'bg-forest' : 'bg-stone-400'}`}
        aria-hidden="true"
      />
    )}
    {!last && (
      <span className={`absolute -bottom-[0.45rem] left-1/2 z-10 hidden h-3 w-3 rotate-45 border-r border-t lg:-right-2.5 lg:left-auto lg:top-1/2 lg:block lg:-translate-y-1/2 ${featured ? 'border-forest bg-forest' : 'border-stone-300 bg-ivory-100'}`} aria-hidden="true" />
    )}
    <span className={`grid h-9 w-9 shrink-0 place-items-center border ${featured ? 'border-ivory/30 bg-ivory/10 text-copper-200' : 'border-stone-300 bg-ivory text-copper'}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
    <span className="min-w-0">
      <span className={`block text-[9px] font-mono uppercase tracking-[0.16em] ${featured ? 'text-ivory/65' : 'text-stone-500'}`}>{number} / {featured ? 'Editor-owned' : 'Workflow'}</span>
      <span className="mt-0.5 block text-xs font-semibold leading-snug">{title}</span>
      <span className={`mt-1 block text-[10px] ${featured ? 'text-ivory/80' : 'text-stone-500'}`}>{count}</span>
    </span>
  </button>
);

interface ReviewQueueRowProps {
  review: DemoReview;
  onOpen: () => void;
}

const ReviewQueueRow: React.FC<ReviewQueueRowProps> = ({ review, onOpen }) => {
  const highestSeverity: IssueSeverity | 'verified' = review.issues.includes('critical')
    ? 'critical'
    : review.issues.includes('warning')
      ? 'warning'
      : review.issues.includes('advisory')
        ? 'advisory'
        : 'verified';

  return (
    <article className="group border-b border-stone-200 py-4 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
        >
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[9px] font-mono font-bold tracking-wider text-stone-500">{review.id}</span>
            <span className="text-[9px] text-stone-400">/</span>
            <span className="inline-flex items-center gap-1 text-[9px] text-stone-500">
              <Clock3 className="h-2.5 w-2.5" aria-hidden="true" /> {review.submittedAt}
            </span>
          </span>
          <span className="mt-1 block font-serif text-base leading-snug text-obsidian group-hover:text-copper-700">{review.title}</span>
        </button>
        <span className="shrink-0 text-right">
          <span className="block text-[8px] font-mono uppercase tracking-wider text-stone-500">Alignment</span>
          <span className={`font-serif text-lg ${review.score >= 90 ? 'text-forest' : 'text-copper-800'}`}>{review.score}</span>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[10px] text-stone-600">{review.creator}</span>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityIndicator severity={highestSeverity} size="sm" />
          <span className={`inline-flex items-center border px-1.5 py-1 text-[8px] font-mono uppercase tracking-[0.1em] ${STATUS_STYLES[review.status]}`}>
            {STATUS_LABELS[review.status]}
          </span>
          {review.issues.length > 0 && (
            <span className="text-[9px] text-stone-500">{review.issues.length} {review.issues.length === 1 ? 'issue' : 'issues'}</span>
          )}
        </div>
      </div>
    </article>
  );
};
