import type {
  BoardColumn,
  BoardSummary,
  ColumnCategory,
  ProjectMember,
  ProjectSummary,
  Task,
  TaskLink,
  TaskPriority,
} from '../domain/models';
import { colors } from '../theme/tokens';
import { graphqlRequest } from './graphql';

/** A related task (dependency), as both `blockedBy` and `blocks` return it. */
export const LINK_FIELDS = `
    id
    readableId
    title
    status
    boardId
    column {
      name
    }
`;

export const TASK_FIELDS = `
  id
  number
  readableId
  title
  description
  priority
  startDate
  dueDate
  boardId
  columnId
  position
  parentTaskId
  status
  blockedBy {
    ${LINK_FIELDS}
  }
  blocks {
    ${LINK_FIELDS}
  }
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

export const PROJECT_FIELDS = `
      id
      name
      description
      role
      boards {
        id
        name
        columns {
          id
        }
      }
      projectMembers {
        userId
        userName
        role
      }
`;

export const PROJECTS_QUERY = `
  query Projects($userId: UUID!) {
    projects(userId: $userId) {
      ${PROJECT_FIELDS}
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
  startDate?: string | null;
  dueDate: string | null;
  boardId: string;
  columnId: string;
  position: string;
  parentTaskId?: string | null;
  blockedBy?: LinkNode[];
  blocks?: LinkNode[];
  status: ColumnCategory;
  column: { id: string; name: string; category: ColumnCategory };
  assignees: { id: string; userName: string | null }[];
}

export interface LinkNode {
  id: string;
  readableId: string;
  title: string;
  status: ColumnCategory;
  boardId: string;
  column: { name: string };
}

export function toTaskLink(node: LinkNode): TaskLink {
  return {
    id: node.id,
    readableId: node.readableId,
    title: node.title,
    status: node.status,
    columnName: node.column.name,
    boardId: node.boardId,
  };
}

export interface ProjectNode {
  id: string;
  name: string;
  description?: string | null;
  role?: string | null;
  /** `columns` is read for the project screen's “3 columns”. */
  boards: { id: string; name: string; columns?: { id: string }[] }[];
  projectMembers: { userId: string; userName: string; role?: string }[];
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
    startDate: node.startDate ?? null,
    parentTaskId: node.parentTaskId ?? null,
    blockedBy: (node.blockedBy ?? []).map(toTaskLink),
    blocks: (node.blocks ?? []).map(toTaskLink),
    dueDate: node.dueDate,
    position: node.position,
  };
}

export function toProjectMembers(project: ProjectNode): ProjectMember[] {
  return project.projectMembers.map((m) => ({ userId: m.userId, userName: m.userName }));
}

export function toBoardSummaries(projects: ProjectNode[]): BoardSummary[] {
  return projects.flatMap((p) => p.boards.map((b) => ({ id: b.id, name: b.name, projectId: p.id, projectName: p.name })));
}

export function toProjectSummary(project: ProjectNode): ProjectSummary {
  const description = project.description?.trim();
  return {
    id: project.id,
    name: project.name,
    description: description || null,
    role: project.role ?? null,
    boardCount: project.boards.length,
  };
}

export function boardWithTasksRequest(boardId: string) {
  return graphqlRequest<{ board: BoardNode; tasks: TaskNode[] }>(BOARD_WITH_TASKS_QUERY, { boardId });
}

export async function projectsRequest(userId: string): Promise<ProjectNode[]> {
  const data = await graphqlRequest<{ projects: ProjectNode[] }>(PROJECTS_QUERY, { userId });
  return data.projects;
}
