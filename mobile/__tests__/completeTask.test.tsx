import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { TaskNode } from '../src/api/boards';
import { MOVE_TASK_MUTATION } from '../src/api/tasks';
import { setSession } from '../src/auth/session';
import {
  BLOCKED_EXPLANATION,
  COMPLETE_FAILED,
  COMPLETE_NETWORK_FAILED,
  NO_DONE_COLUMN,
  remainingSubtasks,
} from '../src/domain/completeTask';
import {
  API_URL,
  BOARD_ID,
  BOARD_NODE,
  COLUMNS,
  type FakeResponse,
  boardResponse,
  mockFetch,
  movedTaskResponse,
  projectsResponse,
  taskNode,
} from '../test-utils/fakeBackend';
import { meResponse, renderApp, storedSession } from '../test-utils/renderApp';
import { resetSecureStore } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

const PARENT_ID = '01a18766-8315-7c9c-90fd-5657de973424';
const DONE_COLUMN = COLUMNS[3];

const inColumn = (index: number) => ({
  columnId: COLUMNS[index].id,
  status: COLUMNS[index].category,
  column: { id: COLUMNS[index].id, name: COLUMNS[index].name, category: COLUMNS[index].category },
});
const node = (number: number, title: string, column: number, overrides: Partial<TaskNode> = {}) =>
  taskNode({
    id: `01a18766-8315-7c9c-90fd-5657de9734${String(number).padStart(2, '0')}`,
    number,
    readableId: `TES-${number}`,
    title,
    description: null,
    priority: null,
    dueDate: null,
    assignees: [],
    parentTaskId: null,
    ...inColumn(column),
    ...overrides,
  });

const parent = (column = 2) =>
  node(24, 'Prepare the project launch', column, {
    id: PARENT_ID,
    description: 'Agree on milestones and assign the launch checklist.',
  });
/** TES-25, 26 and 27, done or to do as given. */
const children = (...done: boolean[]) =>
  [
    [25, 'Agree on launch milestones'],
    [26, 'Review the launch checklist'],
    [27, 'Confirm the release date'],
  ].map(([n, title], i) => node(n as number, title as string, done[i] ? 3 : 1, { parentTaskId: PARENT_ID }));

const read = (...tasks: TaskNode[]): FakeResponse[] => [boardResponse(tasks), projectsResponse()];

/** The backend's refusal (TaskCompletionGuard + DomainErrorFilter). */
const refused = (open: TaskNode[]) => ({
  body: {
    data: null,
    errors: [
      {
        message: `TES-24 can't be completed while ${open.length === 1 ? 'this subtask is' : `these ${open.length} subtasks are`} not done: ${open.map((t) => `${t.readableId} (${t.title})`).join(', ')}.`,
        extensions: {
          code: 'BAD_USER_INPUT',
          incompleteSubtasks: open.map((t) => ({ id: t.id, readableId: t.readableId, title: t.title })),
        },
      },
    ],
  },
});

type Sent = { query: string; variables: { input: Record<string, unknown> } };
const moveCalls = (fetchMock: jest.Mock): Sent[] =>
  fetchMock.mock.calls
    .map(([, init]) => JSON.parse((init as RequestInit).body as string) as Sent)
    .filter((b) => b.query === MOVE_TASK_MUTATION);

async function openTask(id: string, ...responses: FakeResponse[]) {
  resetSecureStore(storedSession());
  const fetchMock = mockFetch(meResponse(), ...responses);
  const router = await renderApp(`/tasks/${id}?boardId=${BOARD_ID}`);
  await screen.findByTestId('task-title');
  return { router, fetchMock };
}

const markComplete = () => fireEvent.press(screen.getByTestId('mark-complete-button'));
const incompleteLabels = () =>
  within(screen.getByTestId('completion-blocked'))
    .getAllByRole('button', { name: /^Open subtask/ })
    .map((b) => b.props.accessibilityLabel as string);

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
});

describe('A parent with open subtasks can’t be completed', () => {
  it('shows the backend’s refusal with the two open subtasks, and keeps the parent in progress', async () => {
    const kids = children(true, false, false);
    const { fetchMock } = await openTask(PARENT_ID, ...read(parent(), ...kids), refused(kids.slice(1)), ...read(parent(), ...kids));
    expect(screen.getByTestId('subtask-progress')).toHaveTextContent('1 / 3 done');
    expect(screen.getByRole('button', { name: 'Mark complete' })).toBeEnabled();

    await markComplete();

    expect(await screen.findByTestId('completion-blocked-title')).toHaveTextContent('Complete 2 subtasks first');
    expect(screen.getByText(BLOCKED_EXPLANATION)).toBeOnTheScreen();
    expect(screen.getByText('Incomplete subtasks')).toBeOnTheScreen();
    expect(screen.getByTestId('incomplete-count')).toHaveTextContent('2 remaining');
    expect(incompleteLabels()).toEqual([
      'Open subtask TES-26, Review the launch checklist',
      'Open subtask TES-27, Confirm the release date',
    ]);
    const first = screen.getByTestId(`incomplete-${kids[1].id}`);
    expect(within(first).getByText('TES-26 · To do')).toBeOnTheScreen();
    expect(within(first).getByText('Open subtask →')).toBeOnTheScreen();
    expect(screen.getByText('Open each subtask above to finish the remaining work, then return to this parent.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Back to task' })).toBeOnTheScreen();

    // Nothing says it worked, and the parent's status is the one it had.
    expect(screen.getByTestId('task-status')).toHaveTextContent('◐ In progress');
    expect(screen.queryByText('Task completed')).not.toBeOnTheScreen();
    expect(screen.queryByText(/Agree on launch milestones/)).not.toBeOnTheScreen();

    expect(moveCalls(fetchMock)).toHaveLength(1);
    expect(moveCalls(fetchMock)[0].variables.input).toEqual({ taskId: PARENT_ID, columnId: DONE_COLUMN.id });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));
  });

  it('says “Complete 1 subtask first” when one is open', async () => {
    const kids = children(true, true, false);
    await openTask(PARENT_ID, ...read(parent(), ...kids), refused([kids[2]]), ...read(parent(), ...kids));

    await markComplete();

    expect(await screen.findByTestId('completion-blocked-title')).toHaveTextContent('Complete 1 subtask first');
    expect(screen.getByTestId('incomplete-count')).toHaveTextContent('1 remaining');
    expect(incompleteLabels()).toEqual(['Open subtask TES-27, Confirm the release date']);
  });

  it('goes back to the task from the refusal, still not completed', async () => {
    const kids = children(true, false, false);
    await openTask(PARENT_ID, ...read(parent(), ...kids), refused(kids.slice(1)), ...read(parent(), ...kids));
    await markComplete();

    await fireEvent.press(await screen.findByRole('button', { name: 'Back to task' }));

    expect(screen.queryByTestId('completion-blocked')).not.toBeOnTheScreen();
    expect(screen.getByTestId('subtask-progress')).toHaveTextContent('1 / 3 done');
    expect(screen.getByRole('button', { name: 'Mark complete' })).toBeEnabled();
    expect(screen.getByTestId('task-status')).toHaveTextContent('◐ In progress');
  });

  it('finds the open subtasks itself when the refusal doesn’t list them', async () => {
    const kids = children(true, false, false);
    const bare = { body: { data: null, errors: [{ message: 'TES-24 can’t be completed.', extensions: { code: 'BAD_USER_INPUT', incompleteSubtasks: [] } }] } };
    await openTask(PARENT_ID, ...read(parent(), ...kids), bare, ...read(parent(), ...kids));

    await markComplete();

    await waitFor(() => expect(screen.getByTestId('incomplete-count')).toHaveTextContent('2 remaining'));
    expect(incompleteLabels()).toHaveLength(2);
  });
});

describe('Finishing the subtasks, then the parent', () => {
  it('opens an open subtask, and on return shows only what is still open; with none left, the parent completes', async () => {
    const before = children(true, false, false);
    const afterOne = children(true, true, false);
    const afterAll = children(true, true, true);
    const { router, fetchMock } = await openTask(
      PARENT_ID,
      ...read(parent(), ...before),
      refused(before.slice(1)),
      ...read(parent(), ...before),
      // Open TES-26 from the refusal and finish it there.
      ...read(parent(), ...before),
      movedTaskResponse(afterOne[1]),
      ...read(parent(), ...afterOne),
      // Back on the parent: read again.
      ...read(parent(), ...afterOne),
    );
    await markComplete();
    await screen.findByTestId('completion-blocked');

    await fireEvent.press(screen.getByTestId(`incomplete-${before[1].id}`));
    await waitFor(() => expect(router).toHavePathname(`/tasks/${before[1].id}`));
    expect(await screen.findByTestId('parent-link')).toHaveTextContent(/^Subtask of TES-24/);
    await markComplete();
    expect(await screen.findByText('Task completed')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('close-button'));
    await waitFor(() => expect(router).toHavePathname(`/tasks/${PARENT_ID}`));

    // The child just finished is gone from the list; one remains.
    await waitFor(() => expect(screen.getByTestId('completion-blocked-title')).toHaveTextContent('Complete 1 subtask first'));
    expect(incompleteLabels()).toEqual(['Open subtask TES-27, Confirm the release date']);
    expect(screen.getByTestId('task-status')).toHaveTextContent('◐ In progress');

    // Finish TES-27 too, then return: nothing is open, so the refusal clears by itself.
    const last = mockFetch(
      ...read(parent(), ...afterOne),
      movedTaskResponse(afterAll[2]),
      ...read(parent(), ...afterAll),
      ...read(parent(), ...afterAll),
      movedTaskResponse(parent(3)),
      ...read(parent(3), ...afterAll),
    );
    await fireEvent.press(screen.getByTestId(`incomplete-${before[2].id}`));
    await waitFor(() => expect(router).toHavePathname(`/tasks/${before[2].id}`));
    await screen.findByTestId('parent-link');
    await markComplete();
    expect(await screen.findByText('Task completed')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('close-button'));
    await waitFor(() => expect(router).toHavePathname(`/tasks/${PARENT_ID}`));

    await waitFor(() => expect(screen.queryByTestId('completion-blocked')).not.toBeOnTheScreen());
    expect(screen.getByTestId('all-subtasks-done')).toHaveTextContent('All subtasks are complete.');
    expect(screen.getByTestId('subtask-progress')).toHaveTextContent('3 / 3 done');

    await markComplete();
    expect(await screen.findByText('Task completed')).toBeOnTheScreen();
    expect(screen.getByTestId('task-status')).toHaveTextContent('✓ Done');
    expect(moveCalls(fetchMock)).toHaveLength(2);
    expect(moveCalls(last).map((c) => c.variables.input.taskId)).toEqual([before[2].id, PARENT_ID]);
  });

  it('shows “All subtasks are complete.” and completes the parent only after the backend accepts', async () => {
    const kids = children(true, true, true);
    const { fetchMock } = await openTask(
      PARENT_ID,
      ...read(parent(), ...kids),
      movedTaskResponse(parent(3)),
      ...read(parent(3), ...kids),
    );
    expect(screen.getByTestId('all-subtasks-done')).toHaveTextContent('All subtasks are complete.');
    expect(screen.getByTestId('subtask-progress')).toHaveTextContent('3 / 3 done');

    await markComplete();

    expect(await screen.findByText('Task completed')).toBeOnTheScreen();
    expect(screen.getByTestId('task-status')).toHaveTextContent('✓ Done');
    expect(screen.getByTestId('mark-complete-button')).toBeDisabled();
    expect(screen.getByText('Completed')).toBeOnTheScreen();
    expect(screen.queryByTestId('all-subtasks-done')).not.toBeOnTheScreen();
    expect(screen.getByTestId('subtask-progress')).toHaveTextContent('3 / 3 done');
    expect(moveCalls(fetchMock)[0].variables.input).toEqual({ taskId: PARENT_ID, columnId: DONE_COLUMN.id });
    // Read again from the backend afterwards.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));
  });

  it('shows “Completing…” and sends one request however often it is tapped', async () => {
    const kids = children(true, true, true);
    await openTask(PARENT_ID, ...read(parent(), ...kids));
    let answer!: (value: unknown) => void;
    const pending = jest.fn(() => new Promise((resolve) => (answer = resolve)));
    globalThis.fetch = pending as unknown as typeof fetch;

    await markComplete();
    await markComplete();

    expect(screen.getByText('Completing…')).toBeOnTheScreen();
    expect(screen.getByTestId('mark-complete-button')).toBeDisabled();
    expect(screen.getByTestId('add-subtask-button')).toBeDisabled();
    expect(screen.getByTestId('task-status')).toHaveTextContent('◐ In progress');
    expect(pending).toHaveBeenCalledTimes(1);

    mockFetch(...read(parent(3), ...kids));
    answer({ ok: true, status: 200, text: async () => JSON.stringify(movedTaskResponse(parent(3)).body) });
    expect(await screen.findByText('Task completed')).toBeOnTheScreen();
  });

  it('completes a task without subtasks normally', async () => {
    const solo = node(30, 'Write the press release', 2);
    const { fetchMock } = await openTask(solo.id, ...read(solo), movedTaskResponse(node(30, 'Write the press release', 3)), ...read(node(30, 'Write the press release', 3)));
    expect(screen.queryByTestId('all-subtasks-done')).not.toBeOnTheScreen();

    await markComplete();

    expect(await screen.findByText('Task completed')).toBeOnTheScreen();
    expect(screen.getByTestId('task-status')).toHaveTextContent('✓ Done');
    expect(moveCalls(fetchMock)[0].variables.input).toEqual({ taskId: solo.id, columnId: DONE_COLUMN.id });
  });

  it('shows a task that is already done as Completed', async () => {
    await openTask(PARENT_ID, ...read(parent(3), ...children(true, true, true)));

    expect(screen.getByTestId('task-status')).toHaveTextContent('✓ Done');
    expect(screen.getByTestId('mark-complete-button')).toBeDisabled();
    expect(screen.queryByText('Task completed')).not.toBeOnTheScreen();
  });
});

describe('Errors', () => {
  it.each([
    ['the server can’t be reached', 'network-error' as const, COMPLETE_NETWORK_FAILED],
    ['the server fails', { status: 500, body: { errors: [{ message: 'Unexpected Execution Error' }] } }, COMPLETE_FAILED],
  ])('keeps the status and offers a retry when %s', async (_, failure, message) => {
    const kids = children(true, true, true);
    await openTask(PARENT_ID, ...read(parent(), ...kids), failure as FakeResponse, ...read(parent(), ...kids));

    await markComplete();

    expect(await screen.findByTestId('form-error')).toHaveTextContent(message);
    expect(screen.getByTestId('task-status')).toHaveTextContent('◐ In progress');
    expect(screen.queryByText('Task completed')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('completion-blocked')).not.toBeOnTheScreen();

    mockFetch(movedTaskResponse(parent(3)), ...read(parent(3), ...kids));
    await markComplete();
    expect(await screen.findByText('Task completed')).toBeOnTheScreen();
    expect(screen.queryByTestId('form-error')).not.toBeOnTheScreen();
  });

  it('explains a board without a Done column, without sending anything', async () => {
    const noDone = { body: { data: { board: { ...BOARD_NODE, columns: BOARD_NODE.columns.slice(0, 3) }, tasks: [parent()] } } };
    const { fetchMock } = await openTask(PARENT_ID, noDone, projectsResponse());

    await markComplete();

    expect(screen.getByTestId('form-error')).toHaveTextContent(NO_DONE_COLUMN);
    expect(moveCalls(fetchMock)).toHaveLength(0);
  });
});

describe('remainingSubtasks', () => {
  const [, open1, open2] = children(true, false, false);
  const listed = [open1, open2].map((t) => ({ id: t.id, readableId: t.readableId, title: t.title }));
  const asTask = (n: TaskNode, done = false) => ({
    id: n.id,
    readableId: n.readableId,
    number: n.number,
    boardId: BOARD_ID,
    title: n.title,
    description: null,
    status: done ? ('DONE' as const) : ('TO_DO' as const),
    columnId: '',
    columnName: '',
    priority: null,
    assigneeIds: [],
    dueDate: null,
  });

  it('drops children that are done now, keeps ones it can’t see, and adds new open ones', () => {
    const added = node(29, 'New open child', 1, { parentTaskId: PARENT_ID });
    expect(remainingSubtasks(listed, [asTask(open1, true), asTask(added)]).map((s) => s.readableId)).toEqual(['TES-27', 'TES-29']);
    expect(remainingSubtasks(listed, [asTask(open1, true), asTask(open2, true)])).toEqual([]);
  });
});
