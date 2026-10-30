let activeWorkspaceId: string | null = null;

export const setActiveWorkspace = (workspaceId: string | null): void => {
  activeWorkspaceId = workspaceId;
};

export const getActiveWorkspace = (): string | null => activeWorkspaceId;
