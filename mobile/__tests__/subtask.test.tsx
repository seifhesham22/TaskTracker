import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { TaskNode } from '../src/api/boards';
import { CREATE_TASK_MUTATION } from '../src/api/tasks';
import BoardScreen from '../src/app/boards/[boardId]';
import { setSession } from '../src/auth/session';
import {
  PARENT_GONE,
  SUBTASK_CREATE_FAILED,
  SUBTASK_TITLE_REQUIRED,
  SUBTASK_TITLE_TOO_LONG,
} from '../src/domain/subtask';
import {
  ACCESS_TOKEN,
  API_URL,
  BOARD_ID,
  COLUMNS,
  type FakeResponse,
  boardResponse,
  gqlError,
  gqlTask,
  mockFetch,
  projectsResponse,
  taskDto,
  taskNode,
} from '../test-utils/fakeBackend';
import { meResponse, renderApp, storedSession } from '../test-utils/renderApp';
import { resetSecureStore } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));

const PARENT_ID = '01a18766-8315-7c9c-90fd-5657de973424';
const OTHER_PARENT_ID = '01a18766-8315-7c9c-90fd-5657de973499';
const NEW_ID = '01a18766-8315-7c9c-90fd-5657de973428';

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

const parent = node(24, 'Prepare the project launch', 2, {
  id: PARENT_ID,
  description: 'Agree on milestones and assign the launch checklist.',
});
const children = [
  node(25, 'Agree on launch milestones', 3, { parentTaskId: PARENT_ID }),
  node(26, 'Review the launch checklist', 1, { parentTaskId: PARENT_ID }),
  node(27, 'Confirm the release date', 1, { parentTaskId: PARENT_ID }),
];
// Tasks on the same board that are not subtasks of TES-24.
const unrelated = [
  node(30, 'Unrelated top-level task', 0),
  node(31, 'Child of another task', 0, { parentTaskId: OTHER_PARENT_ID }),
];
const created = node(28, 'Prepare the release notes', 0, { id: NEW_ID, parentTaskId: PARENT_ID });

const boardWith = (...extra: TaskNode[]): FakeResponse[] => [
  boardResponse([parent, ...children, ...unrelated, ...extra]),
  projectsResponse(),
];
const createdResponse = () => ({
  body: gqlTask(
    taskDto({
      id: NEW_ID,
      readableId: 'TES-28',
      number: 28,
      title: 'Prepare the release notes',
      parentTaskId: PARENT_ID,
      columnId: COLUMNS[0].id,
      columnName: 'Backlog',
      status: 'BACKLOG',
    }),
  ),
});

type Sent = { query: string; variables: { input: Record<string, unknown> } };
const sentBodies = (fetchMock: jest.Mock): Sent[] =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
const createCalls = (fetchMock: jest.Mock) => sentBodies(fetchMock).filter((b) => b.query === CREATE_TASK_MUTATION);

const detailsUrl = `/tasks/${PARENT_ID}?boardId=${BOARD_ID}`;

async function open(url: string, responses: FakeResponse[], routes: Record<string, unknown> = {}) {
  resetSecureStore(storedSession());
  const fetchMock = mockFetch(meResponse(), ...responses);
  const router = await renderApp(url, routes);
  return { router, fetchMock };
}

/** Parent details, then Add subtask. */
async function openCreateSubtask(...afterOpen: FakeResponse[]) {
  const opened = await open(detailsUrl, [...boardWith(), ...boardWith(), ...afterOpen]);
  await fireEvent.press(await screen.findByRole('button', { name: 'Add subtask' }));
  await screen.findByTestId('subtask-title-input');
  return opened;
}

async function submit(title: string) {
  await fireEvent.changeText(screen.getByTestId('subtask-title-input'), title);
  await fireEvent.press(screen.getByTestId('create-subtask-button'));
}

const subtaskTitles = () =>
  within(screen.getByTestId('subtasks'))
    .queryAllByRole('button')
    .map((b) => b.props.accessibilityLabel as string);

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
});

describe('Parent task: subtasks', () => {
  it('lists only this task’s subtasks, indented, with their key, status and progress', async () => {
    await open(detailsUrl, boardWith());

    expect(await screen.findByText('Prepare the project launch')).toBeOnTheScreen();
    expect(screen.getByTestId('task-status')).toHaveTextContent('◐ In progress');
    expect(screen.getByText('Subtasks')).toBeOnTheScreen();
    expect(screen.getByTestId('subtask-progress')).toHaveTextContent('1 / 3 done');
    expect(subtaskTitles()).toEqual([
      'TES-25, Done, Agree on launch milestones',
      'TES-26, To do, Review the launch checklist',
      'TES-27, To do, Confirm the release date',
    ]);
    const done = screen.getByTestId(`subtask-${children[0].id}`);
    expect(within(done).getByText('TES-25 · Done')).toBeOnTheScreen();
    expect(within(done).getByText('✓ Agree on launch milestones')).toBeOnTheScreen();
    expect(within(screen.getByTestId(`subtask-${children[1].id}`)).getByText('○ Review the launch checklist')).toBeOnTheScreen();
    expect(screen.queryByText(/Unrelated top-level task|Child of another task/)).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add subtask' })).toBeOnTheScreen();
  });

  it('shows a subtask’s parent, and opens it', async () => {
    const { router } = await open(`/tasks/${children[1].id}?boardId=${BOARD_ID}`, [...boardWith(), ...boardWith()]);

    const link = await screen.findByTestId('parent-link');
    expect(link).toHaveTextContent('Subtask of TES-24 · Prepare the project launch');
    expect(screen.getByTestId('subtask-progress')).toHaveTextContent('0 / 0 done');

    await fireEvent.press(link);

    await waitFor(() => expect(router).toHavePathname(`/tasks/${PARENT_ID}`));
    expect(await screen.findByTestId('subtask-progress')).toHaveTextContent('1 / 3 done');
  });

  it('labels subtasks on the board with their parent, and not top-level tasks', async () => {
    await open(`/boards/${BOARD_ID}`, boardWith(), { 'boards/[boardId]': BoardScreen });

    await fireEvent.press(await screen.findByRole('tab', { name: /^To do/ }));
    expect(await screen.findByTestId(`task-parent-${children[1].id}`)).toHaveTextContent('↳ Subtask of TES-24');
    await fireEvent.press(screen.getByRole('tab', { name: /^Backlog/ }));
    // Its parent isn't on this board, so the card can only say that it is a subtask.
    expect(await screen.findByTestId(`task-parent-${unrelated[1].id}`)).toHaveTextContent('↳ Subtask');
    expect(screen.queryByTestId(`task-parent-${unrelated[0].id}`)).not.toBeOnTheScreen();
  });
});

describe('Create subtask', () => {
  it('opens from the parent with the design’s form, fixed to that parent', async () => {
    const { router, fetchMock } = await openCreateSubtask();

    expect(router).toHavePathname(`/tasks/${PARENT_ID}/subtask`);
    expect(screen.getByRole('header', { name: 'Create subtask' })).toBeOnTheScreen();
    expect(screen.getByTestId('task-breadcrumb')).toHaveTextContent('TEST PROJECT / TES-24');
    expect(screen.getByText('PARENT TASK')).toBeOnTheScreen();
    expect(within(screen.getByTestId('parent-task')).getByText('TES-24 · Prepare the project launch')).toBeOnTheScreen();
    expect(screen.getByText('Subtask title *')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Enter a subtask title')).toBeOnTheScreen();
    expect(screen.getByTestId('subtask-title-input').props.autoFocus).toBe(true);
    expect(screen.getByText('The new subtask will appear under TES-24.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create subtask' })).toBeOnTheScreen();
    expect(createCalls(fetchMock)).toHaveLength(0);
  });

  it('creates the subtask under its parent with the real createTask mutation and lists it from a fresh query', async () => {
    const { router, fetchMock } = await openCreateSubtask(createdResponse(), ...boardWith(created));

    await submit('  Prepare the release notes  ');

    expect(await screen.findByText('Subtask created')).toBeOnTheScreen();
    await waitFor(() => expect(router).toHavePathname(`/tasks/${PARENT_ID}`));
    await waitFor(() => expect(screen.getByTestId('subtask-progress')).toHaveTextContent('1 / 4 done'));
    expect(subtaskTitles()).toContain('TES-28, Backlog, Prepare the release notes');

    const [create] = createCalls(fetchMock);
    expect(create.variables.input).toEqual({
      boardId: BOARD_ID,
      title: 'Prepare the release notes',
      parentTaskId: PARENT_ID,
    });
    const index = sentBodies(fetchMock).findIndex((b) => b.query === CREATE_TASK_MUTATION);
    expect(((fetchMock.mock.calls[index][1] as RequestInit).headers as Headers).get('Authorization')).toBe(
      `Bearer ${ACCESS_TOKEN}`,
    );
    // The list came from the board being read again after the mutation.
    expect(fetchMock.mock.calls.length).toBe(index + 3);
  });

  it('still lists the new subtask after leaving and reopening the parent', async () => {
    const { router } = await openCreateSubtask(createdResponse(), ...boardWith(created), ...boardWith(created), ...boardWith(created));
    await submit('Prepare the release notes');
    await screen.findByText('Subtask created');

    await fireEvent.press(await screen.findByTestId(`subtask-${NEW_ID}`));
    await waitFor(() => expect(router).toHavePathname(`/tasks/${NEW_ID}`));
    await fireEvent.press(await screen.findByTestId('parent-link'));

    await waitFor(() => expect(router).toHavePathname(`/tasks/${PARENT_ID}`));
    await waitFor(() => expect(subtaskTitles()).toContain('TES-28, Backlog, Prepare the release notes'));
    expect(screen.getByTestId('subtask-progress')).toHaveTextContent('1 / 4 done');
  });

  it('rejects an empty title without sending anything, and clears the message once one is typed', async () => {
    const { fetchMock } = await openCreateSubtask();

    await submit('   ');

    expect(screen.getByTestId('subtask-title-error')).toHaveTextContent(SUBTASK_TITLE_REQUIRED);
    expect(createCalls(fetchMock)).toHaveLength(0);
    await fireEvent.changeText(screen.getByTestId('subtask-title-input'), 'Prepare');
    expect(screen.queryByTestId('subtask-title-error')).not.toBeOnTheScreen();
  });

  it('rejects a title longer than the backend’s 200 characters', async () => {
    const { fetchMock } = await openCreateSubtask();

    await submit('x'.repeat(201));

    expect(screen.getByTestId('subtask-title-error')).toHaveTextContent(SUBTASK_TITLE_TOO_LONG);
    expect(createCalls(fetchMock)).toHaveLength(0);
  });

  it('shows the backend’s title refusal under the field', async () => {
    await openCreateSubtask({ body: gqlError('BAD_USER_INPUT', 'Title cannot be empty or only spaces.') });

    await submit('Prepare the release notes');

    expect(await screen.findByTestId('subtask-title-error')).toHaveTextContent(SUBTASK_TITLE_REQUIRED);
    expect(screen.queryByTestId('form-error')).not.toBeOnTheScreen();
  });

  it('explains a parent the backend no longer finds', async () => {
    await openCreateSubtask({ body: gqlError('NOT_FOUND', `Parent task '${PARENT_ID}' was not found.`) });

    await submit('Prepare the release notes');

    expect(await screen.findByTestId('form-error')).toHaveTextContent(PARENT_GONE);
  });

  it.each([
    ['the server can’t be reached', 'network-error' as const],
    ['the server fails', { status: 500, body: { errors: [{ message: 'Unexpected Execution Error' }] } }],
  ])('keeps the title and adds nothing when %s', async (_, failure) => {
    const { router } = await openCreateSubtask(failure as FakeResponse, ...boardWith());

    await submit('Prepare the release notes');

    expect(await screen.findByTestId('form-error')).toHaveTextContent(SUBTASK_CREATE_FAILED);
    expect(router).toHavePathname(`/tasks/${PARENT_ID}/subtask`);
    expect(screen.getByTestId('subtask-title-input').props.value).toBe('Prepare the release notes');
    expect(screen.getByTestId('cancel-button')).toBeEnabled();
    expect(screen.getByTestId('create-subtask-button')).toBeEnabled();

    await fireEvent.press(screen.getByTestId('cancel-button'));
    await waitFor(() => expect(router).toHavePathname(`/tasks/${PARENT_ID}`));
    await waitFor(() => expect(screen.getByTestId('subtask-progress')).toHaveTextContent('1 / 3 done'));
    expect(screen.queryByText('Subtask created')).not.toBeOnTheScreen();
  });

  it('shows “Creating…”, locks the form and sends one request however often it is tapped', async () => {
    const { fetchMock } = await openCreateSubtask();
    let answer!: (value: unknown) => void;
    const pending = jest.fn(() => new Promise((resolve) => (answer = resolve)));
    globalThis.fetch = pending as unknown as typeof fetch;

    await submit('Prepare the release notes');
    await fireEvent.press(screen.getByTestId('create-subtask-button'));
    await fireEvent(screen.getByTestId('subtask-title-input'), 'submitEditing');

    expect(screen.getByText('Creating…')).toBeOnTheScreen();
    expect(screen.getByTestId('create-subtask-button')).toBeDisabled();
    expect(screen.getByTestId('cancel-button')).toBeDisabled();
    expect(screen.getByTestId('subtask-title-input').props.editable).toBe(false);
    expect(pending).toHaveBeenCalledTimes(1);
    expect(createCalls(fetchMock)).toHaveLength(0);

    mockFetch(...boardWith(created));
    answer({ ok: true, status: 200, text: async () => JSON.stringify(createdResponse().body) });
    expect(await screen.findByText('Subtask created')).toBeOnTheScreen();
  });

  it('Cancel goes back to the unchanged parent without creating anything', async () => {
    const { router, fetchMock } = await openCreateSubtask(...boardWith());
    await fireEvent.changeText(screen.getByTestId('subtask-title-input'), 'Not wanted');

    await fireEvent.press(screen.getByTestId('cancel-button'));

    await waitFor(() => expect(router).toHavePathname(`/tasks/${PARENT_ID}`));
    await waitFor(() => expect(screen.getByTestId('subtask-progress')).toHaveTextContent('1 / 3 done'));
    expect(screen.queryByText('Not wanted')).not.toBeOnTheScreen();
    expect(screen.queryByText('Subtask created')).not.toBeOnTheScreen();
    expect(createCalls(fetchMock)).toHaveLength(0);
  });
});
