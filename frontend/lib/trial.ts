/**
 * trial.ts
 *
 * Manages the anonymous trial session for users who haven't signed in.
 * A UUID is generated on first visit and persisted in localStorage.
 * The backend enforces 1 free upload per trial_id.
 */

const TRIAL_KEY = "runpaper_trial_id";

/** Returns the existing trial ID, or creates and stores a new one. */
export function getOrCreateTrialId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(TRIAL_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(TRIAL_KEY, id);
  }
  return id;
}

/** Returns the trial ID if it exists, null otherwise. */
export function getTrialId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TRIAL_KEY);
}

/** True if a trial ID is already stored (user has visited before). */
export function hasTrialId(): boolean {
  return getTrialId() !== null;
}
