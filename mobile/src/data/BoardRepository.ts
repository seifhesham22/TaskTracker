import type { BoardData, BoardSummary, CreateTaskInput, Task } from '../domain/models';

export type BoardLoadErrorKind = 'notFound' | 'unsupported' | 'network' | 'server';

/** Why a board (or the board list) could not be loaded. */
export class BoardLoadError extends Error {
  constructor(
    public readonly kind: BoardLoadErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'BoardLoadError';
  }
}

/**
 * Where the board screen gets its data. Screens only talk to this interface, so the data
 * source can be the real backend, the demo data or a test double.
 *
 * - `listBoards` / `getBoard` reject with `BoardLoadError`.
 * - `createTask` rejects with `CreateTaskError` (see domain/createTaskErrors).
 */
export interface BoardRepository {
  readonly mode: 'backend' | 'demo' | 'test';
  listBoards(): Promise<BoardSummary[]>;
  getBoard(boardId: string): Promise<BoardData>;
  createTask(input: CreateTaskInput): Promise<Task>;
}
