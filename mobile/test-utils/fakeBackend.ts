/**
 * Test helpers: a mocked `fetch` that answers like the backend's /graphql endpoint, and a board
 * repository that uses the real createTask request with a supplied board.
 * Kept outside __tests__ so Jest doesn't run this file as a test suite.
 */
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
  { userId: '01a18766-479c-7ec2-be3f-3c3a00989ad6', userName: 'Mona Adel', email: 'mona@example.test' },
  { userId: '01a18766-479c-7ec2-be3f-3c3a00989ad7', userName: 'Omar Khaled', email: 'omar@example.test' },
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

/** Body of a GraphQL error response, as HotChocolate sends it. */
export const gqlError = (code: string | undefined, message: string) => ({
  errors: [{ message, ...(code ? { extensions: { code } } : {}) }],
  data: null,
});

export const gqlTask = (task: Task) => ({ data: { createTask: task } });

export type FakeResponse = { status?: number; body: unknown } | 'network-error';

/** Replaces global fetch; each call gets the next response. */
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

/** The JSON body sent in the n-th fetch call. */
export function sentBody(fetchMock: jest.Mock, call = 0): { query: string; variables: { input: Record<string, unknown> } } {
  const init = fetchMock.mock.calls[call][1] as RequestInit;
  return JSON.parse(init.body as string);
}

/** Real backend createTask (over the mocked fetch), with the board supplied by the test. */
export function testRepository(getBoard: () => Promise<BoardData>): BoardRepository & { getBoard: jest.Mock } {
  const backend = createBackendBoardRepository();
  return { ...backend, mode: 'test', getBoard: jest.fn(getBoard) };
}
