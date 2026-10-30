import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { EvidenceAttachmentSection } from '@/components/brand/EvidenceAttachmentSection';
import {
  LocalEvidence,
  LocalReviewAnalysis,
  analyzeLocalContent,
  getLocalBrandRules,
  getLocalEvidenceCatalogue,
  VisualReviewInput,
} from '@/services/localReviewEngine';
import { DEMO_SCENARIOS } from '@/services/demoScenarios';
import { getEvidenceCitationRewrite, getVerifiedEvidenceCitationId } from '@/services/evidenceCitation';
import { readReviewRecords, resubmitReviewRecord, saveReviewDraft, saveReviewRecord, updateReviewRecord, REVIEW_RECORDS_UPDATED_EVENT } from '@/services/reviewStorage';
import { cloudCreateReviewDraftRecord } from '@/services/cloudStorage';
import { WORKSPACE_DATA_UPDATED_EVENT, getWorkspaceAnalysisConfigHash } from '@/services/workspaceStorage';
import { ReviewFinding, ReviewSeverity } from '@/types/review';
import { useLanguage } from '@/contexts/LanguageProvider';

interface ReviewReport extends LocalReviewAnalysis {
  submittedContent: string;
  recordId: string | null;
}

const CONTENT_TYPES = ['Social post', 'Advertisement', 'Landing page', 'Email'];
const CAMPAIGN_OPTIONS = [
  'Apex Media · Q4 launch',
  'BrandLens AI · Editorial governance',
  'Meridian Studio · Product stories',
];

const SEVERITY_STYLES: Record<ReviewSeverity, string> = {
  critical: 'border-copper-300 bg-copper-50 text-copper-800',
  moderate: 'border-copper-200 bg-ivory-100 text-copper-800',
  minor: 'border-stone-300 bg-stone-100 text-stone-700',
};

const SEVERITY_PEN_HIGHLIGHT: Record<ReviewSeverity, string> = {
  critical: 'bg-copper-200/80 decoration-copper-700',
  moderate: 'bg-copper-100 decoration-copper-600',
  minor: 'bg-stone-200 decoration-stone-600',
};

const EVIDENCE_STATUS_STYLES: Record<ReviewFinding['evidenceStatus'], string> = {
  matched: 'text-forest-700',
  unverified: 'text-copper-800',
  'rule-only': 'text-stone-600',
};

const getSeverityCounts = (findings: ReviewFinding[]) => ({
  critical: findings.filter((finding) => finding.severity === 'critical').length,
  moderate: findings.filter((finding) => finding.severity === 'moderate').length,
  minor: findings.filter((finding) => finding.severity === 'minor').length,
});

const getStorageErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : 'The browser could not access local review storage.'
);

const contrastRatio = (foreground: string, background: string): number | null => {
  const toLuminance = (hex: string): number | null => {
    const normalized = hex.trim().replace(/^#/, '');
    if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) return null;
    const full = normalized.length === 3 ? normalized.split('').map((part) => part + part).join('') : normalized;
    const channels = [0, 2, 4].map((index) => Number.parseInt(full.slice(index, index + 2), 16) / 255);
    const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const light = toLuminance(foreground);
  const dark = toLuminance(background);
  if (light === null || dark === null) return null;
  return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
};

const getEditorialRewrite = (
  content: string,
  finding: ReviewFinding,
  mode: 'safe' | 'evidence',
  evidenceCatalogue: LocalEvidence[],
): { startIndex: number; endIndex: number; text: string } | null => {
  if (mode === 'evidence') return getEvidenceCitationRewrite(content, finding, evidenceCatalogue);
  const escapedQuote = finding.quote.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const quotePattern = new RegExp(escapedQuote, 'i');
  const quoteMatch = quotePattern.exec(content);
  const quoteIndex = quoteMatch?.index ?? -1;
  if (quoteIndex < 0) return null;
  const matchedQuote = quoteMatch?.[0] ?? finding.quote;

  if (finding.ruleId === 'R-103') {
    const claimPattern = /\b(?:we\s+)?guarantee(?:d|s|ing)?\s+(?:a\s+)?100%\s*[a-z]+\b/gi;
    const claim = Array.from(content.matchAll(claimPattern)).find((match) => (
      match.index !== undefined
      && quoteIndex >= match.index
      && quoteIndex < match.index + match[0].length
    ));
    if (claim?.index !== undefined) {
      return {
        startIndex: claim.index,
        endIndex: claim.index + claim[0].length,
        text: /^we\s/i.test(claim[0])
          ? 'we are committed to delivering measurable, evidence-backed returns'
          : 'committed to delivering measurable, evidence-backed returns',
      };
    }
    if (/^guaranteed$/i.test(matchedQuote)) {
      return {
        startIndex: quoteIndex,
        endIndex: quoteIndex + matchedQuote.length,
        text: 'designed for reliable performance (see SLA Evidence EVI-02)',
      };
    }
    if (/^guarantee(?:d|s|ing)?$/i.test(matchedQuote)) {
      return {
        startIndex: quoteIndex,
        endIndex: quoteIndex + matchedQuote.length,
        text: 'are committed to',
      };
    }
    const claimSpan = /\b(?:a\s+)?(?:\d+(?:\.\d+)?\s?%\s*[a-z]*|zero[- ]risk|risk[- ]free|no possibility of failure|\d+x\s+faster)\b/gi;
    const claimMatch = Array.from(content.matchAll(claimSpan)).find((match) => (
      match.index !== undefined
      && quoteIndex >= match.index
      && quoteIndex < match.index + match[0].length
    ));
    if (claimMatch?.index !== undefined) {
      const claimText = claimMatch[0];
      const replacement = /^\s*a\s+/i.test(claimText)
        ? 'evidence-backed outcomes'
        : /zero[- ]risk|risk[- ]free|no possibility/i.test(claimText)
          ? 'a measured approach to risk'
          : /faster$/i.test(claimText)
            ? 'a measured improvement'
            : 'measurable, evidence-backed outcomes';
      return {
        startIndex: claimMatch.index,
        endIndex: claimMatch.index + claimText.length,
        text: replacement,
      };
    }
    return {
      startIndex: quoteIndex,
      endIndex: quoteIndex + matchedQuote.length,
      text: 'measurable, evidence-backed outcomes',
    };
  }

  if (finding.ruleId === 'R-101' && /best\s+company\s+in\s+the\s+world/i.test(matchedQuote)) {
    return {
      startIndex: quoteIndex,
      endIndex: quoteIndex + matchedQuote.length,
      text: 'a trusted platform built for enterprise teams',
    };
  }
  if (finding.suggestion.trim()) {
    return {
      startIndex: quoteIndex,
      endIndex: quoteIndex + matchedQuote.length,
      text: finding.suggestion,
    };
  }
  return {
    startIndex: quoteIndex,
    endIndex: quoteIndex + matchedQuote.length,
    text: finding.ruleId === 'R-101'
      ? 'a trusted option for teams'
      : finding.ruleId === 'R-103'
        ? 'measurable results, subject to applicable evidence'
        : 'clear, accessible wording',
  };
};

export const ReviewPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const revisionRecordId = searchParams.get('record');
  const spotlightSample = searchParams.get('spotlight');
  const scenarioParam = searchParams.get('scenario');
  const reanalyzeRequested = searchParams.get('reanalyze') === '1';
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState(CONTENT_TYPES[0]);
  const [campaign, setCampaign] = useState('');
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [suggestedContent, setSuggestedContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const [draftChanged, setDraftChanged] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<string[]>([]);
  const [suggestionMessages, setSuggestionMessages] = useState<Record<string, string>>({});
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [activeRules, setActiveRules] = useState<ReturnType<typeof getLocalBrandRules>>([]);
  const [evidenceCatalogue, setEvidenceCatalogue] = useState<ReturnType<typeof getLocalEvidenceCatalogue>>([]);
  const [visualInput, setVisualInput] = useState<VisualReviewInput>({
    foreground: '#181816',
    background: '#F7F4EB',
    accent: '#1E3A2F',
  });
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [attachmentsVersion, setAttachmentsVersion] = useState(0);

  const activeRecordId = editingRecordId || report?.recordId || null;
  // attachmentsVersion ensures reactive updates when files are attached or removed
  const activeRecord = useMemo(() => {
    if (!activeRecordId) return null;
    return readReviewRecords().find((r) => r.id === activeRecordId) ?? null;
  }, [activeRecordId, attachmentsVersion]);
  const currentRevision = activeRecord?.revision ?? (editingRecordId ? 1 : 1);
  const currentAttachments = activeRecord?.attachments ?? [];

  const handleEnsureDraftId = async (): Promise<string> => {
    if (editingRecordId) return editingRecordId;
    if (report?.recordId) return report.recordId;
    const configHash = getWorkspaceAnalysisConfigHash();
    const submission = {
      title: title.trim() || 'Untitled Draft',
      contentType,
      campaign: campaign.trim(),
      author: author.trim() || 'Workspace editor',
      content: content.trim() || 'Draft content',
    };
    const draft = await cloudCreateReviewDraftRecord(submission, configHash);
    setEditingRecordId(draft.id);
    return draft.id;
  };


  useEffect(() => {
    const refreshWorkspace = () => {
      try {
        setActiveRules(getLocalBrandRules());
        setEvidenceCatalogue(getLocalEvidenceCatalogue());
        setWorkspaceError('');
      } catch (error) {
        setWorkspaceError(`Workspace rules and evidence could not be loaded: ${getStorageErrorMessage(error)}`);
      }
    };
    refreshWorkspace();
    window.addEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshWorkspace);
    const handleRecordsUpdated = () => setAttachmentsVersion((v) => v + 1);
    window.addEventListener(REVIEW_RECORDS_UPDATED_EVENT, handleRecordsUpdated);
    return () => {
      window.removeEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshWorkspace);
      window.removeEventListener(REVIEW_RECORDS_UPDATED_EVENT, handleRecordsUpdated);
    };
  }, []);

  useEffect(() => {
    if (!revisionRecordId) return;
    try {
      const record = readReviewRecords().find((candidate) => candidate.id === revisionRecordId);
      if (!record) {
        setStorageError('The review selected for revision could not be found in local storage.');
        return;
      }
      if (
        record.status !== 'changes_requested'
        && record.status !== 'approved'
        && record.status !== 'draft'
        && !(record.status === 'awaiting_human_verification' && reanalyzeRequested)
      ) {
        setStorageError('This review state cannot be edited through the revision workbench.');
        return;
      }
      setTitle(record.title);
      setContentType(record.contentType);
      setCampaign(record.campaign);
      setAuthor(record.author);
      setContent(record.currentContent);
      setEditingRecordId(record.id);
      if (record.status === 'changes_requested') {
        const latestRequest = [...record.statusHistory].reverse().find((event) => event.status === 'changes_requested');
        setRevisionFeedback(latestRequest?.note ?? record.signedNote ?? '');
      }
    } catch (error) {
      setStorageError(`The review selected for revision could not be loaded: ${getStorageErrorMessage(error)}`);
    }
  }, [revisionRecordId, reanalyzeRequested]);

  useEffect(() => {
    if (!spotlightSample) return;
    setTitle('Spotlight risk sample');
    setContentType('Advertisement');
    setContent(spotlightSample);
    setSuggestedContent('');
    setReport(null);
    setEditingRecordId(null);
    setDraftChanged(false);
    setAppliedSuggestions([]);
    setSuggestionMessages({});
    setValidationError('');
    setStorageError('');
  }, [spotlightSample]);

  useEffect(() => {
    if (!scenarioParam) return;
    loadExample(scenarioParam, reanalyzeRequested);
  }, [scenarioParam, reanalyzeRequested]);

  const runAnalysis = async () => {
    if (isAnalyzing) return;
    if (!content.trim()) {
      setValidationError('Add marketing content before running an analysis.');
      return;
    }
    if (!title.trim()) {
      setValidationError('Add a content title so the review can be identified in the approval queue.');
      return;
    }

    const submittedContent = content;
    const analysisTitle = title.trim();
    const analysisType = contentType;
    const analysisCampaign = campaign;
    const analysisAuthor = author.trim() || 'Workspace editor';

    setValidationError('');
    setStorageError('');
    setIsAnalyzing(true);
    setReport(null);
    setDraftChanged(false);
    setAppliedSuggestions([]);
    setSuggestionMessages({});

    if (editingRecordId) {
      try {
        const draftRecord = saveReviewDraft(editingRecordId, submittedContent, {
          title: analysisTitle,
          contentType: analysisType,
          campaign: analysisCampaign,
          author: analysisAuthor,
        }, reanalyzeRequested);
        setEditingRecordId(draftRecord.id);
      } catch (error) {
        setIsAnalyzing(false);
        setStorageError(`The revision could not be prepared for analysis: ${getStorageErrorMessage(error)}`);
        return;
      }
    }

    await new Promise<void>((resolve) => window.setTimeout(resolve, 600));
    let analysis: LocalReviewAnalysis;
    try {
      analysis = analyzeLocalContent(submittedContent, visualInput);
    } catch (error) {
      setIsAnalyzing(false);
      setStorageError(`The local analysis could not be completed: ${getStorageErrorMessage(error)}`);
      return;
    }
    const summary = `${analysis.summary} Local demo rules only; no live AI model or external fact-checking is used.`;

    let recordId: string | null = null;
    try {
      const submission = {
        title: analysisTitle,
        contentType: analysisType,
        campaign: analysisCampaign,
        author: analysisAuthor,
        content: submittedContent,
      };
      const savedRecord = editingRecordId
        ? resubmitReviewRecord(editingRecordId, submission, analysis.score, analysis.findings, summary, analysis.configHash)
        : saveReviewRecord(submission, analysis.score, analysis.findings, summary, analysis.configHash);
      recordId = savedRecord.id;
      setEditingRecordId(savedRecord.id);
    } catch (error) {
      setStorageError(`Analysis completed, but the review could not be saved or sent to the approval queue: ${getStorageErrorMessage(error)}`);
    }

    setSuggestedContent(submittedContent);
    setReport({ ...analysis, summary, submittedContent, recordId });
    setIsAnalyzing(false);
  };

  const applySuggestion = (finding: ReviewFinding, mode: 'safe' | 'evidence') => {
    const rewrite = getEditorialRewrite(suggestedContent, finding, mode, evidenceCatalogue);
    if (!rewrite) {
      const priorEditOverlapsFinding = report?.findings.some((priorFinding) => (
        appliedSuggestions.some((entry) => entry.startsWith(`${priorFinding.id}:`))
        && priorFinding.startIndex < finding.endIndex
        && finding.startIndex < priorFinding.endIndex
      ));
      setSuggestionMessages((previous) => ({
        ...previous,
        [finding.id]: priorEditOverlapsFinding
          ? 'Quote span was modified in the draft above — edit manually or click Reset suggestions'
          : 'Quote could not be matched in the draft above — edit manually or click Reset suggestions',
      }));
      setStorageError('');
      return;
    }
    const { startIndex: matchIndex, endIndex, text: replacement } = rewrite;
    const updatedContent = `${suggestedContent.slice(0, matchIndex)}${replacement}${suggestedContent.slice(endIndex)}`;
    setSuggestedContent(updatedContent);
    setContent(updatedContent);
    setDraftChanged(true);
    setAppliedSuggestions((previous) => previous.includes(`${finding.id}:${mode}`)
      ? previous
      : [...previous, `${finding.id}:${mode}`]);
    setSuggestionMessages((previous) => {
      const remaining = { ...previous };
      delete remaining[finding.id];
      return remaining;
    });
    setStorageError('');

    if (report?.recordId) {
      try {
        updateReviewRecord(report.recordId, { suggestedContent: updatedContent });
      } catch (error) {
        setStorageError(`The suggestion was applied in the editor but could not be saved to the review record: ${getStorageErrorMessage(error)}`);
      }
    }
  };

  const loadExample = (scenarioId: string, autoAnalyze = false) => {
    const example = DEMO_SCENARIOS.find((scenario) => scenario.id === scenarioId);
    if (!example) {
      setValidationError('That demo scenario is no longer available.');
      return;
    }

    const hasExistingWork = Boolean(
      title.trim() ||
      content.trim() ||
      author.trim() ||
      campaign ||
      report ||
      editingRecordId ||
      currentAttachments.length > 0
    );

    if (
      hasExistingWork &&
      !window.confirm(
        t('reviewConfirmReplaceWork')
      )
    ) {
      return;
    }

    setTitle(example.title);
    setContentType(example.contentType);
    setCampaign(example.campaign);
    setAuthor(example.author);
    setContent(example.content);
    setValidationError('');
    setStorageError('');
    setDraftChanged(false);
    setAppliedSuggestions([]);
    setSuggestionMessages({});
    setEditingRecordId(null);
    setRevisionFeedback('');

    if (autoAnalyze) {
      try {
        const analysis = analyzeLocalContent(example.content, visualInput);
        const summary = `${analysis.summary} Local demo rules only; no live AI model or external fact-checking is used.`;
        const submission = {
          title: example.title,
          contentType: example.contentType,
          campaign: example.campaign,
          author: example.author,
          content: example.content,
        };
        const savedRecord = saveReviewRecord(submission, analysis.score, analysis.findings, summary, analysis.configHash);
        setEditingRecordId(savedRecord.id);
        setSuggestedContent(example.content);
        setReport({ ...analysis, summary, submittedContent: example.content, recordId: savedRecord.id });
      } catch {
        setReport(null);
        setSuggestedContent('');
      }
    } else {
      setReport(null);
      setSuggestedContent('');
    }
  };
  const clearDraft = () => {
    setTitle('');
    setContentType(CONTENT_TYPES[0]);
    setCampaign('');
    setAuthor('');
    setContent('');
    setReport(null);
    setSuggestedContent('');
    setValidationError('');
    setStorageError('');
    setDraftChanged(false);
    setAppliedSuggestions([]);
    setSuggestionMessages({});
    setEditingRecordId(null);
    setRevisionFeedback('');
  };

  const resetSuggestedVersion = () => {
    if (!report) return;
    setSuggestedContent(report.submittedContent);
    setContent(report.submittedContent);
    setDraftChanged(false);
    setAppliedSuggestions([]);
    setSuggestionMessages({});
    setStorageError('');
    if (report.recordId) {
      try {
        updateReviewRecord(report.recordId, { suggestedContent: report.submittedContent });
      } catch (error) {
        setStorageError(`The suggested version was reset in the editor but could not be saved: ${getStorageErrorMessage(error)}`);
      }
    }
  };

  const counts = report ? getSeverityCounts(report.findings) : null;
  const analysisAlreadyCurrent = Boolean(report?.recordId && !draftChanged);
  const findingByRule = report
    ? new Map(report.findings.map((finding) => [finding.ruleId, finding]))
    : new Map<string, ReviewFinding>();
  const getContentTypeLabel = (type: string) => {
    if (type === 'Social post') return t('reviewTypeSocialPost');
    if (type === 'Advertisement') return t('reviewTypeAdvertisement');
    if (type === 'Landing page') return t('reviewTypeLandingPage');
    if (type === 'Email') return t('reviewTypeEmail');
    return type;
  };

  return (
    <div className="space-y-6 font-sans">
      <header className="border-b border-stone-300 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="mb-1 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-copper">{t('reviewKicker')}</p>
            <h2 className="font-serif text-3xl font-normal tracking-tight text-obsidian sm:text-4xl">{t('reviewTitle')}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
              {t('reviewDescription')}
            </p>
          </div>
          <Badge variant="neutral" size="sm" icon={<Sparkles className="h-3 w-3" />}>
            {t('reviewDemoBadge')}
          </Badge>
        </div>
        <div className="mt-4 flex flex-wrap items-start gap-2 border-l-2 border-copper/60 pl-3 text-[11px] leading-relaxed text-stone-600">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" aria-hidden="true" />
          <span>{t('reviewAnalysisNotice')}</span>
        </div>
      </header>

      {revisionFeedback && (
        <div className="border-l-2 border-copper bg-copper-50/70 px-4 py-3 text-sm text-stone-700" role="status">
          <p className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-copper-800">{t('reviewReviewerFeedback')}</p>
          <p className="mt-1">{revisionFeedback}</p>
        </div>
      )}
      {workspaceError && <p role="alert" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">{workspaceError}</p>}
      {editingRecordId && (
        <div className="border-l-2 border-forest bg-forest-50/60 px-4 py-3 text-xs leading-relaxed text-stone-700">
          {t('reviewRevisionDisclosure')}
        </div>
      )}

      <section
        aria-label="Curated evaluation scenarios"
        className="border border-stone-300/80 bg-ivory-100/70 p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-copper" aria-hidden="true" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-copper">
              {t('demoWorkbenchBannerKicker')}
            </span>
          </div>
          <span className="text-[10px] font-mono text-stone-500">
            {t('demoWorkbenchBannerDesc')}
          </span>
        </div>

        <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {DEMO_SCENARIOS.map((example) => {
            const isSelected = title === example.title;
            return (
              <button
                key={example.id}
                type="button"
                onClick={() => loadExample(example.id)}
                className={`flex flex-col justify-between rounded-sm border p-3 text-left transition-all ${isSelected
                    ? 'border-copper bg-ivory-50 shadow-xs ring-1 ring-copper/40'
                    : 'border-stone-300 bg-ivory-50/60 hover:border-copper/70 hover:bg-ivory-50'
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-copper">
                      {example.contentType}
                    </span>
                    <span className="text-[9px] font-mono text-stone-400">
                      {example.id === 'needs-review' ? 'R-101 · R-103' : example.id === 'evidence-review' ? 'EVI-02' : 'Pass'}
                    </span>
                  </div>
                  <h4 className="mt-1 font-serif text-sm font-medium text-obsidian">
                    {example.id === 'needs-review'
                      ? t('demoScenarioNeedsReviewTitle')
                      : example.id === 'evidence-review'
                        ? t('demoScenarioEvidenceTitle')
                        : t('demoScenarioCleanTitle')}
                  </h4>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-stone-600">
                    {example.id === 'needs-review'
                      ? t('demoScenarioNeedsReviewDesc')
                      : example.id === 'evidence-review'
                        ? t('demoScenarioEvidenceDesc')
                        : t('demoScenarioCleanDesc')}
                  </p>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-stone-200/60 pt-2 text-[10px] font-medium text-copper">
                  <span>{t('demoLoadInWorkbench')}</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <Panel
        kicker={t('reviewSubmission')}
        title={t('reviewPrepareContent')}
        subtitle={t('reviewOriginalIntact')}
        padding="md"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            id="review-title"
            label={t('reviewContentTitle')}
            labelClassName="sm:min-h-[2.5rem] flex items-end"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (report) setDraftChanged(true);
            }}
            placeholder={t('reviewTitlePlaceholder')}
            required
          />
          <div className="w-full space-y-1.5 font-sans">
            <label htmlFor="review-content-type" className="block text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-stone-700 sm:min-h-[2.5rem] flex items-end">
              <span>{t('reviewContentType')}</span>
            </label>
            <select
              id="review-content-type"
              value={contentType}
              onChange={(event) => {
                setContentType(event.target.value);
                if (report) setDraftChanged(true);
              }}
              className="w-full rounded-[3px] border border-stone-300 bg-ivory-50 px-3 py-2 text-sm text-obsidian transition-colors focus:border-copper focus:outline-none focus:ring-1 focus:ring-copper/40"
            >
              {CONTENT_TYPES.map((type) => <option key={type} value={type}>{getContentTypeLabel(type)}</option>)}
            </select>
          </div>
          <div className="w-full space-y-1.5 font-sans">
            <label htmlFor="review-campaign" className="block text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-stone-700 sm:min-h-[2.5rem] flex items-end">
              <span>{t('reviewCampaignBrand')} <span className="normal-case tracking-normal text-stone-500">{t('reviewOptional')}</span></span>
            </label>
            <select
              id="review-campaign"
              value={campaign}
              onChange={(event) => {
                setCampaign(event.target.value);
                if (report) setDraftChanged(true);
              }}
              className="w-full rounded-[3px] border border-stone-300 bg-ivory-50 px-3 py-2 text-sm text-obsidian transition-colors focus:border-copper focus:outline-none focus:ring-1 focus:ring-copper/40"
            >
              <option value="">{t('reviewNoSelection')}</option>
              {CAMPAIGN_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <Input
            id="review-author"
            label={t('reviewCreatorSubmitter')}
            labelClassName="sm:min-h-[2.5rem] flex items-end"
            value={author}
            onChange={(event) => {
              setAuthor(event.target.value);
              if (report) setDraftChanged(true);
            }}
            placeholder={t('reviewOptional')}
          />
        </div>

        <div className="mt-5">
          <label htmlFor="review-content" className="mb-1.5 block text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-stone-700">
            {t('reviewMarketingContent')}
          </label>
          <textarea
            id="review-content"
            rows={8}
            value={content}
            onChange={(event) => {
              const updatedContent = event.target.value;
              setContent(updatedContent);
              setSuggestedContent(updatedContent);
              if (report) setDraftChanged(updatedContent !== report.submittedContent);
              setValidationError('');
            }}
            onBlur={() => {
              if (editingRecordId) {
                try {
                  const draftRecord = saveReviewDraft(editingRecordId, content);
                  setEditingRecordId(draftRecord.id);
                } catch (error) {
                  setStorageError(`The edited revision could not be saved: ${getStorageErrorMessage(error)}`);
                }
              } else if (report?.recordId && suggestedContent !== report.submittedContent) {
                try {
                  updateReviewRecord(report.recordId, { suggestedContent });
                } catch (error) {
                  setStorageError(`The edited version could not be saved to the review record: ${getStorageErrorMessage(error)}`);
                }
              }
            }}
            placeholder={t('reviewContentPlaceholder')}
            aria-describedby="review-content-help"
            className="w-full resize-y rounded-[3px] border border-stone-300 bg-ivory-50 p-4 font-serif text-base leading-relaxed text-obsidian placeholder:font-sans placeholder:text-sm placeholder:text-stone-400 focus:border-copper focus:outline-none focus:ring-1 focus:ring-copper/40"
          />
          <div id="review-content-help" className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-stone-500">
            <span>{content.trim() ? content.trim().split(/\s+/).length : 0} {t('reviewWords')} · {content.length} {t('reviewCharacters')}</span>
            <span className="font-mono uppercase tracking-wider">{t('reviewRulesEvidenceLocal')}</span>
          </div>
        </div>

        <section className="mt-4 border-y border-stone-200 py-3" aria-labelledby="visual-inspector-title">
          <button
            type="button"
            aria-expanded={inspectorOpen}
            aria-controls="visual-inspector-panel"
            onClick={() => setInspectorOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
          >
            <span>
              <span id="visual-inspector-title" className="block text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-obsidian">{t('reviewVisualInspector')}</span>
              <span className="mt-1 block text-[10px] text-stone-500">{t('reviewVisualInspectorSubtitle')}</span>
            </span>
            <span className="text-[9px] font-mono uppercase tracking-wider text-copper">{inspectorOpen ? t('reviewHide') : t('reviewInspect')}</span>
          </button>
          {inspectorOpen && (
            <div id="visual-inspector-panel" className="mt-4 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-2 text-[10px] leading-relaxed text-stone-600">
                <p className="font-mono font-bold uppercase tracking-wider text-obsidian">{t('reviewCtaAccessibility')}</p>
                <p>{t('reviewCtaAccessibilityDescription')}</p>
                <p className="border-l-2 border-copper/60 pl-2">{t('reviewHeuristicDisclaimer')}</p>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-obsidian">{t('reviewBrandPaletteContrast')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Warm Ivory', value: { foreground: '#181816', background: '#F7F4EB', accent: '#B4532A' } },
                    { label: 'Obsidian', value: { foreground: '#F7F4EB', background: '#181816', accent: '#1E3A2F' } },
                    { label: 'Forest', value: { foreground: '#F7F4EB', background: '#1E3A2F', accent: '#B4532A' } },
                    { label: 'Copper', value: { foreground: '#181816', background: '#B4532A', accent: '#1E3A2F' } },
                    { label: 'Neon / low contrast', value: { foreground: '#B8FF00', background: '#FFFF00', accent: '#FF00FF' } },
                  ].map((preset) => (
                    <button key={preset.label} type="button" onClick={() => setVisualInput(preset.value)} className="border border-stone-300 px-2 py-1 text-[9px] text-stone-700 hover:border-copper hover:text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60">{preset.label}</button>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    ['foreground', t('reviewForeground')],
                    ['background', t('reviewBackground')],
                    ['accent', t('reviewAccent')],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="space-y-1">
                      <span className="block text-[9px] font-mono uppercase tracking-wider text-stone-600">{label} {t('reviewHex')}</span>
                      <input
                        value={visualInput[key]}
                        onChange={(event) => setVisualInput((current) => ({ ...current, [key]: event.target.value }))}
                        aria-label={`${label} hex color`}
                        className="w-full rounded-[3px] border border-stone-300 bg-ivory-50 px-2 py-1.5 font-mono text-[10px] uppercase text-obsidian focus:border-copper focus:outline-none focus:ring-1 focus:ring-copper/40"
                      />
                    </label>
                  ))}
                </div>
                {(() => {
                  const ratio = contrastRatio(visualInput.foreground, visualInput.background);
                  const approved = ['#F7F4EB', '#181816', '#1E3A2F', '#B4532A'];
                  const palettePass = [visualInput.foreground, visualInput.background, visualInput.accent]
                    .every((value) => approved.includes(value.trim().toUpperCase()));
                  return (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-200 pt-2 text-[10px]">
                      <span className="font-mono font-semibold text-obsidian">
                        {ratio === null ? t('reviewEnterValidHex') : `${ratio.toFixed(2)}:1 ${ratio >= 7 ? t('reviewAaaPass') : ratio >= 4.5 ? t('reviewAaPass') : t('reviewFail')}`}
                      </span>
                      <span className={palettePass ? 'text-forest-700' : 'text-copper-800'}>{t('reviewPalette')} {palettePass ? t('reviewCompliant') : t('reviewOffBrand')}</span>
                      <span className="text-stone-500">{t('reviewWcagText')}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </section>


        <div className="mt-5 border-t border-stone-200 pt-4">
          <EvidenceAttachmentSection
            reviewId={activeRecordId || ''}
            revision={currentRevision}
            attachments={currentAttachments}
            mode="workbench"
            uploaderName={author.trim() || 'Workspace editor'}
            onEnsureDraftId={handleEnsureDraftId}
            onAttachmentAdded={() => setAttachmentsVersion((v) => v + 1)}
            onAttachmentRemoved={() => setAttachmentsVersion((v) => v + 1)}
          />
        </div>

        {validationError && (
          <p role="alert" className="mt-3 flex items-start gap-2 border-l-2 border-copper bg-copper-50/70 px-3 py-2 text-xs text-copper-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {validationError}
          </p>
        )}
        {storageError && (
          <p role="alert" className="mt-3 flex items-start gap-2 border-l-2 border-copper bg-copper-50/70 px-3 py-2 text-xs text-copper-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {storageError}
          </p>
        )}
        <div className="mt-5 border-t border-stone-200 pt-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-obsidian">
              {t('reviewSampleHeading')}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              {t('reviewSampleDescription')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {DEMO_SCENARIOS.map((example) => {
              const sampleTitle =
                example.id === 'needs-review'
                  ? t('reviewNeedsReview')
                  : example.id === 'evidence-review'
                    ? t('reviewEvidenceGaps')
                    : t('reviewCleanApproval');

              const sampleDescription =
                example.id === 'needs-review'
                  ? t('reviewSampleNeedsReviewDesc')
                  : example.id === 'evidence-review'
                    ? t('reviewSampleEvidenceGapsDesc')
                    : t('reviewSampleCleanApprovalDesc');

              const SampleIcon =
                example.id === 'needs-review'
                  ? AlertTriangle
                  : example.id === 'evidence-review'
                    ? FileSearch
                    : CheckCircle2;

              return (
                <button
                  key={example.id}
                  data-sample-id={example.id}
                  type="button"
                  onClick={() => loadExample(example.id)}
                  aria-label={`${t('reviewLoadExample')}: ${sampleTitle}`}
                  className="group flex min-h-36 flex-col justify-between gap-4 rounded-sm border border-stone-300 bg-ivory-50 p-3 text-left transition-colors hover:border-copper hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
                >
                  <span className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-stone-300 bg-white text-copper-800">
                      <SampleIcon className="h-4 w-4" aria-hidden="true" />
                    </span>

                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-obsidian">
                        {sampleTitle}
                      </span>
                      <span className="mt-1 block text-[10px] leading-relaxed text-stone-600">
                        {sampleDescription}
                      </span>
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-copper group-hover:text-obsidian">
                    {t('reviewLoadSampleAction')}
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={clearDraft}
              className="inline-flex items-center gap-1 self-start px-1 py-1 text-[10px] text-stone-500 hover:text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
            >
              <RotateCcw className="h-3 w-3" /> {t('reviewClear')}
            </button>

            <Button
              type="button"
              variant="copper"
              size="md"
              isLoading={isAnalyzing}
              disabled={isAnalyzing || analysisAlreadyCurrent}
              leftIcon={
                isAnalyzing ? undefined : <Sparkles className="h-4 w-4" />
              }
              onClick={runAnalysis}
            >
              {isAnalyzing
                ? t('reviewAnalysing')
                : analysisAlreadyCurrent
                  ? t('reviewAnalysisCurrent')
                  : t('reviewAnalyseContent')}
            </Button>
          </div>
        </div>

        {isAnalyzing && (
          <div className="mt-3 flex items-center gap-2 border-t border-copper/25 pt-3 text-xs text-stone-600" role="status" aria-live="polite">
            <LoaderCircle className="h-4 w-4 animate-spin text-copper" />
            {t('reviewAnalysisProgress')}
          </div>
        )}
      </Panel>

      {report ? (
        <section data-tour="review-findings" aria-labelledby="analysis-report-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-300 pb-3">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-copper">{t('reviewAnalysisReport')}</p>
              <h3 id="analysis-report-heading" className="mt-1 font-serif text-2xl text-obsidian">{title.trim()}</h3>
              <p className="mt-1 text-[11px] text-stone-500">{getContentTypeLabel(contentType)}{campaign ? ` · ${campaign}` : ''} · {report.recordId ? `${t('reviewRecord')} ${report.recordId}` : t('reviewNotSaved')}</p>
            </div>
            {report.recordId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={draftChanged}
                rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                onClick={() => navigate('/approvals')}
              >
                {t('reviewOpenVerificationGate')}
              </Button>
            )}
          </div>

          {draftChanged && (
            <p className="border-l-2 border-copper bg-copper-50/60 px-3 py-2 text-xs text-copper-900">
              {t('reviewDraftChanged')}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Panel
              kicker={t('reviewOriginalContentKicker')}
              title={t('reviewSubmittedCopy')}
              subtitle={t('reviewHighlightsLocalRule')}
              padding="md"
              className="lg:col-span-5"
            >
              <div className="mb-4 flex items-end justify-between border-b border-stone-200 pb-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">{t('reviewConsistencyScore')}</span>
                <span className={`font-serif text-4xl leading-none ${report.score >= 85 ? 'text-forest' : report.score >= 65 ? 'text-copper-700' : 'text-copper-900'}`}>
                  {report.score}<span className="text-sm text-stone-500"> / 100</span>
                </span>
              </div>
              {counts && (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  <SeverityCount label="critical" count={counts.critical} />
                  <SeverityCount label="moderate" count={counts.moderate} />
                  <SeverityCount label="minor" count={counts.minor} />
                </div>
              )}
              <HighlightedContent content={report.submittedContent} findings={report.findings} />
              <p className="mt-4 border-t border-stone-200 pt-3 text-[10px] leading-relaxed text-stone-500">
                {t('reviewScoringMethod')}
              </p>
            </Panel>

            <Panel
              kicker={t('reviewFindingsKicker')}
              title={`${report.findings.length} ${report.findings.length === 1 ? t('reviewFindingSingular') : t('reviewFindingPlural')}`}
              subtitle={report.summary}
              padding="md"
              className="lg:col-span-4"
            >
              {report.findings.length === 0 ? (
                <div className="border-l-2 border-forest bg-forest-50/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-forest-800">
                    <CheckCircle2 className="h-4 w-4" /> {t('reviewNoConfiguredRules')}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-stone-700">
                    {t('reviewNoAccuracyGuarantee')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {report.findings.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      appliedModes={appliedSuggestions.filter((entry) => entry.startsWith(`${finding.id}:`))}
                      citationId={getVerifiedEvidenceCitationId(finding, evidenceCatalogue)}
                      statusMessage={suggestionMessages[finding.id]}
                      onApply={(mode) => applySuggestion(finding, mode)}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              kicker={t('reviewEvidenceKicker')}
              title={t('reviewSourcesRulebook')}
              subtitle={t('reviewRuleReferenceNotProof')}
              padding="md"
              className="lg:col-span-3"
            >
              <div className="space-y-3">
                {report.findings.length > 0 ? report.findings.map((finding) => (
                  <article key={`evidence-${finding.id}`} className="border-b border-stone-200 pb-3 last:border-b-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-semibold leading-snug text-obsidian">{finding.ruleId} · {finding.ruleTitle}</span>
                      <span className={`shrink-0 text-[8px] font-mono uppercase tracking-wider ${EVIDENCE_STATUS_STYLES[finding.evidenceStatus]}`}>
                        {finding.evidenceStatus === 'matched' ? t('reviewEvidenceMatched') : finding.evidenceStatus === 'unverified' ? t('reviewEvidenceUnverified') : t('reviewEvidenceRuleOnly')}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-stone-600">
                      {finding.evidenceReference ?? t('reviewNoMatchingEvidence')}
                    </p>
                    {finding.evidenceStatus === 'unverified' && (
                      <p className="mt-1 text-[9px] leading-relaxed text-copper-800">{t('reviewUnverifiedNotFalse')}</p>
                    )}
                  </article>
                )) : (
                  <div className="border-l-2 border-stone-300 pl-3 text-xs leading-relaxed text-stone-600">
                    {t('reviewNoFindingEvidenceStart')} {evidenceCatalogue.length} {t('reviewLocalEntries')}
                  </div>
                )}

                <div className="border-t border-copper/30 pt-3">
                  <h4 className="mb-2 flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-copper">
                    <BookOpenCheck className="h-3.5 w-3.5" /> {t('reviewEvidenceCatalogue')}
                  </h4>
                  {evidenceCatalogue.map((entry) => (
                    <div key={entry.id} className="mb-2 last:mb-0">
                      <p className="text-[10px] font-semibold text-obsidian">{entry.id} · {entry.label} · {entry.verificationStatus}</p>
                      <p className="mt-0.5 text-[9px] leading-relaxed text-stone-500">{entry.source}. {entry.note}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-stone-200 pt-3">
                  <p className="mb-2 text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-stone-500">{t('reviewActiveLocalRules')}</p>
                  {activeRules.map((rule) => {
                    const flagged = findingByRule.has(rule.id);
                    return (
                      <div key={rule.id} className="mb-1.5 flex items-start gap-2 last:mb-0">
                        {flagged
                          ? <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-copper" aria-label="Flagged" />
                          : <Check className="mt-0.5 h-3 w-3 shrink-0 text-forest" aria-label="No match" />}
                        <span className="text-[9px] leading-relaxed text-stone-600"><strong className="text-obsidian">{rule.id}</strong> · {rule.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>
          </div>

          <div data-tour="review-suggestion-box">
            <Panel
              kicker={t('reviewSideBySide')}
              title={t('reviewOriginalSuggested')}
              subtitle={t('reviewOnlyExplicitSuggestion')}
              padding="md"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] text-stone-500">{t('reviewOriginalPreserved')}</span>
                <button
                  type="button"
                  onClick={resetSuggestedVersion}
                  disabled={!draftChanged}
                  className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-stone-600 hover:text-obsidian disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
                >
                  <RotateCcw className="h-3 w-3" /> {t('reviewResetSuggestions')}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="min-w-0 border-t-2 border-stone-300 pt-3">
                  <p className="mb-2 text-[9px] font-mono font-bold uppercase tracking-wider text-stone-500">{t('reviewOriginalSubmission')}</p>
                  <div className="min-h-32 w-full max-w-full whitespace-pre-wrap text-left text-sm leading-relaxed [overflow-wrap:anywhere] [text-indent:0] text-stone-700">{report.submittedContent}</div>
                </div>
                <div className="min-w-0 border-t-2 border-forest pt-3">
                  <p className="mb-2 text-[9px] font-mono font-bold uppercase tracking-wider text-forest">{t('reviewSuggestedEditable')}</p>
                  <div className={`min-h-32 w-full max-w-full whitespace-pre-wrap text-left text-sm leading-relaxed [overflow-wrap:anywhere] [text-indent:0] text-obsidian ${appliedSuggestions.length ? 'rounded-sm bg-forest-50/70 ring-2 ring-forest/35 animate-pulse' : ''}`}>{suggestedContent}</div>
                </div>
              </div>
            </Panel>
          </div>

          {report.recordId ? (
            <div className="flex flex-col gap-3 border-t border-stone-300 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-xs text-stone-600">
                <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
                <span>{t('reviewSavedAs')} <strong className="font-mono text-obsidian">{report.recordId}</strong> {t('reviewApprovalQueueSaved')}</span>
              </div>
              <Button
                type="button"
                variant="forest"
                size="md"
                disabled={draftChanged}
                rightIcon={<ArrowRight className="h-4 w-4" />}
                onClick={() => navigate('/approvals')}
              >
                {t('reviewContinueHumanVerification')}
              </Button>
            </div>
          ) : (
            <p role="status" className="border-l-2 border-copper bg-copper-50/70 px-3 py-2 text-xs text-copper-900">
              {t('reviewAnalysisNotSaved')}
            </p>
          )}
        </section>
      ) : (
        <Panel kicker={t('reviewAnalysisReport')} title={t('reviewFindingsAppearHere')} padding="none" className="border-dashed">
          <EmptyState
            kicker={t('reviewAwaitingSubmission')}
            title={t('reviewYourContentStaysYours')}
            description={t('reviewCompleteSubmission')}
            icon={<FileSearch className="h-5 w-5 text-copper" />}
            className="my-4 border-0 bg-transparent"
          />
        </Panel>
      )}
    </div>
  );
};

interface SeverityCountProps {
  label: ReviewSeverity;
  count: number;
}

const SeverityCount: React.FC<SeverityCountProps> = ({ label, count }) => {
  const { t } = useLanguage();
  const severityLabel = label === 'critical' ? t('reviewSeverityCritical') : label === 'moderate' ? t('reviewSeverityModerate') : t('reviewSeverityMinor');
  return (
    <span className={`inline-flex items-center gap-1 border px-1.5 py-1 text-[9px] font-mono uppercase tracking-wider ${SEVERITY_STYLES[label]}`}>
      {severityLabel} <strong>{count}</strong>
    </span>
  );
};

const HighlightedContent: React.FC<{ content: string; findings: ReviewFinding[] }> = ({ content, findings }) => {
  const { t } = useLanguage();
  const getSeverityLabel = (s: ReviewSeverity) =>
    s === 'critical' ? t('reviewSeverityCritical') : s === 'moderate' ? t('reviewSeverityModerate') : t('reviewSeverityMinor');

  const boundaries = Array.from(new Set([
    0,
    content.length,
    ...findings.flatMap((finding) => [finding.startIndex, finding.endIndex]),
  ])).sort((left, right) => left - right);

  return (
    <div className="min-h-40 whitespace-pre-wrap [overflow-wrap:anywhere] border-l-2 border-copper/50 bg-white/60 p-4 font-serif text-sm leading-relaxed text-obsidian">
      {boundaries.slice(0, -1).map((start, index) => {
        const end = boundaries[index + 1];
        if (end <= start) return null;
        const segment = content.slice(start, end);
        const matchingFindings = findings.filter((finding) => finding.startIndex < end && finding.endIndex > start);
        if (matchingFindings.length === 0) return <React.Fragment key={`${start}-${end}`}>{segment}</React.Fragment>;
        const strongest = matchingFindings.some((finding) => finding.severity === 'critical')
          ? 'critical'
          : matchingFindings.some((finding) => finding.severity === 'moderate')
            ? 'moderate'
            : 'minor';
        return (
          <mark
            key={`${start}-${end}`}
            className={`${SEVERITY_PEN_HIGHLIGHT[strongest]} decoration-2 underline underline-offset-2`}
            title={matchingFindings.map((finding) => `${getSeverityLabel(finding.severity)}: ${finding.ruleTitle}`).join('; ')}
          >
            {segment}
          </mark>
        );
      })}
    </div>
  );
};

interface FindingCardProps {
  finding: ReviewFinding;
  appliedModes: string[];
  citationId: string | null;
  statusMessage?: string;
  onApply: (mode: 'safe' | 'evidence') => void;
}

const FindingCard: React.FC<FindingCardProps> = ({ finding, appliedModes, citationId, statusMessage, onApply }) => {
  const { t } = useLanguage();
  const severityLabel = finding.severity === 'critical' ? t('reviewSeverityCritical') : finding.severity === 'moderate' ? t('reviewSeverityModerate') : t('reviewSeverityMinor');

  return (
    <article className="border-b border-stone-200 pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex items-center border px-1.5 py-1 text-[9px] font-mono font-semibold uppercase tracking-wider ${SEVERITY_STYLES[finding.severity]}`}>
          {severityLabel}
        </span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-stone-500">{finding.category} · {finding.ruleId}</span>
      </div>
      <h4 className="mt-2 text-xs font-semibold leading-snug text-obsidian">{finding.ruleTitle}</h4>
      <blockquote className="mt-2 border-l-2 border-copper bg-ivory-100/80 px-2.5 py-2 font-serif text-xs italic leading-relaxed text-stone-800">
        “{finding.quote}”
      </blockquote>
      <p className="mt-2 text-[10px] leading-relaxed text-stone-600">{finding.reason}</p>
      <p className="mt-2 text-[10px] leading-relaxed text-obsidian">
        <strong className="font-semibold">{t('reviewApplicableRule')}</strong> {finding.ruleId} — {finding.guidelineSnapshot?.description ?? finding.ruleTitle}
      </p>
      {finding.evidenceReference && (
        <p className="mt-1 text-[9px] leading-relaxed text-stone-500">{t('reviewReferencePrefix')} {finding.evidenceReference}</p>
      )}
      <div className="mt-2 min-w-0 border-t border-stone-200 pt-2">
        <p className="w-full text-left text-[10px] leading-relaxed text-forest-800 [overflow-wrap:anywhere]">
          {finding.suggestion
            ? <>{t('reviewSuggestionPrefix')} <strong>{finding.suggestion}</strong></>
            : <>{t('reviewSuggestionPrefix')} {t('reviewSuggestionFallback')}</>}
        </p>
        {statusMessage && <p role="status" className="mt-2 border-l-2 border-copper bg-copper-50/70 px-2 py-1.5 text-[9px] leading-relaxed text-copper-900">{statusMessage}</p>}
        {!citationId && (
          <p className="mt-2 text-[9px] leading-relaxed text-copper-800">{t('reviewPlaceholderDraftOnly')}</p>
        )}
        {finding.evidenceStatus === 'matched' && citationId && (
          <p className="mt-2 text-[9px] leading-relaxed text-forest-800">{t('reviewVerifiedCatalogueAvailable')} {citationId}.</p>
        )}
        <div className="mt-2 flex flex-wrap justify-end gap-1.5">
          {([
            ['safe', t('reviewApplySafeRewrite')],
            ['evidence', citationId
              ? `${t('reviewInsertVerifiedCitation')} · ${citationId}`
              : t('reviewInsertEvidencePlaceholder')],
          ] as const).map(([mode, label]) => {
            const applied = appliedModes.includes(`${finding.id}:${mode}`);
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onApply(mode)}
                disabled={applied}
                title={applied ? t('reviewRewriteAppliedTitle') : label}
                className="inline-flex shrink-0 items-center gap-1 border border-forest-300 bg-forest-50 px-2 py-1 text-[8px] font-mono uppercase tracking-wider text-forest-800 hover:bg-forest-100 disabled:cursor-default disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
              >
                {applied ? <Check className="h-3 w-3" /> : null}
                {applied ? t('reviewApplied') : label}
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
};
