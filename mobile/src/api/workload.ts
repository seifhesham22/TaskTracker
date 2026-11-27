import type { ColumnCategory, TaskPriority } from '../domain/models';
import { graphqlRequest } from './graphql';

/**
 * US-29: the backend's `workload` query (GetWorkloadHandler). One answer has every current member
 * of the project with their open tasks, and the open tasks nobody in the project is assigned to.
 * The backend decides what is open (columns of category BACKLOG, TO_DO and IN_PROGRESS), counts a
 * task once for each of its assignees, and orders members by open tasks, then by user name.
 * Owner only: writers and readers get AUTH_NOT_AUTHORIZED, non-members NOT_FOUND.
 */
const WORKLOAD_TASK_FIELDS = `
  id
  readableId
  title
  status
  priority
  boardId
  column {
    name
  }
`;

export const WORKLOAD_QUERY = `
  query ProjectWorkload($projectId: UUID!) {
    workload(projectId: $projectId) {
      averageOpenTasks
      members {
        userId
        userName
        role
        openTaskCount
        openTasks {
          ${WORKLOAD_TASK_FIELDS}
        }
      }
      unassigned {
        ${WORKLOAD_TASK_FIELDS}
      }
    }
  }
`;

export interface WorkloadTaskNode {
  id: string;
  readableId: string;
  title: string;
  status: ColumnCategory;
  priority: TaskPriority | null;
  boardId: string;
  column: { name: string };
}

export interface MemberWorkloadNode {
  userId: string;
  userName: string;
  role: string;
  openTaskCount: number;
  openTasks: WorkloadTaskNode[];
}

export interface ProjectWorkloadNode {
  averageOpenTasks: number;
  members: MemberWorkloadNode[];
  unassigned: WorkloadTaskNode[];
}

export async function workloadRequest(projectId: string): Promise<ProjectWorkloadNode> {
  const data = await graphqlRequest<{ workload: ProjectWorkloadNode }>(WORKLOAD_QUERY, { projectId });
  return data.workload;
}
