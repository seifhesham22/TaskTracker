import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { BOARD_WITH_TASKS_QUERY, PROJECTS_QUERY, type LinkNode, type ProjectNode, type TaskNode } from '../src/api/boards';
import { MOVE_TASK_MUTATION } from '../src/api/tasks';
import { setSession } from '../src/auth/session';
import BoardScreen from '../src/app/boards/[boardId]';
import { ALL_PREREQUISITES_DONE, VERIFY_FAILED, cantStart } from '../src/domain/blockers';
import { API_URL, BOARD_ID, BOARD_NODE, COLUMNS, PROJECT_ID, PROJECT_MEMBERS, titleOnlyTaskNode } from '../test-utils/fakeBackend';
import { meResponse, renderApp, storedSession } from '../test-utils/renderApp';
import { resetSecureStore } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

const [BACKLOG, , IN_PROGRESS, DONE] = COLUMNS;
const id = (n: number) => `01a18766-8315-7c9c-90fd-5657de97${String(n).padStart(4, '0')}`;
const A = id(18); // Approve scope: must be done before B.
const B = id(24); // Prepare launch checklist: the task being started.
const C = id(30); // Publish the checklist: waits for B (B blocks C).
const D = id(19); // Book the venue: another blocker of B.

type Answer = { status?: number; body: unknown } | 'network-error';

/**
 * A small stand-in for the backend: the board's tasks and their dependencies, read as the board
 * query returns them (blockedBy / blocks with each task's status now), and moves checked as
 * MoveTaskHandler does (TaskBlockerGuard: no In progress or Done while a blocker isn't done).
 */
function backend() {
  const tasks = new Map<string, { n: number; title: string; column: number }>();
  const deps: [blocking: string, blocked: string][] = [];
  const once: Record<string, Answer[]> = {};
  const sent: { query: string; variables: { input?: Record<string, unknown> } }[] = [];
  let role = 'WRITER';

  const link = (taskId: string): LinkNode => {
    const t = tasks.get(taskId)!;
    const column = COLUMNS[t.column];
    return { id: taskId, readableId: `TES-${t.n}`, title: t.title, status: column.category, boardId: BOARD_ID, column: { name: column.name } };
  };
  const node = (taskId: string): TaskNode => {
    const t = tasks.get(taskId)!;
    return titleOnlyTaskNode(t.column, {
      id: taskId,
      number: t.n,
      readableId: `TES-${t.n}`,
      title: t.title,
      blockedBy: deps.filter(([, blocked]) => blocked === taskId).map(([blocking]) => link(blocking)),
      blocks: deps.filter(([blocking]) => blocking === taskId).map(([, blocked]) => link(blocked)),
    });
  };
  const project = (): ProjectNode => ({ id: PROJECT_ID, name: 'Website redesign', role, boards: [{ id: BOARD_ID, name: 'Test Board' }], projectMembers: PROJECT_MEMBERS });

  const answer = (query: string, input?: Record<string, unknown>): Answer => {
    if (once[query]?.length) return once[query].shift()!;
    if (query === BOARD_WITH_TASKS_QUERY) return { body: { data: { board: BOARD_NODE, tasks: [...tasks.keys()].map(node) } } };
    if (query === PROJECTS_QUERY) return { body: { data: { projects: [project()] } } };
    if (query === MOVE_TASK_MUTATION) {
      const taskId = input!.taskId as string;
      const target = COLUMNS.findIndex((c) => c.id === input!.columnId);
      const active = ['IN_PROGRESS', 'DONE'].includes(COLUMNS[target].category);
      const blockers = deps.filter(([b, blocked]) => blocked === taskId && COLUMNS[tasks.get(b)!.column].category !== 'DONE').map(([b]) => b);
      if (active && blockers.length > 0) {
        return {
          body: {
            data: null,
            errors: [
              {
                message: `TES-${tasks.get(taskId)!.n} is blocked by unfinished tasks.`,
                extensions: { code: 'BAD_USER_INPUT', blockers: blockers.map((b) => ({ id: b, readableId: `TES-${tasks.get(b)!.n}`, title: tasks.get(b)!.title })) },
              },
            ],
          },
        };
      }
      tasks.get(taskId)!.column = target;
      return { body: { data: { moveTask: node(taskId) } } };
    }
    return { body: meResponse().body };
  };

  const fetchMock = jest.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    sent.push(body);
    const a = answer(body.query, body.variables?.input);
    if (a === 'network-error') throw new TypeError('Network request failed');
    const status = a.status ?? 200;
    return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(a.body) };
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  return {
    task: (taskId: string, n: number, title: string, column: number) => tasks.set(taskId, { n, title, column }),
    depend: (blocking: string, blocked: string) => deps.push([blocking, blocked]),
    undepend: (blocking: string, blocked: string) => deps.splice(deps.findIndex(([b, d]) => b === blocking && d === blocked), 1),
    setColumn: (taskId: string, column: number) => (tasks.get(taskId)!.column = column),
    column: (taskId: string) => COLUMNS[tasks.get(taskId)!.column].name,
    failNext: (query: string, ...answers: Answer[]) => (once[query] = [...(once[query] ?? []), ...answers]),
    setRole: (r: string) => (role = r),
    moves: () => sent.filter((b) => b.query === MOVE_TASK_MUTATION).map((b) => b.variables.input),
  };
}

/** B is blocked by A (in progress); B blocks C. */
function scenario() {
  const server = backend();
  server.task(A, 18, 'Approve scope', 2);
  server.task(B, 24, 'Prepare launch checklist', 1);
  server.task(C, 30, 'Publish the checklist', 1);
  server.depend(A, B);
  server.depend(B, C);
  return server;
}

const statusUrl = (taskId: string) => `/tasks/${taskId}/status?boardId=${BOARD_ID}`;

async function open(url: string) {
  resetSecureStore(storedSession());
  const router = await renderApp(url, { 'boards/[boardId]': BoardScreen });
  return router;
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
});

describe('Which tasks block a start', () => {
  it('shows the one unfinished predecessor, sends nothing, and keeps the status', async () => {
    const server = scenario();
    await open(statusUrl(B));

    expect(await screen.findByTestId('form-error')).toHaveTextContent(cantStart(1));
    expect(screen.getByRole('header', { name: 'Prepare launch checklist' })).toBeOnTheScreen();
    expect(screen.getByText('Website redesign / TES-24')).toBeOnTheScreen();
    expect(screen.getByTestId('status-value')).toHaveTextContent('To do');
    const card = screen.getByTestId(`blocker-${A}`);
    expect(within(card).getByText('TES-18 · Approve scope')).toBeOnTheScreen();
    expect(within(card).getByText('In progress · Blocks TES-24')).toBeOnTheScreen();
    expect(within(card).getByRole('button', { name: 'Open blocker TES-18, Approve scope' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Back to board' })).toBeOnTheScreen();
    expect(screen.queryByTestId('status-submit')).not.toBeOnTheScreen();
    expect(server.moves()).toEqual([]);
    expect(server.column(B)).toBe('To do');
  });

  it('lists every unfinished predecessor, and leaves out the done ones', async () => {
    const server = scenario();
    server.task(D, 19, 'Book the venue', 1);
    server.depend(D, B);
    server.task(id(17), 17, 'Already signed off', 3);
    server.depend(id(17), B);
    await open(statusUrl(B));

    expect(await screen.findByTestId('form-error')).toHaveTextContent(cantStart(2));
    expect(screen.getByTestId(`blocker-${A}`)).toBeOnTheScreen();
    expect(screen.getByTestId(`blocker-${D}`)).toBeOnTheScreen();
    expect(screen.queryByTestId(`blocker-${id(17)}`)).not.toBeOnTheScreen();
    expect(screen.queryByText(/Already signed off/)).not.toBeOnTheScreen();
  });

  it('never takes a task this one blocks for a blocker: B starts although C isn’t done', async () => {
    const server = scenario();
    server.undepend(A, B);
    await open(statusUrl(B));

    expect(await screen.findByRole('button', { name: 'Start task' })).toBeEnabled();
    expect(screen.queryByTestId('blocker-list')).not.toBeOnTheScreen();
    expect(screen.queryByText(/Publish the checklist/)).not.toBeOnTheScreen();
  });

  it('starts an unblocked task: the move is sent, and the new status shown once confirmed', async () => {
    const server = scenario();
    server.undepend(A, B);
    await open(statusUrl(B));
    await fireEvent.press(await screen.findByRole('button', { name: 'Start task' }));

    expect(await screen.findByText('Task started')).toBeOnTheScreen();
    expect(screen.getByTestId('status-value')).toHaveTextContent('In progress');
    expect(server.moves()).toEqual([{ taskId: B, columnId: IN_PROGRESS.id }]);
  });
});

describe('Checked again right before every start', () => {
  it('a blocker reopened since the screen opened stops the start: nothing is sent', async () => {
    const server = scenario();
    server.setColumn(A, 3); // done when the screen opens
    await open(statusUrl(B));
    expect(await screen.findByTestId('prerequisites-done')).toHaveTextContent(ALL_PREREQUISITES_DONE);

    server.setColumn(A, 2); // reopened in another session
    await fireEvent.press(screen.getByRole('button', { name: 'Start task' }));

    expect(await screen.findByTestId('form-error')).toHaveTextContent(cantStart(1));
    expect(server.moves()).toEqual([]);
    expect(screen.getByTestId('status-value')).toHaveTextContent('To do');
  });

  it('Check again after the blocker is done: the task can be started', async () => {
    const server = scenario();
    await open(statusUrl(B));
    await screen.findByTestId(`blocker-${A}`);

    server.setColumn(A, 3);
    await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));

    expect(await screen.findByText(ALL_PREREQUISITES_DONE)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Start task' }));
    expect(await screen.findByText('Task started')).toBeOnTheScreen();
    expect(server.moves()).toEqual([{ taskId: B, columnId: IN_PROGRESS.id }]);
  });

  it('Check again after the dependency is removed: the task can be started', async () => {
    const server = scenario();
    await open(statusUrl(B));
    await screen.findByTestId(`blocker-${A}`);

    server.undepend(A, B);
    await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Start task' }));

    expect(await screen.findByText('Task started')).toBeOnTheScreen();
    expect(server.column(B)).toBe('In progress');
  });

  it('shows the blockers the backend names when it refuses a start the app didn’t know was blocked', async () => {
    const server = scenario();
    server.undepend(A, B);
    await open(statusUrl(B));
    await screen.findByRole('button', { name: 'Start task' });

    server.depend(A, B); // added in another session, after this screen's last read…
    // …and the app's own check right before the move still sees the old answer.
    server.failNext(BOARD_WITH_TASKS_QUERY, {
      body: { data: { board: BOARD_NODE, tasks: [titleOnlyTaskNode(1, { id: B, number: 24, readableId: 'TES-24', title: 'Prepare launch checklist' })] } },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Start task' }));

    expect(await screen.findByTestId(`blocker-${A}`)).toBeOnTheScreen();
    expect(screen.getByTestId('form-error')).toHaveTextContent(cantStart(1));
    expect(screen.getByTestId('status-value')).toHaveTextContent('To do');
    expect(server.column(B)).toBe('To do');
  });

  it('moves that don’t start work are not held back by blockers', async () => {
    const server = scenario();
    server.setColumn(A, 3);
    await open(statusUrl(B));
    await fireEvent.press(await screen.findByTestId(`status-option-${BACKLOG.id}`));
    await fireEvent.press(screen.getByRole('button', { name: 'Move to Backlog' }));

    expect(await screen.findByText('Moved to Backlog')).toBeOnTheScreen();
    expect(server.moves()).toEqual([{ taskId: B, columnId: BACKLOG.id }]);
  });
});

describe('Opening a blocker and coming back', () => {
  it('opens the blocker by its ID, completes it there, and back on the task the start is allowed', async () => {
    const server = scenario();
    await open(statusUrl(B));
    await fireEvent.press(await screen.findByRole('button', { name: 'Open blocker TES-18, Approve scope' }));

    expect(await screen.findByRole('header', { name: 'Approve scope' })).toBeOnTheScreen();
    expect(screen.getByText('Website redesign / TES-18')).toBeOnTheScreen();
    expect(screen.getByTestId('blocks-note')).toHaveTextContent('This task blocks TES-24.');
    expect(screen.getByTestId('status-value')).toHaveTextContent('In progress');

    await fireEvent.press(await screen.findByTestId(`status-option-${DONE.id}`));
    await fireEvent.press(screen.getByRole('button', { name: 'Complete task' }));
    expect(await screen.findByText('Task completed')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Back to blocked task' }));
    // Read again on the way back: the blocker is done now.
    expect(await screen.findByText(ALL_PREREQUISITES_DONE)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Start task' }));
    expect(await screen.findByText('Task started')).toBeOnTheScreen();
    expect(server.moves()).toEqual([
      { taskId: A, columnId: DONE.id },
      { taskId: B, columnId: IN_PROGRESS.id },
    ]);
  });
});

describe('Never started when the blockers can’t be checked', () => {
  it('a failed read of the blockers allows no start, and Try again checks again', async () => {
    resetSecureStore(storedSession());
    const server = scenario();
    server.undepend(A, B);
    // The task loads; the prerequisites check (the second read of the board) gets no answer.
    const realFetch = globalThis.fetch;
    let boardReads = 0;
    globalThis.fetch = jest.fn(async (url: string, init: RequestInit) => {
      if (JSON.parse(init.body as string).query === BOARD_WITH_TASKS_QUERY && ++boardReads === 2) {
        throw new TypeError('Network request failed');
      }
      return (realFetch as unknown as (u: string, i: RequestInit) => Promise<unknown>)(url, init);
    }) as unknown as typeof fetch;
    await renderApp(statusUrl(B));

    expect(await screen.findByTestId('form-error')).toHaveTextContent(VERIFY_FAILED);
    expect(screen.queryByTestId('status-submit')).not.toBeOnTheScreen();
    expect(screen.getByTestId('status-value')).toHaveTextContent('To do');

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Start task' }));
    expect(await screen.findByText('Task started')).toBeOnTheScreen();
    expect(server.moves()).toEqual([{ taskId: B, columnId: IN_PROGRESS.id }]);
  });

  it('a failed read right before the start sends nothing', async () => {
    const server = scenario();
    server.undepend(A, B);
    await open(statusUrl(B));
    await screen.findByRole('button', { name: 'Start task' });

    server.failNext(BOARD_WITH_TASKS_QUERY, 'network-error');
    await fireEvent.press(screen.getByRole('button', { name: 'Start task' }));

    expect(await screen.findByTestId('form-error')).toHaveTextContent(VERIFY_FAILED);
    expect(server.moves()).toEqual([]);
    expect(screen.getByTestId('status-value')).toHaveTextContent('To do');
  });

  it('a move without an answer isn’t shown as started; Try again looks before sending it again', async () => {
    const server = scenario();
    server.undepend(A, B);
    await open(statusUrl(B));
    await screen.findByRole('button', { name: 'Start task' });

    server.failNext(MOVE_TASK_MUTATION, 'network-error');
    await fireEvent.press(screen.getByRole('button', { name: 'Start task' }));
    expect(await screen.findByTestId('form-error')).toHaveTextContent(VERIFY_FAILED);
    expect(screen.queryByText('Task started')).not.toBeOnTheScreen();
    expect(screen.getByTestId('status-value')).toHaveTextContent('To do');

    await fireEvent.press(screen.getByRole('button', { name: 'Start task' }));
    expect(await screen.findByText('Task started')).toBeOnTheScreen();
    expect(server.moves()).toHaveLength(2);
  });

  it('another refusal keeps the status and says why', async () => {
    const server = scenario();
    server.undepend(A, B);
    await open(statusUrl(B));
    await screen.findByRole('button', { name: 'Start task' });

    server.failNext(MOVE_TASK_MUTATION, {
      body: { data: null, errors: [{ message: 'Only writers and owners of the project can move tasks.', extensions: { code: 'AUTH_NOT_AUTHORIZED' } }] },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Start task' }));
    expect(await screen.findByTestId('form-error')).toBeOnTheScreen();
    expect(screen.getByTestId('status-value')).toHaveTextContent('To do');
    expect(screen.queryByText('Task started')).not.toBeOnTheScreen();
  });

  it('shows “Checking prerequisites…” and allows nothing until the answer', async () => {
    resetSecureStore(storedSession());
    const server = scenario();
    server.undepend(A, B);
    const realFetch = globalThis.fetch;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let boardReads = 0;
    globalThis.fetch = jest.fn(async (url: string, init: RequestInit) => {
      if (JSON.parse(init.body as string).query === BOARD_WITH_TASKS_QUERY && ++boardReads === 2) await gate;
      return (realFetch as unknown as (u: string, i: RequestInit) => Promise<unknown>)(url, init);
    }) as unknown as typeof fetch;
    await renderApp(statusUrl(B));

    expect(await screen.findByText('Checking prerequisites…')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();
    await act(async () => release());
    expect(await screen.findByRole('button', { name: 'Start task' })).toBeEnabled();
  });

  it('a Reader sees the blockers and no way to change the status', async () => {
    const server = scenario();
    server.setRole('READER');
    server.undepend(A, B);
    await open(statusUrl(B));
    expect(await screen.findByTestId('status-read-only')).toBeOnTheScreen();
    expect(screen.queryByTestId('status-submit')).not.toBeOnTheScreen();
  });
});

describe('From the board and Task details', () => {
  it('a long-press move of a blocked task to In progress sends nothing, keeps the card and explains', async () => {
    const server = scenario();
    const router = await open(`/boards/${BOARD_ID}`);
    await fireEvent(await screen.findByTestId(`task-card-${B}`), 'longPress');
    await fireEvent.press(screen.getByTestId(`move-task-sheet-option-${IN_PROGRESS.id}`));

    await waitFor(() => expect(router).toHavePathname(`/tasks/${B}/status`));
    expect(await screen.findByTestId('move-reverted')).toHaveTextContent('Move reverted · TES-24 stays in To do.');
    expect(screen.getByTestId(`blocker-${A}`)).toBeOnTheScreen();
    expect(server.moves()).toEqual([]);
  });

  it('a move the backend refuses for blockers is reported the same way', async () => {
    const server = scenario();
    server.undepend(A, B);
    const router = await open(`/boards/${BOARD_ID}`);
    await screen.findByTestId(`task-card-${B}`);
    server.depend(A, B); // added since the board was read
    await fireEvent(screen.getByTestId(`task-card-${B}`), 'longPress');
    await fireEvent.press(screen.getByTestId(`move-task-sheet-option-${IN_PROGRESS.id}`));

    await waitFor(() => expect(router).toHavePathname(`/tasks/${B}/status`));
    expect(await screen.findByTestId(`blocker-${A}`)).toBeOnTheScreen();
    expect(server.column(B)).toBe('To do');
  });

  it('a move that doesn’t start work still goes through from the board', async () => {
    const server = scenario();
    await open(`/boards/${BOARD_ID}`);
    await fireEvent(await screen.findByTestId(`task-card-${B}`), 'longPress');
    await fireEvent.press(screen.getByTestId(`move-task-sheet-option-${BACKLOG.id}`));

    expect(await screen.findByText('Moved to Backlog')).toBeOnTheScreen();
    expect(server.moves()).toEqual([{ taskId: B, columnId: BACKLOG.id }]);
  });

  it('Mark complete on a blocked task sends nothing and shows its blockers', async () => {
    const server = scenario();
    const router = await open(`/tasks/${B}?boardId=${BOARD_ID}`);
    await fireEvent.press(await screen.findByTestId('mark-complete-button'));

    await waitFor(() => expect(router).toHavePathname(`/tasks/${B}/status`));
    expect(await screen.findByTestId(`blocker-${A}`)).toBeOnTheScreen();
    expect(server.moves()).toEqual([]);
  });

  it('Task details opens the status screen with Change status', async () => {
    scenario();
    const router = await open(`/tasks/${B}?boardId=${BOARD_ID}`);
    await fireEvent.press(await screen.findByTestId('change-status-button'));
    await waitFor(() => expect(router).toHavePathname(`/tasks/${B}/status`));
    expect(await screen.findByTestId(`blocker-${A}`)).toBeOnTheScreen();
  });
});
