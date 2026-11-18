import { ConfigurationError } from '../api/client';
import { GraphQLResponseError, NetworkError } from '../api/graphql';
import type { Task } from './models';

// Wording from the designer's parent-completion handoff.
export const COMPLETE_FAILED = 'We couldn’t complete the task. Try again.';
export const COMPLETE_NETWORK_FAILED = 'We couldn’t reach the server, so the task wasn’t completed. Check your connection and try again.';
export const NO_DONE_COLUMN = 'This board has no Done column, so the task can’t be completed here.';
export const BLOCKED_EXPLANATION = 'This parent task can’t be completed while its subtasks are still open.';
export const blockedTitle = (count: number) => `Complete ${count} ${count === 1 ? 'subtask' : 'subtasks'} first`;

/** An open child, as the backend lists it in `extensions.incompleteSubtasks` (TaskCompletionGuard). */
export interface IncompleteSubtask {
  id: string;
  readableId: string;
  title: string;
}

export type CompleteTaskFailure =
  | { kind: 'incompleteSubtasks'; subtasks: IncompleteSubtask[] }
  | { kind: 'failed'; message: string };

export class CompleteTaskError extends Error {
  constructor(public readonly failure: CompleteTaskFailure) {
    super(failure.kind === 'failed' ? failure.message : 'incompleteSubtasks');
    this.name = 'CompleteTaskError';
  }
}

function isIncompleteSubtask(value: unknown): value is IncompleteSubtask {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.readableId === 'string' && typeof v.title === 'string';
}

/**
 * The backend refuses to move a parent into a Done column while a child isn't done, with
 * BAD_USER_INPUT and the open children in `extensions.incompleteSubtasks`. An empty list means
 * the refusal named no children; the screen then finds them in a fresh read of the board.
 */
export function toCompleteTaskFailure(error: unknown): CompleteTaskFailure {
  if (error instanceof CompleteTaskError) return error.failure;
  if (error instanceof GraphQLResponseError) {
    const blocked = error.errors.find((e) => e.extensions && 'incompleteSubtasks' in e.extensions);
    if (blocked) {
      const listed = blocked.extensions?.incompleteSubtasks;
      return { kind: 'incompleteSubtasks', subtasks: Array.isArray(listed) ? listed.filter(isIncompleteSubtask) : [] };
    }
    const known = error.errors.find((e) => ['BAD_USER_INPUT', 'NOT_FOUND'].includes(e.extensions?.code ?? ''));
    return { kind: 'failed', message: known?.message || COMPLETE_FAILED };
  }
  if (error instanceof NetworkError) return { kind: 'failed', message: COMPLETE_NETWORK_FAILED };
  if (error instanceof ConfigurationError) return { kind: 'failed', message: error.message };
  return { kind: 'failed', message: COMPLETE_FAILED };
}

const sameId = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The open children to show after a refusal, kept current as the parent is read again: a child
 * the fresh read shows as done drops off, a child it can't see (another board) stays as the
 * backend listed it, and an open child added since the refusal is added.
 */
export function remainingSubtasks(listed: IncompleteSubtask[], fresh: Task[]): IncompleteSubtask[] {
  const stillOpen = listed.filter((s) => {
    const current = fresh.find((t) => sameId(t.id, s.id));
    return !current || current.status !== 'DONE';
  });
  const added = fresh
    .filter((t) => t.status !== 'DONE' && !stillOpen.some((s) => sameId(s.id, t.id)))
    .map((t) => ({ id: t.id, readableId: t.readableId, title: t.title }));
  return [...stillOpen, ...added].map((s) => {
    const current = fresh.find((t) => sameId(t.id, s.id));
    return current ? { id: current.id, readableId: current.readableId, title: current.title } : s;
  });
}
