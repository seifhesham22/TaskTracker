import type { HttpClient } from '../HttpClient';
import {
  ApiError,
  BlockedTaskStartApiError,
  IncompleteSubtasksApiError,
  type IncompleteSubtaskDto,
  type TaskBlockerDto,
} from '../errors';
import {
  type AssignTaskInput,
  type BoardDetails,
  type CreateBoardInput,
  type CreateTaskInput,
  type MoveTaskInput,
  type TaskItem,
  type UnassignTaskInput,
  type UpdateTaskInput,
  ColumnCategory,
} from '../../domain/models';

export const DEFAULT_COLUMN_CATEGORIES: readonly { readonly category: ColumnCategory; readonly name: string; readonly color: string }[] = [
  { category: ColumnCategory.Backlog, name: 'Backlog', color: '#8A90A0' },
  { category: ColumnCategory.ToDo, name: 'To do', color: '#5B8DE8' },
  { category: ColumnCategory.InProgress, name: 'In progress', color: '#E8945B' },
  { category: ColumnCategory.Done, name: 'Done', color: '#2A9D8F' },
] as const;

export const GRAPHQL_TASK_FIELDS = `
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
  startDate
  dueDate
  parentTaskId
  column {
    id
    name
    category
  }
  assignees {
    id
    userName
  }
  blocks {
    id
    readableId
    title
    status
  }
  blockedBy {
    id
    readableId
    title
    status
  }
`;

export const UPDATE_TASK_MUTATION = `
  mutation UpdateTask($input: UpdateTaskInput!) {
    updateTask(input: $input) {
      ${GRAPHQL_TASK_FIELDS}
    }
  }
`;

export const ASSIGN_TASK_MUTATION = `
  mutation AssignTask($input: AssignTaskInput!) {
    assignTask(input: $input) {
      ${GRAPHQL_TASK_FIELDS}
    }
  }
`;

export const UNASSIGN_TASK_MUTATION = `
  mutation UnassignTask($input: UnassignTaskInput!) {
    unassignTask(input: $input) {
      ${GRAPHQL_TASK_FIELDS}
    }
  }
`;

export const CREATE_BOARD_MUTATION = `
  mutation CreateBoard($input: CreateBoardInput!) {
    createBoard(input: $input) {
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
  }
`;

export interface GraphQLErrorExtension {
  readonly code?: string;
  readonly incompleteSubtasks?: readonly IncompleteSubtaskDto[];
  readonly blockers?: readonly TaskBlockerDto[];
  readonly [key: string]: unknown;
}

export interface GraphQLResponse<T> {
  readonly data?: T | null;
  readonly errors?: readonly { readonly message: string; readonly extensions?: GraphQLErrorExtension }[];
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
  startDate?: string | null;
  dueDate?: string | null;
  createdAt?: string;
  parentTaskId?: string | null;
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
  blocks?: {
    id: string;
    readableId: string;
    title: string;
    status?: ColumnCategory;
  }[];
  blockedBy?: {
    id: string;
    readableId: string;
    title: string;
    status?: ColumnCategory;
  }[];
}

export interface AddTaskDependencyInput {
  readonly blockingTaskId: string;
  readonly blockedTaskId: string;
}

export interface AddTaskDependencyResult {
  readonly blockingTask: TaskItem;
  readonly blockedTask: TaskItem;
}

export class BoardService {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  public static createApiErrorFromGraphQl(
    errors: readonly { readonly message: string; readonly extensions?: GraphQLErrorExtension }[]
  ): ApiError {
    const firstError = errors[0];
    const code = firstError?.extensions?.code;
    const msg = firstError?.message || 'GraphQL request failed';
    const lower = msg.toLowerCase();

    if (code === 'NOT_FOUND' || lower.includes('not found')) {
      return new ApiError(msg, 404, errors);
    }
    if (
      code === 'AUTH_NOT_AUTHORIZED' ||
      code === 'FORBIDDEN' ||
      lower.includes('forbidden') ||
      lower.includes('not authorized') ||
      lower.includes('do not have access') ||
      lower.includes('not a member')
    ) {
      return new ApiError(msg, 403, errors);
    }
    if (code === 'AUTH_NOT_AUTHENTICATED' || lower.includes('unauthenticated')) {
      return new ApiError(msg, 401, errors);
    }
    return new ApiError(msg, 400, errors);
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
          startDate
          dueDate
          parentTaskId
          column {
            id
            name
            category
          }
          assignees {
            id
            userName
          }
          blocks {
            id
            readableId
            title
            status
          }
          blockedBy {
            id
            readableId
            title
            status
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
        throw BoardService.createApiErrorFromGraphQl(result.errors);
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

        const tasks: TaskItem[] = rawTasks.map((t) => this.mapRawTask(t));

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

  async searchTasks(projectId: string, search?: string): Promise<TaskItem[]> {
    const query = `
      query SearchBacklog($projectId: UUID!, $search: String) {
        backlog(projectId: $projectId, search: $search, page: 1, pageSize: 50) {
          items {
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
            startDate
            dueDate
            parentTaskId
            blocks {
              id
              readableId
              title
              status
            }
            blockedBy {
              id
              readableId
              title
              status
            }
          }
          totalCount
        }
      }
    `;

    try {
      const result = await this.client.post<GraphQLResponse<{ backlog?: { items: RawTask[]; totalCount: number } }>>(
        '/graphql',
        { query, variables: { projectId, search: search?.trim() || null } }
      );

      if (result.errors && result.errors.length > 0) {
        throw BoardService.createApiErrorFromGraphQl(result.errors);
      }

      const items = result.data?.backlog?.items || [];
      return items.map((t) => this.mapRawTask(t));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw err;
      }
      return [];
    }
  }

  async addTaskDependency(input: AddTaskDependencyInput): Promise<AddTaskDependencyResult> {
    const mutation = `
      mutation AddTaskDependency($input: AddTaskDependencyInput!) {
        addTaskDependency(input: $input) {
          blockingTask {
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
            startDate
            dueDate
            parentTaskId
            blocks {
              id
              readableId
              title
              status
            }
            blockedBy {
              id
              readableId
              title
              status
            }
          }
          blockedTask {
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
            startDate
            dueDate
            parentTaskId
            blocks {
              id
              readableId
              title
              status
            }
            blockedBy {
              id
              readableId
              title
              status
            }
          }
        }
      }
    `;

    const result = await this.client.post<
      GraphQLResponse<{
        addTaskDependency?: {
          blockingTask: RawTask;
          blockedTask: RawTask;
        };
      }>
    >('/graphql', { query: mutation, variables: { input } });

    if (result.errors && result.errors.length > 0) {
      throw BoardService.createApiErrorFromGraphQl(result.errors);
    }

    if (!result.data?.addTaskDependency) {
      throw new ApiError('Failed to add task dependency.', 500, null);
    }

    return {
      blockingTask: this.mapRawTask(result.data.addTaskDependency.blockingTask),
      blockedTask: this.mapRawTask(result.data.addTaskDependency.blockedTask),
    };
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
          parentTaskId
        }
      }
    `;

    const result = await this.client.post<GraphQLResponse<{ createTask: TaskItem }>>(
      '/graphql',
      { query: mutation, variables: { input } }
    );

    if (result.errors && result.errors.length > 0) {
      throw BoardService.createApiErrorFromGraphQl(result.errors);
    }

    if (!result.data?.createTask) {
      throw new ApiError('Failed to create task.', 500, null);
    }

    return result.data.createTask;
  }

  async createSubtask(parentTask: TaskItem, title: string): Promise<TaskItem> {
    return this.createTask({
      boardId: parentTask.boardId,
      columnId: parentTask.columnId,
      title: title.trim(),
      parentTaskId: parentTask.id,
    });
  }

  async moveTask(input: MoveTaskInput): Promise<TaskItem> {
    const mutation = `
      mutation MoveTask($input: MoveTaskInput!) {
        moveTask(input: $input) {
          ${GRAPHQL_TASK_FIELDS}
        }
      }
    `;

    const result = await this.client.post<GraphQLResponse<{ moveTask: RawTask }>>(
      '/graphql',
      { query: mutation, variables: { input } }
    );

    if (result.errors && result.errors.length > 0) {
      const firstError = result.errors[0];
      const blockers = firstError.extensions?.blockers as
        | readonly TaskBlockerDto[]
        | undefined;
      if (blockers && Array.isArray(blockers)) {
        throw new BlockedTaskStartApiError(
          firstError.message,
          blockers,
          result.errors
        );
      }
      const incompleteSubtasks = firstError.extensions?.incompleteSubtasks as
        | readonly IncompleteSubtaskDto[]
        | undefined;
      if (incompleteSubtasks && Array.isArray(incompleteSubtasks)) {
        throw new IncompleteSubtasksApiError(
          firstError.message,
          incompleteSubtasks,
          result.errors
        );
      }
      throw BoardService.createApiErrorFromGraphQl(result.errors);
    }

    if (!result.data?.moveTask) {
      throw new ApiError('Failed to move task.', 500, null);
    }

    return this.mapRawTask(result.data.moveTask);
  }

  async updateTask(input: UpdateTaskInput): Promise<TaskItem> {
    const result = await this.client.post<GraphQLResponse<{ updateTask: RawTask }>>(
      '/graphql',
      { query: UPDATE_TASK_MUTATION, variables: { input } }
    );

    if (result.errors && result.errors.length > 0) {
      throw BoardService.createApiErrorFromGraphQl(result.errors);
    }

    if (!result.data?.updateTask) {
      throw new ApiError('Failed to update task.', 500, null);
    }

    return this.mapRawTask(result.data.updateTask);
  }

  async assignTask(input: AssignTaskInput): Promise<TaskItem> {
    const result = await this.client.post<GraphQLResponse<{ assignTask: RawTask }>>(
      '/graphql',
      { query: ASSIGN_TASK_MUTATION, variables: { input } }
    );

    if (result.errors && result.errors.length > 0) {
      const firstError = result.errors[0];
      const code = firstError.extensions?.code;
      if (code === 'AUTH_NOT_AUTHORIZED') {
        throw new ApiError(firstError.message, 403, result.errors);
      }
      if (code === 'AUTH_NOT_AUTHENTICATED') {
        throw new ApiError(firstError.message, 401, result.errors);
      }
      if (code === 'NOT_FOUND') {
        throw new ApiError(firstError.message, 404, result.errors);
      }
      throw new ApiError(firstError.message, 400, result.errors);
    }

    if (!result.data?.assignTask) {
      throw new ApiError('Failed to assign task.', 500, null);
    }

    return this.mapRawTask(result.data.assignTask);
  }

  async unassignTask(input: UnassignTaskInput): Promise<TaskItem> {
    const result = await this.client.post<GraphQLResponse<{ unassignTask: RawTask }>>(
      '/graphql',
      { query: UNASSIGN_TASK_MUTATION, variables: { input } }
    );

    if (result.errors && result.errors.length > 0) {
      const firstError = result.errors[0];
      const code = firstError.extensions?.code;
      if (code === 'AUTH_NOT_AUTHORIZED') {
        throw new ApiError(firstError.message, 403, result.errors);
      }
      if (code === 'AUTH_NOT_AUTHENTICATED') {
        throw new ApiError(firstError.message, 401, result.errors);
      }
      if (code === 'NOT_FOUND') {
        throw new ApiError(firstError.message, 404, result.errors);
      }
      throw new ApiError(firstError.message, 400, result.errors);
    }

    if (!result.data?.unassignTask) {
      throw new ApiError('Failed to unassign task.', 500, null);
    }

    return this.mapRawTask(result.data.unassignTask);
  }

  async createBoard(input: CreateBoardInput): Promise<BoardDetails> {
    const payloadInput = {
      projectId: input.projectId,
      name: input.name.trim(),
    };

    const result = await this.client.post<GraphQLResponse<{ createBoard: RawBoard }>>(
      '/graphql',
      { query: CREATE_BOARD_MUTATION, variables: { input: payloadInput } }
    );

    if (result.errors && result.errors.length > 0) {
      const firstError = result.errors[0];
      const code = firstError.extensions?.code;
      const message = firstError.message || '';

      if (code === 'AUTH_NOT_AUTHENTICATED') {
        throw new ApiError('The current user is not authorized to access this resource.', 401, result.errors);
      }
      if (code === 'AUTH_NOT_AUTHORIZED') {
        throw new ApiError(message || 'Only the owner of the project can create boards.', 403, result.errors);
      }
      if (code === 'NOT_FOUND') {
        throw new ApiError(message || 'Project was not found.', 404, result.errors);
      }
      if (code === 'BAD_USER_INPUT' || message.toLowerCase().includes('already exists')) {
        const errorMsg = message.toLowerCase().includes('already exists')
          ? 'A board with this name already exists in this project.'
          : message;
        throw new ApiError(errorMsg, 400, result.errors);
      }
      throw new ApiError(
        message || 'Couldn’t create the board. Your name is kept. Try again.',
        500,
        result.errors
      );
    }

    if (!result.data?.createBoard) {
      throw new ApiError('Couldn’t create the board. Your name is kept. Try again.', 500, null);
    }

    const b = result.data.createBoard;
    return {
      id: b.id,
      projectId: b.projectId,
      projectName: b.projectName ?? null,
      name: b.name,
      columns: (b.columns || []).map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        position: c.position || '',
        color: c.color ?? null,
      })),
      members: b.members || [],
    };
  }

  private mapRawTask(t: RawTask): TaskItem {
    return {
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
      startDate: t.startDate,
      dueDate: t.dueDate,
      createdAt: t.createdAt,
      parentTaskId: t.parentTaskId ?? null,
      blocks: (t.blocks || []).map((b) => ({
        id: b.id,
        readableId: b.readableId,
        title: b.title,
        status: b.status,
      })),
      blockedBy: (t.blockedBy || []).map((b) => ({
        id: b.id,
        readableId: b.readableId,
        title: b.title,
        status: b.status,
      })),
    };
  }

  private isValidUuid(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
}
