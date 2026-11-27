import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { ProjectNode, TaskNode } from '../src/api/boards';
import { ASSIGN_TASK_MUTATION, UNASSIGN_TASK_MUTATION } from '../src/api/tasks';
import { setSession } from '../src/auth/session';
import BoardScreen from '../src/app/boards/[boardId]';
import {
  ASSIGNMENT_FAILED,
  LOADING_MEMBERS,
  NO_LONGER_MEMBER,
  NO_MATCHING_MEMBERS,
  READER_VIEW,
} from '../src/domain/assignee';
import {
  API_URL,
  BOARD_ID,
  type FakeResponse,
  PROJECT_ID,
  USER_ID,
  boardResponse,
  gqlError,
  mockFetch,
  projectsResponse,
  titleOnlyTaskNode,
} from '../test-utils/fakeBackend';
import { meResponse, renderApp, storedSession } from '../test-utils/renderApp';
import { resetSecureStore } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

const MINA = { userId: 'u-mina', userName: 'mina.joao@local.test', role: 'WRITER' };
const DOMBELE = { userId: 'u-dombele', userName: 'dombele.joao@local.test', role: 'OWNER' };
const RITA = { userId: 'u-rita', userName: 'rita@local.test', role: 'READER' };
/** A member of another project only: never offered. */
const OUTSIDER = { userId: 'u-outsider', userName: 'outsider@local.test', role: 'OWNER' };

const me = (role: string) => ({ userId: USER_ID, userName: 'admin@local.test', role });
const project = (role: string): ProjectNode => ({
  id: PROJECT_ID,
  name: 'Website redesign',
  role,
  boards: [{ id: BOARD_ID, name: 'Sprint board' }],
  projectMembers: [me(role), MINA, DOMBELE, RITA],
});
const other: ProjectNode = {
  id: 'p-other',
  name: 'Product launch',
  role: 'OWNER',
  boards: [],
  projectMembers: [OUTSIDER],
};

const assigned = (...members: { userId: string; userName: string }[]) =>
  members.map((m) => ({ id: m.userId, userName: m.userName }));
const task = (assignees: TaskNode['assignees'] = []): TaskNode =>
  titleOnlyTaskNode(1, {
    id: '01a18766-8315-7c9c-90fd-5657de973424',
    readableId: 'TES-24',
    title: 'Prepare launch checklist',
    priority: 'HIGH',
    assignees,
  });
const TASK_ID = task().id;
/** What a task screen reads: the board and its tasks, then the user's projects (members, roles). */
const read = (assignees: TaskNode['assignees'] = [], role = 'WRITER'): FakeResponse[] => [
  boardResponse([task(assignees)]),
  projectsResponse([project(role), other]),
];
const assignedResponse = (...members: { userId: string; userName: string }[]): FakeResponse => ({
  body: { data: { assignTask: task(assigned(...members)) } },
});
const unassignedResponse = (...members: { userId: string; userName: string }[]): FakeResponse => ({
  body: { data: { unassignTask: task(assigned(...members)) } },
});
const serverError: FakeResponse = { status: 500, body: { errors: [{ message: 'Unexpected Execution Error' }] } };

type Sent = { query: string; variables: { input?: Record<string, unknown> } };
const sent = (fetchMock: jest.Mock): Sent[] =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
const calls = (fetchMock: jest.Mock, query: string) =>
  sent(fetchMock)
    .filter((b) => b.query === query)
    .map((b) => b.variables.input);
const mutations = (fetchMock: jest.Mock) =>
  sent(fetchMock)
    .filter((b) => b.query === ASSIGN_TASK_MUTATION || b.query === UNASSIGN_TASK_MUTATION)
    .map((b) => `${b.query === ASSIGN_TASK_MUTATION ? 'assign' : 'unassign'} ${b.variables.input!.userId}`);

const taskUrl = `/tasks/${TASK_ID}?boardId=${BOARD_ID}`;
const assigneeUrl = `/tasks/${TASK_ID}/assignee?boardId=${BOARD_ID}`;

async function open(url: string, ...responses: FakeResponse[]) {
  resetSecureStore(storedSession());
  const fetchMock = mockFetch(meResponse(), ...responses);
  const router = await renderApp(url, { 'boards/[boardId]': BoardScreen });
  return { router, fetchMock };
}

/** Task assignee, then Change assignee, which reads the eligible members again. */
async function openPicker(saved: TaskNode['assignees'] = [], role = 'WRITER', ...responses: FakeResponse[]) {
  const opened = await open(assigneeUrl, ...read(saved, role), ...read(saved, role), ...responses);
  await fireEvent.press(await screen.findByTestId('change-assignee-button'));
  await screen.findByTestId(`option-${MINA.userId}`);
  return opened;
}

const save = () => fireEvent.press(screen.getByTestId('save-assignee'));

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
});

describe('Task assignee', () => {
  it('opens from Task details, which shows the assignee, as in the design', async () => {
    const { router } = await open(taskUrl, ...read(), ...read());
    expect(await screen.findByTestId('task-assignee')).toHaveTextContent('Assignee: Unassigned');

    await fireEvent.press(screen.getByRole('button', { name: 'Task assignee' }));

    await waitFor(() => expect(router).toHavePathname(`/tasks/${TASK_ID}/assignee`));
    expect(await screen.findByRole('header', { name: 'Task assignee' })).toBeOnTheScreen();
    expect(screen.getByText('Website redesign / TES-24')).toBeOnTheScreen();
    const card = screen.getByTestId('assignee-task-card');
    expect(within(card).getByText('Prepare launch checklist')).toBeOnTheScreen();
    expect(within(card).getByText('To do · High priority')).toBeOnTheScreen();
    expect(screen.getByTestId('assignee-value')).toHaveTextContent('Unassigned');
    expect(screen.getByRole('button', { name: 'Change assignee' })).toBeOnTheScreen();
  });

  it('shows the saved assignee with initials and name, never an ID alone', async () => {
    await open(assigneeUrl, ...read(assigned(MINA)));
    expect(await screen.findByTestId('assignee-value')).toHaveTextContent('MJ · mina.joao@local.test');
  });

  it.each(['OWNER', 'WRITER'])('lets a project %s change the assignee', async (role) => {
    await open(assigneeUrl, ...read([], role));
    expect(await screen.findByTestId('change-assignee-button')).toBeOnTheScreen();
  });

  it('shows a Reader the saved assignee with no way to change it', async () => {
    await open(assigneeUrl, ...read(assigned(MINA), 'READER'));
    expect(await screen.findByTestId('assignee-value')).toHaveTextContent('MJ · mina.joao@local.test');
    expect(screen.getByTestId('assignee-reader-note')).toHaveTextContent(READER_VIEW);
    expect(screen.queryByTestId('change-assignee-button')).not.toBeOnTheScreen();
  });
});

describe('Change assignee: the picker', () => {
  it('offers Unassigned and the task’s project members only, with their roles, and the current choice', async () => {
    await openPicker(assigned(MINA));

    expect(screen.getByRole('header', { name: 'Change assignee' })).toBeOnTheScreen();
    expect(screen.getByText('TES-24 · Prepare launch checklist')).toBeOnTheScreen();
    expect(screen.getByTestId('member-search').props.placeholder).toBe('Search members…');
    expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual([
      'Unassigned, Remove the current assignment',
      'admin@local.test, Project member · Writer',
      'mina.joao@local.test, Project member · Writer',
      'dombele.joao@local.test, Project member · Owner',
      'rita@local.test, Project member · Reader',
    ]);
    expect(screen.queryByText('outsider@local.test')).not.toBeOnTheScreen();
    expect(screen.getByTestId(`option-${MINA.userId}`).props.accessibilityState).toMatchObject({ checked: true });
    // Nothing changed yet.
    expect(screen.getByTestId('save-assignee')).toBeDisabled();
  });

  it('says the members are loading and allows no save until they are read', async () => {
    resetSecureStore(storedSession());
    const answers: ((value: unknown) => void)[] = [];
    const ok = (r: FakeResponse) => ({ ok: true, status: 200, text: async () => JSON.stringify((r as { body: unknown }).body) });
    const queue: (() => Promise<unknown>)[] = [
      async () => ok({ body: meResponse().body }),
      async () => ok(read()[0]),
      async () => ok(read()[1]),
    ];
    globalThis.fetch = jest.fn(() =>
      queue.length ? queue.shift()!() : new Promise((resolve) => answers.push(resolve)),
    ) as unknown as typeof fetch;
    await renderApp(assigneeUrl);
    await fireEvent.press(await screen.findByTestId('change-assignee-button'));

    expect(await screen.findByTestId('members-loading')).toHaveTextContent(LOADING_MEMBERS);
    expect(screen.getByTestId('save-assignee')).toBeDisabled();
    expect(screen.queryByRole('radio')).not.toBeOnTheScreen();

    await act(async () => answers[0](ok(read()[0])));
    await waitFor(() => expect(answers).toHaveLength(2));
    await act(async () => answers[1](ok(read()[1])));
    expect(await screen.findByTestId(`option-${MINA.userId}`)).toBeOnTheScreen();
  });

  it('searches the project’s members, and says when none match without offering anyone else', async () => {
    await openPicker();
    await fireEvent.changeText(screen.getByTestId('member-search'), 'mina');
    expect(screen.getByTestId(`option-${MINA.userId}`)).toBeOnTheScreen();
    expect(screen.queryByTestId(`option-${DOMBELE.userId}`)).not.toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('member-search'), 'outsider');
    expect(screen.getByTestId('members-none')).toHaveTextContent(NO_MATCHING_MEMBERS);
    expect(screen.queryByRole('radio')).not.toBeOnTheScreen();
    expect(screen.getByTestId('save-assignee')).toBeDisabled();
  });

  it('Cancel discards the draft choice and sends nothing', async () => {
    const { fetchMock } = await openPicker();
    await fireEvent.press(screen.getByTestId(`option-${MINA.userId}`));
    await fireEvent.press(screen.getByTestId('cancel-assignee'));

    expect(await screen.findByTestId('assignee-value')).toHaveTextContent('Unassigned');
    expect(mutations(fetchMock)).toEqual([]);
  });
});

describe('Change assignee: saving', () => {
  it('assigns the chosen member with assignTask, then shows the backend’s task', async () => {
    const { fetchMock } = await openPicker([], 'WRITER', assignedResponse(MINA), ...read(assigned(MINA)));
    await fireEvent.press(screen.getByTestId(`option-${MINA.userId}`));
    expect(screen.getByTestId('save-assignee')).toBeEnabled();
    await save();

    expect(await screen.findByText('Assignee updated')).toBeOnTheScreen();
    expect(screen.getByTestId('assignee-value')).toHaveTextContent('MJ · mina.joao@local.test');
    expect(calls(fetchMock, ASSIGN_TASK_MUTATION)).toEqual([{ taskId: TASK_ID, userId: MINA.userId }]);
    expect(mutations(fetchMock)).toEqual([`assign ${MINA.userId}`]);
  });

  it('changes the assignee: the new one is assigned first, then the old one removed', async () => {
    const { fetchMock } = await openPicker(
      assigned(MINA),
      'OWNER',
      assignedResponse(MINA, DOMBELE),
      unassignedResponse(DOMBELE),
      ...read(assigned(DOMBELE), 'OWNER'),
    );
    await fireEvent.press(screen.getByTestId(`option-${DOMBELE.userId}`));
    await save();

    expect(await screen.findByText('Assignee updated')).toBeOnTheScreen();
    expect(screen.getByTestId('assignee-value')).toHaveTextContent('DJ · dombele.joao@local.test');
    expect(mutations(fetchMock)).toEqual([`assign ${DOMBELE.userId}`, `unassign ${MINA.userId}`]);
  });

  it('removes the assignment with unassignTask: the task then has no assignee', async () => {
    const { fetchMock } = await openPicker(assigned(MINA), 'WRITER', unassignedResponse(), ...read());
    await fireEvent.press(screen.getByTestId('option-unassigned'));
    expect(screen.getByRole('button', { name: 'Remove assignment' })).toBeEnabled();
    await save();

    expect(await screen.findByText('Assignment removed')).toBeOnTheScreen();
    expect(screen.getByTestId('assignee-value')).toHaveTextContent('Unassigned');
    expect(calls(fetchMock, UNASSIGN_TASK_MUTATION)).toEqual([{ taskId: TASK_ID, userId: MINA.userId }]);
  });

  it('says when several assignees will be replaced, and removes every other one', async () => {
    const { fetchMock } = await openPicker(
      assigned(MINA, DOMBELE),
      'WRITER',
      unassignedResponse(DOMBELE),
      unassignedResponse(),
      ...read(),
    );
    expect(screen.getByTestId('save-assignee')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('option-unassigned'));
    expect(screen.getByTestId('replaces-note')).toHaveTextContent(/mina\.joao@local\.test, dombele\.joao@local\.test/);
    await save();

    expect(await screen.findByText('Assignment removed')).toBeOnTheScreen();
    expect(mutations(fetchMock)).toEqual([`unassign ${MINA.userId}`, `unassign ${DOMBELE.userId}`]);
  });

  it('shows “Saving…”, locks the choices, and sends one request however often it is tapped', async () => {
    await openPicker();
    await fireEvent.press(screen.getByTestId(`option-${MINA.userId}`));
    let answer!: (value: unknown) => void;
    const fetchMock = jest.fn(() => new Promise((resolve) => (answer = resolve)));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await save();
    await save();

    expect(screen.getByText('Saving…')).toBeOnTheScreen();
    expect(screen.getByTestId('save-assignee')).toBeDisabled();
    expect(screen.getByTestId('cancel-assignee')).toBeDisabled();
    expect(screen.getByTestId(`option-${DOMBELE.userId}`).props.accessibilityState).toMatchObject({ disabled: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    mockFetch(...read(assigned(MINA)));
    await act(async () => answer({ ok: true, status: 200, text: async () => JSON.stringify((assignedResponse(MINA) as { body: unknown }).body) }));
    expect(await screen.findByText('Assignee updated')).toBeOnTheScreen();
  });
});

describe('Change assignee: failures never look saved', () => {
  it.each([
    ['no response', 'network-error' as FakeResponse],
    ['a server error', serverError],
  ])('after %s keeps the choice and the saved assignee, and Try again checks first', async (_, failure) => {
    const { fetchMock } = await openPicker(
      [],
      'WRITER',
      failure,
      ...read(),
      // Try again: the task is read first, then the member assigned.
      ...read(),
      assignedResponse(MINA),
      ...read(assigned(MINA)),
    );
    await fireEvent.press(screen.getByTestId(`option-${MINA.userId}`));
    await save();

    expect(await screen.findByTestId('form-error')).toHaveTextContent(ASSIGNMENT_FAILED);
    expect(screen.getByTestId(`option-${MINA.userId}`).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('save-assignee')).toBeEnabled();
    expect(screen.queryByText('Assignee updated')).not.toBeOnTheScreen();

    await save();
    expect(await screen.findByText('Assignee updated')).toBeOnTheScreen();
    expect(mutations(fetchMock)).toEqual([`assign ${MINA.userId}`, `assign ${MINA.userId}`]);
  });

  it('a failed removal keeps the assignee: Cancel shows it still assigned', async () => {
    await openPicker(assigned(MINA), 'WRITER', serverError, ...read(assigned(MINA)));
    await fireEvent.press(screen.getByTestId('option-unassigned'));
    await save();

    expect(await screen.findByTestId('form-error')).toHaveTextContent(ASSIGNMENT_FAILED);
    await fireEvent.press(screen.getByTestId('cancel-assignee'));
    expect(await screen.findByTestId('assignee-value')).toHaveTextContent('MJ · mina.joao@local.test');
    expect(screen.queryByText('Assignment removed')).not.toBeOnTheScreen();
  });

  it('refuses someone who is no longer a project member, and asks for another choice', async () => {
    const refused = { body: gqlError('BAD_USER_INPUT', `User '${MINA.userId}' is not a member of project TES, so they can't be assigned to this task.`) };
    // The members read again: Mina was removed from the project meanwhile.
    const withoutMina = projectsResponse([{ ...project('WRITER'), projectMembers: [me('WRITER'), DOMBELE, RITA] }, other]);
    const { fetchMock } = await openPicker([], 'WRITER', refused, boardResponse([task()]), withoutMina);
    await fireEvent.press(screen.getByTestId(`option-${MINA.userId}`));
    await save();

    expect(await screen.findByTestId('form-error')).toHaveTextContent(NO_LONGER_MEMBER);
    await waitFor(() =>
      expect(screen.getByTestId(`option-${MINA.userId}`)).toHaveTextContent(/Membership removed/),
    );
    expect(screen.getByTestId('save-assignee')).toBeDisabled();
    expect(screen.queryByText('Assignee updated')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(`option-${DOMBELE.userId}`));
    expect(screen.getByTestId('save-assignee')).toBeEnabled();
    expect(mutations(fetchMock)).toEqual([`assign ${MINA.userId}`]);
  });

  it('a role taken away meanwhile (AUTH_NOT_AUTHORIZED) leads to the read-only view, with the reason', async () => {
    const message = 'Only writers and owners of the project can assign tasks.';
    await openPicker([], 'WRITER', { body: gqlError('AUTH_NOT_AUTHORIZED', message) }, ...read([], 'READER'));
    await fireEvent.press(screen.getByTestId(`option-${MINA.userId}`));
    await save();

    expect(await screen.findByTestId('form-error')).toHaveTextContent(message);
    expect(await screen.findByTestId('assignee-reader-note')).toBeOnTheScreen();
    expect(screen.getByTestId('assignee-value')).toHaveTextContent('Unassigned');
  });

  it('a lost membership (NOT_FOUND) clears the task as when the app resumes', async () => {
    const gone = { body: gqlError('NOT_FOUND', `Task '${TASK_ID}' was not found.`) };
    const boardGone = { body: gqlError('NOT_FOUND', `Board '${BOARD_ID}' was not found.`) };
    await openPicker([], 'WRITER', gone, boardGone);
    await fireEvent.press(screen.getByTestId(`option-${MINA.userId}`));
    await save();

    expect(await screen.findByRole('header', { name: 'Your project access has changed' })).toBeOnTheScreen();
    expect(screen.queryByText(/Prepare launch checklist/)).not.toBeOnTheScreen();
  });
});

describe('Task details and cards stay in step with the backend', () => {
  it('the board card, Task details and a reopened task all show the saved assignee', async () => {
    const { router } = await open(
      `/boards/${BOARD_ID}`,
      ...read(), // board
      ...read(), // task details
      ...read(), // task assignee
      ...read(), // change assignee: members read again
      assignedResponse(MINA),
      ...read(assigned(MINA)), // the task read again after saving
      ...read(assigned(MINA)), // back on Task details
      ...read(assigned(MINA)), // back on the board
      ...read(assigned(MINA)), // the task opened again
    );
    const card = await screen.findByTestId(`task-card-${TASK_ID}`);
    expect(card.props.accessibilityLabel).not.toMatch(/Assigned to/);

    await fireEvent.press(card);
    await fireEvent.press(await screen.findByTestId('assignee-button'));
    await fireEvent.press(await screen.findByTestId('change-assignee-button'));
    await fireEvent.press(await screen.findByTestId(`option-${MINA.userId}`));
    await save();
    await screen.findByText('Assignee updated');

    await fireEvent.press(screen.getByTestId('close-button'));
    await waitFor(() => expect(router).toHavePathname(`/tasks/${TASK_ID}`));
    expect(await screen.findByText('Assignee: MJ · mina.joao@local.test')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('close-button'));
    await waitFor(() => expect(router).toHavePathname(`/boards/${BOARD_ID}`));
    await waitFor(() =>
      expect(screen.getByTestId(`task-card-${TASK_ID}`).props.accessibilityLabel).toMatch(/Assigned to mina\.joao@local\.test/),
    );

    await fireEvent.press(screen.getByTestId(`task-card-${TASK_ID}`));
    expect(await screen.findByText('Assignee: MJ · mina.joao@local.test')).toBeOnTheScreen();
  });
});
