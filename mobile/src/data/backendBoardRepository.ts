import {
  boardWithTasksRequest,
  projectsRequest,
  toBoardColumn,
  toBoardSummaries,
  toProjectMembers,
  toProjectSummary,
  toTask,
  type ProjectNode,
} from '../api/boards';
import { getSession } from '../auth/session';
import { ConfigurationError } from '../api/client';
import { GraphQLResponseError, NOT_AUTHENTICATED, NetworkError, hasErrorCode } from '../api/graphql';
import { backlogRequest } from '../api/backlog';
import { MAX_PAGE_SIZE, addTaskDependencyRequest, searchTasksRequest } from '../api/dependencies';
import { backlogVariables, type BacklogQuery } from '../domain/backlog';
import { addProjectMemberRequest, removeProjectMemberRequest } from '../api/members';
import { createBoardRequest } from '../api/createBoard';
import { createProjectRequest } from '../api/projects';
import {
  assignTaskRequest,
  createTaskRequest,
  moveTaskRequest,
  unassignTaskRequest,
  updateTaskRequest,
} from '../api/tasks';
import { looksLikeKey } from '../domain/dependencies';
import { SESSION_EXPIRED } from '../domain/authErrors';
import { CompleteTaskError, toCompleteTaskFailure } from '../domain/completeTask';
import { CreateTaskError, toCreateTaskFailure } from '../domain/createTaskErrors';
import type { BoardData, CreateTaskInput, TaskDetails, UpdateTaskChanges } from '../domain/models';
import { MEMBERS_LOAD_FAILED as PROJECT_MEMBERS_LOAD_FAILED, PROJECT_NOT_FOUND } from '../domain/members';
import { MoveTaskError, toMoveTaskFailureMessage } from '../domain/moveTaskErrors';
import { BoardLoadError, type BoardRepository } from './BoardRepository';

export const NOT_SIGNED_IN = 'You’re not logged in. Log in to see your projects.';
export const USER_NOT_FOUND = 'Your account wasn’t found on the server. Log out and log in again.';
export const BOARD_LOAD_NETWORK = 'We couldn’t reach the server. Check your connection and try again.';
export const BOARD_LOAD_SERVER = 'Something went wrong on the server while loading the board.';

export const MEMBERS_NEED_SIGN_IN =
  'Project members can’t be listed because you’re not logged in. You can still create the task without an assignee.';
export const MEMBERS_NOT_IN_PROJECT =
  'You aren’t a member of this board’s project, so its members can’t be listed. You can still create the task without an assignee.';
export const MEMBERS_LOAD_FAILED =
  'Couldn’t load the project’s members. You can still create the task without an assignee.';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOARD_NOT_FOUND = /^Board '([^']+)' was not found\.$/;
const USER_NOT_FOUND_MESSAGE = /^User '[^']+' was not found\.$/;

/** The signed-in user, whose projects are listed. */
export function getSignedInUserId(): string | null {
  return getSession()?.user.id ?? null;
}

const notFoundMessage = (boardId: string) => `Board '${boardId}' was not found.`;

function hasError(error: unknown, code: string, message: RegExp): string | null {
  if (!(error instanceof GraphQLResponseError)) return null;
  const entry = error.errors.find((e) => e.extensions?.code === code && message.test(e.message ?? ''));
  return entry ? entry.message : null;
}

function missingBoardMessage(error: unknown, boardId: string): string | null {
  const message = hasError(error, 'NOT_FOUND', BOARD_NOT_FOUND);
  const missingId = message ? BOARD_NOT_FOUND.exec(message)?.[1] : undefined;
  return missingId?.toLowerCase() === boardId.toLowerCase() ? message : null;
}

function toBoardLoadError(error: unknown, boardId?: string): BoardLoadError {
  if (error instanceof ConfigurationError) return new BoardLoadError('configuration', error.message);
  const boardMissing = boardId ? missingBoardMessage(error, boardId) : null;
  if (boardMissing) return new BoardLoadError('notFound', boardMissing);
  if (hasError(error, 'NOT_FOUND', USER_NOT_FOUND_MESSAGE)) return new BoardLoadError('server', USER_NOT_FOUND);
  if (hasErrorCode(error, NOT_AUTHENTICATED)) return new BoardLoadError('expired', SESSION_EXPIRED);
  // The backend's code for a refusal by role or ownership: access is refused, like NOT_FOUND.
  if (hasErrorCode(error, 'AUTH_NOT_AUTHORIZED')) return new BoardLoadError('notFound', (error as Error).message);
  if (error instanceof NetworkError) return new BoardLoadError('network', BOARD_LOAD_NETWORK);
  return new BoardLoadError('server', BOARD_LOAD_SERVER);
}

type ProjectLookup = { project: ProjectNode } | { unavailable: string };

async function findProject(userId: string | null, projectId: string): Promise<ProjectLookup> {
  if (!userId) return { unavailable: MEMBERS_NEED_SIGN_IN };
  try {
    const project = (await projectsRequest(userId)).find((p) => p.id === projectId);
    return project ? { project } : { unavailable: MEMBERS_NOT_IN_PROJECT };
  } catch {
    return { unavailable: MEMBERS_LOAD_FAILED };
  }
}

export const TASK_NOT_FOUND = 'This task doesn’t exist any more, or was moved to another board.';

export function createBackendBoardRepository(): BoardRepository {
  const repository: BoardRepository = {
    async listProjects() {
      const userId = getSignedInUserId();
      if (!userId) throw new BoardLoadError('configuration', NOT_SIGNED_IN);
      try {
        return (await projectsRequest(userId)).map(toProjectSummary);
      } catch (error) {
        throw toBoardLoadError(error);
      }
    },

    async getProject(projectId: string) {
      const userId = getSignedInUserId();
      if (!userId) throw new BoardLoadError('configuration', NOT_SIGNED_IN);
      let project;
      try {
        project = (await projectsRequest(userId)).find((p) => p.id === projectId);
      } catch (error) {
        throw toBoardLoadError(error);
      }
      // `projects` lists only the user's own, so a project missing from it is one they can't see.
      if (!project) throw new BoardLoadError('notFound', PROJECT_NOT_FOUND);
      return {
        id: project.id,
        name: project.name,
        role: project.role ?? null,
        boards: project.boards.map((b) => ({ id: b.id, name: b.name, columnCount: b.columns?.length ?? 0 })),
      };
    },

    async createBoard(projectId: string, name: string) {
      const board = await createBoardRequest(projectId, name);
      return { id: board.id, projectId: board.projectId, name: board.name };
    },

    async createProject(name: string) {
      return toProjectSummary(await createProjectRequest(name));
    },

    async getProjectMembers(projectId: string) {
      const userId = getSignedInUserId();
      if (!userId) throw new BoardLoadError('configuration', NOT_SIGNED_IN);
      let project;
      try {
        project = (await projectsRequest(userId)).find((p) => p.id === projectId);
      } catch (error) {
        const failure = toBoardLoadError(error);
        throw failure.message === BOARD_LOAD_SERVER
          ? new BoardLoadError('server', PROJECT_MEMBERS_LOAD_FAILED)
          : failure;
      }
      // `projects` lists only the user's own, so a project that's missing is one they can't see.
      if (!project) throw new BoardLoadError('notFound', PROJECT_NOT_FOUND);
      return {
        projectId: project.id,
        projectName: project.name,
        role: project.role ?? null,
        members: project.projectMembers.map((m) => ({
          userId: m.userId,
          userName: m.userName,
          role: m.role ?? '',
        })),
      };
    },

    async addMember(projectId, email, role) {
      const member = await addProjectMemberRequest(projectId, email, role);
      return {
        userId: member.userId,
        userName: member.userName,
        role: member.role,
      };
    },

    async getKnownAccounts(projectId) {
      const userId = getSignedInUserId();
      if (!userId) throw new BoardLoadError('configuration', NOT_SIGNED_IN);
      const projects = await projectsRequest(userId);
      const project = projects.find((p) => p.id === projectId);
      return {
        accounts: projects.flatMap((p) => p.projectMembers.map((m) => m.userName)),
        members: (project?.projectMembers ?? []).map((m) => ({
          userId: m.userId,
          userName: m.userName,
          role: m.role ?? '',
        })),
      };
    },

    async removeMember(projectId, userId) {
      await removeProjectMemberRequest(projectId, userId);
    },

    async listBoards() {
      const userId = getSignedInUserId();
      if (!userId) throw new BoardLoadError('configuration', NOT_SIGNED_IN);
      try {
        return toBoardSummaries(await projectsRequest(userId));
      } catch (error) {
        throw toBoardLoadError(error);
      }
    },

    async getBoard(boardId: string): Promise<BoardData> {
      if (!UUID.test(boardId)) throw new BoardLoadError('notFound', notFoundMessage(boardId));

      let response;
      try {
        response = await boardWithTasksRequest(boardId);
      } catch (error) {
        throw toBoardLoadError(error, boardId);
      }

      const { board, tasks } = response;
      const lookup = await findProject(getSignedInUserId(), board.projectId);
      const project = 'project' in lookup ? lookup.project : null;

      return {
        board: {
          id: board.id,
          name: board.name,
          projectId: board.projectId,
          projectName: project?.name ?? '',
          columns: board.columns.map(toBoardColumn),
          members: project ? toProjectMembers(project) : [],
          membersUnavailable: 'unavailable' in lookup ? lookup.unavailable : undefined,
          projectRole: project?.role ?? null,
        },
        tasks: tasks.map(toTask),
      };
    },

    // The backend has no single-task query, so this reads the task from its board, as the board
    // screen does, which also gives the project and board names.
    async getTask(boardId: string, taskId: string): Promise<TaskDetails> {
      const { board, tasks } = await repository.getBoard(boardId);
      const task = tasks.find((t) => t.id.toLowerCase() === taskId.toLowerCase());
      if (!task) throw new BoardLoadError('notFound', TASK_NOT_FOUND, 'task');
      // The backend keeps the relationship as each task's parentTaskId, so a task's subtasks are
      // the board's tasks that point at it.
      const sameId = (a: string | null | undefined, b: string) => !!a && a.toLowerCase() === b.toLowerCase();
      const subtasks = tasks.filter((t) => sameId(t.parentTaskId, task.id)).sort((a, b) => a.number - b.number);
      const parent = task.parentTaskId ? (tasks.find((t) => sameId(task.parentTaskId, t.id)) ?? null) : null;
      const doneColumnId = board.columns.find((c) => c.category === 'DONE')?.id ?? null;
      return {
        task,
        projectName: board.projectName,
        boardName: board.name,
        subtasks,
        parent,
        doneColumnId,
        projectId: board.projectId,
        canEdit: board.projectRole !== 'READER',
        projectRole: board.projectRole ?? null,
        members: board.members,
      };
    },

    async completeTask(taskId: string, doneColumnId: string) {
      try {
        return await moveTaskRequest(taskId, doneColumnId);
      } catch (error) {
        throw new CompleteTaskError(toCompleteTaskFailure(error));
      }
    },

    async getBacklog(projectId: string, query: BacklogQuery, page: number) {
      const result = await backlogRequest(backlogVariables(projectId, query, page));
      return {
        items: result.items.map((node) => ({
          id: node.id,
          readableId: node.readableId,
          title: node.title,
          status: node.status,
          columnName: node.column.name,
          priority: node.priority,
          storyPoints: node.storyPoints,
          boardId: node.boardId,
        })),
        totalCount: result.totalCount,
        page: result.page,
        hasNextPage: result.hasNextPage,
      };
    },

    async addDependency(blockingTaskId: string, blockedTaskId: string) {
      await addTaskDependencyRequest(blockingTaskId, blockedTaskId);
    },

    // The backend's search matches titles. A term like "TES-18" or "18" can only match a key, so
    // then the project's tasks are read (up to the backend's largest page) and matched here.
    async searchTasks(projectId: string, term: string) {
      const trimmed = term.trim();
      return looksLikeKey(trimmed)
        ? searchTasksRequest(projectId, null, MAX_PAGE_SIZE)
        : searchTasksRequest(projectId, trimmed || null, 20);
    },

    async assignTask(taskId: string, userId: string) {
      return assignTaskRequest(taskId, userId);
    },

    async unassignTask(taskId: string, userId: string) {
      return unassignTaskRequest(taskId, userId);
    },

    async updateTask(taskId: string, changes: UpdateTaskChanges) {
      return updateTaskRequest(taskId, changes);
    },

    async createTask(input: CreateTaskInput) {
      try {
        return await createTaskRequest(input);
      } catch (error) {
        throw new CreateTaskError(toCreateTaskFailure(error, input));
      }
    },

    async moveTask(taskId: string, columnId: string) {
      try {
        return await moveTaskRequest(taskId, columnId);
      } catch (error) {
        throw new MoveTaskError(toMoveTaskFailureMessage(error));
      }
    },
  };
  return repository;
}
