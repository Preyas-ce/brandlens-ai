/**
 * Onboarding and Eagle Guided Tour persistence services.
 *
 * Rules:
 * 1. Automatic tour is ONLY eligible for newly registered accounts (via Create Workspace / sign up).
 * 2. Normal sign-in or returning accounts with cleared storage NEVER automatically trigger the tour.
 * 3. The pending-tour marker is established on account registration (associated with userId and/or normalized email).
 * 4. Completed/skipped states are preserved per user ID.
 * 5. Onboarding state is strictly separated from review records, guidelines, and audit data.
 */

const PENDING_REGISTRATION_KEY_PREFIX = 'brandlens.pending_registration_tour.v1.';
const TOUR_COMPLETED_KEY_PREFIX = 'brandlens.eagle_tour_completed.v1.';
const TOUR_SKIPPED_KEY_PREFIX = 'brandlens.eagle_tour_skipped.v1.';
const ACTIVE_TOUR_STEP_KEY_PREFIX = 'brandlens.eagle_tour_step.v1.';
const JUDGE_DEMO_TOUR_SEEN_KEY_PREFIX = 'brandlens.judge_demo_tour_seen.v1.';
const JUDGE_DEMO_SESSION_KEY = 'brandlens.is_judge_demo_session';

const sanitizeKey = (key: string): string => key.trim().toLowerCase();

/**
 * Sets the pending registration tour marker for a newly created account.
 * Called exclusively by the Create Workspace (sign up) registration workflow.
 */
export const setPendingRegistrationTour = (
  userId?: string | null,
  email?: string | null,
): void => {
  try {
    if (userId) {
      window.localStorage.setItem(`${PENDING_REGISTRATION_KEY_PREFIX}${userId}`, 'true');
    }
    if (email) {
      window.localStorage.setItem(`${PENDING_REGISTRATION_KEY_PREFIX}email.${sanitizeKey(email)}`, 'true');
    }
  } catch {
    // Graceful fallback if storage is restricted
  }
};

/**
 * Checks whether the current user is pending the new-account Eagle Guided Tour.
 * Returns true ONLY if a pending marker exists for this specific user.
 */
export const isPendingRegistrationTour = (
  userId?: string | null,
  email?: string | null,
): boolean => {
  try {
    if (userId) {
      const byId = window.localStorage.getItem(`${PENDING_REGISTRATION_KEY_PREFIX}${userId}`);
      if (byId === 'true') return true;
    }
    if (email) {
      const byEmail = window.localStorage.getItem(`${PENDING_REGISTRATION_KEY_PREFIX}email.${sanitizeKey(email)}`);
      if (byEmail === 'true') return true;
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Clears the pending registration marker after the tour begins or is dismissed.
 */
export const clearPendingRegistrationTour = (
  userId?: string | null,
  email?: string | null,
): void => {
  try {
    if (userId) {
      window.localStorage.removeItem(`${PENDING_REGISTRATION_KEY_PREFIX}${userId}`);
    }
    if (email) {
      window.localStorage.removeItem(`${PENDING_REGISTRATION_KEY_PREFIX}email.${sanitizeKey(email)}`);
    }
  } catch {
    // Graceful fallback
  }
};

/**
 * Checks whether the user has completed the Eagle Guided Tour.
 */
export const hasUserCompletedEagleTour = (userId?: string | null): boolean => {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(`${TOUR_COMPLETED_KEY_PREFIX}${userId}`) === 'true';
  } catch {
    return false;
  }
};

/**
 * Marks the Eagle Guided Tour as completed for the user.
 */
export const markUserEagleTourCompleted = (userId?: string | null): void => {
  if (!userId) return;
  try {
    window.localStorage.setItem(`${TOUR_COMPLETED_KEY_PREFIX}${userId}`, 'true');
    window.localStorage.removeItem(`${ACTIVE_TOUR_STEP_KEY_PREFIX}${userId}`);
  } catch {
    // Graceful fallback
  }
};

/**
 * Checks whether the user has explicitly skipped the Eagle Guided Tour.
 */
export const hasUserSkippedEagleTour = (userId?: string | null): boolean => {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(`${TOUR_SKIPPED_KEY_PREFIX}${userId}`) === 'true';
  } catch {
    return false;
  }
};

/**
 * Marks the tour as skipped for this user.
 */
export const markUserEagleTourSkipped = (userId?: string | null): void => {
  if (!userId) return;
  try {
    window.localStorage.setItem(`${TOUR_SKIPPED_KEY_PREFIX}${userId}`, 'true');
    window.localStorage.removeItem(`${ACTIVE_TOUR_STEP_KEY_PREFIX}${userId}`);
  } catch {
    // Graceful fallback
  }
};

/**
 * Saves the active tour step for resuming across route changes.
 */
export const saveActiveTourStep = (userId: string | null | undefined, step: number): void => {
  const key = userId || 'anonymous';
  try {
    window.localStorage.setItem(`${ACTIVE_TOUR_STEP_KEY_PREFIX}${key}`, String(step));
  } catch {
    // Graceful fallback
  }
};

/**
 * Gets the active saved tour step, defaulting to 1.
 */
export const getActiveTourStep = (userId?: string | null): number => {
  const key = userId || 'anonymous';
  try {
    const raw = window.localStorage.getItem(`${ACTIVE_TOUR_STEP_KEY_PREFIX}${key}`);
    const num = raw ? parseInt(raw, 10) : 1;
    return num >= 1 && num <= 6 ? num : 1;
  } catch {
    return 1;
  }
};

/**
 * Resets all eagle tour state for testing or replay scenarios.
 */
export const resetEagleTourState = (userId?: string | null): void => {
  if (!userId) return;
  try {
    window.localStorage.removeItem(`${PENDING_REGISTRATION_KEY_PREFIX}${userId}`);
    window.localStorage.removeItem(`${TOUR_COMPLETED_KEY_PREFIX}${userId}`);
    window.localStorage.removeItem(`${TOUR_SKIPPED_KEY_PREFIX}${userId}`);
    window.localStorage.removeItem(`${ACTIVE_TOUR_STEP_KEY_PREFIX}${userId}`);
  } catch {
    // Ignore
  }
};

/**
 * Sets whether the current browser session was initiated via Judge Demo Access.
 */
export const setJudgeDemoSession = (isJudge: boolean): void => {
  try {
    if (typeof window === 'undefined') return;
    if (isJudge) {
      window.sessionStorage.setItem(JUDGE_DEMO_SESSION_KEY, 'true');
    } else {
      window.sessionStorage.removeItem(JUDGE_DEMO_SESSION_KEY);
    }
  } catch {
    // Ignore
  }
};

/**
 * Checks whether the current session is an active Judge Demo session.
 */
export const isJudgeDemoSessionActive = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(JUDGE_DEMO_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
};

/**
 * Checks whether an email matches the configured public judge demo email.
 */
export const isJudgeDemoEmail = (
  email?: string | null,
  configuredEmail?: string | null,
): boolean => {
  if (!email) return false;
  const target = (configuredEmail || '').trim().toLowerCase();
  return Boolean(target && email.trim().toLowerCase() === target);
};

/**
 * Checks whether the judge demo tour has already been seen by this specific user.
 */
export const hasJudgeDemoTourBeenSeen = (userId?: string | null): boolean => {
  if (!userId) return false;
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(`${JUDGE_DEMO_TOUR_SEEN_KEY_PREFIX}${userId}`) === 'true';
  } catch {
    return false;
  }
};

/**
 * Marks the judge demo tour as seen for this specific user.
 */
export const markJudgeDemoTourSeen = (userId?: string | null): void => {
  if (!userId) return;
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`${JUDGE_DEMO_TOUR_SEEN_KEY_PREFIX}${userId}`, 'true');
  } catch {
    // Ignore
  }
};

/**
 * Resets the judge demo tour seen marker (for testing or reset flows).
 */
export const resetJudgeDemoTourSeen = (userId?: string | null): void => {
  if (!userId) return;
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(`${JUDGE_DEMO_TOUR_SEEN_KEY_PREFIX}${userId}`);
  } catch {
    // Ignore
  }
};