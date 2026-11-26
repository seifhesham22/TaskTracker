import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { BackHandler } from 'react-native';

import { BOARD_WITH_TASKS_QUERY, PROJECTS_QUERY, type ColumnNode, type ProjectNode } from '../src/api/boards';
import { CREATE_BOARD_MUTATION } from '../src/api/createBoard';
import { setSession } from '../src/auth/session';
import BoardScreen from '../src/app/boards/[boardId]';
import {
  BOARD_NAME_REQUIRED,
  BOARD_NAME_TAKEN,
  BOARD_NAME_TOO_LONG,
  CREATE_BOARD_FAILED,
  ONLY_OWNER_CREATES_BOARDS,
} from '../src/domain/createBoard';
import {
  ACCESS_TOKEN,
  API_URL,
  type FakeResponse,
  PROJECT_ID,
  PROJECT_MEMBERS,
  gqlError,
  mockFetch,
  projectsResponse,
} from '../test-utils/fakeBackend';
import { meResponse, renderApp, storedSession } from '../test-utils/renderApp';
import { resetSecureStore } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

const SPRINT_2 = '01a18766-48b5-7fb8-a04c-13e1bf640002';
const SPRINT_3 = '01a18766-48b5-7fb8-a04c-13e1bf640003';
const OTHER_PROJECT = '01a18766-48a1-7b2e-9c3f-5d6e7f809a1c';

/** What the backend's Board.AddDefaultColumns creates, as `createBoard` and `board` return them. */
const DEFAULT_COLUMNS: ColumnNode[] = [
  { id: 'c-backlog', name: 'Backlog', position: 'V', category: 'BACKLOG' },
  { id: 'c-todo', name: 'To do', position: 'l', category: 'TO_DO' },
  { id: 'c-progress', name: 'In progress', position: 't', category: 'IN_PROGRESS' },
  { id: 'c-done', name: 'Done', position: 'x', category: 'DONE' },
];

type Board = { id: string; name: string };
const project = (role: string, boards: Board[] = [{ id: SPRINT_2, name: 'Sprint 2' }]): ProjectNode => ({
  id: PROJECT_ID,
  name: 'Website redesign',
  role,
  boards,
  projectMembers: PROJECT_MEMBERS,
});
const otherProject = (boards: Board[] = []): ProjectNode => ({
  id: OTHER_PROJECT,
  name: 'Product launch',
  role: 'OWNER',
  boards,
  projectMembers: PROJECT_MEMBERS,
});
const mine = (...projects: ProjectNode[]) => projectsResponse(projects);
const withSprint3 = () => mine(project('OWNER', [{ id: SPRINT_2, name: 'Sprint 2' }, { id: SPRINT_3, name: 'Sprint 3' }]));

const created = (): FakeResponse => ({
  body: { data: { createBoard: { id: SPRINT_3, projectId: PROJECT_ID, name: 'Sprint 3', columns: DEFAULT_COLUMNS } } },
});
/** The new board as the board screen reads it: the board and its (no) tasks, then the projects. */
const newBoard = (): FakeResponse[] => [
  { body: { data: { board: { id: SPRINT_3, projectId: PROJECT_ID, name: 'Sprint 3', columns: DEFAULT_COLUMNS }, tasks: [] } } },
  withSprint3(),
];
const duplicate = (): FakeResponse => ({
  body: gqlError('BAD_USER_INPUT', "A board named 'Sprint 2' already exists in this project."),
});
const serverError: FakeResponse = { status: 500, body: { errors: [{ message: 'Unexpected Execution Error' }] } };

type Sent = { query: string; variables: { input?: Record<string, unknown> } };
const sent = (fetchMock: jest.Mock): Sent[] =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
const createCalls = (fetchMock: jest.Mock) => sent(fetchMock).filter((b) => b.query === CREATE_BOARD_MUTATION);

const projectUrl = `/projects/${PROJECT_ID}`;
const formUrl = `/projects/${PROJECT_ID}/boards/new`;

async function open(url: string, ...responses: FakeResponse[]) {
  resetSecureStore(storedSession());
  const fetchMock = mockFetch(meResponse(), ...responses);
  const router = await renderApp(url, { 'boards/[boardId]': BoardScreen });
  return { router, fetchMock };
}

/** Project boards, then Create board: each screen reads the project from the backend. */
async function openForm(...responses: FakeResponse[]) {
  const opened = await open(projectUrl, mine(project('OWNER')), mine(project('OWNER')), ...responses);
  await fireEvent.press(await screen.findByTestId('create-board-button'));
  await screen.findByTestId('board-name-input');
  return opened;
}

const type = (name: string) => fireEvent.changeText(screen.getByTestId('board-name-input'), name);
const submit = () => fireEvent.press(screen.getByTestId('create-board-submit'));

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
});

describe('Project boards: who can create a board', () => {
  it('shows the Owner the project’s boards and Create board, as in the design', async () => {
    await open(projectUrl, mine(project('OWNER')));

    expect(await screen.findByRole('header', { name: 'Project boards' })).toBeOnTheScreen();
    expect(screen.getByTestId('project-subtitle')).toHaveTextContent('Website redesign · Owner');
    const card = screen.getByTestId(`board-${SPRINT_2}`);
    expect(within(card).getByText('Sprint 2')).toBeOnTheScreen();
    expect(within(card).getByText('Board · Website redesign')).toBeOnTheScreen();
    expect(within(card).getByRole('button', { name: 'Open board Sprint 2' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create board' })).toBeOnTheScreen();
    expect(screen.queryByTestId('owner-only-note')).not.toBeOnTheScreen();
  });

  it.each([
    ['WRITER', 'Writer'],
    ['READER', 'Reader'],
  ])('doesn’t show a %s Create board, but lets them open the boards', async (role, label) => {
    await open(projectUrl, mine(project(role)));

    expect(await screen.findByTestId('project-subtitle')).toHaveTextContent(`Website redesign · ${label}`);
    expect(screen.getByRole('button', { name: 'Open board Sprint 2' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Create board' })).not.toBeOnTheScreen();
    expect(screen.getByTestId('owner-only-note')).toHaveTextContent(ONLY_OWNER_CREATES_BOARDS);
  });

  it.each(['WRITER', 'READER'])('doesn’t give a %s the form by a direct link either', async (role) => {
    const { fetchMock } = await open(formUrl, mine(project(role)));

    expect(await screen.findByTestId('owner-only-note')).toHaveTextContent(ONLY_OWNER_CREATES_BOARDS);
    expect(screen.queryByTestId('board-name-input')).not.toBeOnTheScreen();
    expect(createCalls(fetchMock)).toHaveLength(0);
  });

  it('refuses a direct link to the form for a project the user isn’t in', async () => {
    await open(formUrl, mine(otherProject()));
    expect(await screen.findByRole('header', { name: 'Project unavailable' })).toBeOnTheScreen();
    expect(screen.queryByTestId('board-name-input')).not.toBeOnTheScreen();
  });
});

describe('Create a board: the form', () => {
  it('renders as in the design, for the project it was opened from', async () => {
    const { router } = await openForm();

    expect(router).toHavePathname(formUrl);
    expect(screen.getByRole('header', { name: 'Create a board' })).toBeOnTheScreen();
    expect(screen.getByText('Website redesign')).toBeOnTheScreen();
    expect(screen.getByText('Board name *')).toBeOnTheScreen();
    expect(screen.getByLabelText('Board name, required')).toBeOnTheScreen();
    expect(screen.getByTestId('board-name-input').props.placeholder).toBe('Enter a board name');
    expect(screen.getByText('This board will belong to Website redesign.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create board' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();

    await type('Sprint 3');
    expect(screen.getByTestId('board-name-input').props.value).toBe('Sprint 3');
  });

  it.each([
    ['an empty name', '', BOARD_NAME_REQUIRED],
    ['a name of spaces only', '    ', BOARD_NAME_REQUIRED],
    ['a name over 100 characters', 'x'.repeat(101), BOARD_NAME_TOO_LONG],
  ])('refuses %s, says why at the field, and sends nothing', async (_, name, message) => {
    const { fetchMock } = await openForm();
    const before = fetchMock.mock.calls.length;
    await type(name);
    await submit();

    expect(screen.getByTestId('board-name-error')).toHaveTextContent(message);
    expect(screen.getByTestId('board-name-input').props['aria-invalid']).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(before);

    await type('Sprint 3');
    expect(screen.queryByTestId('board-name-error')).not.toBeOnTheScreen();
  });

  it('Cancel goes back to the project’s boards without sending anything', async () => {
    const { router, fetchMock } = await openForm(mine(project('OWNER')));
    await type('Sprint 3');
    await fireEvent.press(screen.getByTestId('cancel-button'));

    await waitFor(() => expect(router).toHavePathname(projectUrl));
    expect(createCalls(fetchMock)).toHaveLength(0);
    expect(await screen.findByText('Sprint 2')).toBeOnTheScreen();
  });
});

describe('Create a board: with the backend', () => {
  it('sends the project and the trimmed name with createBoard, then opens the new board by its ID', async () => {
    const { router, fetchMock } = await openForm(created(), ...newBoard());
    await type('  Sprint 3  ');
    await submit();

    await waitFor(() => expect(router).toHavePathname(`/boards/${SPRINT_3}`));
    expect(createCalls(fetchMock).map((c) => c.variables.input)).toEqual([{ projectId: PROJECT_ID, name: 'Sprint 3' }]);
    const index = sent(fetchMock).findIndex((b) => b.query === CREATE_BOARD_MUTATION);
    expect(((fetchMock.mock.calls[index][1] as RequestInit).headers as Headers).get('Authorization')).toBe(
      `Bearer ${ACCESS_TOKEN}`,
    );
    // The board screen reads the board the backend returned.
    const boardRead = sent(fetchMock)[index + 1];
    expect(boardRead.query).toBe(BOARD_WITH_TASKS_QUERY);
    expect(boardRead.variables).toEqual({ boardId: SPRINT_3 });

    expect(await screen.findByText('Board created in Website redesign.')).toBeOnTheScreen();
    expect(screen.getByText('Sprint 3')).toBeOnTheScreen();
    // The backend's default columns, in its order, all empty.
    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Backlog, 0 tasks',
      'To do, 0 tasks',
      'In progress, 0 tasks',
      'Done, 0 tasks',
    ]);
  });

  it('Back from the new board shows the project’s board list read again, with the new board', async () => {
    const { router, fetchMock } = await openForm(created(), ...newBoard(), withSprint3());
    await type('Sprint 3');
    await submit();
    await screen.findByText('Board created in Website redesign.');

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    await waitFor(() => expect(router).toHavePathname(projectUrl));
    expect(await screen.findByTestId(`board-${SPRINT_3}`)).toBeOnTheScreen();
    expect(screen.getByTestId(`board-${SPRINT_2}`)).toBeOnTheScreen();
    expect(sent(fetchMock).at(-1)!.query).toBe(PROJECTS_QUERY);
  });

  it('shows a duplicate name in this project at the field, keeps it, and opens nothing', async () => {
    const { router } = await openForm(duplicate());
    await type('Sprint 2');
    await submit();

    expect(await screen.findByTestId('board-name-error')).toHaveTextContent(BOARD_NAME_TAKEN);
    expect(screen.getByTestId('board-name-input').props.value).toBe('Sprint 2');
    expect(screen.queryByText(/Board created/)).not.toBeOnTheScreen();
    expect(router).toHavePathname(formUrl);
    expect(screen.getByTestId('create-board-submit')).toBeEnabled();
  });

  it('leaves the same name in another project to the backend: it is sent, not refused here', async () => {
    const { fetchMock } = await open(
      projectUrl,
      mine(project('OWNER'), otherProject([{ id: 'b-other', name: 'Sprint 3' }])),
      mine(project('OWNER'), otherProject([{ id: 'b-other', name: 'Sprint 3' }])),
      created(),
      ...newBoard(),
    );
    await fireEvent.press(await screen.findByTestId('create-board-button'));
    await screen.findByTestId('board-name-input');
    await type('Sprint 3');
    await submit();

    expect(await screen.findByText('Board created in Website redesign.')).toBeOnTheScreen();
    expect(createCalls(fetchMock)).toHaveLength(1);
  });

  it.each([
    ['no response', 'network-error' as FakeResponse],
    ['a server error', serverError],
  ])('after %s keeps the name, says so, and Try again first checks whether it was created', async (_, failure) => {
    const { router, fetchMock } = await openForm(failure, mine(project('OWNER')), created(), ...newBoard());
    await type('Sprint 3');
    await submit();

    expect(await screen.findByTestId('form-error')).toHaveTextContent(CREATE_BOARD_FAILED);
    expect(screen.getByTestId('board-name-input').props.value).toBe('Sprint 3');
    expect(screen.getByTestId('create-board-submit')).toBeEnabled();
    expect(screen.getByTestId('cancel-button')).toBeEnabled();
    expect(router).toHavePathname(formUrl);

    await submit();
    await waitFor(() => expect(router).toHavePathname(`/boards/${SPRINT_3}`));
    // Not created the first time: the project was read, then the name sent again.
    expect(createCalls(fetchMock)).toHaveLength(2);
  });

  it('finds on retry that the first attempt was saved, and doesn’t create the board twice', async () => {
    const { router, fetchMock } = await openForm('network-error', withSprint3(), ...newBoard());
    await type('Sprint 3');
    await submit();
    await screen.findByTestId('form-error');

    await submit();

    await waitFor(() => expect(router).toHavePathname(`/boards/${SPRINT_3}`));
    expect(createCalls(fetchMock)).toHaveLength(1);
  });

  it('shows “Creating…”, locks the form and Back, and sends one request however often it is tapped', async () => {
    const onBack = jest.spyOn(BackHandler, 'addEventListener');
    await openForm();
    await type('Sprint 3');
    let answer!: (value: unknown) => void;
    const fetchMock = jest.fn(() => new Promise((resolve) => (answer = resolve)));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    onBack.mockClear();

    await submit();
    await submit();

    expect(screen.getByText('Creating…')).toBeOnTheScreen();
    expect(screen.getByTestId('create-board-submit')).toBeDisabled();
    expect(screen.getByTestId('cancel-button')).toBeDisabled();
    expect(screen.getByTestId('board-name-input').props.editable).toBe(false);
    expect(screen.getByTestId('board-name-input').props.value).toBe('Sprint 3');
    expect(onBack.mock.calls.some(([event]) => event === 'hardwareBackPress')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    mockFetch(...newBoard());
    await act(async () => answer({ ok: true, status: 200, text: async () => JSON.stringify((created() as { body: unknown }).body) }));
    expect(await screen.findByText('Board created in Website redesign.')).toBeOnTheScreen();
    onBack.mockRestore();
  });

  it('explains a role taken away meanwhile (AUTH_NOT_AUTHORIZED) instead of trying again', async () => {
    await openForm({ body: gqlError('AUTH_NOT_AUTHORIZED', 'Only the owner of the project can create boards.') });
    await type('Sprint 3');
    await submit();

    expect(await screen.findByTestId('owner-only-note')).toHaveTextContent(ONLY_OWNER_CREATES_BOARDS);
    expect(screen.queryByTestId('board-name-input')).not.toBeOnTheScreen();
  });

  it('shows lost access (NOT_FOUND) with the access screen, not as a failed form', async () => {
    await openForm({ body: gqlError('NOT_FOUND', `Project '${PROJECT_ID}' was not found.`) });
    await type('Sprint 3');
    await submit();

    expect(await screen.findByRole('header', { name: 'Your project access has changed' })).toBeOnTheScreen();
    expect(screen.queryByTestId('board-name-input')).not.toBeOnTheScreen();
  });

  it('shows another refusal about the name as the backend words it', async () => {
    await openForm({ body: gqlError('BAD_USER_INPUT', 'Board name cannot be longer than 100 characters.') });
    await type('Sprint 3');
    await submit();
    expect(await screen.findByTestId('board-name-error')).toHaveTextContent('Board name cannot be longer than 100 characters.');
  });
});
