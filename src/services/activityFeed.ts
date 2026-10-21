import { ReviewRecord } from '@/types/review';

export type ActivityKind = 'submission' | 'issue' | 'comment' | 'revision' | 'approval';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  description: string;
  detail: string;
  timestamp: string;
  reviewId: string;
}

export const getActivityFeed = (records: ReviewRecord[]): ActivityEvent[] => records.flatMap((record) => (
  record.statusHistory.flatMap((event, index): ActivityEvent[] => {
    const revisionSnapshot = event.revision === record.revision
      ? undefined
      : record.revisionHistory.find((snapshot) => snapshot.revision === event.revision);
    const eventTitle = revisionSnapshot?.title ?? record.title;
    const eventFindings = revisionSnapshot?.findings ?? record.findings;
    const eventScore = revisionSnapshot?.score ?? record.score;
    let kind: ActivityKind;
    let description: string;
    let detail: string;

    switch (event.status) {
      case 'submitted':
        kind = 'submission';
        description = 'Content submitted for review';
        detail = `${eventTitle} · ${event.actor}`;
        break;
      case 'draft':
        kind = 'revision';
        description = 'Content revision saved';
        detail = `${eventTitle} · ${event.note || `Revision ${event.revision ?? record.revision}`}`;
        break;
      case 'analysis_complete':
        kind = eventFindings.length ? 'issue' : 'comment';
        description = eventFindings.length ? 'Issues detected in local analysis' : 'Local analysis completed';
        detail = `${eventTitle} · ${eventFindings.length} finding${eventFindings.length === 1 ? '' : 's'} · Score ${eventScore}/100`;
        break;
      case 'changes_requested':
        kind = 'revision';
        description = 'Changes requested by reviewer';
        detail = `${eventTitle} · ${event.actor}${event.note ? ` · ${event.note}` : ''}`;
        break;
      case 'approved':
        kind = 'approval';
        description = 'Human approval recorded';
        detail = `${eventTitle} · ${event.actor}`;
        break;
      case 'rejected':
        kind = 'comment';
        description = 'Content rejected by reviewer';
        detail = `${eventTitle} · ${event.actor}${event.note ? ` · ${event.note}` : ''}`;
        break;
      default:
        return [];
    }

    return [{
      id: `${record.id}-${event.status}-${index}-${event.at}`,
      kind,
      description,
      detail,
      timestamp: event.at,
      reviewId: record.id,
    }];
  })
)).sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
