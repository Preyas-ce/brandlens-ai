let activeWorkspaceId: string | null = null;
let storageEventsDeferred = false;

export const setActiveWorkspaceStorageScope = (workspaceId: string | null): void => {
  activeWorkspaceId = workspaceId;
};

export const getScopedStorageKey = (key: string): string => (
  activeWorkspaceId ? `${key}.workspace.${activeWorkspaceId}` : key
);

export const getActiveWorkspaceId = (): string | null => activeWorkspaceId;

export const setStorageEventsDeferred = (deferred: boolean): void => {
  storageEventsDeferred = deferred;
};

export const dispatchStorageUpdated = (eventName: string): void => {
  if (!storageEventsDeferred) window.dispatchEvent(new Event(eventName));
};
