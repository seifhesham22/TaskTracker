import type { ColumnCategory, Task, TaskPriority } from '../domain/models';
import { TASK_FIELDS, toTask, type TaskNode } from './boards';
import { graphqlRequest } from './graphql';

/**
 * US-36: the backend's `tasks` query (GetTasksHandler) for one board, with its own title search
 * and filters. The backend checks the user is a member of the board's project, matches `search`
 * anywhere in the title in any case, combines `search` and every `where` field with AND, and
 * returns the whole matching list (not paged) in creation order.
 */
export const BOARD_TASKS_QUERY = `
  query BoardTasks($boardId: UUID!, $search: String, $where: TaskFilterInput) {
    tasks(boardId: $boardId, search: $search, where: $where) {
      ${TASK_FIELDS}
    }
  }
`;

/** TaskFilterInput: only the fields and operations the backend documents for `tasks`. */
export interface TaskWhere {
  status?: { eq: ColumnCategory };
  /** `eq: null` matches tasks with no priority. */
  priority?: { eq: TaskPriority | null };
  /** `some` with a member's id: their tasks (also shared ones); `any: false`: tasks with no assignee. */
  assignees?: { some: { userId: { eq: string } } } | { any: false };
}

export interface BoardTasksVariables {
  boardId: string;
  search?: string;
  where?: TaskWhere;
}

export async function boardTasksRequest(variables: BoardTasksVariables): Promise<Task[]> {
  const data = await graphqlRequest<{ tasks: TaskNode[] }>(BOARD_TASKS_QUERY, { ...variables });
  return data.tasks.map(toTask);
}
