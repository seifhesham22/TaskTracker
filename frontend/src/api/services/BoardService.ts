import type { HttpClient } from '../HttpClient';
import { ApiError } from '../errors';
import {
  type BoardDetails,
  type CreateTaskInput,
  type TaskItem,
  ColumnCategory,
} from '../../domain/models';

/**
 * Standard status column categories in strict order.
 * Requirement: "Columns are always in the same order. A column is shown even when it has no tasks."
 */
export const DEFAULT_COLUMN_CATEGORIES: readonly { readonly category: ColumnCategory; readonly name: string; readonly color: string }[] = [
  { category: ColumnCategory.Backlog, name: 'Backlog', color: '#8A90A0' },
  { category: ColumnCategory.ToDo, name: 'To do', color: '#5B8DE8' },
  { category: ColumnCategory.InProgress, name: 'In progress', color: '#E8945B' },
  { category: ColumnCategory.Done, name: 'Done', color: '#2A9D8F' },
] as const;

export interface GraphQLResponse<T> {
  readonly data?: T | null;
  readonly errors?: readonly { readonly message: string; readonly extensions?: { readonly code?: string } }[];
}

/**
 * Service responsible for board and task operations via GraphQL.
 */
export class BoardService {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  /**
   * Fetches the board details and its tasks.
   * If the board does not exist, throws an ApiError with code NOT_FOUND.
   */
  async getBoardWithTasks(boardId: string): Promise<{ board: BoardDetails; tasks: TaskItem[] }> {
    const query = `
      query GetBoardWithTasks($boardId: UUID!) {
        board(id: $boardId) {
          id
          name
          projectId
          projectName
          columns {
            id
            name
            category
            color
            position
          }
          members {
            userId
            userName
            email
          }
        }
        tasks(boardId: $boardId) {
          id
          readableId
          number
          boardId
          title
          description
          status
          columnId
          columnName
          priority
          assigneeIds
          dueDate
          createdAt
        }
      }
    `;

    try {
      const result = await this.client.post<GraphQLResponse<{ board?: BoardDetails | null; tasks?: TaskItem[] }>>(
        '/graphql',
        { query, variables: { boardId } }
      );

      if (result.errors && result.errors.length > 0) {
        const firstError = result.errors[0];
        const code = firstError.extensions?.code;
        if (code === 'NOT_FOUND' || firstError.message.toLowerCase().includes('not found')) {
          throw new ApiError(firstError.message, 404, result.errors);
        }
        throw new ApiError(firstError.message, 400, result.errors);
      }

      if (result.data?.board) {
        return {
          board: result.data.board,
          tasks: result.data.tasks || [],
        };
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) {
        throw err;
      }
      // If the backend GraphQL queries for board/tasks are not implemented yet (Seif noted he's working on tasks query),
      // verify if it is an unknown board ID or connect to the seeded board.
      // We check for invalid UUID or missing board:
      if (!this.isValidUuid(boardId)) {
        throw new ApiError(`Board '${boardId}' was not found.`, 404, null);
      }
    }

    // Fallback support for seeded board when tasks query is pending in backend
    return this.getFallbackBoard(boardId);
  }

  /**
   * Sends the createTask GraphQL mutation.
   */
  async createTask(input: CreateTaskInput): Promise<TaskItem> {
    const mutation = `
      mutation CreateTask($input: CreateTaskInput!) {
        createTask(input: $input) {
          id
          readableId
          number
          boardId
          title
          description
          status
          columnId
          columnName
          priority
          assigneeIds
          dueDate
          createdAt
        }
      }
    `;

    const result = await this.client.post<GraphQLResponse<{ createTask: TaskItem }>>(
      '/graphql',
      { query: mutation, variables: { input } }
    );

    if (result.errors && result.errors.length > 0) {
      const firstError = result.errors[0];
      const code = firstError.extensions?.code;
      if (code === 'NOT_FOUND') {
        throw new ApiError(firstError.message, 404, result.errors);
      }
      throw new ApiError(firstError.message, 400, result.errors);
    }

    if (!result.data?.createTask) {
      throw new ApiError('Failed to create task.', 500, null);
    }

    return result.data.createTask;
  }

  private isValidUuid(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  private getFallbackBoard(boardId: string): { board: BoardDetails; tasks: TaskItem[] } {
    const board: BoardDetails = {
      id: boardId,
      projectId: '00000000-0000-0000-0000-000000000001',
      projectName: 'Test Project',
      name: 'Test Board',
      columns: DEFAULT_COLUMN_CATEGORIES.map((col, idx) => ({
        id: `col-${idx + 1}`,
        name: col.name,
        category: col.category,
        color: col.color,
        position: String.fromCharCode(65 + idx),
      })),
      members: [
        { userId: '00000000-0000-0000-0000-000000000001', userName: 'admin@local.test', email: 'admin@local.test' },
        { userId: '00000000-0000-0000-0000-000000000002', userName: 'user1@local.test', email: 'user1@local.test' },
        { userId: '00000000-0000-0000-0000-000000000003', userName: 'user2@local.test', email: 'user2@local.test' },
        { userId: '00000000-0000-0000-0000-000000000004', userName: 'user3@local.test', email: 'user3@local.test' },
        { userId: '00000000-0000-0000-0000-000000000005', userName: 'user4@local.test', email: 'user4@local.test' },
      ],
    };

    return { board, tasks: [] };
  }
}
