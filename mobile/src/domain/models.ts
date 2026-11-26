export type ColumnCategory = 'BACKLOG' | 'TO_DO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const TASK_PRIORITIES: readonly TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const TITLE_MAX_LENGTH = 200;

/** Another task as a dependency names it: enough to show and open it. */
export interface TaskLink {
  id: string;
  readableId: string;
  title: string;
  status: ColumnCategory;
  columnName: string;
  boardId: string;
}

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
  assigneeNames?: string[];
  startDate?: string | null;
  dueDate: string | null;
  /** The task this one is a subtask of, as the backend stores it. */
  parentTaskId?: string | null;
  /** Tasks that must happen before this one (the backend's `blockedBy`). */
  blockedBy?: TaskLink[];
  /** Tasks that wait for this one (the backend's `blocks`). */
  blocks?: TaskLink[];
  createdAt?: string;
  position?: string;
}

export interface CreateTaskInput {
  boardId: string;
  columnId?: string;
  title: string;
  description?: string;
  assigneeId?: string;
  priority?: TaskPriority;
  dueDate?: string;
  /** Makes the new task a subtask of this one (same project). */
  parentTaskId?: string;
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
}

export interface Board {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  columns: BoardColumn[];
  members: ProjectMember[];
  membersUnavailable?: string;
  /** The signed-in user's role in the project (OWNER, WRITER, READER), if known. */
  projectRole?: string | null;
}

export interface BoardData {
  board: Board;
  tasks: Task[];
}

/** The fields the Edit task form can change. A field left out is not sent; `null` clears it. */
export interface UpdateTaskChanges {
  title?: string;
  description?: string | null;
  priority?: TaskPriority | null;
  /** ISO 8601, midnight UTC of the chosen day, as the create-task form sends due dates. */
  startDate?: string | null;
  dueDate?: string | null;
}

/** A task with the names shown above it on the details and edit screens. */
export interface TaskDetails {
  task: Task;
  projectName: string;
  boardName: string;
  /** Tasks whose parentTaskId is this task, by task number. */
  subtasks: Task[];
  /** The task this one is a subtask of, if it's on the same board. */
  parent: Task | null;
  /** The board's first Done column, where completing the task moves it; null if it has none. */
  doneColumnId: string | null;
  projectId: string;
  /** False only when the backend says the user is a reader, who can't add dependencies. */
  canEdit: boolean;
}

export interface BoardSummary {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  /** The signed-in user's role: OWNER, WRITER or READER. */
  role: string | null;
  boardCount: number;
}
