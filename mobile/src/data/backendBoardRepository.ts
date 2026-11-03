import {
  boardWithTasksRequest,
  projectsRequest,
  toBoardColumn,
  toBoardSummaries,
  toProjectMembers,
  toTask,
  type ProjectNode,
} from '../api/boards';
import { GraphQLResponseError, NetworkError } from '../api/graphql';
import { createTaskRequest } from '../api/tasks';
import { CreateTaskError, toCreateTaskFailure } from '../domain/createTaskErrors';
import type { BoardData, CreateTaskInput } from '../domain/models';
import { BoardLoadError, type BoardRepository } from './BoardRepository';

export const USER_ID_MISSING =
  'Set EXPO_PUBLIC_USER_ID in mobile/.env to list your boards. The backend has no login yet, so it needs to know whose projects to show.';
export const USER_NOT_FOUND =
  'The user in EXPO_PUBLIC_USER_ID doesn’t exist on the server. Check the ID in mobile/.env.';
export const BOARD_LOAD_NETWORK = 'We couldn’t reach the server. Check your connection and try again.';
export const BOARD_LOAD_SERVER = 'Something went wrong on the server while loading the board.';

export const MEMBERS_NEED_USER_ID =
  'Project members can’t be listed because EXPO_PUBLIC_USER_ID isn’t set. You can still create the task without an assignee.';
export const MEMBERS_NOT_IN_PROJECT =
  'You aren’t a member of this board’s project, so its members can’t be listed. You can still create the task without an assignee.';
export const MEMBERS_LOAD_FAILED =
  'Couldn’t load the project’s members. You can still create the task without an assignee.';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOARD_NOT_FOUND = /^Board '[^']+' was not found\.$/;
const USER_NOT_FOUND_MESSAGE = /^User '[^']+' was not found\.$/;

export function getConfiguredUserId(): string | null {
  const userId = process.env.EXPO_PUBLIC_USER_ID?.trim();
  return userId ? userId : null;
}

const notFoundMessage = (boardId: string) => `Board '${boardId}' was not found.`;

function hasError(error: unknown, code: string, message: RegExp): string | null {
  if (!(error instanceof GraphQLResponseError)) return null;
  const entry = error.errors.find((e) => e.extensions?.code === code && message.test(e.message ?? ''));
  return entry ? entry.message : null;
}

function toBoardLoadError(error: unknown): BoardLoadError {
  const boardMissing = hasError(error, 'NOT_FOUND', BOARD_NOT_FOUND);
  if (boardMissing) return new BoardLoadError('notFound', boardMissing);
  if (hasError(error, 'NOT_FOUND', USER_NOT_FOUND_MESSAGE)) return new BoardLoadError('server', USER_NOT_FOUND);
  if (error instanceof NetworkError) return new BoardLoadError('network', BOARD_LOAD_NETWORK);
  return new BoardLoadError('server', BOARD_LOAD_SERVER);
}

type ProjectLookup = { project: ProjectNode } | { unavailable: string };

async function findProject(userId: string | null, projectId: string): Promise<ProjectLookup> {
  if (!userId) return { unavailable: MEMBERS_NEED_USER_ID };
  try {
    const project = (await projectsRequest(userId)).find((p) => p.id === projectId);
    return project ? { project } : { unavailable: MEMBERS_NOT_IN_PROJECT };
  } catch {
    return { unavailable: MEMBERS_LOAD_FAILED };
  }
}

export function createBackendBoardRepository(): BoardRepository {
  return {
    mode: 'backend',

    async listBoards() {
      const userId = getConfiguredUserId();
      if (!userId) throw new BoardLoadError('unsupported', USER_ID_MISSING);
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
        throw toBoardLoadError(error);
      }

      const { board, tasks } = response;
      const lookup = await findProject(getConfiguredUserId(), board.projectId);
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
        },
        tasks: tasks.map(toTask),
      };
    },

    async createTask(input: CreateTaskInput) {
      try {
        return await createTaskRequest(input);
      } catch (error) {
        throw new CreateTaskError(toCreateTaskFailure(error, input));
      }
    },
  };
}
