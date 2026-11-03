/**
 * DEMO DATA ONLY. Not the backend's seeded data, never sent to the backend.
 *
 * Used when EXPO_PUBLIC_MOBILE_DEMO_MODE=true, so the board screen and the create-task form can
 * be tried on a device while the backend has no board/task/member queries. Everything lives in
 * memory and is lost when the app restarts.
 *
 * Failures are simulated with the same error shapes the backend returns (GraphQL codes and
 * messages from CreateTaskHandler), and go through the same mapping as real responses.
 */
import { ApiError } from '../api/client';
import { GraphQLResponseError, NetworkError } from '../api/graphql';
import { CreateTaskError, toCreateTaskFailure } from '../domain/createTaskErrors';
import type {
  Board,
  BoardColumn,
  BoardData,
  BoardSummary,
  CreateTaskInput,
  ProjectMember,
  Task,
} from '../domain/models';
import { BoardLoadError, type BoardRepository } from './BoardRepository';

export type DemoScenario =
  | 'none'
  | 'boardDeletedOnSubmit'
  | 'columnMissingOnce'
  | 'networkFailureOnce'
  | 'serverFailureOnce'
  | 'loadFailsOnce';

const DEMO_PROJECT = { id: 'de000000-0000-4000-8000-00000000f001', name: 'Demo Project', key: 'DEMO' };

const demoId = (group: string, n: number) => `de000000-0000-4000-8000-${group}${String(n).padStart(12 - group.length, '0')}`;

export const DEMO_MEMBERS: ProjectMember[] = [
  { userId: demoId('a', 1), userName: 'Demo Admin', email: 'admin@demo.invalid' },
  { userId: demoId('a', 2), userName: 'Demo Member One', email: 'member1@demo.invalid' },
  { userId: demoId('a', 3), userName: 'Demo Member Two', email: 'member2@demo.invalid' },
  // Listed here, but the simulated server rejects them as "not a member of the project".
  { userId: demoId('a', 4), userName: 'Demo Removed Member', email: 'removed@demo.invalid' },
];

/** The member the simulated server rejects, to try the assignee error. */
export const DEMO_REMOVED_MEMBER_ID = DEMO_MEMBERS[3].userId;

/** An ID no demo board has, to try "Board not found" when opening a board. */
export const DEMO_MISSING_BOARD_ID = demoId('b', 999);

const DEMO_BOARDS: { name: string; scenario: DemoScenario }[] = [
  { name: 'Demo board', scenario: 'none' },
  { name: 'Demo · board deleted while the form is open', scenario: 'boardDeletedOnSubmit' },
  { name: 'Demo · column missing on first submit', scenario: 'columnMissingOnce' },
  { name: 'Demo · network failure on first submit', scenario: 'networkFailureOnce' },
  { name: 'Demo · server failure on first submit', scenario: 'serverFailureOnce' },
  { name: 'Demo · board fails to load once', scenario: 'loadFailsOnce' },
];

function demoColumns(boardNumber: number): BoardColumn[] {
  return [
    { name: 'Backlog', category: 'BACKLOG', color: '#8A90A0', position: 'V' },
    { name: 'To do', category: 'TO_DO', color: '#5B8DE8', position: 'l' },
    { name: 'In progress', category: 'IN_PROGRESS', color: '#E8945B', position: 't' },
    { name: 'Done', category: 'DONE', color: '#2A9D8F', position: 'x' },
  ].map((c, i) => ({ ...c, id: demoId('c', boardNumber * 10 + i + 1) }) as BoardColumn);
}

interface DemoBoardState {
  board: Board;
  tasks: Task[];
  scenario: DemoScenario;
  failuresLeft: number;
  deleted: boolean;
}

export interface DemoRepositoryOptions {
  /** Simulated network delay, so loading and "Creating…" states are visible. */
  latencyMs?: number;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const graphQLError = (code: string, message: string) =>
  new GraphQLResponseError([{ message, extensions: { code } }], 200);

export function createDemoBoardRepository({ latencyMs = 400 }: DemoRepositoryOptions = {}): BoardRepository {
  const boards = new Map<string, DemoBoardState>();
  DEMO_BOARDS.forEach(({ name, scenario }, i) => {
    const id = demoId('b', i + 1);
    boards.set(id, {
      board: {
        id,
        name,
        projectId: DEMO_PROJECT.id,
        projectName: DEMO_PROJECT.name,
        columns: demoColumns(i + 1),
        members: DEMO_MEMBERS,
      },
      tasks: [],
      scenario,
      failuresLeft: scenario === 'none' || scenario === 'boardDeletedOnSubmit' ? 0 : 1,
      deleted: false,
    });
  });
  let lastTaskNumber = 0;

  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, latencyMs));

  const find = (boardId: string) => {
    const state = boards.get(boardId);
    return state && !state.deleted ? state : undefined;
  };

  /** What the simulated backend does for one createTask call. */
  const simulateCreate = (input: CreateTaskInput): Task => {
    const state = find(input.boardId);
    if (!state) throw graphQLError('NOT_FOUND', `Board '${input.boardId}' was not found.`);

    if (state.scenario === 'boardDeletedOnSubmit') {
      state.deleted = true;
      throw graphQLError('NOT_FOUND', `Board '${input.boardId}' was not found.`);
    }
    if (state.failuresLeft > 0) {
      state.failuresLeft -= 1;
      if (state.scenario === 'networkFailureOnce') throw new NetworkError(new TypeError('Network request failed'));
      if (state.scenario === 'serverFailureOnce') throw new ApiError('Request failed with status 500', 500, undefined);
      if (state.scenario === 'columnMissingOnce') {
        throw graphQLError(
          'NOT_FOUND',
          `Column '${input.columnId ?? state.board.columns[0].id}' was not found on board '${input.boardId}'.`,
        );
      }
    }

    const column = input.columnId
      ? state.board.columns.find((c) => c.id === input.columnId)
      : state.board.columns[0];
    if (!column) {
      throw input.columnId
        ? graphQLError('NOT_FOUND', `Column '${input.columnId}' was not found on board '${input.boardId}'.`)
        : graphQLError('BAD_USER_INPUT', "This board has no columns, so the task can't get a status.");
    }
    if (input.assigneeId && (input.assigneeId === DEMO_REMOVED_MEMBER_ID || !DEMO_MEMBERS.some((m) => m.userId === input.assigneeId))) {
      throw graphQLError(
        'BAD_USER_INPUT',
        `User '${input.assigneeId}' is not a member of project ${DEMO_PROJECT.key}, so they can't be assigned to this task.`,
      );
    }
    const title = input.title.trim();
    if (!title) throw graphQLError('BAD_USER_INPUT', 'Title cannot be empty or only spaces.');
    if (title.length > 200) throw graphQLError('BAD_USER_INPUT', 'Title cannot be longer than 200 characters.');

    lastTaskNumber += 1;
    const task: Task = {
      id: demoId('d', lastTaskNumber),
      readableId: `${DEMO_PROJECT.key}-${lastTaskNumber}`,
      number: lastTaskNumber,
      boardId: state.board.id,
      title,
      description: input.description ?? null,
      status: column.category,
      columnId: column.id,
      columnName: column.name,
      priority: input.priority ?? null,
      assigneeIds: input.assigneeId ? [input.assigneeId] : [],
      dueDate: input.dueDate ?? null,
      createdAt: new Date().toISOString(),
    };
    state.tasks.push(task);
    return task;
  };

  return {
    mode: 'demo',

    async listBoards(): Promise<BoardSummary[]> {
      await wait();
      return [...boards.values()]
        .filter((s) => !s.deleted)
        .map(({ board }) => ({ id: board.id, name: board.name, projectName: board.projectName }));
    },

    async getBoard(boardId: string): Promise<BoardData> {
      await wait();
      const state = find(boardId);
      if (!state) throw new BoardLoadError('notFound', `Board '${boardId}' was not found.`);
      if (state.scenario === 'loadFailsOnce' && state.failuresLeft > 0) {
        state.failuresLeft -= 1;
        throw new BoardLoadError('network', 'Simulated network failure (demo).');
      }
      return clone({ board: state.board, tasks: state.tasks });
    },

    async createTask(input: CreateTaskInput): Promise<Task> {
      await wait();
      try {
        return clone(simulateCreate(input));
      } catch (error) {
        throw new CreateTaskError(toCreateTaskFailure(error, input));
      }
    },
  };
}
