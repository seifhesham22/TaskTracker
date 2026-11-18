import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { TaskNode } from '../src/api/boards';
import { UPDATE_TASK_MUTATION } from '../src/api/tasks';
import BoardScreen from '../src/app/boards/[boardId]';
import { setSession } from '../src/auth/session';
import { TITLE_REQUIRED, TITLE_TOO_LONG } from '../src/domain/createTaskErrors';
import { DUE_BEFORE_START, INVALID_DATE, SAVE_FAILED, TASK_GONE, validateEditTask } from '../src/domain/editTask';
import {
  ACCESS_TOKEN,
  API_URL,
  BOARD_ID,
  COLUMNS,
  type FakeResponse,
  gqlError,
  mockFetch,
  boardResponse,
  projectsResponse,
  taskNode,
} from '../test-utils/fakeBackend';
import { meResponse, renderApp, storedSession } from '../test-utils/renderApp';
import { resetSecureStore } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

// The date picker shows one button; pressing it picks whatever date the test set last.
let mockPickedDate = new Date(2026, 10, 3);
jest.mock('@react-native-community/datetimepicker', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text: RNText } = jest.requireActual('react-native');
  const Picker = ({ onChange, testID }: { onChange: (e: { type: string }, d: Date) => void; testID?: string }) =>
    React.createElement(
      Pressable,
      { testID, onPress: () => onChange({ type: 'set' }, mockPickedDate) },
      React.createElement(RNText, null, 'Pick date'),
    );
  return { __esModule: true, default: Picker, DateTimePickerAndroid: { open: jest.fn() } };
});

const TASK_ID = '01a18766-8315-7c9c-90fd-5657de973424';

const savedTask = (overrides: Partial<TaskNode> = {}) =>
  taskNode({
    id: TASK_ID,
    number: 24,
    readableId: 'TES-24',
    title: 'Plan the project launch',
    description: 'Agree on milestones and assign the launch checklist.',
    priority: 'MEDIUM',
    startDate: '2026-11-16T00:00:00.000Z',
    dueDate: '2026-11-20T00:00:00.000Z',
    columnId: COLUMNS[0].id,
    status: 'BACKLOG',
    column: { id: COLUMNS[0].id, name: 'Backlog', category: 'BACKLOG' },
    assignees: [],
    ...overrides,
  });

/** What the backend returns for the task: the board, its tasks and the project's name. */
const taskResponses = (node: TaskNode = savedTask()): FakeResponse[] => [boardResponse([node]), projectsResponse()];
const updatedResponse = (node: TaskNode) => ({ body: { data: { updateTask: node } } });

type Sent = { query: string; variables: { input: Record<string, unknown> } };
const sentBodies = (fetchMock: jest.Mock): Sent[] =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
const updateCalls = (fetchMock: jest.Mock) => sentBodies(fetchMock).filter((b) => b.query === UPDATE_TASK_MUTATION);

const detailsUrl = `/tasks/${TASK_ID}?boardId=${BOARD_ID}`;
const editUrl = `/tasks/${TASK_ID}/edit?boardId=${BOARD_ID}`;

/** Signed in (session restored with `me`), opening `url`. */
async function open(url: string, ...responses: FakeResponse[]) {
  return openWith({}, url, ...responses);
}

async function openWith(routes: Record<string, unknown>, url: string, ...responses: FakeResponse[]) {
  resetSecureStore(storedSession());
  const fetchMock = mockFetch(meResponse(), ...responses);
  const router = await renderApp(url, routes);
  return { router, fetchMock };
}

async function openEditForm(...extra: FakeResponse[]) {
  const opened = await open(editUrl, ...taskResponses(), ...extra);
  await screen.findByDisplayValue('Plan the project launch');
  return opened;
}

async function pickDate(field: 'start-date' | 'due-date', date: Date) {
  mockPickedDate = date;
  await fireEvent.press(screen.getByTestId(field));
  await fireEvent.press(screen.getByTestId(`${field}-picker`));
  await fireEvent.press(screen.getByTestId(`${field}-done`));
}

async function choosePriority(label: string) {
  await fireEvent.press(screen.getByTestId('priority-select'));
  await fireEvent.press(within(screen.getByTestId('priority-sheet')).getByRole('button', { name: label }));
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
});

describe('Edit task screen', () => {
  it('shows the design’s form, filled with the task as the backend has it', async () => {
    const { fetchMock } = await openEditForm();

    expect(screen.getByText('Edit task')).toBeOnTheScreen();
    expect(screen.getByTestId('task-breadcrumb')).toHaveTextContent('TEST PROJECT / TES-24');
    expect(screen.getByText('Title *')).toBeOnTheScreen();
    expect(screen.getByTestId('title-input').props.value).toBe('Plan the project launch');
    expect(screen.getByTestId('title-counter')).toHaveTextContent('23 / 200 characters');
    expect(screen.getByTestId('description-input').props.value).toBe(
      'Agree on milestones and assign the launch checklist.',
    );
    expect(screen.getByTestId('priority-select')).toHaveTextContent('Medium');
    expect(screen.getByTestId('start-date')).toHaveTextContent('Nov 16, 2026');
    expect(screen.getByTestId('due-date')).toHaveTextContent('Nov 20, 2026');
    expect(screen.getByText('Only Title is required.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
    // Nothing changed yet, so there is nothing to save.
    expect(screen.getByTestId('save-button')).toBeDisabled();
    expect(updateCalls(fetchMock)).toHaveLength(0);
  });

  it('shows grey placeholders and “Loading…” until the task arrives', async () => {
    resetSecureStore(storedSession());
    let answer!: (value: unknown) => void;
    const pending = new Promise((resolve) => (answer = resolve));
    const queue: (() => Promise<unknown>)[] = [
      async () => ({ ok: true, status: 200, text: async () => JSON.stringify(meResponse().body) }),
      () => pending,
      async () => ({ ok: true, status: 200, text: async () => JSON.stringify(projectsResponse().body) }),
    ];
    globalThis.fetch = jest.fn(() => queue.shift()!()) as unknown as typeof fetch;
    await renderApp(editUrl);

    expect(await screen.findByTestId('task-form-skeleton')).toBeOnTheScreen();
    expect(screen.getByText('Loading…')).toBeOnTheScreen();
    expect(screen.getByTestId('save-button')).toBeDisabled();

    answer({ ok: true, status: 200, text: async () => JSON.stringify(boardResponse([savedTask()]).body) });
    expect(await screen.findByDisplayValue('Plan the project launch')).toBeOnTheScreen();
  });

  it('saves all five fields with the real updateTask mutation and shows what the backend saved', async () => {
    const changed = savedTask({
      title: 'Prepare the project launch',
      description: 'Book the venue.',
      priority: 'HIGH',
      startDate: '2026-11-17T00:00:00.000Z',
      dueDate: '2026-11-25T00:00:00.000Z',
    });
    const { router, fetchMock } = await open(
      detailsUrl,
      ...taskResponses(),
      ...taskResponses(),
      updatedResponse(changed),
      ...taskResponses(changed),
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit task' }));
    await screen.findByDisplayValue('Plan the project launch');

    await fireEvent.changeText(screen.getByTestId('title-input'), '  Prepare the project launch ');
    expect(screen.getByTestId('title-counter')).toHaveTextContent('26 / 200 characters');
    await fireEvent.changeText(screen.getByTestId('description-input'), 'Book the venue.');
    await choosePriority('High');
    expect(screen.getByTestId('priority-select')).toHaveTextContent('High');
    await pickDate('start-date', new Date(2026, 10, 17));
    expect(screen.getByTestId('start-date')).toHaveTextContent('Nov 17, 2026');
    await pickDate('due-date', new Date(2026, 10, 25));
    expect(screen.getByTestId('due-date')).toHaveTextContent('Nov 25, 2026');
    expect(screen.getByTestId('save-button')).toBeEnabled();

    await fireEvent.press(screen.getByTestId('save-button'));

    // Back on Task details, read again from the backend.
    expect(await screen.findByText('Task updated')).toBeOnTheScreen();
    await waitFor(() => expect(router).toHavePathname(`/tasks/${TASK_ID}`));
    expect(screen.getByText('Task details')).toBeOnTheScreen();
    expect(await screen.findByText('Prepare the project launch')).toBeOnTheScreen();
    expect(screen.getByTestId('task-description')).toHaveTextContent('Book the venue.');
    expect(screen.getByTestId('task-priority')).toHaveTextContent('Priority: High');
    expect(screen.getByTestId('task-start-date')).toHaveTextContent('Start date: Nov 17, 2026');
    expect(screen.getByTestId('task-due-date')).toHaveTextContent('Due date: Nov 25, 2026');

    const [update] = updateCalls(fetchMock);
    expect(update.variables.input).toEqual({
      taskId: TASK_ID,
      title: 'Prepare the project launch',
      description: 'Book the venue.',
      priority: 'HIGH',
      startDate: '2026-11-17T00:00:00Z',
      dueDate: '2026-11-25T00:00:00Z',
    });
    const updateIndex = sentBodies(fetchMock).findIndex((b) => b.query === UPDATE_TASK_MUTATION);
    expect(((fetchMock.mock.calls[updateIndex][1] as RequestInit).headers as Headers).get('Authorization')).toBe(
      `Bearer ${ACCESS_TOKEN}`,
    );
    // The details screen asked the backend again after saving.
    expect(fetchMock.mock.calls.length).toBe(updateIndex + 3);
  });

  it('sends only the fields that changed, so the others keep their saved values', async () => {
    const { fetchMock } = await openEditForm(updatedResponse(savedTask({ title: 'Prepare the project launch' })), ...taskResponses());

    await fireEvent.changeText(screen.getByTestId('title-input'), 'Prepare the project launch');
    await fireEvent.press(screen.getByTestId('save-button'));

    await waitFor(() => expect(updateCalls(fetchMock)).toHaveLength(1));
    expect(updateCalls(fetchMock)[0].variables.input).toEqual({ taskId: TASK_ID, title: 'Prepare the project launch' });
  });

  it('can clear the description, the priority and a date, sending null as the backend expects', async () => {
    const { fetchMock } = await openEditForm(
      updatedResponse(savedTask({ description: null, priority: null, startDate: null })),
      ...taskResponses(),
    );

    await fireEvent.changeText(screen.getByTestId('description-input'), '   ');
    await choosePriority('No priority');
    await fireEvent.press(screen.getByTestId('start-date'));
    await fireEvent.press(screen.getByTestId('start-date-clear'));
    expect(screen.getByTestId('start-date')).toHaveTextContent('Pick a date');
    await fireEvent.press(screen.getByTestId('save-button'));

    await waitFor(() => expect(updateCalls(fetchMock)).toHaveLength(1));
    expect(updateCalls(fetchMock)[0].variables.input).toEqual({
      taskId: TASK_ID,
      description: null,
      priority: null,
      startDate: null,
    });
  });

  it('shows “Saving…”, locks the form and sends one request however often Save is tapped', async () => {
    const { fetchMock } = await openEditForm();
    let answer!: (value: unknown) => void;
    const saving = jest.fn(() => new Promise((resolve) => (answer = resolve)));
    globalThis.fetch = saving as unknown as typeof fetch;

    await fireEvent.changeText(screen.getByTestId('title-input'), 'Prepare the project launch');
    await fireEvent.press(screen.getByTestId('save-button'));
    await fireEvent.press(screen.getByTestId('save-button'));

    expect(screen.getByText('Saving…')).toBeOnTheScreen();
    expect(screen.getByTestId('save-button')).toBeDisabled();
    expect(screen.getByTestId('cancel-button')).toBeDisabled();
    expect(screen.getByTestId('title-input').props.editable).toBe(false);
    expect(screen.getByTestId('description-input').props.editable).toBe(false);
    expect(screen.getByTestId('priority-select')).toBeDisabled();
    expect(screen.getByTestId('start-date')).toBeDisabled();
    expect(saving).toHaveBeenCalledTimes(1);
    expect(updateCalls(fetchMock)).toHaveLength(0);

    mockFetch(...taskResponses());
    answer({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(updatedResponse(savedTask({ title: 'Prepare the project launch' })).body),
    });
    expect(await screen.findByText('Task updated')).toBeOnTheScreen();
  });

  it.each([
    ['the server can’t be reached', 'network-error' as const],
    ['the server fails', { status: 500, body: { errors: [{ message: 'Unexpected Execution Error' }] } }],
  ])('keeps every change and says “We couldn’t save your changes” when %s', async (_, failure) => {
    const { router } = await openEditForm(failure as FakeResponse);

    await fireEvent.changeText(screen.getByTestId('title-input'), 'Prepare the project launch');
    await choosePriority('High');
    await fireEvent.press(screen.getByTestId('save-button'));

    expect(await screen.findByTestId('form-error')).toHaveTextContent(SAVE_FAILED);
    expect(router).toHavePathname(`/tasks/${TASK_ID}/edit`);
    expect(screen.getByTestId('title-input').props.value).toBe('Prepare the project launch');
    expect(screen.getByTestId('priority-select')).toHaveTextContent('High');
    expect(screen.getByTestId('save-button')).toBeEnabled();
  });

  it('says the task is gone when the backend no longer finds it', async () => {
    await openEditForm({ body: gqlError('NOT_FOUND', `Task '${TASK_ID}' was not found.`) });

    await fireEvent.changeText(screen.getByTestId('title-input'), 'Prepare the project launch');
    await fireEvent.press(screen.getByTestId('save-button'));

    expect(await screen.findByTestId('form-error')).toHaveTextContent(TASK_GONE);
  });
});

describe('Edit task validation', () => {
  it('requires a title and sends nothing without one', async () => {
    const { fetchMock } = await openEditForm();

    await fireEvent.changeText(screen.getByTestId('title-input'), '   ');
    expect(screen.getByTestId('title-counter')).toHaveTextContent('0 / 200 characters');
    await fireEvent.press(screen.getByTestId('save-button'));

    expect(screen.getByTestId('title-error')).toHaveTextContent(TITLE_REQUIRED);
    expect(updateCalls(fetchMock)).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId('title-input'), 'Back again');
    expect(screen.queryByTestId('title-error')).not.toBeOnTheScreen();
  });

  it('refuses a title longer than the backend’s 200 characters', async () => {
    const { fetchMock } = await openEditForm();

    await fireEvent.changeText(screen.getByTestId('title-input'), 'x'.repeat(201));
    await fireEvent.press(screen.getByTestId('save-button'));

    expect(screen.getByTestId('title-error')).toHaveTextContent(TITLE_TOO_LONG);
    expect(updateCalls(fetchMock)).toHaveLength(0);
  });

  it('refuses a due date before the start date, as the backend does, and allows the same day', async () => {
    const { fetchMock } = await openEditForm(updatedResponse(savedTask()), ...taskResponses());

    await pickDate('due-date', new Date(2026, 10, 14));
    await fireEvent.press(screen.getByTestId('save-button'));

    expect(screen.getByTestId('due-date-error')).toHaveTextContent(DUE_BEFORE_START);
    expect(updateCalls(fetchMock)).toHaveLength(0);

    await pickDate('due-date', new Date(2026, 10, 16));
    expect(screen.queryByTestId('due-date-error')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('save-button'));
    await waitFor(() => expect(updateCalls(fetchMock)).toHaveLength(1));
    expect(updateCalls(fetchMock)[0].variables.input).toEqual({ taskId: TASK_ID, dueDate: '2026-11-16T00:00:00Z' });
  });

  it('refuses dates that aren’t real calendar days', () => {
    const values = { title: 'A task', description: '', priority: null };
    expect(validateEditTask({ ...values, startDate: '2026-02-30', dueDate: null })).toEqual({ startDate: INVALID_DATE });
    expect(validateEditTask({ ...values, startDate: null, dueDate: 'soon' })).toEqual({ dueDate: INVALID_DATE });
    expect(validateEditTask({ ...values, startDate: '2028-02-29', dueDate: '2028-03-01' })).toEqual({});
  });

  it.each([
    ['The due date cannot be before the start date.', 'due-date-error', DUE_BEFORE_START],
    ['Title cannot be empty or only spaces.', 'title-error', TITLE_REQUIRED],
    ['Title cannot be longer than 200 characters.', 'title-error', TITLE_TOO_LONG],
  ])('shows the backend’s “%s” under its field', async (message, testID, shown) => {
    await openEditForm({ body: gqlError('BAD_USER_INPUT', message) });

    await fireEvent.changeText(screen.getByTestId('description-input'), 'Changed');
    await fireEvent.press(screen.getByTestId('save-button'));

    expect(await screen.findByTestId(testID)).toHaveTextContent(shown);
    expect(screen.queryByTestId('form-error')).not.toBeOnTheScreen();
  });

  it('shows any other backend refusal above the form', async () => {
    await openEditForm({ body: gqlError('BAD_USER_INPUT', 'Something else is wrong.') });

    await fireEvent.changeText(screen.getByTestId('description-input'), 'Changed');
    await fireEvent.press(screen.getByTestId('save-button'));

    expect(await screen.findByTestId('form-error')).toHaveTextContent('Something else is wrong.');
  });
});

describe('Cancel', () => {
  it('goes straight back when nothing changed, without sending anything', async () => {
    const { router, fetchMock } = await open(detailsUrl, ...taskResponses(), ...taskResponses(), ...taskResponses());
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit task' }));
    await screen.findByDisplayValue('Plan the project launch');

    await fireEvent.press(screen.getByTestId('cancel-button'));

    await waitFor(() => expect(router).toHavePathname(`/tasks/${TASK_ID}`));
    expect(screen.queryByTestId('discard-dialog')).not.toBeOnTheScreen();
    expect(updateCalls(fetchMock)).toHaveLength(0);
  });

  it('asks before discarding changes, keeps them on “Keep editing”, and drops them on “Discard changes”', async () => {
    const { router, fetchMock } = await open(detailsUrl, ...taskResponses(), ...taskResponses(), ...taskResponses());
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit task' }));
    await screen.findByDisplayValue('Plan the project launch');
    await fireEvent.changeText(screen.getByTestId('title-input'), 'Prepare the project launch');

    await fireEvent.press(screen.getByTestId('cancel-button'));
    expect(screen.getByText('Discard changes?')).toBeOnTheScreen();
    expect(screen.getByText('Your unsaved changes will be lost.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByTestId('discard-dialog')).not.toBeOnTheScreen();
    expect(screen.getByTestId('title-input').props.value).toBe('Prepare the project launch');

    await fireEvent.press(screen.getByTestId('close-button'));
    await fireEvent.press(screen.getByRole('button', { name: 'Discard changes' }));

    await waitFor(() => expect(router).toHavePathname(`/tasks/${TASK_ID}`));
    expect(await screen.findByText('Plan the project launch')).toBeOnTheScreen();
    expect(screen.queryByText('Prepare the project launch')).not.toBeOnTheScreen();
    expect(screen.queryByText('Task updated')).not.toBeOnTheScreen();
    expect(updateCalls(fetchMock)).toHaveLength(0);
  });
});

describe('Task details', () => {
  it('shows the task’s five fields as saved, and “Not set” for empty ones', async () => {
    await open(detailsUrl, ...taskResponses(savedTask({ priority: null, startDate: null })));

    expect(await screen.findByText('Plan the project launch')).toBeOnTheScreen();
    expect(screen.getByTestId('task-breadcrumb')).toHaveTextContent('TEST PROJECT / TES-24');
    expect(screen.getByTestId('task-description')).toHaveTextContent('Agree on milestones and assign the launch checklist.');
    expect(screen.getByTestId('task-priority')).toHaveTextContent('Priority: None');
    expect(screen.getByTestId('task-start-date')).toHaveTextContent('Start date: Not set');
    expect(screen.getByTestId('task-due-date')).toHaveTextContent('Due date: Nov 20, 2026');
    expect(screen.queryByText('Task updated')).not.toBeOnTheScreen();
  });

  it('says so when the task isn’t on its board any more', async () => {
    await open(detailsUrl, boardResponse([]), projectsResponse());

    expect(await screen.findByText('Task not found')).toBeOnTheScreen();
  });

  it('opens from a task card on the board, and the board shows the edit when you come back', async () => {
    const edited = savedTask({ title: 'Prepare the project launch' });
    const { router } = await openWith(
      { 'boards/[boardId]': BoardScreen },
      `/boards/${BOARD_ID}`,
      ...taskResponses(),
      ...taskResponses(),
      ...taskResponses(),
      updatedResponse(edited),
      ...taskResponses(edited),
      ...taskResponses(edited),
    );

    await fireEvent.press(await screen.findByTestId(`task-card-${TASK_ID}`));
    await waitFor(() => expect(router).toHavePathname(`/tasks/${TASK_ID}`));
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit task' }));
    await fireEvent.changeText(await screen.findByTestId('title-input'), 'Prepare the project launch');
    await fireEvent.press(screen.getByTestId('save-button'));
    expect(await screen.findByText('Task updated')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('close-button'));

    await waitFor(() => expect(router).toHavePathname(`/boards/${BOARD_ID}`));
    const card = await screen.findByTestId(`task-card-${TASK_ID}`);
    await waitFor(() => expect(within(card).getByText('Prepare the project launch')).toBeOnTheScreen());
  });
});
