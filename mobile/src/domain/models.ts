/**
 * Models shared by the board screen and the create-task form.
 *
 * `Task` and `CreateTaskInput` match the backend `createTask` mutation (TaskDto / CreateTaskInput).
 * `Board`, `BoardColumn` and `ProjectMember` describe data the backend cannot return yet
 * (there is no board, task-list or member query); they follow the backend entities so a real
 * board query can fill them later.
 */

export type ColumnCategory = 'BACKLOG' | 'TO_DO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const TASK_PRIORITIES: readonly TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

/** Same limit as the backend (`TaskItem.TitleMaxLength`). */
export const TITLE_MAX_LENGTH = 200;

export interface Task {
  id: string;
  readableId: string;
  number: number;
  boardId: string;
  title: string;
  description: string | null;
  status: ColumnCategory;
  columnId: string;
  columnName: string;
  priority: TaskPriority | null;
  assigneeIds: string[];
  /** ISO 8601 date-time, e.g. "2026-11-05T00:00:00Z". */
  dueDate: string | null;
  createdAt: string;
}

export interface CreateTaskInput {
  boardId: string;
  columnId?: string;
  title: string;
  description?: string;
  assigneeId?: string;
  priority?: TaskPriority;
  /** ISO 8601 date-time. */
  dueDate?: string;
}

export interface BoardColumn {
  id: string;
  name: string;
  category: ColumnCategory;
  color: string;
  position: string;
}

export interface ProjectMember {
  userId: string;
  userName: string;
  email: string;
}

export interface Board {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  /** Ordered by position. */
  columns: BoardColumn[];
  /** Members of the board's project, i.e. the people a task can be assigned to. */
  members: ProjectMember[];
}

export interface BoardData {
  board: Board;
  tasks: Task[];
}

export interface BoardSummary {
  id: string;
  name: string;
  projectName: string;
}
