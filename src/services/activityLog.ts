import { ActivityEvent } from '@/services/activityFeed';

export const ACTIVITY_DISMISSED_STORAGE_KEY = 'brandlens.activityDismissed.v1';
export const ACTIVITY_DISMISSED_UPDATED_EVENT = 'brandlens:activity-dismissed-updated';

export const readDismissedActivityIds = (): string[] => {
  const raw = window.localStorage.getItem(ACTIVITY_DISMISSED_STORAGE_KEY);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Saved activity state could not be read: ${error instanceof Error ? error.message : 'invalid JSON'}`);
  }
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error('Saved activity state has an unsupported format and was left unchanged.');
  }
  return parsed;
};

export const dismissActivityEvents = (events: ActivityEvent[]): string[] => {
  const previous = readDismissedActivityIds();
  const next = [...new Set([...previous, ...events.map((event) => event.id)])];
  window.localStorage.setItem(ACTIVITY_DISMISSED_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(ACTIVITY_DISMISSED_UPDATED_EVENT));
  return previous;
};

export const restoreDismissedActivityEvents = (ids: string[]): void => {
  window.localStorage.setItem(ACTIVITY_DISMISSED_STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(ACTIVITY_DISMISSED_UPDATED_EVENT));
};
