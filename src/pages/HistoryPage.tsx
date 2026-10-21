import React, { useEffect, useState } from 'react';
import {
  Download, 
  Search, 
  UserCheck,
  History,
  RotateCcw,
} from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import {
  readReviewRecords,
  clearUserGeneratedReviewRecords,
  clearAllReviewRecords,
  REVIEW_RECORDS_STORAGE_KEY,
  REVIEW_RECORDS_UPDATED_EVENT,
} from '@/services/reviewStorage';
import { readWorkspaceAuditEvents, WORKSPACE_DATA_STORAGE_KEY, WORKSPACE_DATA_UPDATED_EVENT } from '@/services/workspaceStorage';
import { createAuditTrailExport } from '@/services/auditTrailExport';
import { ReviewRecord } from '@/types/review';
import { WorkspaceAuditEvent } from '@/types/workspace';
import { useNavigate } from 'react-router-dom';

interface AuditRecord {
  id: string;
  docTitle: string;
  source: string;
  score: number;
  status: string;
  verifiedBy: string;
  timestamp: string;
  flagsResolved: number;
  comment?: string;
  revision?: number;
  contentHash?: string;
  isDemo?: boolean;
  recordOrigin?: 'live' | 'seeded_example';
  relatedReviewId?: string;
  eventType?: string;
  details?: Record<string, string>;
  sortTimestamp?: string;
  revisionContent?: string;
  events?: AuditRecord[];
}

type AuditFilter = 'all' | 'review' | 'decision' | 'guideline' | 'evidence' | 'settings';
type AuditRecordView = 'live' | 'seeded';

const STATUS_EVENT_LABELS: Record<string, string> = {
  draft: 'Draft / revision saved',
  submitted: 'Submitted',
  analysis_complete: 'AI analysis complete',
  validation_complete: 'Brand & evidence validation complete',
  issues_found: 'Issues found',
  awaiting_human_verification: 'Awaiting human verification',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  rejected: 'Rejected',
};

const workspaceEventLabel = (event: WorkspaceAuditEvent): string => {
  const labels: Record<string, string> = {
    guideline_created: 'Guideline created',
    guideline_updated: 'Guideline updated',
    guideline_activated: 'Guideline activated',
    guideline_deactivated: 'Guideline paused',
    guideline_deleted: 'Guideline deleted',
    evidence_created: 'Evidence record created',
    evidence_updated: 'Evidence record updated',
    evidence_deleted: 'Evidence record deleted',
    settings_updated: 'Workspace settings updated',
  };
  return labels[event.type] ?? event.type;
};

const AUDIT_LOGS: AuditRecord[] = [
  {
    id: 'AUD-5881',
    docTitle: 'Brand Modernization & Visual Identity Manifesto',
    source: 'Internal Brand Team',
    score: 94,
    status: 'Approved',
    verifiedBy: 'Elena Rostova (VP Brand Strategy)',
    timestamp: '2026-10-20 14:12',
    flagsResolved: 1,
    isDemo: true,
  },
  {
    id: 'AUD-5880',
    docTitle: 'Investor Narrative & Sustainable Growth Brief',
    source: 'Executive Communications',
    score: 98,
    status: 'Approved',
    verifiedBy: 'Nitin Editor (Chief Brand Officer)',
    timestamp: '2026-10-19 18:30',
    flagsResolved: 0,
    isDemo: true,
  },
  {
    id: 'AUD-5879',
    docTitle: 'Global Partner Summit Invitation Letter',
    source: 'Events Marketing Team',
    score: 88,
    status: 'Approved',
    verifiedBy: 'Marcus Brody (Lead Tech Writer)',
    timestamp: '2026-10-19 11:05',
    flagsResolved: 2,
    isDemo: true,
  },
  {
    id: 'AUD-5878',
    docTitle: 'Product Security Whitepaper v2.0',
    source: 'Technical Architecture',
    score: 62,
    status: 'Revision Requested',
    verifiedBy: 'Elena Rostova (VP Brand Strategy)',
    timestamp: '2026-10-18 16:44',
    flagsResolved: 4,
    isDemo: true,
  },
  {
    id: 'AUD-5877',
    docTitle: 'AI Ethics & Customer Privacy Charter',
    source: 'Legal & Compliance',
    score: 99,
    status: 'Approved',
    verifiedBy: 'Nitin Editor (Chief Brand Officer)',
    timestamp: '2026-10-17 09:20',
    flagsResolved: 0,
    isDemo: true,
  },
];

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<AuditFilter>('all');
  const [recordView, setRecordView] = useState<AuditRecordView>('live');
  const [selectedEvent, setSelectedEvent] = useState<AuditRecord | null>(null);
  const [reviewRecords, setReviewRecords] = useState<ReviewRecord[]>([]);
  const [workspaceEvents, setWorkspaceEvents] = useState<WorkspaceAuditEvent[]>([]);
  const [storageError, setStorageError] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  useEffect(() => {
    const refreshRecords = () => {
      try {
        setReviewRecords(readReviewRecords());
        setWorkspaceEvents(readWorkspaceAuditEvents());
        setStorageError('');
      } catch (error) {
        setStorageError(error instanceof Error ? error.message : 'Local audit records could not be loaded.');
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

  const localAuditLogs: AuditRecord[] = reviewRecords.flatMap((record) => {
    const lifecycleEvents: AuditRecord[] = record.statusHistory
      .filter((event) => event.status !== 'approved' && event.status !== 'changes_requested' && event.status !== 'rejected')
      .map((event, index) => {
        const revision = event.revision ?? record.revision;
        const snapshot = record.revisionHistory.find((item) => item.revision === revision);
        return {
          id: `${record.id}-event-${index}-${event.at}`,
          docTitle: `${snapshot?.title ?? record.title} · Revision ${revision}`,
          source: record.campaign || record.contentType,
          score: snapshot?.score ?? (revision === record.revision ? record.score : 0),
          status: STATUS_EVENT_LABELS[event.status] ?? event.status,
          verifiedBy: event.actor,
          timestamp: new Date(event.at).toLocaleString(),
          sortTimestamp: event.at,
          flagsResolved: snapshot?.findings.length ?? (revision === record.revision ? record.findings.length : 0),
          comment: event.note,
          revision,
          contentHash: snapshot?.contentHash ?? (revision === record.revision ? record.contentHash : undefined),
          revisionContent: snapshot?.content ?? (revision === record.revision ? record.currentContent : undefined),
          relatedReviewId: record.id,
          eventType: 'review',
        };
      });
    const decisions: AuditRecord[] = record.decisionHistory.map((decision) => {
      const revision = record.revisionHistory.find((item) => (
        item.revision === decision.revision && item.contentHash === decision.contentHash
      ));
      const isCurrentRevision = record.revision === decision.revision && record.contentHash === decision.contentHash;
      const findings = isCurrentRevision ? record.findings : revision?.findings ?? [];
      return {
        id: `${record.id}-R${decision.revision}-${decision.decidedAt}`,
        docTitle: `${revision?.title ?? record.title} · Revision ${decision.revision}`,
        source: record.campaign || record.contentType,
        score: isCurrentRevision ? record.score : revision?.score ?? 0,
        status: decision.decision === 'approved'
          ? 'Approved'
          : decision.decision === 'changes_requested'
            ? 'Revision Requested'
            : 'Rejected',
        verifiedBy: decision.reviewer,
        timestamp: new Date(decision.decidedAt).toLocaleString(),
        sortTimestamp: decision.decidedAt,
        flagsResolved: findings.length,
        comment: decision.comment,
        revision: decision.revision,
        contentHash: decision.contentHash,
        revisionContent: decision.content,
        relatedReviewId: record.id,
        eventType: 'decision',
      };
    });
    return [...lifecycleEvents, ...decisions];
  });

  const workspaceAuditLogs: AuditRecord[] = workspaceEvents.map((event) => ({
    id: event.id,
    docTitle: event.entityTitle,
    source: event.snapshot.category ?? event.snapshot.sourceName ?? event.entityId,
    score: 0,
    status: workspaceEventLabel(event),
    verifiedBy: event.actor,
    timestamp: new Date(event.timestamp).toLocaleString(),
    sortTimestamp: event.timestamp,
    flagsResolved: 0,
    comment: event.description,
    eventType: event.type.startsWith('guideline')
      ? 'guideline'
      : event.type.startsWith('evidence') ? 'evidence' : 'settings',
    details: event.snapshot,
  }));
  const liveLogs = [...localAuditLogs, ...workspaceAuditLogs]
    .sort((left, right) => new Date(right.sortTimestamp ?? right.timestamp).getTime() - new Date(left.sortTimestamp ?? left.timestamp).getTime());
  const seededLogs = [...AUDIT_LOGS]
    .sort((left, right) => new Date(right.sortTimestamp ?? right.timestamp).getTime() - new Date(left.sortTimestamp ?? left.timestamp).getTime());

  const groupLogs = (sourceLogs: AuditRecord[]): AuditRecord[] => {
    const grouped = new Map<string, AuditRecord[]>();
    const displayLogs: AuditRecord[] = [];
    sourceLogs.forEach((log) => {
      if (!log.relatedReviewId || !['review', 'decision'].includes(log.eventType ?? '')) {
        displayLogs.push(log);
        return;
      }
      const groupId = `${log.relatedReviewId}-${log.revision ?? 0}-${log.contentHash ?? ''}`;
      grouped.set(groupId, [...(grouped.get(groupId) ?? []), log]);
    });
    grouped.forEach((events) => {
      const ordered = events.slice().sort((left, right) => (
        new Date(left.sortTimestamp ?? left.timestamp).getTime() - new Date(right.sortTimestamp ?? right.timestamp).getTime()
      ));
      const latest = ordered[ordered.length - 1];
      displayLogs.push({
        ...latest,
        id: `${latest.relatedReviewId}-R${latest.revision}-${latest.contentHash ?? 'revision'}`,
        status: latest.status,
        events: ordered,
      });
    });
    return displayLogs.sort((left, right) => new Date(right.sortTimestamp ?? right.timestamp).getTime() - new Date(left.sortTimestamp ?? left.timestamp).getTime());
  };
  const liveCount = groupLogs(liveLogs).length;
  const seededCount = seededLogs.length;
  const selectedLogs = recordView === 'live' ? liveLogs : seededLogs;
  const filteredLogs = selectedLogs.filter(
    (log) => (filter === 'all' || log.eventType === filter) && (
      log.docTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.verifiedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.comment?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );
  const displayLogs = groupLogs(filteredLogs);

  const getDiff = (currentLog: AuditRecord) => {
    if (!currentLog.relatedReviewId || !currentLog.revision) return null;
    const record = reviewRecords.find((item) => item.id === currentLog.relatedReviewId);
    const current = record?.revisionHistory.find((item) => item.revision === currentLog.revision)?.content
      ?? (record?.revision === currentLog.revision ? record.currentContent : currentLog.revisionContent);
    const previous = record?.revisionHistory.find((item) => item.revision === (currentLog.revision ?? 1) - 1)?.content;
    if (current === undefined || previous === undefined) return null;
    const beforeWords = previous.split(/(\s+)/);
    const afterWords = current.split(/(\s+)/);
    let prefix = 0;
    while (prefix < beforeWords.length && prefix < afterWords.length && beforeWords[prefix] === afterWords[prefix]) prefix += 1;
    let suffix = 0;
    while (
      suffix < beforeWords.length - prefix
      && suffix < afterWords.length - prefix
      && beforeWords[beforeWords.length - 1 - suffix] === afterWords[afterWords.length - 1 - suffix]
    ) suffix += 1;
    return {
      before: beforeWords.slice(prefix, beforeWords.length - suffix).join(''),
      after: afterWords.slice(prefix, afterWords.length - suffix).join(''),
    };
  };

  const handleExport = () => {
    const exportData = createAuditTrailExport(liveLogs, seededLogs);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'brandlens_audit_trail.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const resetLocalHistory = (mode: 'tests' | 'all') => {
    try {
      const removed = mode === 'tests' ? clearUserGeneratedReviewRecords() : clearAllReviewRecords();
      setReviewRecords(readReviewRecords());
      setStorageError('');
      setIsResetModalOpen(false);
      if (removed === 0) setStorageError('No local review records matched that reset option.');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Local audit history could not be reset.');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="border-b border-stone-300 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase tracking-widest font-mono text-copper font-bold">
              Compliance Ledger
            </span>
          </div>
          <h2 className="font-serif text-3xl font-normal text-obsidian tracking-tight">
            Editorial Audit History
          </h2>
          <p className="text-sm text-stone-600 mt-1 max-w-2xl">
            Live reviewer decisions are linked to exact analysed revisions. Built-in reference examples are kept separate and are not live approval records.
          </p>
        </div>

        {storageError && <p role="alert" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">Local audit decisions could not be loaded: {storageError}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="md"
            leftIcon={<RotateCcw className="w-4 h-4 text-copper" />}
            onClick={() => setIsResetModalOpen(true)}
          >
            Reset Local Audit History
          </Button>
          <Button
            variant="outline"
            size="md"
            leftIcon={<Download className="w-4 h-4 text-stone-600" />}
            onClick={handleExport}
          >
            Export Audit Trail (JSON)
          </Button>
        </div>
      </div>

      <div role="tablist" aria-label="Audit record origin" className="flex flex-wrap gap-2 border-b border-stone-300 pb-3">
        <button
          type="button"
          role="tab"
          aria-selected={recordView === 'live'}
          onClick={() => setRecordView('live')}
          className={`border px-3 py-2 text-[10px] font-mono uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 ${recordView === 'live' ? 'border-obsidian bg-obsidian text-ivory' : 'border-stone-300 bg-ivory-50 text-stone-700 hover:border-copper'}`}
        >
          Live Workspace Audit Ledger ({liveCount})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={recordView === 'seeded'}
          onClick={() => setRecordView('seeded')}
          className={`border px-3 py-2 text-[10px] font-mono uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 ${recordView === 'seeded' ? 'border-obsidian bg-obsidian text-ivory' : 'border-stone-300 bg-ivory-50 text-stone-700 hover:border-copper'}`}
        >
          Seeded Reference Examples ({seededCount})
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex items-center justify-between gap-4 bg-ivory-50/80 p-3.5 rounded-[3px] border border-stone-300">
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, reviewer, or department..."
            className="w-full bg-white text-xs rounded-[3px] border border-stone-300 pl-9 pr-3 py-2 placeholder:text-stone-400 focus:outline-none focus:border-copper"
          />
        </div>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as AuditFilter)}
          aria-label="Filter audit history by event type"
          className="bg-white text-xs rounded-[3px] border border-stone-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
        >
          <option value="all">All events</option>
          <option value="review">Review lifecycle</option>
          <option value="decision">Human decisions</option>
          <option value="guideline">Guideline changes</option>
          <option value="evidence">Evidence changes</option>
          <option value="settings">Workspace settings</option>
        </select>
        </div>

        <span className="text-xs text-stone-500 font-mono hidden sm:inline">
          Showing {displayLogs.length} {recordView === 'live' ? 'live' : 'seeded'} audit records
        </span>
      </div>

      {/* Audit Table */}
      <Panel
        padding="none"
        variant="elevated"
        kicker={recordView === 'live' ? 'APPEND-ONLY WORKSPACE TIMELINE' : 'BUILT-IN DEMONSTRATION RECORDS'}
        title={recordView === 'live' ? `Live Workspace Audit Ledger (${liveCount})` : `Seeded Reference Examples (${seededCount})`}
      >
        {recordView === 'seeded' && (
          <div className="border-b border-copper-300 bg-copper-50 px-6 py-3">
            <span className="inline-flex border border-copper-400 bg-ivory px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-copper-900">SEEDED EXAMPLE · NOT A LIVE APPROVAL</span>
            <p className="mt-1 text-[10px] leading-relaxed text-stone-700">These built-in examples illustrate the audit interface and are not user-submitted or saved approval records.</p>
          </div>
        )}
        {filteredLogs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              kicker="AUDIT LOG SEARCH"
              title="No Matching Audit Records"
              description="No historical audit entries match your search query. Try searching for a different reviewer, document title, or source."
              icon={<History className="w-5 h-5 text-copper" />}
              action={{
                label: 'Clear Search Query',
                onClick: () => setSearchTerm(''),
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ivory-100/80 border-b border-stone-200 uppercase font-mono font-semibold text-stone-600 tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-3.5">Log ID / Date</th>
                  <th className="px-6 py-3.5">Document Title & Source</th>
                  <th className="px-6 py-3.5">Alignment</th>
                  <th className="px-6 py-3.5">Gate Status</th>
                  <th className="px-6 py-3.5">Human Sign-off Signature</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {displayLogs.map((log) => (
                  <React.Fragment key={log.id}>
                  <tr className="align-top hover:bg-ivory-100/60 transition-colors">
                    <td className="px-6 py-4 font-mono">
                      {log.isDemo && <span className="mb-1 inline-block border border-copper-400 bg-copper-50 px-1.5 py-1 text-[8px] font-mono font-bold uppercase tracking-wider text-copper-900">SEEDED EXAMPLE · NOT A LIVE APPROVAL</span>}
                      {log.details ? (
                        <button type="button" onClick={() => setSelectedEvent(log)} className="font-bold text-obsidian hover:text-copper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60">{log.id} · Details</button>
                      ) :                       <div className="font-bold text-obsidian">{log.events ? `R${log.revision} · ${log.relatedReviewId}` : log.id}</div>}
                      <div className="text-stone-500 text-[11px]">{log.timestamp}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-serif text-sm font-medium text-obsidian">
                        {log.relatedReviewId ? (
                          <button type="button" onClick={() => navigate(`/approvals/${encodeURIComponent(log.relatedReviewId ?? '')}`)} className="text-left hover:text-copper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60">{log.docTitle}</button>
                        ) : log.docTitle}
                      </div>
                      <div className="text-stone-500 text-[11px] mt-0.5">
                        {log.source}{log.contentHash ? ` · ${log.contentHash}` : ''}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`font-mono font-semibold ${
                        log.score >= 90 ? 'text-forest' : 'text-copper'
                      }`}>
                        {log.eventType === 'guideline' || log.eventType === 'evidence' ? '—' : `${log.score}/100`}
                      </span>
                      <span className="text-[11px] text-stone-500 block">
                        {log.eventType === 'guideline' || log.eventType === 'evidence' ? log.eventType : `${log.flagsResolved} findings`}
                      </span>
                      {log.events && (
                        <div className="mt-2 flex flex-wrap items-center gap-1 text-[8px] font-mono uppercase tracking-wide text-stone-500" aria-label="Review lifecycle">
                          {[
                            ['Submitted', log.events.some((event) => event.status === 'Submitted')],
                            ['Analyzed', log.events.some((event) => event.status.toLowerCase().includes('analysis complete'))],
                            ['Flagged', log.flagsResolved > 0],
                            ['Gate', log.events.some((event) => event.eventType === 'decision')],
                          ].map(([label, done]) => (
                            <span key={String(label)} className={`border px-1 py-0.5 ${done ? 'border-forest-300 bg-forest-50 text-forest-800' : 'border-stone-200 text-stone-400'}`}>{label}</span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <Badge
                        variant={log.status === 'Approved' || log.status.includes('complete') ? 'forest' : log.status === 'Rejected' ? 'stone' : 'copper'}
                        size="sm"
                        dot
                      >
                        {log.status}
                      </Badge>
                    </td>

                    <td className="px-6 py-4 font-sans">
                      <div className="flex items-center gap-1.5 text-obsidian font-medium">
                        <UserCheck className={`w-3.5 h-3.5 ${log.status === 'Approved' ? 'text-forest' : 'text-copper'}`} />
                        <span>{log.verifiedBy}</span>
                      </div>
                      <div className="text-[10px] text-stone-500 uppercase tracking-widest font-mono">
                        {log.isDemo ? 'Seeded demo record' : `${log.eventType === 'guideline' || log.eventType === 'evidence' ? 'Workspace event' : `Revision ${log.revision ?? '—'} · ${log.contentHash ?? ''}`}`}
                      </div>
                      {log.comment && <div className="mt-1 max-w-sm text-[10px] leading-relaxed text-stone-600">“{log.comment}”</div>}
                    </td>
                  </tr>
                  {log.events && (
                    <tr className="bg-ivory-100/40">
                      <td colSpan={5} className="px-6 pb-3">
                        <details className="border-t border-stone-200 pt-2">
                          <summary className="cursor-pointer text-[9px] font-mono uppercase tracking-wider text-copper-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60">Revision lifecycle · {log.events.length} events · Compare with prior revision</summary>
                          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                            <ol className="space-y-2">
                              {log.events.map((event) => (
                                <li key={event.id} className="flex items-start justify-between gap-3 border-l border-stone-300 pl-2 text-[9px]">
                                  <span className="font-semibold text-obsidian">{event.status}<span className="ml-2 font-normal text-stone-500">· {event.verifiedBy}</span></span>
                                  <time className="shrink-0 text-stone-500">{event.timestamp}</time>
                                </li>
                              ))}
                            </ol>
                            {(() => {
                              const diff = getDiff(log);
                              return diff ? (
                                <div className="border-l-2 border-copper/50 pl-3">
                                  <p className="mb-2 text-[9px] font-mono font-bold uppercase tracking-wider text-stone-600">Revision diff · changed passage</p>
                                  <p className="text-[10px] leading-relaxed text-stone-700"><span className="font-mono text-copper-800">−</span> {diff.before || 'No prior wording'}</p>
                                  <p className="mt-1 text-[10px] leading-relaxed text-stone-700"><span className="font-mono text-forest-800">+</span> {diff.after || 'No replacement wording'}</p>
                                </div>
                              ) : <p className="text-[9px] text-stone-500">No prior revision is available for comparison.</p>;
                            })()}
                          </div>
                        </details>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        isOpen={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        kicker="WORKSPACE AUDIT EVENT"
        title={selectedEvent?.docTitle}
        subtitle={selectedEvent ? `${selectedEvent.status} · ${selectedEvent.id} · ${selectedEvent.timestamp}` : ''}
        maxWidth="lg"
      >
        {selectedEvent && (
          <div className="space-y-3">
            <p className="border-l-2 border-copper bg-copper-50/70 px-3 py-2 text-xs text-stone-700">{selectedEvent.comment}</p>
            <p className="text-xs text-stone-600"><strong className="text-obsidian">Recorded by:</strong> {selectedEvent.verifiedBy}</p>
            <dl className="grid gap-2 sm:grid-cols-2">
              {Object.entries(selectedEvent.details ?? {}).map(([key, value]) => (
                <div key={key} className="border-b border-stone-200 pb-2">
                  <dt className="text-[9px] font-mono uppercase tracking-wider text-stone-500">{key}</dt>
                  <dd className="mt-1 break-words text-xs text-obsidian">{value || 'Not provided'}</dd>
                </div>
              ))}
            </dl>
            <div className="flex justify-end border-t border-stone-200 pt-3">
              <Button variant="secondary" size="sm" onClick={() => setSelectedEvent(null)}>Close details</Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        kicker="LOCAL AUDIT HISTORY"
        title="Reset local review records"
        subtitle="Choose precisely which browser-saved review records to remove. Guideline, evidence, and workspace settings remain unchanged."
        maxWidth="lg"
      >
        <div className="space-y-3">
          <div className="border border-stone-200 bg-ivory-50 p-3">
            <h4 className="text-sm font-semibold text-obsidian">Clear local test records</h4>
            <p className="mt-1 text-[10px] leading-relaxed text-stone-600">Remove user-created review records, revisions, and decisions. Prepared demo scenario records are preserved.</p>
            <Button className="mt-3" type="button" variant="outline" size="sm" onClick={() => resetLocalHistory('tests')}>Clear test records</Button>
          </div>
          <div className="border border-copper/40 bg-copper-50/50 p-3">
            <h4 className="text-sm font-semibold text-obsidian">Reset to clean seeded examples</h4>
            <p className="mt-1 text-[10px] leading-relaxed text-stone-600">Remove all browser-saved review records, including prepared scenarios. The five built-in, read-only seeded audit examples remain visible.</p>
            <Button className="mt-3" type="button" variant="copper" size="sm" onClick={() => resetLocalHistory('all')}>Reset to seeded examples</Button>
          </div>
          <div className="flex justify-end border-t border-stone-200 pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsResetModalOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
