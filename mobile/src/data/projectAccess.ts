/**
 * US-5: which projects the backend has refused during this session, so that every screen showing
 * one of them clears its data at once, not only the screen that got the refusal. Screens of other
 * projects are untouched, and the session goes on.
 *
 * Held in memory only, and only as project IDs: no project data is kept here. A successful read
 * of a project takes it off the list again (the user may have been added back).
 */

type Listener = (projectId: string) => void;

const lost = new Set<string>();
const listeners = new Set<Listener>();
const key = (projectId: string) => projectId.toLowerCase();

/** The backend refused the project's data, or it is gone from the user's projects. */
export function reportAccessLost(projectId: string): void {
  if (lost.has(key(projectId))) return;
  lost.add(key(projectId));
  listeners.forEach((listener) => listener(projectId));
}

/** The backend has just returned the project's data. */
export function reportAccessConfirmed(projectId: string): void {
  lost.delete(key(projectId));
}

export function hasLostAccess(projectId: string): boolean {
  return lost.has(key(projectId));
}

export function onAccessLost(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Forgets everything: a new session starts with nothing assumed. */
export function resetProjectAccess(): void {
  lost.clear();
}
