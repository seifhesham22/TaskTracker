/**
 * Status of a column and tasks on the board.
 * Matches ColumnCategory in the backend.
 * Uses const object with string literal union for compatibility with TypeScript 5.8+ erasableSyntaxOnly.
 */
export const ColumnCategory = {
  Backlog: 'BACKLOG',
  ToDo: 'TO_DO',
  InProgress: 'IN_PROGRESS',
  Done: 'DONE',
  Cancelled: 'CANCELLED',
} as const;

export type ColumnCategory = (typeof ColumnCategory)[keyof typeof ColumnCategory];

/**
 * Task priority matching backend TaskPriority enum.
 */
export const TaskPriority = {
  Low: 'LOW',
  Medium: 'MEDIUM',
  High: 'HIGH',
  Critical: 'CRITICAL',
} as const;

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

/**
 * Domain entity representing a task item.
 */
export interface TaskItem {
  readonly id: string;
  readonly readableId: string;
  readonly number: number;
  readonly boardId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly status: ColumnCategory;
  readonly columnId: string;
  readonly columnName: string;
  readonly priority?: TaskPriority | null;
  readonly assigneeIds: readonly string[];
  readonly dueDate?: string | null;
  readonly createdAt: string;
}

/**
 * Domain entity representing a board column.
 */
export interface BoardColumnModel {
  readonly id: string;
  readonly name: string;
  readonly category: ColumnCategory;
  readonly color?: string | null;
  readonly position: string;
}

/**
 * Domain entity representing a project member (assignee option).
 */
export interface ProjectMemberModel {
  readonly userId: string;
  readonly userName: string;
  readonly email: string;
}

/**
 * Domain entity representing a board with its metadata and columns.
 */
export interface BoardDetails {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly name: string;
  readonly columns: readonly BoardColumnModel[];
  readonly members: readonly ProjectMemberModel[];
}

/**
 * Input payload for creating a task via GraphQL mutation.
 */
export interface CreateTaskInput {
  readonly boardId: string;
  readonly columnId?: string;
  readonly title: string;
  readonly description?: string;
  readonly assigneeId?: string;
  readonly priority?: TaskPriority;
  readonly dueDate?: string;
}
