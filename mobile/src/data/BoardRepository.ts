import type {
  BoardData,
  BoardSummary,
  CreateTaskInput,
  ProjectSummary,
  Task,
  TaskDetails,
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

export interface BoardRepository {
  listProjects(): Promise<ProjectSummary[]>;
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
  /** Rejects with the backend's error; `toEditTaskErrors` turns it into messages. */
  updateTask(taskId: string, changes: UpdateTaskChanges): Promise<Task>;
}
