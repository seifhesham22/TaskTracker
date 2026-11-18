import { ApiError, ConfigurationError } from '../api/client';
import { GraphQLResponseError, NetworkError } from '../api/graphql';
import type { Task, TaskLink } from './models';

// Wording from the designer's dependency handoff, shared with the web app.
export const SELECT_A_TASK = 'Select a task to continue.';
export const ADD_FAILED = 'We couldn’t add the dependency. Try again.';
export const SEARCH_FAILED = 'We couldn’t load matching tasks. Try again.';
export const MUST_HAPPEN_BEFORE = 'must happen before';

/**
 * Seen from the current task: "Blocked by" picks a task that must happen first (the current task
 * waits); "Blocks" picks a task that waits for the current one.
 */
export type Relationship = 'blockedBy' | 'blocks';

export const RELATIONSHIP_LABELS: Record<Relationship, string> = { blockedBy: 'Blocked by', blocks: 'Blocks' };

export function relationshipHint(relationship: Relationship, currentKey: string): string {
  return relationship === 'blockedBy'
    ? `The selected task must finish before ${currentKey}.`
    : `${currentKey} must finish before the selected task.`;
}

/**
 * The backend's direction (AddTaskDependencyInput): blockingTaskId must happen before
 * blockedTaskId.
 */
export function toDependencyInput(relationship: Relationship, currentId: string, selectedId: string) {
  return relationship === 'blockedBy'
    ? { blockingTaskId: selectedId, blockedTaskId: currentId }
    : { blockingTaskId: currentId, blockedTaskId: selectedId };
}

export const countLabel = (label: string, n: number) => `${label} · ${n} ${n === 1 ? 'task' : 'tasks'}`;

const sameId = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Whether this pair is already linked in this direction, so picking it would add nothing. */
export function isAlreadyLinked(task: Task, relationship: Relationship, candidateId: string): boolean {
  const links = relationship === 'blockedBy' ? task.blockedBy : task.blocks;
  return (links ?? []).some((l) => sameId(l.id, candidateId));
}

/** "TES-18", "tes-18" or "18": the backend's search matches titles only, so keys are matched here. */
export const looksLikeKey = (term: string) => /^([a-z][a-z0-9]*-)?\d+$/i.test(term.trim());

/** The tasks to offer: matching the term by key or title, and never the current task. */
export function matchingTasks(found: TaskLink[], term: string, currentId: string): TaskLink[] {
  const t = term.trim().toLowerCase();
  return found.filter((task) => {
    if (sameId(task.id, currentId)) return false;
    if (!t) return true;
    const key = task.readableId.toLowerCase();
    return key === t || key.endsWith(`-${t}`) || key.startsWith(t) || task.title.toLowerCase().includes(t);
  });
}

/**
 * The backend's own explanation where it gives one: a task blocking itself, different projects,
 * a cycle (US-18), or no permission. Anything else, including no response, is the design's message.
 */
export function toAddDependencyError(error: unknown): string {
  if (error instanceof GraphQLResponseError) {
    const known = error.errors.find((e) =>
      ['BAD_USER_INPUT', 'AUTH_NOT_AUTHORIZED', 'NOT_FOUND'].includes(e.extensions?.code ?? ''),
    );
    if (known?.extensions?.code === 'NOT_FOUND') return 'One of these tasks no longer exists. Go back and try again.';
    if (known?.message) return known.message;
    return ADD_FAILED;
  }
  if (error instanceof ConfigurationError) return error.message;
  if (error instanceof NetworkError || error instanceof ApiError) return ADD_FAILED;
  return ADD_FAILED;
}
