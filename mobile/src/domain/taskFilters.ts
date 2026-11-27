import type { BoardTasksVariables, TaskWhere } from '../api/boardTasks';
import { ConfigurationError } from '../api/client';
import { GraphQLResponseError } from '../api/graphql';
import { STATUS_LABELS, priorityLabel } from './backlog';
import type { BoardColumn, ColumnCategory, ProjectMember, Task, TaskPriority } from './models';

/** Whose tasks: anyone's, nobody's, or one member's (by user id, never by name). */
export type AssigneeChoice = { kind: 'anyone' } | { kind: 'unassigned' } | { kind: 'member'; userId: string };

/** `any`: no priority filter; `null`: tasks with no priority. */
export type PriorityChoice = TaskPriority | null | 'any';

/** One value per category, as in the design. */
export interface TaskFilters {
  status: ColumnCategory | null;
  assignee: AssigneeChoice;
  priority: PriorityChoice;
}

export const NO_FILTERS: TaskFilters = { status: null, assignee: { kind: 'anyone' }, priority: 'any' };

// Wording from the designer's handoff.
export const LOADING_TASKS = 'Loading matching tasks…';
export const LOAD_FAILED = 'Couldn’t load matching tasks. Your filters are kept.';
export const REFRESH_FAILED = 'Couldn’t refresh the tasks. These are the last results loaded.';
export const NO_MATCHES = 'No tasks match your search and filters.';
export const NO_TASKS = 'This board has no tasks yet.';
export const CLEARED = 'Search and filters cleared';

export const activeFilterCount = (f: TaskFilters) =>
  (f.status ? 1 : 0) + (f.assignee.kind === 'anyone' ? 0 : 1) + (f.priority === 'any' ? 0 : 1);

export const hasCriteria = (search: string, f: TaskFilters) => search.trim() !== '' || activeFilterCount(f) > 0;

/**
 * The `tasks` variables: the board, the trimmed search, and only the filters that are set. The
 * backend applies them all together (AND).
 */
export function boardTasksVariables(boardId: string, search: string, f: TaskFilters): BoardTasksVariables {
  const variables: BoardTasksVariables = { boardId };
  const term = search.trim();
  if (term) variables.search = term;
  const where: TaskWhere = {};
  if (f.status) where.status = { eq: f.status };
  if (f.priority !== 'any') where.priority = { eq: f.priority };
  if (f.assignee.kind === 'member') where.assignees = { some: { userId: { eq: f.assignee.userId } } };
  if (f.assignee.kind === 'unassigned') where.assignees = { any: false };
  if (Object.keys(where).length > 0) variables.where = where;
  return variables;
}

/** The statuses a task on this board can have: its columns' categories, in column order. */
export function boardStatuses(columns: readonly BoardColumn[]): ColumnCategory[] {
  return [...new Set([...columns].sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0)).map((c) => c.category))];
}

export const statusLabel = (status: ColumnCategory | null) => (status ? STATUS_LABELS[status] : 'Any status');

export const priorityChoiceLabel = (p: PriorityChoice) => (p === 'any' ? 'Any priority' : priorityLabel(p));

export function assigneeLabel(choice: AssigneeChoice, members: readonly ProjectMember[]): string {
  if (choice.kind === 'anyone') return 'Anyone';
  if (choice.kind === 'unassigned') return 'Unassigned';
  return members.find((m) => m.userId === choice.userId)?.userName ?? 'A former member';
}

/** “To do”, “Mina Joao”, “High”: one chip per active filter, each removing only its own. */
export function filterChips(f: TaskFilters, members: readonly ProjectMember[]) {
  const chips: { key: keyof TaskFilters; label: string }[] = [];
  if (f.status) chips.push({ key: 'status', label: statusLabel(f.status) });
  if (f.assignee.kind !== 'anyone') chips.push({ key: 'assignee', label: assigneeLabel(f.assignee, members) });
  if (f.priority !== 'any') chips.push({ key: 'priority', label: priorityChoiceLabel(f.priority) });
  return chips;
}

export function withoutFilter(f: TaskFilters, key: keyof TaskFilters): TaskFilters {
  return { ...f, [key]: NO_FILTERS[key] };
}

/** “Title contains “launch” · 3 filters”. */
export function criteriaSummary(search: string, f: TaskFilters): string {
  const n = activeFilterCount(f);
  return [search.trim() ? `Title contains “${search.trim()}”` : null, n ? `${n} ${n === 1 ? 'filter' : 'filters'}` : null]
    .filter(Boolean)
    .join(' · ');
}

export function resultCountLabel(count: number, filtered: boolean): string {
  if (filtered) return `${count} matching ${count === 1 ? 'task' : 'tasks'}`;
  return `${count} ${count === 1 ? 'task' : 'tasks'} · Permitted board tasks`;
}

/** “TES-31 · To do · High · Mina Joao”: the key, column, priority and assignees, as in the design. */
export function taskLine(task: Task): string {
  const names = (task.assigneeNames ?? []).filter(Boolean);
  return [task.readableId, task.columnName, priorityLabel(task.priority), names.length ? names.join(', ') : 'Unassigned'].join(' · ');
}

/** Members whose name contains the text, any case, for the assignee search. */
export function matchMembers(members: readonly ProjectMember[], text: string): ProjectMember[] {
  const term = text.trim().toLowerCase();
  return term ? members.filter((m) => m.userName.toLowerCase().includes(term)) : [...members];
}

/** The backend's reason when it explains it (a search that's too long); otherwise the design's. */
export function taskSearchErrorMessage(error: unknown): string {
  if (error instanceof GraphQLResponseError) {
    const invalid = error.errors.find((e) => e.extensions?.code === 'BAD_USER_INPUT');
    if (invalid?.message) return `${LOAD_FAILED} ${invalid.message}`;
  }
  if (error instanceof ConfigurationError) return error.message;
  return LOAD_FAILED;
}
