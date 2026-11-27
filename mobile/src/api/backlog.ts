import type { ColumnCategory, TaskPriority } from '../domain/models';
import { graphqlRequest } from './graphql';

/**
 * The project's backlog: every task of the project's boards, in the backend's order (board, column,
 * position), searched, filtered and paged by the backend (GetBacklogQuery / GetBacklogHandler).
 */
export const BACKLOG_QUERY = `
  query ProjectBacklog($projectId: UUID!, $search: String, $where: BacklogFilterInput, $page: Int!, $pageSize: Int!) {
    backlog(projectId: $projectId, search: $search, where: $where, page: $page, pageSize: $pageSize) {
      items {
        id
        readableId
        title
        status
        priority
        storyPoints
        boardId
        column {
          name
        }
      }
      totalCount
      page
      pageSize
      totalPages
      hasNextPage
    }
  }
`;

/** BacklogFilterInput: only the two fields the backend offers here, with their `in` operation. */
export interface BacklogWhere {
  status?: { in: ColumnCategory[] };
  priority?: { in: TaskPriority[] };
}

export interface BacklogVariables {
  projectId: string;
  /** Left out when blank, so the backend applies no search. */
  search?: string;
  /** Left out when no filter is chosen. */
  where?: BacklogWhere;
  page: number;
  pageSize: number;
}

export interface BacklogItemNode {
  id: string;
  readableId: string;
  title: string;
  status: ColumnCategory;
  priority: TaskPriority | null;
  storyPoints: number | null;
  boardId: string;
  column: { name: string };
}

export interface BacklogPageNode {
  items: BacklogItemNode[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
}

export async function backlogRequest(variables: BacklogVariables): Promise<BacklogPageNode> {
  const data = await graphqlRequest<{ backlog: BacklogPageNode }>(BACKLOG_QUERY, { ...variables });
  return data.backlog;
}

/**
 * US-24: the backend's `rankTask` (RankTaskHandler). Puts the task right after `afterTaskId` in the
 * project's backlog order (its rank), or at the top when `afterTaskId` is null. The rank belongs to
 * the backlog only: the task's status, column and board position don't change. Writers and owners
 * only (AUTH_NOT_AUTHORIZED otherwise). The saved order is what every member's `backlog` returns.
 */
export const RANK_TASK_MUTATION = `
  mutation RankTask($input: RankTaskInput!) {
    rankTask(input: $input) {
      id
      readableId
    }
  }
`;

export async function rankTaskRequest(taskId: string, afterTaskId: string | null): Promise<{ id: string }> {
  const data = await graphqlRequest<{ rankTask: { id: string; readableId: string } }>(RANK_TASK_MUTATION, {
    input: { taskId, afterTaskId },
  });
  return data.rankTask;
}
