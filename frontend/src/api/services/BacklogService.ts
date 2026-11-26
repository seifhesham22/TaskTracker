import type { HttpClient } from '../HttpClient';
import { ApiError } from '../errors';
import type { GraphQLResponse } from './BoardService';
import type {
  BacklogFilterInput,
  BacklogItem,
  BacklogPageData,
  ColumnCategory,
  GetBacklogInput,
  RankTaskInput,
  RankTaskResult,
  TaskPriority,
} from '../../domain/models';

export const RANK_TASK_MUTATION = `
  mutation RankTask($input: RankTaskInput!) {
    rankTask(input: $input) {
      id
      readableId
    }
  }
`;

export const UPDATE_TASK_PRIORITY_MUTATION = `
  mutation UpdateTaskPriority($input: UpdateTaskInput!) {
    updateTask(input: $input) {
      id
      readableId
      priority
    }
  }
`;

interface RawBacklogItem {
  readonly id: string;
  readonly readableId: string;
  readonly number: number;
  readonly boardId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly priority?: TaskPriority | null;
  readonly status: ColumnCategory;
  readonly column?: {
    readonly id?: string;
    readonly name: string;
    readonly category?: ColumnCategory;
  } | null;
  readonly assignees?: readonly { readonly id: string; readonly userName?: string | null }[];
  readonly blocks?: readonly { readonly readableId: string }[];
  readonly blockedBy?: readonly { readonly readableId: string }[];
  readonly position?: string;
  readonly parentTaskId?: string | null;
}

interface RawBacklogPage {
  readonly items: readonly RawBacklogItem[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

export class BacklogService {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  public buildFilter(
    status?: ColumnCategory | null,
    priority?: TaskPriority | 'NONE' | null,
    assigneeId?: string | 'UNASSIGNED' | null
  ): BacklogFilterInput | undefined {
    const filter: Record<string, unknown> = {};

    if (status) {
      filter.status = { eq: status };
    }

    if (priority === 'NONE') {
      filter.priority = { eq: null };
    } else if (priority) {
      filter.priority = { eq: priority };
    }

    if (assigneeId === 'UNASSIGNED') {
      filter.assignees = { any: false };
    } else if (assigneeId) {
      filter.assignees = { some: { userId: { eq: assigneeId } } };
    }

    if (Object.keys(filter).length === 0) {
      return undefined;
    }

    return filter as BacklogFilterInput;
  }

  public async getBacklog(input: GetBacklogInput): Promise<BacklogPageData> {
    const query = `
      query Backlog($projectId: UUID!, $search: String, $where: BacklogFilterInput, $page: Int!, $pageSize: Int!) {
        backlog(projectId: $projectId, search: $search, where: $where, page: $page, pageSize: $pageSize) {
          items {
            id
            readableId
            number
            boardId
            title
            description
            priority
            status
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
              readableId
            }
            blockedBy {
              readableId
            }
            position
            parentTaskId
          }
          totalCount
          page
          pageSize
          totalPages
          hasNextPage
          hasPreviousPage
        }
      }
    `;

    const variables = {
      projectId: input.projectId,
      search: input.search?.trim() ? input.search.trim() : null,
      where: input.where ?? null,
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 20,
    };

    const response = await this.client.post<GraphQLResponse<{ backlog: RawBacklogPage }>>(
      '/graphql',
      { query, variables }
    );

    if (response.errors && response.errors.length > 0) {
      const firstError = response.errors[0];
      const code = firstError.extensions?.code;
      if (code === 'NOT_FOUND') {
        throw new ApiError(firstError.message, 404, response.errors);
      }
      if (code === 'AUTH_NOT_AUTHORIZED' || code === 'FORBIDDEN') {
        throw new ApiError(firstError.message, 403, response.errors);
      }
      if (code === 'AUTH_NOT_AUTHENTICATED') {
        throw new ApiError(firstError.message, 401, response.errors);
      }
      throw new ApiError(firstError.message, 400, response.errors);
    }

    const backlog = response.data?.backlog;
    if (!backlog) {
      throw new ApiError('Failed to load project backlog.', 500, null);
    }

    return {
      items: backlog.items.map((raw) => this.mapRawBacklogItem(raw)),
      totalCount: backlog.totalCount,
      page: backlog.page,
      pageSize: backlog.pageSize,
      totalPages: backlog.totalPages,
      hasNextPage: backlog.hasNextPage,
      hasPreviousPage: backlog.hasPreviousPage,
    };
  }

  private mapRawBacklogItem(raw: RawBacklogItem): BacklogItem {
    return {
      id: raw.id,
      readableId: raw.readableId,
      number: raw.number,
      boardId: raw.boardId,
      title: raw.title,
      description: raw.description ?? null,
      status: raw.status,
      column: raw.column
        ? {
          id: raw.column.id,
          name: raw.column.name,
          category: raw.column.category,
        }
        : null,
      priority: raw.priority ?? null,
      assignees: raw.assignees ? raw.assignees.map((a) => ({ id: a.id, userName: a.userName })) : [],
      blocks: raw.blocks ? raw.blocks.map((b) => ({ readableId: b.readableId })) : [],
      blockedBy: raw.blockedBy ? raw.blockedBy.map((b) => ({ readableId: b.readableId })) : [],
      position: raw.position,
      parentTaskId: raw.parentTaskId ?? null,
    };
  }

  public async rankTask(input: RankTaskInput): Promise<RankTaskResult> {
    const response = await this.client.post<GraphQLResponse<{ rankTask: RankTaskResult }>>(
      '/graphql',
      { query: RANK_TASK_MUTATION, variables: { input } }
    );

    if (response.errors && response.errors.length > 0) {
      const firstError = response.errors[0];
      const code = firstError.extensions?.code;
      if (code === 'NOT_FOUND') {
        throw new ApiError(firstError.message, 404, response.errors);
      }
      if (code === 'AUTH_NOT_AUTHORIZED' || code === 'FORBIDDEN') {
        throw new ApiError(firstError.message, 403, response.errors);
      }
      if (code === 'AUTH_NOT_AUTHENTICATED') {
        throw new ApiError(firstError.message, 401, response.errors);
      }
      if (code === 'BAD_USER_INPUT') {
        throw new ApiError(firstError.message, 400, response.errors);
      }
      throw new ApiError(firstError.message, 400, response.errors);
    }

    const result = response.data?.rankTask;
    if (!result) {
      throw new ApiError('Failed to rank task.', 500, null);
    }

    return result;
  }

  public async updateTaskPriority(
    taskId: string,
    priority: TaskPriority | null
  ): Promise<{ id: string; readableId: string; priority: TaskPriority | null }> {
    const response = await this.client.post<
      GraphQLResponse<{ updateTask: { id: string; readableId: string; priority: TaskPriority | null } }>
    >('/graphql', {
      query: UPDATE_TASK_PRIORITY_MUTATION,
      variables: { input: { taskId, priority } },
    });

    if (response.errors && response.errors.length > 0) {
      const firstError = response.errors[0];
      const code = firstError.extensions?.code;
      if (code === 'NOT_FOUND') {
        throw new ApiError(firstError.message, 404, response.errors);
      }
      if (code === 'AUTH_NOT_AUTHORIZED' || code === 'FORBIDDEN') {
        throw new ApiError(firstError.message, 403, response.errors);
      }
      if (code === 'AUTH_NOT_AUTHENTICATED') {
        throw new ApiError(firstError.message, 401, response.errors);
      }
      throw new ApiError(firstError.message, 400, response.errors);
    }

    const result = response.data?.updateTask;
    if (!result) {
      throw new ApiError('Failed to update task priority.', 500, null);
    }

    return result;
  }
}
