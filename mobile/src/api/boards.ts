import type {
  BoardColumn,
  BoardSummary,
  ColumnCategory,
  ProjectMember,
  Task,
  TaskPriority,
} from '../domain/models';
import { colors } from '../theme/tokens';
import { graphqlRequest } from './graphql';

export const TASK_FIELDS = `
  id
  number
  readableId
  title
  description
  priority
  dueDate
  boardId
  columnId
  position
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
`;

export const BOARD_WITH_TASKS_QUERY = `
  query BoardWithTasks($boardId: UUID!) {
    board(id: $boardId) {
      id
      projectId
      name
      columns {
        id
        name
        position
        category
      }
    }
    tasks(boardId: $boardId) {
      ${TASK_FIELDS}
    }
  }
`;

export const PROJECTS_QUERY = `
  query Projects($userId: UUID!) {
    projects(userId: $userId) {
      id
      name
      boards {
        id
        name
      }
      projectMembers {
        userId
        userName
      }
    }
  }
`;

export interface ColumnNode {
  id: string;
  name: string;
  position: string;
  category: ColumnCategory;
}

export interface BoardNode {
  id: string;
  projectId: string;
  name: string;
  columns: ColumnNode[];
}

export interface TaskNode {
  id: string;
  number: number;
  readableId: string;
  title: string;
  description: string | null;
  priority: TaskPriority | null;
  dueDate: string | null;
  boardId: string;
  columnId: string;
  position: string;
  status: ColumnCategory;
  column: { id: string; name: string; category: ColumnCategory };
  assignees: { id: string; userName: string | null }[];
}

export interface ProjectNode {
  id: string;
  name: string;
  boards: { id: string; name: string }[];
  projectMembers: { userId: string; userName: string }[];
}

export function toBoardColumn(node: ColumnNode): BoardColumn {
  return { ...node, color: colors.status[node.category] };
}

export function toTask(node: TaskNode): Task {
  return {
    id: node.id,
    readableId: node.readableId,
    number: node.number,
    boardId: node.boardId,
    title: node.title,
    description: node.description,
    status: node.status,
    columnId: node.columnId,
    columnName: node.column.name,
    priority: node.priority,
    assigneeIds: node.assignees.map((a) => a.id),
    assigneeNames: node.assignees.map((a) => a.userName ?? ''),
    dueDate: node.dueDate,
    position: node.position,
  };
}

export function toProjectMembers(project: ProjectNode): ProjectMember[] {
  return project.projectMembers.map((m) => ({ userId: m.userId, userName: m.userName }));
}

export function toBoardSummaries(projects: ProjectNode[]): BoardSummary[] {
  return projects.flatMap((p) => p.boards.map((b) => ({ id: b.id, name: b.name, projectName: p.name })));
}

export function boardWithTasksRequest(boardId: string) {
  return graphqlRequest<{ board: BoardNode; tasks: TaskNode[] }>(BOARD_WITH_TASKS_QUERY, { boardId });
}

export async function projectsRequest(userId: string): Promise<ProjectNode[]> {
  const data = await graphqlRequest<{ projects: ProjectNode[] }>(PROJECTS_QUERY, { userId });
  return data.projects;
}
