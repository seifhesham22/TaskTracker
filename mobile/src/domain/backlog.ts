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
