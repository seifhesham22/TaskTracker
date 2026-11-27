import type { BacklogVariables, BacklogWhere } from '../api/backlog';
import { ApiError, ConfigurationError } from '../api/client';
import { GraphQLResponseError, NetworkError } from '../api/graphql';
import { PRIORITY_LABELS, TASK_PRIORITIES, type ColumnCategory, type TaskPriority } from './models';

/** How many items each request asks for. The backend allows 1–100 (GetBacklogHandler). */
export const BACKLOG_PAGE_SIZE = 20;

/** The backend's status values (ColumnCategory), as the backlog filter takes them. */
export const BACKLOG_STATUSES: readonly ColumnCategory[] = ['BACKLOG', 'TO_DO', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
export const STATUS_LABELS: Record<ColumnCategory, string> = {
  BACKLOG: 'Backlog',
  TO_DO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};
export const BACKLOG_PRIORITIES: readonly TaskPriority[] = TASK_PRIORITIES;

// Wording from the designer's backlog handoff.
export const LOAD_FAILED_TITLE = 'Couldn’t load the backlog';
export const LOAD_FAILED_TEXT = 'Try again to load the project’s upcoming work.';
export const LOAD_MORE_FAILED = 'Couldn’t load more items. Your list is still here — try again.';

export interface BacklogItem {
  id: string;
  readableId: string;
  title: string;
  status: ColumnCategory;
  columnName: string;
  priority: TaskPriority | null;
  storyPoints: number | null;
  boardId: string;
}

/** What the user asked for. Changing it starts again from page 1. */
export interface BacklogQuery {
  search: string;
  statuses: ColumnCategory[];
  priorities: TaskPriority[];
}

export const EMPTY_QUERY: BacklogQuery = { search: '', statuses: [], priorities: [] };

export const isFiltered = (query: BacklogQuery) =>
  query.search.trim() !== '' || query.statuses.length > 0 || query.priorities.length > 0;

/** The GraphQL variables for one page: blank search and empty filters are left out. */
export function backlogVariables(projectId: string, query: BacklogQuery, page: number, pageSize = BACKLOG_PAGE_SIZE): BacklogVariables {
  const variables: BacklogVariables = { projectId, page, pageSize };
  const search = query.search.trim();
  if (search) variables.search = search;
  const where: BacklogWhere = {};
  if (query.statuses.length > 0) where.status = { in: [...query.statuses] };
  if (query.priorities.length > 0) where.priority = { in: [...query.priorities] };
  if (where.status || where.priority) variables.where = where;
  return variables;
}

/** Adds a page after the items already shown, keeping their order and skipping any already there. */
export function appendPage(shown: BacklogItem[], next: BacklogItem[]): BacklogItem[] {
  const seen = new Set(shown.map((item) => item.id));
  return [...shown, ...next.filter((item) => !seen.has(item.id))];
}

export const priorityLabel = (priority: TaskPriority | null) => (priority ? PRIORITY_LABELS[priority] : 'No priority');

export const estimateLabel = (points: number | null) =>
  points == null ? 'Estimate: Not estimated' : `Estimate: ${points} ${points === 1 ? 'point' : 'points'}`;

export const countLabel = (total: number) => `${total} ${total === 1 ? 'item' : 'items'} · Ordered by backlog position`;

/** The backend's message where it explains the refusal (e.g. search too long); otherwise the design's. */
export function backlogErrorMessage(error: unknown): string {
  if (error instanceof GraphQLResponseError) {
    const known = error.errors.find((e) => e.extensions?.code === 'BAD_USER_INPUT');
    if (known?.message) return known.message;
    if (error.errors.some((e) => e.extensions?.code === 'NOT_FOUND')) {
      return 'This project wasn’t found, or you aren’t a member of it.';
    }
    return LOAD_FAILED_TEXT;
  }
  if (error instanceof ConfigurationError) return error.message;
  if (error instanceof NetworkError || error instanceof ApiError) return LOAD_FAILED_TEXT;
  return LOAD_FAILED_TEXT;
}

// ── US-24: prioritizing and reordering ────────────────────────────────────────────────────────

/**
 * Who may change the backlog's priority and order: the backend's `CanEdit` (writers and the owner),
 * which `rankTask` and `updateTask` both check. An unknown role shows no controls.
 */
export const canManageBacklog = (role: string | null | undefined) => role === 'OWNER' || role === 'WRITER';

const ROLE_VIEWS: Record<string, string> = { OWNER: 'Owner view', WRITER: 'Writer view', READER: 'Reader view' };
export const roleViewLabel = (role: string | null | undefined) => (role ? (ROLE_VIEWS[role] ?? null) : null);

// Wording from the designer's handoff.
export const READ_ONLY_NOTE = 'Read-only · Only backlog managers can change priority or order.';
export const REORDER_PAUSED = 'Reordering is paused while searching or filtering.';
export const SAVING_ORDER = 'Saving order…';
export const ORDER_SAVED = 'Order saved for all project members';
export const SAVE_FAILED = 'Couldn’t save the change. Previous order restored.';
export const ORDER_CHANGED = 'The backlog changed while you were moving this item. The latest order is shown — try again.';
export const ORDER_SAVED_NOT_RELOADED = 'Order saved for all project members. Pull to refresh to see the latest list.';
export const priorityUpdated = (priority: TaskPriority | null) => `Priority updated to ${priorityLabel(priority)}`;

/** The rows of the priority picker: the backend's values, and “No priority” (null). */
export const PRIORITY_CHOICES: readonly (TaskPriority | null)[] = [null, ...TASK_PRIORITIES];

/**
 * `rankTask` takes “after this task”, not a number. To put the item now at `from` at `target`
 * (both 1-based places in the full, unfiltered backlog), it goes right after the task now at the
 * returned place; 0 means the top. Items between `from` and `target` shift by one, so a move down
 * lands after the task now at `target`, and a move up after the one now before `target`.
 */
export function anchorPosition(from: number, target: number): number {
  return target < from ? target - 1 : target;
}

/** The inline error of “Move to position”, or null when it can be moved there. */
export function positionError(text: string, current: number, total: number): string | null {
  const trimmed = text.trim();
  if (!trimmed) return 'Enter a position.';
  if (!/^\d+$/.test(trimmed)) return `Enter a whole number from 1 to ${total}.`;
  const value = Number(trimmed);
  if (value < 1 || value > total) return `Enter a position from 1 to ${total}.`;
  if (value === current) return `This item is already at position ${current}.`;
  return null;
}

/**
 * “Move this item before TES-31.”: the task now at the target place, when it's loaded. A move down
 * lands after that task; a move up, before it. Otherwise only the number is known.
 */
export function moveHint(target: number, current: number, total: number, atTarget: BacklogItem | undefined): string {
  if (atTarget) return `Move this item ${target < current ? 'before' : 'after'} ${atTarget.readableId}.`;
  return `Move this item to position ${target} of ${total}.`;
}

/** The backend's reason for refusing a priority or order change, in words for the user. */
export function backlogSaveErrorMessage(error: unknown): string {
  if (error instanceof GraphQLResponseError) {
    const refused = error.errors.find((e) => e.extensions?.code === 'AUTH_NOT_AUTHORIZED');
    if (refused?.message) return refused.message;
    if (error.errors.some((e) => e.extensions?.code === 'AUTH_NOT_AUTHENTICATED')) {
      return 'Your session has expired. Log in again.';
    }
    if (error.errors.some((e) => e.extensions?.code === 'NOT_FOUND')) {
      return 'This item, or the one it was placed after, isn’t in the backlog any more.';
    }
    const invalid = error.errors.find((e) => e.extensions?.code === 'BAD_USER_INPUT');
    if (invalid?.message) return invalid.message;
    return 'Something went wrong on the server. Try again.';
  }
  if (error instanceof ConfigurationError) return error.message;
  if (error instanceof NetworkError || error instanceof ApiError) {
    return 'We couldn’t reach the server. Check your connection and try again.';
  }
  return 'Something went wrong. Try again.';
}

/** The backend refused because of the user's role: the screen reads the role again. */
export const isRoleRefusal = (error: unknown) =>
  error instanceof GraphQLResponseError && error.errors.some((e) => e.extensions?.code === 'AUTH_NOT_AUTHORIZED');

/** The item or its anchor is gone or changed: the latest list is read before trying again. */
export const isStaleOrder = (error: unknown) =>
  error instanceof GraphQLResponseError &&
  error.errors.some((e) => e.extensions?.code === 'NOT_FOUND' || e.extensions?.code === 'BAD_USER_INPUT');

/** The list with the item at `from` placed at `to` (0-based): only a preview while the save runs. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [moving] = next.splice(from, 1);
  next.splice(to, 0, moving);
  return next;
}

export interface RowLayout {
  id: string;
  y: number;
  height: number;
}

/**
 * Where a dragged row lands: its new 0-based index among the loaded rows (in their shown order),
 * from the rows' layouts and how far it was dragged. A row can only land among loaded rows.
 */
export function dropIndex(rows: readonly RowLayout[], draggedId: string, dy: number): number {
  const dragged = rows.find((r) => r.id === draggedId);
  if (!dragged) return -1;
  const center = dragged.y + dragged.height / 2 + dy;
  return rows.filter((r) => r.id !== draggedId && r.y + r.height / 2 < center).length;
}
