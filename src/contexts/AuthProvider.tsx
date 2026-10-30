import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import {
  AuthenticatedWorkspace,
  clearWorkspaceScope,
  getCurrentSession,
  hasLocalWorkspaceData,
  importLocalWorkspace,
  initializeWorkspace,
  isSupabaseConfigured,
  loadWorkspaceSnapshot,
  WorkspaceRole,
} from '@/services/cloudWorkspace';
import { supabase } from '@/services/supabaseClient';
import { setPendingRegistrationTour } from '@/services/onboardingPreferences';

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  workspace: AuthenticatedWorkspace | null;
  role: WorkspaceRole | null;
  migrationRequired: boolean;
  passwordRecovery: boolean;
  error: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, workspaceName: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updateRecoveredPassword: (newPassword: string) => Promise<void>;
  importLocalData: () => Promise<{ alreadyImported: boolean; importedRecords: number }>;
  continueWithoutImport: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const errorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : 'An unexpected authentication error occurred.'
);
type MigrationDecision = 'imported' | 'skipped';

const migrationDecisionKey = (workspaceId: string): string =>
  `brandlens.localMigrationDecision.v1.${workspaceId}`;

const hasMigrationDecision = (workspaceId: string): boolean => {
  const decision = window.localStorage.getItem(migrationDecisionKey(workspaceId));
  return decision === 'imported' || decision === 'skipped';
};

const saveMigrationDecision = (
  workspaceId: string,
  decision: MigrationDecision,
): void => {
  window.localStorage.setItem(migrationDecisionKey(workspaceId), decision);
};

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [workspace, setWorkspace] = useState<AuthenticatedWorkspace | null>(null);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [error, setError] = useState('');

  const initialize = async (nextSession: Session | null) => {
    setError('');
    setSession(nextSession);
    setWorkspace(null);
    setMigrationRequired(false);
    if (!nextSession) {
      clearWorkspaceScope();
      return;
    }
    const nextWorkspace = await initializeWorkspace(nextSession.user);
    if (hasLocalWorkspaceData() && !hasMigrationDecision(nextWorkspace.id)) {
      setWorkspace(nextWorkspace);
      setMigrationRequired(true);
    } else {
      await loadWorkspaceSnapshot(nextWorkspace.id);
      setWorkspace(nextWorkspace);
      setMigrationRequired(false);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    void getCurrentSession()
      .then(async (current) => {
        if (active) await initialize(current);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false);
      }
      setLoading(true);
      window.setTimeout(() => {
        void initialize(nextSession)
          .catch((cause: unknown) => setError(errorMessage(cause)))
          .finally(() => setLoading(false));
      }, 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw new Error(authError.message);
  };

  const signUp = async (email: string, password: string, workspaceName: string, username: string) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    setError('');

    const normalizedUsername = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      throw new Error('Username must be 3–24 characters and contain only letters, numbers, and underscores.');
    }

    const { data: available, error: availabilityError } = await supabase.rpc('is_username_available', {
      candidate: normalizedUsername,
    });
    if (availabilityError) {
      throw new Error(`Username availability could not be checked: ${availabilityError.message}`);
    }
    if (available !== true) {
      throw new Error('That username is already taken or invalid. Choose another username.');
    }

    const { data: signUpData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: {
          workspace_name: workspaceName.trim() || 'BrandLens Workspace',
          username: normalizedUsername,
        },
      },
    });
    if (authError) {
      if (/database error saving new user|profiles_username_key|profiles_username_format_check/i.test(authError.message)) {
        throw new Error('Your account could not be created. That username may already be taken; choose another and try again.');
      }
      throw new Error(authError.message);
    }

    // Associate pending registration tour specifically with the newly created user
    setPendingRegistrationTour(signUpData?.user?.id ?? null, email.trim().toLowerCase());
  };

  const signOut = async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    setPasswordRecovery(false);
    const { error: authError } = await supabase.auth.signOut();
    if (authError) throw new Error(`Sign out failed: ${authError.message}`);
  };

  const requestPasswordReset = async (email: string) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    setError('');
    const redirectTo = `${window.location.origin}/auth?mode=recovery`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    if (resetError) throw new Error(resetError.message);
  };

  const updateRecoveredPassword = async (newPassword: string) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw new Error(updateError.message);
    setPasswordRecovery(false);
  };

  const continueWithoutImport = async () => {
    if (!workspace) throw new Error('No authenticated workspace is available.');
    setError('');
    await loadWorkspaceSnapshot(workspace.id);
    saveMigrationDecision(workspace.id, 'skipped');
    setMigrationRequired(false);
  };

  const importLocalData = async () => {
    if (!workspace) throw new Error('No authenticated workspace is available.');
    setError('');
    const result = await importLocalWorkspace(workspace.id);
    await loadWorkspaceSnapshot(workspace.id);
    saveMigrationDecision(workspace.id, 'imported');
    setMigrationRequired(false);
    return result;
  };

  const refreshWorkspace = async () => {
    if (!workspace) throw new Error('No authenticated workspace is available.');
    await loadWorkspaceSnapshot(workspace.id);
  };

  const value = useMemo<AuthContextValue>(() => ({
    configured: isSupabaseConfigured(),
    loading,
    session,
    workspace,
    role: workspace?.role ?? null,
    migrationRequired,
    passwordRecovery,
    error,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    updateRecoveredPassword,
    importLocalData,
    continueWithoutImport,
    refreshWorkspace,
    clearError: () => setError(''),
  }), [loading, session, workspace, migrationRequired, passwordRecovery, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
};
