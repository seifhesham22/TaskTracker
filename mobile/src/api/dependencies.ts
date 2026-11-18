import type { TaskLink } from '../domain/models';
import { LINK_FIELDS, toTaskLink, type LinkNode } from './boards';
import { graphqlRequest } from './graphql';

/** blockingTask must happen before blockedTask (AddTaskDependencyHandler). */
export const ADD_TASK_DEPENDENCY_MUTATION = `
  mutation AddTaskDependency($input: AddTaskDependencyInput!) {
    addTaskDependency(input: $input) {
      blockingTask {
        ${LINK_FIELDS}
      }
      blockedTask {
        ${LINK_FIELDS}
      }
    }
  }
`;

/** The project's tasks, for picking the other task. The backend's search matches titles. */
export const SEARCH_TASKS_QUERY = `
  query SearchTasks($projectId: UUID!, $search: String, $pageSize: Int!) {
    backlog(projectId: $projectId, search: $search, pageSize: $pageSize) {
      items {
        ${LINK_FIELDS}
      }
    }
  }
`;

/** The backend's largest page (GetBacklogHandler.MaxPageSize). */
export const MAX_PAGE_SIZE = 100;

export async function addTaskDependencyRequest(blockingTaskId: string, blockedTaskId: string) {
  const data = await graphqlRequest<{ addTaskDependency: { blockingTask: LinkNode; blockedTask: LinkNode } }>(
    ADD_TASK_DEPENDENCY_MUTATION,
    { input: { blockingTaskId, blockedTaskId } },
  );
  return {
    blockingTask: toTaskLink(data.addTaskDependency.blockingTask),
    blockedTask: toTaskLink(data.addTaskDependency.blockedTask),
  };
}

export async function searchTasksRequest(projectId: string, search: string | null, pageSize: number): Promise<TaskLink[]> {
  const data = await graphqlRequest<{ backlog: { items: LinkNode[] } }>(SEARCH_TASKS_QUERY, {
    projectId,
    search,
    pageSize,
  });
  return data.backlog.items.map(toTaskLink);
}
