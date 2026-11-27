import { ApiError, ConfigurationError } from '../api/client';
import { GraphQLResponseError, NetworkError } from '../api/graphql';
import type { MemberWorkloadNode, ProjectWorkloadNode, WorkloadTaskNode } from '../api/workload';
import { priorityLabel } from './backlog';
import type { ColumnCategory, TaskPriority } from './models';

/** One open task as the workload lists show and open it. */
export interface WorkloadTask {
  id: string;
  readableId: string;
  title: string;
  status: ColumnCategory;
  columnName: string;
  priority: TaskPriority | null;
  boardId: string;
}

export interface MemberWorkload {
  userId: string;
  userName: string;
  role: string;
  openTaskCount: number;
  openTasks: WorkloadTask[];
}

export interface ProjectWorkload {
  members: MemberWorkload[];
  unassigned: WorkloadTask[];
  averageOpenTasks: number;
}

/**
 * What the backend counts as open (GetWorkloadHandler): tasks in columns of these categories.
 * DONE and CANCELLED are never open. Only used to describe the rule; the backend applies it.
 */
export const OPEN_STATUSES: readonly ColumnCategory[] = ['BACKLOG', 'TO_DO', 'IN_PROGRESS'];
export const CLOSED_STATUSES: readonly ColumnCategory[] = ['DONE', 'CANCELLED'];

/** How many tasks a drill-down list shows at a time. */
export const WORKLOAD_LIST_PAGE = 20;

// Wording from the designer's handoff.
export const LOADING_WORKLOAD = 'Loading current assignments…';
export const WORKLOAD_LOAD_FAILED = 'Couldn’t load workload. Try again.';
export const WORKLOAD_REFRESH_FAILED = 'Couldn’t refresh the workload. These are the last counts loaded.';
export const COUNTS_EXCLUDE_COMPLETED = 'Counts exclude completed tasks.';
export const NO_OPEN_WORK = 'No open tasks in this project.';
export const WORKLOAD_UNAVAILABLE_TITLE = 'Workload unavailable';
export const WORKLOAD_UNAVAILABLE_TEXT = 'Only authorized project roles can open this view.';
export const MEMBER_GONE = 'This person isn’t a member of the project any more.';

const toTask = (node: WorkloadTaskNode): WorkloadTask => ({
  id: node.id,
  readableId: node.readableId,
  title: node.title,
  status: node.status,
  columnName: node.column.name,
  priority: node.priority,
  boardId: node.boardId,
});

/** Drops a task listed twice, keeping the backend's order. */
function unique(tasks: WorkloadTask[]): WorkloadTask[] {
  const seen = new Set<string>();
  return tasks.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
}

/**
 * The backend's answer as the screens use it, in the backend's order. The counts are the backend's
 * own: it counts every open task of the project, not a page of them.
 */
export function toProjectWorkload(node: ProjectWorkloadNode): ProjectWorkload {
  return {
    members: node.members.map(
      (m: MemberWorkloadNode): MemberWorkload => ({
        userId: m.userId,
        userName: m.userName,
        role: m.role,
        openTaskCount: m.openTaskCount,
        openTasks: unique(m.openTasks.map(toTask)),
      }),
    ),
    unassigned: unique(node.unassigned.map(toTask)),
    averageOpenTasks: node.averageOpenTasks,
  };
}

export const openCountLabel = (count: number) => `${count} open`;
export const openTasksLabel = (count: number) => `${count} open ${count === 1 ? 'task' : 'tasks'}`;

/** The bar's length: the member's share of the highest count, so the busiest member fills it. */
export const barFraction = (count: number, max: number) => (max <= 0 ? 0 : Math.min(1, Math.max(0, count / max)));

export const hasOpenWork = (workload: ProjectWorkload) =>
  workload.unassigned.length > 0 || workload.members.some((m) => m.openTaskCount > 0);

/** “TES-31 · To do · High”, as in the design; the board's name too when the project has several. */
export const taskMeta = (task: WorkloadTask, boardName?: string) =>
  [task.readableId, task.columnName, priorityLabel(task.priority), boardName].filter(Boolean).join(' · ');

export const memberTasksTitle = (userName: string) => `${userName}’s open tasks`;

export const showingLabel = (shown: number, total: number) =>
  `Showing ${shown} of ${total} open ${total === 1 ? 'task' : 'tasks'}`;

/** The reason the workload couldn't be read, in words for the user. */
export function workloadErrorMessage(error: unknown): string {
  if (error instanceof ConfigurationError) return error.message;
  if (error instanceof NetworkError || error instanceof ApiError) {
    return 'We couldn’t reach the server. Check your connection and try again.';
  }
  if (error instanceof GraphQLResponseError) return WORKLOAD_LOAD_FAILED;
  return WORKLOAD_LOAD_FAILED;
}
