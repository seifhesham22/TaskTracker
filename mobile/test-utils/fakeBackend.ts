import type { BoardNode, ProjectNode, TaskNode } from '../src/api/boards';
import { createBackendBoardRepository } from '../src/data/backendBoardRepository';
import type { BoardRepository } from '../src/data/BoardRepository';
import type { BoardColumn, BoardData, ProjectMember, Task } from '../src/domain/models';

export const API_URL = 'http://api.test';
export const BOARD_ID = '01a18766-48b5-7fb8-a04c-13e1bf648def';

export const COLUMNS: BoardColumn[] = [
  { id: '01a18766-0000-7000-8000-00000000c001', name: 'Backlog', category: 'BACKLOG', color: '#8A90A0', position: 'V' },
  { id: '01a18766-0000-7000-8000-00000000c002', name: 'To do', category: 'TO_DO', color: '#5B8DE8', position: 'l' },
  { id: '01a18766-0000-7000-8000-00000000c003', name: 'In progress', category: 'IN_PROGRESS', color: '#E8945B', position: 't' },
  { id: '01a18766-0000-7000-8000-00000000c004', name: 'Done', category: 'DONE', color: '#2A9D8F', position: 'x' },
];

export const MEMBERS: ProjectMember[] = [
  { userId: '01a18766-479c-7ec2-be3f-3c3a00989ad6', userName: 'Mona Adel' },
  { userId: '01a18766-479c-7ec2-be3f-3c3a00989ad7', userName: 'Omar Khaled' },
];

export function boardData(tasks: Task[] = []): BoardData {
  return {
    board: { id: BOARD_ID, name: 'Test Board', projectId: 'p-1', projectName: 'Test Project', columns: COLUMNS, members: MEMBERS },
    tasks,
  };
}

export function taskDto(overrides: Partial<Task> = {}): Task {
  return {
    id: '01a18766-8315-7c9c-90fd-5657de973481',
    readableId: 'TES-1',
    number: 1,
    boardId: BOARD_ID,
    title: 'First task',
    description: null,
    status: 'BACKLOG',
    columnId: COLUMNS[0].id,
    columnName: 'Backlog',
    priority: null,
    assigneeIds: [],
    dueDate: null,
    createdAt: '2026-11-02T10:00:00Z',
    ...overrides,
  };
}

export const gqlError = (code: string | undefined, message: string) => ({
  errors: [{ message, ...(code ? { extensions: { code } } : {}) }],
  data: null,
});

export const gqlTask = (task: Task) => ({ data: { createTask: task } });

export const movedTaskResponse = (node: TaskNode) => ({ body: { data: { moveTask: node } } });

export type FakeResponse = { status?: number; body: unknown } | 'network-error';

export function mockFetch(...responses: FakeResponse[]): jest.Mock {
  const queue = [...responses];
  const fetchMock = jest.fn(async () => {
    const next = queue.shift();
    if (next === undefined) throw new Error('mockFetch: unexpected extra request');
    if (next === 'network-error') throw new TypeError('Network request failed');
    const status = next.status ?? 200;
    return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(next.body) };
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

export function sentBody(fetchMock: jest.Mock, call = 0): { query: string; variables: { input: Record<string, unknown> } } {
  const init = fetchMock.mock.calls[call][1] as RequestInit;
  return JSON.parse(init.body as string);
}

export function testRepository(getBoard: () => Promise<BoardData>): BoardRepository & { getBoard: jest.Mock } {
  const backend = createBackendBoardRepository();
  return { ...backend, getBoard: jest.fn(getBoard) };
}

export const USER_ID = '01a18766-479c-7ec2-be3f-3c3a00989ad6';
export const PROJECT_ID = '01a18766-48a1-7b2e-9c3f-5d6e7f809a1b';

export const BOARD_NODE: BoardNode = {
  id: BOARD_ID,
  projectId: PROJECT_ID,
  name: 'Test Board',
  columns: COLUMNS.map(({ id, name, position, category }) => ({ id, name, position, category })),
};

export const PROJECT_MEMBERS = [
  { userId: USER_ID, userName: 'admin@local.test' },
  { userId: '01a18766-479c-7ec2-be3f-3c3a00989ad7', userName: 'user1@local.test' },
];

export const PROJECTS: ProjectNode[] = [
  {
    id: '01a18766-48a1-7b2e-9c3f-5d6e7f809a1c',
    name: 'Other Project',
    boards: [{ id: '01a18766-48b5-7fb8-a04c-13e1bf648d00', name: 'Other Board' }],
    projectMembers: [{ userId: '01a18766-479c-7ec2-be3f-3c3a00989a00', userName: 'outsider@local.test' }],
  },
  { id: PROJECT_ID, name: 'Test Project', boards: [{ id: BOARD_ID, name: 'Test Board' }], projectMembers: PROJECT_MEMBERS },
];

export const taskNode = (overrides: Partial<TaskNode> = {}): TaskNode => ({
  id: '01a18766-8315-7c9c-90fd-5657de973400',
  number: 1,
  readableId: 'TES-1',
  title: 'Existing task',
  description: null,
  priority: 'HIGH',
  dueDate: '2026-11-05T00:00:00.000Z',
  boardId: BOARD_ID,
  columnId: COLUMNS[2].id,
  position: 'V',
  status: 'IN_PROGRESS',
  column: { id: COLUMNS[2].id, name: 'In progress', category: 'IN_PROGRESS' },
  assignees: [{ id: PROJECT_MEMBERS[1].userId, userName: PROJECT_MEMBERS[1].userName }],
  ...overrides,
});

export const titleOnlyTaskNode = (columnIndex: number, overrides: Partial<TaskNode> = {}): TaskNode => {
  const column = COLUMNS[columnIndex];
  return taskNode({
    priority: null,
    dueDate: null,
    assignees: [],
    columnId: column.id,
    status: column.category,
    column: { id: column.id, name: column.name, category: column.category },
    ...overrides,
  });
};

export const boardResponse = (tasks: TaskNode[] = []) => ({ body: { data: { board: BOARD_NODE, tasks } } });
export const projectsResponse = (projects: ProjectNode[] = PROJECTS) => ({ body: { data: { projects } } });
