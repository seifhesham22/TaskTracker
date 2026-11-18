/**
 * The signed-in session, held in memory while the app runs.
 *
 * `AuthProvider` is the only writer. The GraphQL client reads the access token from here, and the
 * board repository reads the user's ID. The token itself is persisted only through `sessionStorage`
 * (the device's secure store), never here.
 */

export interface SessionUser {
  id: string;
  email: string;
}

export interface Session {
  accessToken: string;
  /** ISO 8601 time at which the backend stops accepting the token. */
  expiresAt: string;
  user: SessionUser;
}

let current: Session | null = null;
let onUnauthenticated: ((accessToken: string) => void) | null = null;

export function getSession(): Session | null {
  return current;
}

export function setSession(session: Session | null): void {
  current = session;
}

/** Called by `AuthProvider` so it can sign out when the backend stops accepting the token. */
export function setUnauthenticatedHandler(handler: ((accessToken: string) => void) | null): void {
  onUnauthenticated = handler;
}

/**
 * The backend refused `accessToken` as expired, revoked or invalid. Ignored unless it is still the
 * current session's token, so a late answer to an old request can't end a newer session.
 */
export function reportUnauthenticated(accessToken: string): void {
  if (current?.accessToken === accessToken) onUnauthenticated?.(accessToken);
}

export function isExpired(session: Pick<Session, 'expiresAt'>, now: number = Date.now()): boolean {
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt <= now;
}
