import type { BoardData, BoardSummary, CreateTaskInput, ProjectSummary, Task } from '../domain/models';

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

export interface BoardRepository {
  listProjects(): Promise<ProjectSummary[]>;
  listBoards(): Promise<BoardSummary[]>;
  getBoard(boardId: string): Promise<BoardData>;
  createTask(input: CreateTaskInput): Promise<Task>;
  moveTask(taskId: string, columnId: string): Promise<Task>;
}
