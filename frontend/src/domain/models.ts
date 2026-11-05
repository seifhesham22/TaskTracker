export const ColumnCategory = {
  Backlog: 'BACKLOG',
  ToDo: 'TO_DO',
  InProgress: 'IN_PROGRESS',
  Done: 'DONE',
  Cancelled: 'CANCELLED',
} as const;

export type ColumnCategory = (typeof ColumnCategory)[keyof typeof ColumnCategory];

export const TaskPriority = {
  Low: 'LOW',
  Medium: 'MEDIUM',
  High: 'HIGH',
  Critical: 'CRITICAL',
} as const;

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export interface TaskAssignee {
  readonly id: string;
  readonly userName?: string | null;
}

export interface TaskItem {
  readonly id: string;
  readonly readableId: string;
  readonly number: number;
  readonly boardId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly status: ColumnCategory;
  readonly columnId: string;
  readonly columnName?: string;
  readonly priority?: TaskPriority | null;
  readonly assignees?: readonly TaskAssignee[];
  readonly assigneeIds: readonly string[];
  readonly assigneeNames?: readonly string[];
  readonly dueDate?: string | null;
  readonly position?: string;
  readonly createdAt?: string;
}

export interface BoardColumnModel {
  readonly id: string;
  readonly name: string;
  readonly category: ColumnCategory;
  readonly color?: string | null;
  readonly position: string;
}

export interface ProjectMemberModel {
  readonly userId: string;
  readonly userName: string;
  readonly email?: string;
}

export interface BoardDetails {
  readonly id: string;
  readonly projectId: string;
  readonly projectName?: string | null;
  readonly name: string;
  readonly columns: readonly BoardColumnModel[];
  readonly members?: readonly ProjectMemberModel[];
}

export interface CreateTaskInput {
  readonly boardId: string;
  readonly columnId?: string;
  readonly title: string;
  readonly description?: string;
  readonly assigneeId?: string;
  readonly priority?: TaskPriority;
  readonly dueDate?: string;
}
