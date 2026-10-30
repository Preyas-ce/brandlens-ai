/**
 * Utilities for managing the one-time welcome experience shown to users
 * after their first successful sign-in or email confirmation.
 *
 * Stored in localStorage keyed by the non-sensitive Supabase user ID.
 */

export const getWelcomeStorageKey = (userId: string): string =>
  `brandlens.welcome_shown.v1.${userId}`;

/**
 * Checks whether the given user has already completed or dismissed
 * the first-sign-in welcome illumination experience.
 *
 * Falls back gracefully to true if browser storage is unavailable or restricted.
 */
export const hasUserSeenWelcome = (userId?: string | null): boolean => {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(getWelcomeStorageKey(userId)) === 'true';
  } catch {
    // If browser storage is disabled or blocked, fallback cleanly so the user is not trapped
    return true;
  }
};

/**
 * Marks the welcome experience as completed for the given user ID.
 * Non-blocking and error-safe.
 */
export const markUserWelcomeSeen = (userId?: string | null): void => {
  if (!userId) return;
  try {
    window.localStorage.setItem(getWelcomeStorageKey(userId), 'true');
  } catch {
    // Graceful silent fallback if storage quota is exceeded or storage is blocked
  }
};

/**
 * Resets the welcome marker (primarily used in tests or demo resets).
 */
export const resetUserWelcomeState = (userId?: string | null): void => {
  if (!userId) return;
  try {
    window.localStorage.removeItem(getWelcomeStorageKey(userId));
  } catch {
    // Ignore
  }
};