import type { BacklogItem, BacklogQuery } from '../domain/backlog';
import type { MemberRole, ProjectMemberDetails, ProjectMembers } from '../domain/members';

import type {
  BoardData,
  BoardSummary,
  CreateTaskInput,
  ProjectSummary,
  Task,
  TaskDetails,
  TaskLink,
  UpdateTaskChanges,
} from '../domain/models';

export type BoardLoadErrorKind = 'notFound' | 'configuration' | 'network' | 'server';

export class BoardLoadError extends Error {
  constructor(
    public readonly kind: BoardLoadErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'BoardLoadError';
  }
}

export interface BacklogResult {
  items: BacklogItem[];
  totalCount: number;
  page: number;
  hasNextPage: boolean;
}

export interface BoardRepository {
  listProjects(): Promise<ProjectSummary[]>;
  /** Rejects with the backend's error; `toCreateProjectFailure` turns it into messages. */
  createProject(name: string): Promise<ProjectSummary>;
  /** The project's members. Rejects with BoardLoadError ('notFound' if the user isn't one of them). */
  getProjectMembers(projectId: string): Promise<ProjectMembers>;
  /** Adds the account with exactly this email. Rejects with the backend's error (`toAddFailure`). */
  addMember(projectId: string, email: string, role: MemberRole): Promise<ProjectMemberDetails>;
  /**
   * The accounts the user may see, as `searchAccounts` looks through them: every member of the
   * user's projects (the backend offers no wider account search), and the project's members now.
   */
  getKnownAccounts(projectId: string): Promise<{ accounts: string[]; members: ProjectMemberDetails[] }>;
  /** Rejects with the backend's error (`toRemoveFailure`). */
  removeMember(projectId: string, userId: string): Promise<void>;
  listBoards(): Promise<BoardSummary[]>;
  getBoard(boardId: string): Promise<BoardData>;
  createTask(input: CreateTaskInput): Promise<Task>;
  moveTask(taskId: string, columnId: string): Promise<Task>;
  /** One task of a board, read from the backend. Rejects with BoardLoadError ('notFound' if it's gone). */
  getTask(boardId: string, taskId: string): Promise<TaskDetails>;
  /**
   * Completes a task by moving it to a Done column. The backend refuses while a subtask is open;
   * rejects with CompleteTaskError.
   */
  completeTask(taskId: string, doneColumnId: string): Promise<Task>;
  /** One page of the project's backlog, searched and filtered by the backend, in its order. */
  getBacklog(projectId: string, query: BacklogQuery, page: number): Promise<BacklogResult>;
  /** `blockingTaskId` must happen before `blockedTaskId`. Rejects with the backend's error. */
  addDependency(blockingTaskId: string, blockedTaskId: string): Promise<void>;
  /** The project's tasks matching `term` by title or key (excluding none). */
  searchTasks(projectId: string, term: string): Promise<TaskLink[]>;
  /** Rejects with the backend's error; `toEditTaskErrors` turns it into messages. */
  updateTask(taskId: string, changes: UpdateTaskChanges): Promise<Task>;
}
