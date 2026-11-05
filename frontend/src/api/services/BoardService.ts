import type { HttpClient } from '../HttpClient';
import { ApiError } from '../errors';
import {
  type BoardDetails,
  type CreateTaskInput,
  type TaskItem,
  ColumnCategory,
} from '../../domain/models';

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

interface RawColumn {
  id: string;
  name: string;
  category: ColumnCategory;
  position: string;
  color?: string | null;
}

interface RawBoard {
  id: string;
  projectId: string;
  projectName?: string | null;
  name: string;
  columns?: RawColumn[];
  members?: { userId: string; userName: string; email?: string }[];
}

interface RawTask {
  id: string;
  readableId: string;
  number: number;
  boardId: string;
  title: string;
  description?: string | null;
  status: ColumnCategory;
  columnId: string;
  columnName?: string;
  position?: string;
  priority?: TaskItem['priority'];
  dueDate?: string | null;
  createdAt?: string;
  column?: {
    id: string;
    name: string;
    category: ColumnCategory;
  };
  assignees?: {
    id: string;
    userName?: string | null;
  }[];
  assigneeIds?: string[];
}

export class BoardService {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  async getBoardWithTasks(boardId: string): Promise<{ board: BoardDetails; tasks: TaskItem[] }> {
    const query = `
      query GetBoardWithTasks($boardId: UUID!) {
        board(id: $boardId) {
          id
          projectId
          name
          columns {
            id
            name
            category
            position
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
          position
          priority
          dueDate
          column {
            id
            name
            category
          }
          assignees {
            id
            userName
          }
        }
      }
    `;

    try {
      const result = await this.client.post<GraphQLResponse<{ board?: RawBoard | null; tasks?: RawTask[] }>>(
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
        const rawBoard = result.data.board;
        const rawTasks = result.data.tasks || [];

        const board: BoardDetails = {
          id: rawBoard.id,
          projectId: rawBoard.projectId,
          projectName: rawBoard.projectName ?? null,
          name: rawBoard.name,
          columns: (rawBoard.columns || []).map((col) => ({
            id: col.id,
            name: col.name,
            category: col.category,
            position: col.position,
            color: col.color ?? null,
          })),
          members: rawBoard.members || [],
        };

        const tasks: TaskItem[] = rawTasks.map((t) => ({
          id: t.id,
          readableId: t.readableId,
          number: t.number,
          boardId: t.boardId,
          title: t.title,
          description: t.description,
          status: t.status,
          columnId: t.columnId,
          columnName: t.column?.name ?? t.columnName,
          position: t.position,
          priority: t.priority,
          assignees: t.assignees,
          assigneeIds: t.assignees ? t.assignees.map((a) => a.id) : (t.assigneeIds || []),
          assigneeNames: t.assignees ? t.assignees.map((a) => a.userName || '') : [],
          dueDate: t.dueDate,
          createdAt: t.createdAt,
        }));

        return { board, tasks };
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) {
        throw err;
      }
      if (!this.isValidUuid(boardId)) {
        throw new ApiError(`Board '${boardId}' was not found.`, 404, null);
      }
      throw err;
    }

    throw new ApiError(`Board '${boardId}' was not found.`, 404, null);
  }

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
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
}
