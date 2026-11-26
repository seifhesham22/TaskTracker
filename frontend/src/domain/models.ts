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

export interface TaskDependencyRef {
  readonly id: string;
  readonly readableId: string;
  readonly title: string;
  readonly status?: ColumnCategory;
}

export const TaskDependencyRelationship = {
  BlockedBy: 'BLOCKED_BY',
  Blocks: 'BLOCKS',
} as const;

export type TaskDependencyRelationship =
  (typeof TaskDependencyRelationship)[keyof typeof TaskDependencyRelationship];

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
  readonly startDate?: string | null;
  readonly dueDate?: string | null;
  readonly position?: string;
  readonly createdAt?: string;
  readonly parentTaskId?: string | null;
  readonly blocks?: readonly TaskDependencyRef[];
  readonly blockedBy?: readonly TaskDependencyRef[];
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
  readonly role?: string;
}

export interface AssignTaskInput {
  readonly taskId: string;
  readonly userId: string;
}

export interface UnassignTaskInput {
  readonly taskId: string;
  readonly userId: string;
}

export interface AssigneeValidationErrors {
  readonly userId?: string;
  readonly general?: string;
}

export interface BoardDetails {
  readonly id: string;
  readonly projectId: string;
  readonly projectName?: string | null;
  readonly name: string;
  readonly columns: readonly BoardColumnModel[];
  readonly members?: readonly ProjectMemberModel[];
  readonly userRole?: string;
}

export interface CreateTaskInput {
  readonly boardId: string;
  readonly columnId?: string;
  readonly title: string;
  readonly description?: string;
  readonly assigneeId?: string;
  readonly priority?: TaskPriority;
  readonly dueDate?: string;
  readonly parentTaskId?: string | null;
}

export interface SubtaskEditorInput {
  readonly title: string;
}

export interface SubtaskValidationErrors {
  readonly title?: string;
}

export interface MoveTaskInput {
  readonly taskId: string;
  readonly columnId: string;
}

export interface UpdateTaskInput {
  readonly taskId: string;
  readonly title?: string;
  readonly description?: string | null;
  readonly priority?: TaskPriority | null;
  readonly startDate?: string | null;
  readonly dueDate?: string | null;
}

export interface BacklogTaskDependencyRef {
  readonly id?: string;
  readonly readableId: string;
}

export interface BacklogItem {
  readonly id: string;
  readonly readableId: string;
  readonly number: number;
  readonly boardId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly status: ColumnCategory;
  readonly column?: {
    readonly id?: string;
    readonly name: string;
    readonly category?: ColumnCategory;
  } | null;
  readonly priority?: TaskPriority | null;
  readonly assignees?: readonly TaskAssignee[];
  readonly blocks?: readonly BacklogTaskDependencyRef[];
  readonly blockedBy?: readonly BacklogTaskDependencyRef[];
  readonly position?: string;
  readonly parentTaskId?: string | null;
}

export interface BacklogPageData {
  readonly items: readonly BacklogItem[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

export interface BacklogFilterInput {
  readonly status?: {
    readonly eq?: ColumnCategory;
    readonly in?: readonly ColumnCategory[];
  };
  readonly priority?: {
    readonly eq?: TaskPriority | null;
    readonly in?: readonly (TaskPriority | null)[];
  };
  readonly boardId?: {
    readonly eq?: string;
  };
  readonly parentTaskId?: {
    readonly eq?: string | null;
  };
}

export interface GetBacklogInput {
  readonly projectId: string;
  readonly search?: string | null;
  readonly where?: BacklogFilterInput | null;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface CreateProjectInput {
  readonly name: string;
  readonly key?: string | null;
  readonly description?: string | null;
}

export interface ProjectValidationErrors {
  readonly name?: string;
  readonly form?: string;
}

export interface CreateBoardInput {
  readonly projectId: string;
  readonly name: string;
}

export interface BoardValidationErrors {
  readonly name?: string;
  readonly form?: string;
}

export const ProjectRole = {
  Owner: 'OWNER',
  Writer: 'WRITER',
  Reader: 'READER',
} as const;

export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];

export interface ProjectMember {
  readonly projectId: string;
  readonly userId: string;
  readonly userName: string;
  readonly role: ProjectRole;
  readonly joinedAt: string;
}

export interface AddProjectMemberInput {
  readonly projectId: string;
  readonly email: string;
  readonly role?: ProjectRole;
}

export interface AddProjectMemberValidationErrors {
  readonly email?: string;
  readonly role?: string;
  readonly form?: string;
}

export interface WorkloadTaskItem {
  readonly id: string;
  readonly readableId: string;
  readonly number: number;
  readonly boardId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly status: ColumnCategory;
  readonly columnId?: string;
  readonly columnName?: string;
  readonly priority?: TaskPriority | null;
}

export interface MemberWorkloadItem {
  readonly userId: string;
  readonly userName: string;
  readonly role: ProjectRole;
  readonly openTaskCount: number;
  readonly openTasks: readonly WorkloadTaskItem[];
}

export interface ProjectWorkloadData {
  readonly averageOpenTasks: number;
  readonly members: readonly MemberWorkloadItem[];
  readonly unassigned: readonly WorkloadTaskItem[];
  readonly totalOpenTasks: number;
}

export interface RankTaskInput {
  readonly taskId: string;
  readonly afterTaskId?: string | null;
}

export interface RankTaskResult {
  readonly id: string;
  readonly readableId: string;
}

export interface BlockedTaskStartFailure {
  readonly taskId: string;
  readonly taskTitle: string;
  readonly readableId: string;
  readonly projectName?: string;
  readonly currentStatus: ColumnCategory;
  readonly currentColumnName: string;
  readonly targetColumnId: string;
  readonly blockers: readonly TaskDependencyRef[];
  readonly message: string;
}
