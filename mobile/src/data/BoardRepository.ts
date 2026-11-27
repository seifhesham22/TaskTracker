import type { BacklogItem, BacklogQuery } from '../domain/backlog';
import type { MemberRole, ProjectMemberDetails, ProjectMembers } from '../domain/members';
import type { ProjectWorkload } from '../domain/workload';
import type { BoardTasksVariables } from '../api/boardTasks';

import type {
  BoardData,
  BoardSummary,
  CreateTaskInput,
  ProjectDetails,
  ProjectSummary,
  Task,
  TaskDetails,
  TaskLink,
  UpdateTaskChanges,
} from '../domain/models';

/**
 * - `notFound`: the backend refused (NOT_FOUND / AUTH_NOT_AUTHORIZED); for a non-member it answers
 *   exactly as for something that doesn't exist.
 * - `expired`: AUTH_NOT_AUTHENTICATED; the app is signing the user out.
 * - `network`: no answer. `server`: an answer that isn't usable. `configuration`: the app's own setup.
 */
export type BoardLoadErrorKind = 'notFound' | 'expired' | 'configuration' | 'network' | 'server';

export class BoardLoadError extends Error {
  constructor(
    public readonly kind: BoardLoadErrorKind,
    message: string,
    /**
     * What was not found: the board or project (access may be lost), or only a task on a board the
     * backend did return (deleted or moved, access is fine).
     */
    public readonly subject: 'project' | 'task' = 'project',
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
  /** One of the user's projects with its boards. Rejects with BoardLoadError ('notFound' for a non-member). */
  getProject(projectId: string): Promise<ProjectDetails>;
  /**
   * US-7: a new board in the project, with the backend's default columns. Rejects with the
   * backend's error (`toCreateBoardFailure`).
   */
  createBoard(projectId: string, name: string): Promise<{ id: string; projectId: string; name: string }>;
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
  /**
   * US-24: the task at this 1-based place of the full, unfiltered backlog, in the backend's order
   * (one item per page), or null past the end. Used to find a move's neighbour when it isn't loaded.
   */
  getBacklogItemAt(projectId: string, position: number): Promise<BacklogItem | null>;
  /**
   * US-24: saves the task's place in the project's backlog, right after `afterTaskId` (null: at the
   * top), with the backend's `rankTask`. Rejects with the backend's error.
   */
  rankTask(taskId: string, afterTaskId: string | null): Promise<void>;
  /**
   * US-29: every current member's open tasks, and the open tasks nobody in the project is assigned
   * to, from the backend's `workload` (owner only). Rejects with the backend's error.
   */
  getWorkload(projectId: string): Promise<ProjectWorkload>;
  /**
   * US-36: one board's tasks matching a title search and filters, from the backend's `tasks`
   * (all matches at once, in creation order). Rejects with the backend's error.
   */
  searchBoardTasks(variables: BoardTasksVariables): Promise<Task[]>;
  /** `blockingTaskId` must happen before `blockedTaskId`. Rejects with the backend's error. */
  addDependency(blockingTaskId: string, blockedTaskId: string): Promise<void>;
  /** The project's tasks matching `term` by title or key (excluding none). */
  searchTasks(projectId: string, term: string): Promise<TaskLink[]>;
  /** US-12: adds a project member to the task's assignees. Rejects with the backend's error. */
  assignTask(taskId: string, userId: string): Promise<Task>;
  /** US-12: removes an assignee from the task. Rejects with the backend's error. */
  unassignTask(taskId: string, userId: string): Promise<Task>;
  /** Rejects with the backend's error; `toEditTaskErrors` turns it into messages. */
  updateTask(taskId: string, changes: UpdateTaskChanges): Promise<Task>;
}
