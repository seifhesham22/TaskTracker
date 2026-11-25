import type { HttpClient } from '../HttpClient';
import { ApiError } from '../errors';
import type { GraphQLResponse } from './BoardService';
import type {
  ColumnCategory,
  MemberWorkloadItem,
  ProjectRole,
  ProjectWorkloadData,
  TaskPriority,
  WorkloadTaskItem,
} from '../../domain/models';

interface RawWorkloadTask {
  readonly id: string;
  readonly readableId: string;
  readonly number: number;
  readonly boardId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly status: ColumnCategory;
  readonly columnId?: string;
  readonly columnName?: string;
  readonly priority?: TaskPriority | null;
}

interface RawMemberWorkload {
  readonly userId: string;
  readonly userName: string;
  readonly role: ProjectRole;
  readonly openTaskCount: number;
  readonly openTasks: readonly RawWorkloadTask[];
}

interface RawProjectWorkload {
  readonly averageOpenTasks: number;
  readonly members: readonly RawMemberWorkload[];
  readonly unassigned: readonly RawWorkloadTask[];
}

export const WORKLOAD_QUERY = `
  query Workload($projectId: UUID!) {
    workload(projectId: $projectId) {
      averageOpenTasks
      members {
        userId
        userName
        role
        openTaskCount
        openTasks {
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
        }
      }
      unassigned {
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
      }
    }
  }
`;

export class WorkloadService {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  public async getWorkload(projectId: string): Promise<ProjectWorkloadData> {
    const response = await this.client.post<GraphQLResponse<{ workload: RawProjectWorkload }>>(
      '/graphql',
      {
        query: WORKLOAD_QUERY,
        variables: { projectId },
      }
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

    const raw = response.data?.workload;
    if (!raw) {
      throw new ApiError('Failed to load project workload.', 500, null);
    }

    const mappedMembers: MemberWorkloadItem[] = raw.members.map((m) => ({
      userId: m.userId,
      userName: m.userName,
      role: m.role,
      openTaskCount: m.openTaskCount,
      openTasks: m.openTasks.map(this.mapTask),
    }));

    // Ensure deterministic sort descending by openTaskCount with name tie-breaker
    mappedMembers.sort((a, b) => {
      if (b.openTaskCount !== a.openTaskCount) {
        return b.openTaskCount - a.openTaskCount;
      }
      return a.userName.localeCompare(b.userName);
    });

    const mappedUnassigned: WorkloadTaskItem[] = raw.unassigned.map(this.mapTask);

    const totalOpenTasks =
      mappedMembers.reduce((sum, m) => sum + m.openTaskCount, 0) + mappedUnassigned.length;

    return {
      averageOpenTasks: raw.averageOpenTasks,
      members: mappedMembers,
      unassigned: mappedUnassigned,
      totalOpenTasks,
    };
  }

  private mapTask(raw: RawWorkloadTask): WorkloadTaskItem {
    return {
      id: raw.id,
      readableId: raw.readableId,
      number: raw.number,
      boardId: raw.boardId,
      title: raw.title,
      description: raw.description ?? null,
      status: raw.status,
      columnId: raw.columnId,
      columnName: raw.columnName,
      priority: raw.priority ?? null,
    };
  }
}
