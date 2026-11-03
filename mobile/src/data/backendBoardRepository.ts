import { createTaskRequest } from '../api/tasks';
import { CreateTaskError, toCreateTaskFailure } from '../domain/createTaskErrors';
import type { CreateTaskInput } from '../domain/models';
import { BoardLoadError, type BoardRepository } from './BoardRepository';

/**
 * Shown when a read is needed that the backend doesn't offer. At the time of writing the
 * backend GraphQL schema has only `ping` and `createTask`, and there are no REST endpoints:
 * there is no way to read boards, columns, tasks or project members.
 */
export const READ_API_MISSING =
  'The server can’t send board data yet: the backend has no query for boards, tasks or project members.';

/** Real backend. Only `createTask` exists; reads are reported as unsupported, never faked. */
export function createBackendBoardRepository(): BoardRepository {
  return {
    mode: 'backend',
    async listBoards() {
      throw new BoardLoadError('unsupported', READ_API_MISSING);
    },
    async getBoard() {
      throw new BoardLoadError('unsupported', READ_API_MISSING);
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
