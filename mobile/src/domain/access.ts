import { ConfigurationError } from '../api/client';
import { GraphQLResponseError, NOT_AUTHENTICATED, NetworkError, hasErrorCode } from '../api/graphql';
import { BoardLoadError } from '../data/BoardRepository';

/**
 * US-5: what the app may say when it can't show a project's boards and tasks. The backend checks
 * membership on every request and answers a non-member exactly as for something that doesn't
 * exist (NOT_FOUND), so the app can't tell the two apart and never names the project.
 */

// Wording from the designer's “Restrict project data to members” handoff.
export const CHECKING_ACCESS = {
  title: 'Checking access',
  subtitle: 'Please wait…',
  status: 'Loading your permitted workspace…',
  note: 'Private boards and tasks remain hidden until access is confirmed.',
};
export const PROJECT_UNAVAILABLE = {
  title: 'Project unavailable',
  subtitle: 'You don’t have access, or this project is unavailable.',
};
export const ACCESS_CHANGED = {
  title: 'Your project access has changed',
  subtitle: 'You no longer have access to this project.',
};
export const CONTACT_OWNER = 'Return to your projects. If you need access, contact a project Owner.';
/** The design's recoverable connection error. */
export const COULD_NOT_CONNECT = {
  title: 'Couldn’t connect',
  subtitle: 'We couldn’t check project access.',
  error: 'Check your connection and try again.',
};
/** Same layout for an answer that isn't usable: not a connection problem, and not a refusal. */
export const SERVER_PROBLEM = {
  title: 'Couldn’t check access',
  subtitle: 'We couldn’t check project access.',
  error: 'Something went wrong on the server. Try again in a moment.',
};
export const SESSION_EXPIRED_SCREEN = {
  title: 'Your session has expired',
  subtitle: 'Log in again to continue.',
  note: 'Private project content is hidden until your session and membership are verified.',
};
export const PROJECTS_SUBTITLE = 'Only projects you can access';
export const CHOOSE_PROJECT = 'Choose a project from your list.';

/**
 * - `denied`: the backend refused (not a member, or the target is gone). Generic on purpose.
 * - `expired`: the session is over; the app is already signing the user out.
 * - `network`: the backend couldn't be reached.
 * - `server`: it answered, but not usably (HTTP 5xx, an unexpected error code).
 * - `configuration`: the app itself isn't set up (no API URL, nobody signed in).
 */
export type AccessProblem = 'denied' | 'expired' | 'network' | 'server' | 'configuration';

/** The backend's codes for a refusal: NOT_FOUND for a non-member, AUTH_NOT_AUTHORIZED for a role. */
const DENIED_CODES = ['NOT_FOUND', 'AUTH_NOT_AUTHORIZED'];

/** What a failure to read project data means for access, from structured error information only. */
export function accessProblemOf(error: unknown): AccessProblem {
  if (error instanceof BoardLoadError) {
    if (error.kind === 'notFound') return 'denied';
    return error.kind;
  }
  if (hasErrorCode(error, NOT_AUTHENTICATED)) return 'expired';
  if (error instanceof ConfigurationError) return 'configuration';
  if (error instanceof NetworkError) return 'network';
  if (error instanceof GraphQLResponseError && error.errors.some((e) => DENIED_CODES.includes(e.extensions?.code ?? '')))
    return 'denied';
  // Any other answer, or none we understand: not a refusal.
  return 'server';
}

/**
 * What an access screen shows: `unavailable` when the data was never shown, `revoked` when the
 * backend refused data the user was already looking at (they were removed while using it).
 */
export type AccessDenial = 'unavailable' | 'revoked';

/** Internal screens the app may return to after logging in again. Anything else is dropped. */
const RETURNABLE =
  /^\/(boards\/[0-9a-f-]{36}|tasks\/[0-9a-f-]{36}|projects\/[0-9a-f-]{36}(\/backlog|\/members)?)(\?boardId=[0-9a-f-]{36})?$/i;

export function safeReturnPath(path: string | null | undefined): string | null {
  return path && RETURNABLE.test(path) ? path : null;
}

export const sameId = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
