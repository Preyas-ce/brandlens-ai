import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, BadgeCheck, CircleAlert, FilePlus2, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getActivityFeed, type ActivityEvent, type ActivityKind, type ActivityStatus } from '@/services/activityFeed';
import {
  dismissActivityEvents,
  readDismissedActivityIds,
  restoreDismissedActivityEvents,
  ACTIVITY_DISMISSED_UPDATED_EVENT,
} from '@/services/activityLog';
import {
  readReviewRecords,
  REVIEW_RECORDS_STORAGE_KEY,
  REVIEW_RECORDS_UPDATED_EVENT,
} from '@/services/reviewStorage';
import { ReviewRecord } from '@/types/review';
import { getScopedStorageKey } from '@/services/storageScope';
import { useLanguage, type SupportedLanguage, type TranslationKey } from '@/contexts/LanguageProvider';

const ACTIVITY_MARKS: Record<ActivityKind, { icon: typeof FilePlus2; style: string }> = {
  submission: { icon: FilePlus2, style: 'bg-ivory-100 text-obsidian' },
  issue: { icon: CircleAlert, style: 'bg-copper-50 text-copper-700' },
  comment: { icon: Activity, style: 'bg-stone-100 text-stone-700' },
  revision: { icon: RotateCcw, style: 'bg-stone-100 text-stone-700' },
  approval: { icon: BadgeCheck, style: 'bg-forest-50 text-forest-700' },
};

const formatTimestamp = (value: string, language: SupportedLanguage, unavailableText: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return unavailableText;
  const locale = language === 'hi' ? 'hi-IN' : language === 'gu' ? 'gu-IN' : 'en-IN';
  return date.toLocaleString(locale);
};

const getActivityDescriptionKey = (event: ActivityEvent): TranslationKey => {
  if (event.status === 'analysis_complete') {
    return (event.findingCount ?? 0) > 0
      ? 'activityEventAnalysisIssues'
      : 'activityEventAnalysisComplete';
  }

  const keys: Record<Exclude<ActivityStatus, 'analysis_complete'>, TranslationKey> = {
    submitted: 'activityEventSubmitted',
    draft: 'activityEventDraftSaved',
    changes_requested: 'activityEventChangesRequested',
    approved: 'activityEventApproved',
    rejected: 'activityEventRejected',
  };

  return keys[event.status];
};

const formatActivityDetail = (
  event: ActivityEvent,
  t: (key: TranslationKey) => string,
): string => {
  const title = event.eventTitle;

  switch (event.status) {
    case 'submitted':
    case 'approved':
      return `${title} · ${event.actor}`;

    case 'draft':
      return `${title} · ${event.note || `${t('activityRevision')} ${event.revision ?? 1}`}`;

    case 'analysis_complete': {
      const count = event.findingCount ?? 0;
      const countLabel = count === 1 ? t('activityFindingOne') : t('activityFindingMany');
      return `${title} · ${count} ${countLabel} · ${t('activityScore')} ${event.score ?? 0}/100`;
    }

    case 'changes_requested':
    case 'rejected':
      return `${title} · ${event.actor}${event.note ? ` · ${event.note}` : ''}`;
  }

  return event.detail;
};
export const ActivityPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [storageError, setStorageError] = useState('');
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<string[] | null>(null);

  useEffect(() => {
    const refreshRecords = () => {
      try {
        setRecords(readReviewRecords());
        setDismissedIds(readDismissedActivityIds());
        setStorageError('');
      } catch (error) {
        setStorageError(error instanceof Error ? error.message : t('activityLoadFallback'));
      }
    };
    refreshRecords();
    window.addEventListener(REVIEW_RECORDS_UPDATED_EVENT, refreshRecords);
    window.addEventListener(ACTIVITY_DISMISSED_UPDATED_EVENT, refreshRecords);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === getScopedStorageKey(REVIEW_RECORDS_STORAGE_KEY)) refreshRecords();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(REVIEW_RECORDS_UPDATED_EVENT, refreshRecords);
      window.removeEventListener(ACTIVITY_DISMISSED_UPDATED_EVENT, refreshRecords);
      window.removeEventListener('storage', handleStorage);
    };
  }, [t]);

  const events = useMemo(() => getActivityFeed(records), [records]);
  const visibleEvents = events.filter((event) => !dismissedIds.includes(event.id));

  const clearActivity = () => {
    try {
      const previous = dismissActivityEvents(visibleEvents);
      setDismissedIds(readDismissedActivityIds());
      setUndoSnapshot(previous);
      setConfirmClear(false);
      setStorageError('');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : t('activityClearFallback'));
    }
  };

  const undoClear = () => {
    if (!undoSnapshot) return;
    try {
      restoreDismissedActivityEvents(undoSnapshot);
      setDismissedIds(undoSnapshot);
      setUndoSnapshot(null);
      setStorageError('');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : t('activityRestoreFallback'));
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <header className="border-b border-stone-300 pb-5">
        <p className="mb-1 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-copper">{t('activityKicker')}</p>
        <h2 className="font-serif text-3xl font-normal tracking-tight text-obsidian sm:text-4xl">{t('activityTitle')}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
          {t('activityDescription')}
          {t('activityAuditHint')}
        </p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <span className="text-[9px] font-mono uppercase tracking-wider text-stone-500">{visibleEvents.length} {visibleEvents.length === 1 ? t('activityVisibleOne') : t('activityVisibleMany')}</span>
        <div className="flex items-center gap-2">
          {undoSnapshot && (
            <Button type="button" variant="outline" size="sm" leftIcon={<Undo2 className="h-3.5 w-3.5" />} onClick={undoClear}>{t('activityUndoClear')}</Button>
          )}
          <Button type="button" variant="outline" size="sm" leftIcon={<Trash2 className="h-3.5 w-3.5" />} disabled={!visibleEvents.length} onClick={() => setConfirmClear(true)}>{t('activityClearLog')}</Button>
        </div>
      </div>

      {storageError && (
        <p role="alert" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">
          {t('activityStorageErrorPrefix')} {storageError}
        </p>
      )}

      {storageError ? null : visibleEvents.length === 0 ? (
        <EmptyState
          kicker={t('activityEmptyKicker')}
          title={t('activityEmptyTitle')}
          description={t('activityEmptyDescription')}
          icon={<Activity className="h-5 w-5 text-copper" />}
          action={{ label: t('activityStartReview'), onClick: () => navigate('/review') }}
        />
      ) : (
        <section aria-label={t('activitySectionAria')}>
          <p className="mb-3 text-[9px] font-mono uppercase tracking-wider text-stone-500">
            {visibleEvents.length} {visibleEvents.length === 1 ? t('activitySavedOne') : t('activitySavedMany')} · {t('activityNewestFirst')}
          </p>
          <ol className="border-l border-stone-300">
            {visibleEvents.map((event) => {
              const mark = ACTIVITY_MARKS[event.kind];
              const Icon = mark.icon;
              return (
                <li key={event.id} className="relative pb-6 pl-6 last:pb-0">
                  <span className={`absolute -left-[0.55rem] top-0 grid h-4 w-4 place-items-center border border-ivory ${mark.style}`} aria-hidden="true">
                    <Icon className="h-2.5 w-2.5" />
                  </span>
                  <span className="mb-1 block text-[8px] font-mono uppercase tracking-wider text-stone-500">{t('activityWorkspaceRecord')}</span>
                  <button
                    type="button"
                    onClick={() => navigate(`/approvals/${encodeURIComponent(event.reviewId)}`)}
                    className="group w-full rounded-sm text-left transition-colors hover:bg-ivory-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
                    aria-label={`${t(getActivityDescriptionKey(event))}: ${formatActivityDetail(event, t)}. .`}
                  >
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-sm font-semibold text-obsidian transition-colors group-hover:text-copper-700">{t(getActivityDescriptionKey(event))}</span>
                      <time className="text-[9px] font-mono text-stone-500" dateTime={event.timestamp}>{formatTimestamp(event.timestamp, language, t('activityTimeUnavailable'))}</time>
                    </span>
                    <span className="mt-1 block break-words text-xs leading-relaxed text-stone-600">{formatActivityDetail(event, t)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 border-t border-stone-300 pt-3 text-[10px] leading-relaxed text-stone-500">
            {t('activityTimelineFooter')}
          </p>
        </section>
      )}
      <Modal
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        kicker={t('activityClearKicker')}
        title={t('activityClearTitle')}
        subtitle={t('activityClearSubtitle')}
        maxWidth="sm"
        footer={(
          <>
            <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmClear(false)}>{t('activityCancel')}</Button>
            <Button type="button" variant="copper" size="sm" onClick={clearActivity}>{t('activityClearHistory')}</Button>
          </>
        )}
      >
        <p className="text-xs leading-relaxed text-stone-700">{t('activityClearPrompt')}</p>
      </Modal>
    </div>
  );
};
