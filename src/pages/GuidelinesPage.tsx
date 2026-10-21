import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Check, FileCheck2, Pause, Pencil, Play, Plus, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Panel } from '@/components/ui/Panel';
import {
  createEvidenceRecord,
  createGuideline,
  deleteEvidenceRecord,
  deleteGuideline,
  getEvidenceFreshness,
  GUIDELINE_CATEGORIES,
  readEvidenceRecords,
  readGuidelines,
  updateEvidenceRecord,
  updateGuideline,
  WORKSPACE_DATA_UPDATED_EVENT,
} from '@/services/workspaceStorage';
import {
  EvidenceRecord,
  GuidelineCategory,
  GuidelineRecord,
  GuidelineRuleType,
} from '@/types/workspace';

type DirectoryTab = 'guidelines' | 'evidence';
type RuleStatusFilter = 'all' | 'active' | 'paused';
type EvidenceStatusFilter = 'all' | 'verified' | 'unverified' | 'expired';

interface GuidelineFormState {
  title: string;
  category: GuidelineCategory;
  ruleType: GuidelineRuleType;
  phrases: string;
  approvedPhrase: string;
  severity: GuidelineRecord['severity'];
  description: string;
}

interface EvidenceFormState {
  title: string;
  description: string;
  sourceName: string;
  sourceUrl: string;
  associatedClaim: string;
  guidelineId: string;
  verificationStatus: EvidenceRecord['verificationStatus'];
  lastReviewedAt: string;
  reviewDueAt: string;
}

const EMPTY_GUIDELINE: GuidelineFormState = {
  title: '',
  category: 'General brand rules',
  ruleType: 'guidance',
  phrases: '',
  approvedPhrase: '',
  severity: 'moderate',
  description: '',
};

const EMPTY_EVIDENCE: EvidenceFormState = {
  title: '',
  description: '',
  sourceName: '',
  sourceUrl: '',
  associatedClaim: '',
  guidelineId: '',
  verificationStatus: 'unverified',
  lastReviewedAt: '',
  reviewDueAt: '',
};

const ruleTypeLabels: Record<GuidelineRuleType, string> = {
  guidance: 'Guidance',
  prohibited_term: 'Prohibited terminology',
  approved_terminology: 'Approved terminology',
  claim_evidence: 'Claim requires evidence',
};

const formatDate = (value: string): string => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

export const GuidelinesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [guidelines, setGuidelines] = useState<GuidelineRecord[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [activeTab, setActiveTab] = useState<DirectoryTab>(
    searchParams.get('tab') === 'evidence' ? 'evidence' : 'guidelines',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<GuidelineCategory | 'all'>('all');
  const [ruleStatus, setRuleStatus] = useState<RuleStatusFilter>('all');
  const [evidenceStatus, setEvidenceStatus] = useState<EvidenceStatusFilter>('all');
  const [isGuidelineModalOpen, setIsGuidelineModalOpen] = useState(false);
  const [editingGuideline, setEditingGuideline] = useState<GuidelineRecord | null>(null);
  const [guidelineForm, setGuidelineForm] = useState<GuidelineFormState>(EMPTY_GUIDELINE);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [editingEvidence, setEditingEvidence] = useState<EvidenceRecord | null>(null);
  const [evidenceForm, setEvidenceForm] = useState<EvidenceFormState>(EMPTY_EVIDENCE);
  const [storageError, setStorageError] = useState('');
  const [formError, setFormError] = useState('');
  const [actionFeedback, setActionFeedback] = useState('');

  const refreshData = () => {
    try {
      setGuidelines(readGuidelines());
      setEvidence(readEvidenceRecords());
      setStorageError('');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Workspace data could not be loaded.');
    }
  };

  useEffect(() => {
    refreshData();
    window.addEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshData);
    return () => window.removeEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshData);
  }, []);

  const filteredGuidelines = useMemo(() => guidelines.filter((rule) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesCategory = categoryFilter === 'all' || rule.category === categoryFilter;
    const matchesStatus = ruleStatus === 'all' || (ruleStatus === 'active' ? rule.isActive : !rule.isActive);
    const matchesQuery = !query || [
      rule.id, rule.title, rule.description, rule.category, rule.approvedPhrase, ...rule.phrases,
    ].some((value) => value.toLowerCase().includes(query));
    return matchesCategory && matchesStatus && matchesQuery;
  }), [categoryFilter, guidelines, ruleStatus, searchQuery]);

  const filteredEvidence = useMemo(() => evidence.filter((item) => {
    const freshness = getEvidenceFreshness(item);
    const matchesStatus = evidenceStatus === 'all'
      || (evidenceStatus === 'verified' && freshness === 'verified')
      || (evidenceStatus === 'unverified' && freshness === 'unverified')
      || (evidenceStatus === 'expired' && (freshness === 'expired' || freshness === 'due'));
    const query = searchQuery.trim().toLowerCase();
    const guideline = guidelines.find((rule) => rule.id === item.guidelineId);
    const matchesQuery = !query || [
      item.id, item.title, item.description, item.sourceName, item.associatedClaim, item.guidelineId,
      guideline?.title ?? '',
    ].some((value) => value.toLowerCase().includes(query));
    return matchesStatus && matchesQuery;
  }), [evidence, evidenceStatus, guidelines, searchQuery]);

  const openGuideline = (rule?: GuidelineRecord) => {
    setEditingGuideline(rule ?? null);
    setGuidelineForm(rule ? {
      title: rule.title,
      category: rule.category,
      ruleType: rule.ruleType,
      phrases: rule.phrases.join(', '),
      approvedPhrase: rule.approvedPhrase,
      severity: rule.severity,
      description: rule.description,
    } : EMPTY_GUIDELINE);
    setFormError('');
    setActionFeedback('');
    setIsGuidelineModalOpen(true);
  };

  const saveGuideline = (event: FormEvent) => {
    event.preventDefault();
    if (!guidelineForm.title.trim() || !guidelineForm.description.trim()) {
      setFormError('Add a title and explanatory guideline text.');
      return;
    }
    const phrases = guidelineForm.phrases.split(',').map((phrase) => phrase.trim()).filter(Boolean);
    if (guidelineForm.ruleType !== 'guidance' && phrases.length === 0) {
      setFormError('This rule type needs at least one phrase or term to check.');
      return;
    }
    if (guidelineForm.ruleType === 'approved_terminology' && !guidelineForm.approvedPhrase.trim()) {
      setFormError('Enter the approved spelling or phrase for this terminology rule.');
      return;
    }
    try {
      const input = {
        ...guidelineForm,
        title: guidelineForm.title.trim(),
        description: guidelineForm.description.trim(),
        phrases,
        approvedPhrase: guidelineForm.approvedPhrase.trim(),
      };
      if (editingGuideline) {
        updateGuideline(editingGuideline.id, input);
        setActionFeedback(`Guideline “${input.title}” saved.`);
      } else {
        createGuideline({ ...input, isActive: true });
        setActionFeedback(`Guideline “${input.title}” added.`);
      }
      setStorageError('');
      setIsGuidelineModalOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The guideline could not be saved.');
    }
  };

  const toggleGuideline = (rule: GuidelineRecord) => {
    try {
      updateGuideline(rule.id, { isActive: !rule.isActive });
      setStorageError('');
      setActionFeedback(`Guideline “${rule.title}” ${rule.isActive ? 'paused' : 'activated'} and saved.`);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'The guideline status could not be changed.');
      setActionFeedback('');
    }
  };

  const removeGuideline = (rule: GuidelineRecord) => {
    if (!window.confirm(`Delete “${rule.title}”? Existing review findings retain their historical rule snapshot.`)) return;
    try {
      deleteGuideline(rule.id);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'The guideline could not be deleted.');
    }
  };

  const openEvidence = (item?: EvidenceRecord) => {
    setEditingEvidence(item ?? null);
    setEvidenceForm(item ? {
      title: item.title,
      description: item.description,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      associatedClaim: item.associatedClaim,
      guidelineId: item.guidelineId,
      verificationStatus: item.verificationStatus,
      lastReviewedAt: item.lastReviewedAt,
      reviewDueAt: item.reviewDueAt,
    } : EMPTY_EVIDENCE);
    setFormError('');
    setIsEvidenceModalOpen(true);
  };

  const saveEvidence = (event: FormEvent) => {
    event.preventDefault();
    if (!evidenceForm.title.trim() || !evidenceForm.sourceName.trim() || !evidenceForm.associatedClaim.trim()) {
      setFormError('Add a title, source name, and the specific claim this evidence supports.');
      return;
    }
    if (evidenceForm.sourceUrl.trim()) {
      try {
        const url = new URL(evidenceForm.sourceUrl);
        if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
      } catch {
        setFormError('Enter a valid HTTP or HTTPS source URL, or leave it blank.');
        return;
      }
    }
    if (evidenceForm.verificationStatus === 'verified' && (!evidenceForm.lastReviewedAt || !evidenceForm.reviewDueAt)) {
      setFormError('Verified evidence requires both a review date and a next review due date.');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (evidenceForm.lastReviewedAt && evidenceForm.lastReviewedAt.slice(0, 10) > today) {
      setFormError('The evidence review date cannot be in the future.');
      return;
    }
    if (evidenceForm.verificationStatus === 'verified' && evidenceForm.reviewDueAt <= today) {
      setFormError('Verified evidence must be reviewed again on a future date before it can support analysis.');
      return;
    }
    if (evidenceForm.lastReviewedAt && evidenceForm.reviewDueAt && evidenceForm.reviewDueAt < evidenceForm.lastReviewedAt) {
      setFormError('The next review date cannot precede the last review date.');
      return;
    }
    try {
      const input = {
        ...evidenceForm,
        title: evidenceForm.title.trim(),
        description: evidenceForm.description.trim(),
        sourceName: evidenceForm.sourceName.trim(),
        sourceUrl: evidenceForm.sourceUrl.trim(),
        associatedClaim: evidenceForm.associatedClaim.trim(),
      };
      if (editingEvidence) updateEvidenceRecord(editingEvidence.id, input);
      else createEvidenceRecord(input);
      setIsEvidenceModalOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The evidence record could not be saved.');
    }
  };

  const removeEvidence = (item: EvidenceRecord) => {
    if (!window.confirm(`Delete evidence record ${item.id} (“${item.title}”)? Historical review snapshots will remain intact.`)) return;
    try {
      const result = deleteEvidenceRecord(item.id);
      setStorageError(result.isReferenced
        ? `${item.id} removed from the active catalogue. Existing findings retain its evidence snapshot.`
        : '');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'The evidence record could not be deleted.');
    }
  };

  const updateEvidenceStatus = (item: EvidenceRecord, status: EvidenceRecord['verificationStatus']) => {
    setEditingEvidence(item);
    setEvidenceForm({
      title: item.title,
      description: item.description,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      associatedClaim: item.associatedClaim,
      guidelineId: item.guidelineId,
      verificationStatus: status,
      lastReviewedAt: status === 'verified' ? new Date().toISOString().slice(0, 10) : item.lastReviewedAt,
      reviewDueAt: status === 'verified' ? item.reviewDueAt || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10) : item.reviewDueAt,
    });
    setFormError('');
    setIsEvidenceModalOpen(true);
  };

  const filterControl = (
    <select
      value={activeTab === 'guidelines' ? categoryFilter : evidenceStatus}
      onChange={(event) => activeTab === 'guidelines'
        ? setCategoryFilter(event.target.value as GuidelineCategory | 'all')
        : setEvidenceStatus(event.target.value as EvidenceStatusFilter)}
      className="w-full sm:w-auto bg-ivory-50 text-xs border border-stone-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
      aria-label={activeTab === 'guidelines' ? 'Filter guidelines by category' : 'Filter evidence by verification status'}
    >
      {activeTab === 'guidelines' ? (
        <>
          <option value="all">All categories</option>
          {GUIDELINE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        </>
      ) : (
        <>
          <option value="all">All verification states</option>
          <option value="verified">Verified and current</option>
          <option value="unverified">Unverified</option>
          <option value="expired">Expired or due for review</option>
        </>
      )}
    </select>
  );

  return (
    <div className="space-y-6 font-sans">
      <div className="border-b border-stone-300 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-widest font-mono text-copper font-bold">Governance Directives</span>
          <h2 className="font-serif text-3xl font-normal text-obsidian tracking-tight">Guidelines & Evidence</h2>
          <p className="text-sm text-stone-600 mt-1 max-w-2xl">
            Maintain the rules and source records used by future local analyses. Edits never rewrite prior findings.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4 text-copper" />}
          onClick={() => activeTab === 'guidelines' ? openGuideline() : openEvidence()}
        >
          Add {activeTab === 'guidelines' ? 'Guideline' : 'Evidence'}
        </Button>
      </div>

      {storageError && <p role="status" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">{storageError}</p>}
      {actionFeedback && <p role="status" className="border-l-2 border-forest bg-forest-50 px-3 py-2 text-xs text-forest-800">{actionFeedback}</p>}

      <div className="flex flex-wrap gap-1 border-b border-stone-300" role="tablist" aria-label="Workspace governance directories">
        {([
          { id: 'guidelines' as const, label: `Guidelines · ${guidelines.length}`, icon: BookOpen },
          { id: 'evidence' as const, label: `Evidence · ${evidence.length}`, icon: FileCheck2 },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-mono uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 ${
              activeTab === id ? 'border-copper text-obsidian' : 'border-transparent text-stone-500 hover:text-obsidian'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 bg-ivory-50 p-4 border border-stone-300 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={activeTab === 'guidelines' ? 'Search rules, phrases, or guidance…' : 'Search evidence, claims, sources…'}
            aria-label="Search this directory"
            className="w-full bg-white text-xs border border-stone-300 pl-9 pr-3 py-2 placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
          />
        </div>
        {filterControl}
        {activeTab === 'guidelines' && (
          <select
            value={ruleStatus}
            onChange={(event) => setRuleStatus(event.target.value as RuleStatusFilter)}
            aria-label="Filter guidelines by active state"
            className="w-full sm:w-auto bg-ivory-50 text-xs border border-stone-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
          >
            <option value="all">All rule states</option>
            <option value="active">Active in analysis</option>
            <option value="paused">Paused</option>
          </select>
        )}
      </div>

      {activeTab === 'guidelines' ? (
        <div className="space-y-3">
          {filteredGuidelines.length === 0 ? (
            <EmptyState
              kicker="GUIDELINE DIRECTORY"
              title="No matching guidelines"
              description="Try a different search or category, or add a local guideline for future content analyses."
              icon={<BookOpen className="w-5 h-5 text-copper" />}
              action={{ label: 'Add a guideline', onClick: () => openGuideline(), icon: <Plus className="w-3.5 h-3.5" /> }}
              secondaryAction={{ label: 'Clear filters', onClick: () => { setSearchQuery(''); setCategoryFilter('all'); setRuleStatus('all'); } }}
            />
          ) : filteredGuidelines.map((rule) => (
            <Panel key={rule.id} padding="none" variant="elevated" className={!rule.isActive ? 'opacity-75' : ''}>
              <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-stone-500">{rule.id}</span>
                    <Badge variant="stone" size="sm">{rule.category}</Badge>
                    <Badge variant={rule.isActive ? 'forest' : 'stone'} size="sm" dot>{rule.isActive ? 'Active' : 'Paused'}</Badge>
                    <span className="text-[10px] font-mono uppercase tracking-wide text-stone-500">{ruleTypeLabels[rule.ruleType]}</span>
                  </div>
                  <h3 className="font-serif text-lg font-normal text-obsidian">{rule.title}</h3>
                  {rule.phrases.length > 0 && <p className="text-xs text-stone-700"><span className="font-semibold">Checked phrases:</span> {rule.phrases.join(', ')}</p>}
                  {rule.approvedPhrase && <p className="text-xs text-stone-700"><span className="font-semibold">Approved wording:</span> {rule.approvedPhrase}</p>}
                  <p className="text-xs text-stone-600 leading-relaxed">{rule.description}</p>
                </div>
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => openGuideline(rule)}
                    title={`Edit guideline ${rule.id}`}
                  >Edit</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={rule.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    onClick={() => toggleGuideline(rule)}
                    aria-pressed={!rule.isActive}
                    title={`${rule.isActive ? 'Pause' : 'Activate'} guideline ${rule.id}`}
                  >{rule.isActive ? 'Pause' : 'Activate'}</Button>
                  <button
                    type="button"
                    onClick={() => removeGuideline(rule)}
                    aria-label={`Delete guideline ${rule.id}`}
                    title={`Delete guideline ${rule.id}`}
                    className="rounded-sm p-2 text-stone-500 transition duration-150 hover:scale-105 hover:bg-copper-50 hover:text-copper active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
                  ><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="border-l-2 border-copper bg-copper-50/60 px-3 py-2 text-xs text-stone-700">
            Evidence is usable only when marked verified, reviewed, current, and associated with the matching claim. User-added URLs are never trusted automatically.
          </p>
          {filteredEvidence.length === 0 ? (
            <EmptyState
              kicker="EVIDENCE CATALOGUE"
              title="No matching evidence records"
              description="Add a source record to document the claim it supports. New entries begin unverified."
              icon={<FileCheck2 className="w-5 h-5 text-copper" />}
              action={{ label: 'Add evidence', onClick: () => openEvidence(), icon: <Plus className="w-3.5 h-3.5" /> }}
              secondaryAction={{ label: 'Clear filters', onClick: () => { setSearchQuery(''); setEvidenceStatus('all'); } }}
            />
          ) : filteredEvidence.map((item) => {
            const freshness = getEvidenceFreshness(item);
            const linkedRule = guidelines.find((rule) => rule.id === item.guidelineId);
            const badgeVariant = freshness === 'verified' ? 'forest' : freshness === 'unverified' ? 'copper' : 'stone';
            const freshnessLabel = freshness === 'verified' ? 'Verified · current' : freshness === 'unverified' ? 'Unverified' : freshness === 'expired' ? 'Expired' : 'Review due';
            return (
              <Panel key={item.id} padding="none" variant="elevated">
                <div className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-stone-500">{item.id}</span>
                      <Badge variant={badgeVariant} size="sm" dot>{freshnessLabel}</Badge>
                      {linkedRule && <Badge variant="stone" size="sm">{linkedRule.id} · {linkedRule.title}</Badge>}
                    </div>
                    <h3 className="font-serif text-lg text-obsidian">{item.title}</h3>
                    <p className="text-xs text-stone-700"><strong>Claim:</strong> {item.associatedClaim}</p>
                    <p className="text-xs text-stone-600">{item.description || 'No additional source notes.'}</p>
                    <div className="text-xs text-stone-600">
                      <strong>Source:</strong> {item.sourceName}
                      {item.sourceUrl && <> · <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-copper underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60">{item.sourceUrl}</a></>}
                    </div>
                    <p className="text-[10px] font-mono text-stone-500">Last reviewed: {formatDate(item.lastReviewedAt)} · Review due: {formatDate(item.reviewDueAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-end md:self-start shrink-0">
                    {item.verificationStatus !== 'verified' && <Button variant="outline" size="sm" onClick={() => updateEvidenceStatus(item, 'verified')}>Verify record…</Button>}
                    {item.verificationStatus === 'verified' && <Button variant="secondary" size="sm" onClick={() => updateEvidenceStatus(item, 'unverified')}>Mark unverified</Button>}
                    <Button variant="secondary" size="sm" onClick={() => openEvidence(item)}>Edit</Button>
                    <button
                      type="button"
                      onClick={() => removeEvidence(item)}
                      aria-label={`Delete evidence ${item.id}`}
                      title={`Delete evidence ${item.id}`}
                      className="rounded-sm p-2 text-stone-500 transition duration-150 hover:scale-105 hover:bg-copper-50 hover:text-copper active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
                    ><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={isGuidelineModalOpen}
        onClose={() => setIsGuidelineModalOpen(false)}
        title={editingGuideline ? 'Edit guideline' : 'Add guideline'}
        subtitle="Active rules are evaluated by future deterministic local analyses."
        maxWidth="2xl"
      >
        <form onSubmit={saveGuideline} className="space-y-4">
          <Input label="Guideline title" value={guidelineForm.title} onChange={(event) => setGuidelineForm({ ...guidelineForm, title: event.target.value })} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-stone-700">Category
              <select value={guidelineForm.category} onChange={(event) => setGuidelineForm({ ...guidelineForm, category: event.target.value as GuidelineCategory })} className="mt-1 block w-full bg-ivory-50 text-sm border border-stone-300 px-3 py-2">
                {GUIDELINE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-stone-700">Rule type
              <select value={guidelineForm.ruleType} onChange={(event) => setGuidelineForm({ ...guidelineForm, ruleType: event.target.value as GuidelineRuleType })} className="mt-1 block w-full bg-ivory-50 text-sm border border-stone-300 px-3 py-2">
                {Object.entries(ruleTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          {guidelineForm.ruleType !== 'guidance' && (
            <Input label="Phrases to match (comma-separated)" value={guidelineForm.phrases} onChange={(event) => setGuidelineForm({ ...guidelineForm, phrases: event.target.value })} placeholder="e.g. guaranteed, best in class" required helperText="Literal phrase checks run against future submissions." />
          )}
          {guidelineForm.ruleType === 'approved_terminology' && (
            <Input label="Approved spelling or phrase" value={guidelineForm.approvedPhrase} onChange={(event) => setGuidelineForm({ ...guidelineForm, approvedPhrase: event.target.value })} required />
          )}
          <label className="block text-xs font-semibold text-stone-700">Severity
            <select value={guidelineForm.severity} onChange={(event) => setGuidelineForm({ ...guidelineForm, severity: event.target.value as GuidelineRecord['severity'] })} className="mt-1 block w-full bg-ivory-50 text-sm border border-stone-300 px-3 py-2">
              <option value="critical">Critical</option><option value="moderate">Moderate</option><option value="minor">Minor</option>
            </select>
          </label>
          <Textarea label="Guideline and rationale" value={guidelineForm.description} onChange={(event) => setGuidelineForm({ ...guidelineForm, description: event.target.value })} rows={3} required />
          {formError && <p role="alert" className="text-xs text-copper-900">{formError}</p>}
          <div className="flex justify-end gap-2 border-t border-stone-200 pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsGuidelineModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" leftIcon={<Check className="h-3.5 w-3.5" />}>Save guideline</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEvidenceModalOpen}
        onClose={() => setIsEvidenceModalOpen(false)}
        title={editingEvidence ? 'Edit evidence record' : 'Add evidence record'}
        subtitle="New or changed evidence is unverified until a reviewer attests to its source and scope."
        maxWidth="2xl"
      >
        <form onSubmit={saveEvidence} className="space-y-4">
          <Input label="Evidence title" value={evidenceForm.title} onChange={(event) => setEvidenceForm({ ...evidenceForm, title: event.target.value })} required />
          <Input label="Source or publisher name" value={evidenceForm.sourceName} onChange={(event) => setEvidenceForm({ ...evidenceForm, sourceName: event.target.value })} required />
          <Input label="Source URL (optional)" type="url" value={evidenceForm.sourceUrl} onChange={(event) => setEvidenceForm({ ...evidenceForm, sourceUrl: event.target.value })} placeholder="https://" />
          <Input label="Specific claim supported" value={evidenceForm.associatedClaim} onChange={(event) => setEvidenceForm({ ...evidenceForm, associatedClaim: event.target.value })} required helperText="Analysis will only match evidence when its claim appears in the nearby content." />
          <label className="block text-xs font-semibold text-stone-700">Related guideline
            <select value={evidenceForm.guidelineId} onChange={(event) => setEvidenceForm({ ...evidenceForm, guidelineId: event.target.value })} className="mt-1 block w-full bg-ivory-50 text-sm border border-stone-300 px-3 py-2">
              <option value="">General evidence</option>
              {guidelines.map((rule) => <option key={rule.id} value={rule.id}>{rule.id} · {rule.title}</option>)}
            </select>
          </label>
          <Textarea label="Source notes and scope" value={evidenceForm.description} onChange={(event) => setEvidenceForm({ ...evidenceForm, description: event.target.value })} rows={3} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-stone-700">Verification status
              <select value={evidenceForm.verificationStatus} onChange={(event) => setEvidenceForm({ ...evidenceForm, verificationStatus: event.target.value as EvidenceRecord['verificationStatus'] })} className="mt-1 block w-full bg-ivory-50 text-sm border border-stone-300 px-3 py-2">
                <option value="unverified">Unverified</option><option value="verified">Verified</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-stone-700">Last reviewed
              <input type="date" value={evidenceForm.lastReviewedAt} onChange={(event) => setEvidenceForm({ ...evidenceForm, lastReviewedAt: event.target.value })} className="mt-1 block w-full bg-ivory-50 text-sm border border-stone-300 px-3 py-2" />
            </label>
            <label className="text-xs font-semibold text-stone-700">Review due
              <input type="date" value={evidenceForm.reviewDueAt} onChange={(event) => setEvidenceForm({ ...evidenceForm, reviewDueAt: event.target.value })} className="mt-1 block w-full bg-ivory-50 text-sm border border-stone-300 px-3 py-2" />
            </label>
          </div>
          <p className="flex items-start gap-2 border-l-2 border-copper bg-copper-50/60 px-3 py-2 text-[11px] leading-relaxed text-stone-700"><ShieldAlert className="h-4 w-4 shrink-0 text-copper" />Mark verified only after checking the source itself. A URL or imported description alone does not establish a claim.</p>
          {formError && <p role="alert" className="text-xs text-copper-900">{formError}</p>}
          <div className="flex justify-end gap-2 border-t border-stone-200 pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsEvidenceModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" leftIcon={<Check className="h-3.5 w-3.5" />}>Save evidence</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
