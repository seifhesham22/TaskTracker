import { ApiError } from '../api/errors';

export type ProjectAccessState =
  | 'checking'
  | 'permitted'
  | 'unavailable'
  | 'revoked'
  | 'session_expired'
  | 'connection_error';

export interface IProjectAccessClassifier {
  classifyError(error: unknown, wasPermitted?: boolean): ProjectAccessState;
}

export class ProjectAccessClassifier implements IProjectAccessClassifier {
  classifyError(error: unknown, wasPermitted: boolean = false): ProjectAccessState {
    if (!error) {
      return 'permitted';
    }

    if (this.isSessionExpired(error)) {
      return 'session_expired';
    }

    if (this.isConnectionError(error)) {
      return 'connection_error';
    }

    if (this.isForbidden(error)) {
      return wasPermitted ? 'revoked' : 'unavailable';
    }

    if (this.isNotFound(error)) {
      return wasPermitted ? 'revoked' : 'unavailable';
    }

    return 'connection_error';
  }

  private isSessionExpired(error: unknown): boolean {
    if (error instanceof ApiError) {
      if (error.status === 401) return true;
      const msg = error.message.toLowerCase();
      if (
        msg.includes('unauthenticated') ||
        msg.includes('token expired') ||
        msg.includes('session expired') ||
        msg.includes('not authenticated')
      ) {
        return true;
      }
      if (Array.isArray(error.body)) {
        return error.body.some(
          (e: { extensions?: { code?: string } }) => e?.extensions?.code === 'AUTH_NOT_AUTHENTICATED'
        );
      }
    }
    return false;
  }

  private isForbidden(error: unknown): boolean {
    if (error instanceof ApiError) {
      if (error.status === 403) return true;
      if (Array.isArray(error.body)) {
        return error.body.some((e: { extensions?: { code?: string } }) => {
          const code = e?.extensions?.code;
          return code === 'AUTH_NOT_AUTHORIZED' || code === 'FORBIDDEN';
        });
      }
    }
    return false;
  }

  private isNotFound(error: unknown): boolean {
    if (error instanceof ApiError) {
      if (error.status === 404) return true;
      const msg = error.message.toLowerCase();
      if (msg.includes('not found') || msg.includes('unavailable') || msg.includes("doesn't exist")) {
        return true;
      }
      if (Array.isArray(error.body)) {
        return error.body.some(
          (e: { extensions?: { code?: string } }) => e?.extensions?.code === 'NOT_FOUND'
        );
      }
    }
    return false;
  }

  private isConnectionError(error: unknown): boolean {
    if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
      return true;
    }
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes('failed to fetch') ||
        msg.includes('network') ||
        msg.includes('connection') ||
        msg.includes('connect') ||
        msg.includes('econnrefused') ||
        msg.includes('timeout') ||
        msg.includes('abort')
      ) {
        return true;
      }
    }
    if (error instanceof ApiError) {
      if (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504) {
        return true;
      }
    }
    return false;
  }
}

export const defaultProjectAccessClassifier = new ProjectAccessClassifier();
