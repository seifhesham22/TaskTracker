import { GraphQLResponseError } from '../api/graphql';
import type { ColumnCategory, Task, TaskLink } from './models';

/**
 * US-17: a task can't enter an active status while a task blocking it isn't done. The backend
 * enforces it on every move (MoveTaskHandler → TaskBlockerGuard, for the categories that
 * ColumnCategoryExtensions.IsActive names: In progress and Done) and lists the unfinished
 * blockers in `extensions.blockers`. The app checks first, so a blocked move isn't even sent.
 */
export const ACTIVE_CATEGORIES: readonly ColumnCategory[] = ['IN_PROGRESS', 'DONE'];
export const isActiveCategory = (category: ColumnCategory) => ACTIVE_CATEGORIES.includes(category);

/** A task that must be done first. From a task's `blockedBy`, or from the backend's refusal. */
export interface Blocker {
  id: string;
  readableId: string;
  title: string;
  /** Known from `blockedBy`; the refusal gives only id, key and title. */
  columnName?: string;
  boardId?: string;
}

/**
 * The tasks blocking this one that aren't done. Only `blockedBy` (the predecessors): the tasks
 * this one blocks (`blocks`) never stop it from starting.
 */
export function unfinishedBlockers(task: Pick<Task, 'blockedBy'>): Blocker[] {
  return (task.blockedBy ?? [])
    .filter((link: TaskLink) => link.status !== 'DONE')
    .map((link) => ({
      id: link.id,
      readableId: link.readableId,
      title: link.title,
      columnName: link.columnName,
      boardId: link.boardId,
    }));
}

function isBlocker(value: unknown): value is Blocker {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.readableId === 'string' && typeof v.title === 'string';
}

/** The blockers the backend named when it refused a move (BAD_USER_INPUT, `extensions.blockers`). */
export function blockersFromError(error: unknown): Blocker[] | null {
  if (!(error instanceof GraphQLResponseError)) return null;
  const refusal = error.errors.find((e) => e.extensions && Array.isArray(e.extensions.blockers));
  if (!refusal) return null;
  return (refusal.extensions!.blockers as unknown[]).filter(isBlocker);
}

// Wording from the designer's “Prevent blocked tasks from starting” handoff.
export const cantStart = (count: number) =>
  `This task can’t start yet. Complete its ${count === 1 ? 'prerequisite' : 'prerequisites'} first.`;
export const CHECKING_PREREQUISITES = 'Checking prerequisites…';
export const ALL_PREREQUISITES_DONE = 'All prerequisites are complete or removed.';
export const VERIFY_FAILED = 'Couldn’t verify prerequisites. The task was not started.';
export const TASK_STARTED = 'Task started';
export const CURRENT_STATUS = 'Current status';
export const COMPLETION_CHECKED_SEPARATELY = 'Completion rules checked separately';
export const unavailableDetail = (count: number) =>
  `Unavailable · ${count} unfinished ${count === 1 ? 'blocker' : 'blockers'}`;
export const blockerDetail = (blocker: Blocker, blockedKey: string) =>
  [blocker.columnName, `Blocks ${blockedKey}`].filter(Boolean).join(' · ');
export const moveReverted = (key: string, columnName: string) => `Move reverted · ${key} stays in ${columnName}.`;
export const blocksTask = (key: string) => `This task blocks ${key}.`;
export const movedTo = (columnName: string) => `Moved to ${columnName}`;
