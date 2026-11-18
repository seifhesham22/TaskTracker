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

// ── Cycles (US-18) ──────────────────────────────────────────────────────────────────────────
// The backend refuses a link that closes a cycle (TaskDependencyCycleGuard) with BAD_USER_INPUT
// and this exact sentence; there is no separate code, so the whole sentence is matched and no
// other BAD_USER_INPUT (different projects, the task itself, …) is taken for a cycle:
//   "{X} can't block {Y}: {Y} already blocks {X} ({Y} → … → {X}), so this would create a cycle."

export const CYCLE_TITLE = 'This dependency creates a cycle.';
export const NOT_SAVED = 'The new link was not saved.';

export interface CycleInfo {
  /** The task that was to go first in the rejected link. */
  blockingKey: string;
  /** The task that was to wait in the rejected link. */
  blockedKey: string;
  /** The links already saved that lead from blockedKey to blockingKey, as the backend found them. */
  existingPath: string[];
}

const CYCLE = /^(\S+) can't block (\S+): (\S+) already blocks (\S+) \((.+)\), so this would create a cycle\.$/;

export function toCycleInfo(error: unknown): CycleInfo | null {
  if (!(error instanceof GraphQLResponseError)) return null;
  for (const entry of error.errors) {
    if (entry.extensions?.code !== 'BAD_USER_INPUT') continue;
    const match = CYCLE.exec(entry.message ?? '');
    if (!match) continue;
    const [, blockingKey, blockedKey, again, back, chain] = match;
    // The sentence names the same two tasks twice, the other way round.
    if (again !== blockedKey || back !== blockingKey) continue;
    return { blockingKey, blockedKey, existingPath: chain.split(' → ') };
  }
  return null;
}

export const cycleExplanation = (cycle: CycleInfo) =>
  `${cycle.blockingKey} already depends on ${cycle.blockedKey}. Choose another task or cancel.`;
export const existingLabel = (cycle: CycleInfo) => `Existing: ${cycle.existingPath.join(' → ')}`;
export const rejectedLabel = (cycle: CycleInfo) => `Rejected: ${cycle.blockingKey} → ${cycle.blockedKey}`;
export const neverAddedNote = (key: string) => `The rejected ${key} link was never added.`;
