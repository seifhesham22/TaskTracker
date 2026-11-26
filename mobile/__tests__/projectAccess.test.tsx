import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { AppState } from 'react-native';

import { BACKLOG_QUERY } from '../src/api/backlog';
import { BOARD_WITH_TASKS_QUERY, PROJECTS_QUERY, type ProjectNode } from '../src/api/boards';
import { setSession } from '../src/auth/session';
import BoardScreen from '../src/app/boards/[boardId]';
import { hasLostAccess } from '../src/data/projectAccess';
import { safeReturnPath } from '../src/domain/access';
import { ACCESS_CHECK_INTERVAL_MS } from '../src/hooks/useProjectAccessWatch';
import {
  API_URL,
  BOARD_ID,
  BOARD_NODE,
  type FakeResponse,
  PROJECT_ID,
  PROJECT_MEMBERS,
  boardResponse,
  gqlError,
  mockFetch,
  projectsResponse,
  titleOnlyTaskNode,
} from '../test-utils/fakeBackend';
import { PASSWORD, EMAIL, loginPayload, meResponse, renderApp, storedSession } from '../test-utils/renderApp';
import { resetSecureStore } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

const OTHER_ID = '01a18766-48a1-7b2e-9c3f-5d6e7f809a1c';
const OTHER_BOARD = '01a18766-48b5-7fb8-a04c-13e1bf648d00';
const TASK = titleOnlyTaskNode(0, { id: '01a18766-8315-7c9c-90fd-5657de973401', title: 'Draft the sitemap' });

const project = (role: string, overrides: Partial<ProjectNode> = {}): ProjectNode => ({
  id: PROJECT_ID,
  name: 'Website redesign',
  role,
  boards: [{ id: BOARD_ID, name: 'Sprint board', columns: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] }],
  projectMembers: PROJECT_MEMBERS,
  ...overrides,
});
const other: ProjectNode = {
  id: OTHER_ID,
  name: 'Product launch',
  role: 'READER',
  boards: [{ id: OTHER_BOARD, name: 'Launch board' }],
  projectMembers: PROJECT_MEMBERS,
};
/** The `projects` query: the user's own projects only, as the backend lists them. */
const mine = (...projects: ProjectNode[]) => projectsResponse(projects);
const notFound = (what: string): FakeResponse => ({ body: gqlError('NOT_FOUND', `${what} was not found.`) });
const boardGone = () => notFound(`Board '${BOARD_ID}'`);
const expiredToken: FakeResponse = { body: gqlError('AUTH_NOT_AUTHENTICATED', 'The current user is not authorized.') };
/** What the board screen reads: the board and its tasks, then the user's projects. */
const board = (role = 'WRITER'): FakeResponse[] => [boardResponse([TASK]), mine(project(role), other)];

const projectUrl = `/projects/${PROJECT_ID}`;
const boardUrl = `/boards/${BOARD_ID}`;
const taskUrl = `/tasks/${TASK.id}?boardId=${BOARD_ID}`;

type Sent = { query: string; variables: Record<string, unknown> };
const sent = (fetchMock: jest.Mock): Sent[] =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));

async function open(url: string, ...responses: FakeResponse[]) {
  resetSecureStore(storedSession());
  const fetchMock = mockFetch(meResponse(), ...responses);
  const router = await renderApp(url, { 'boards/[boardId]': BoardScreen });
  return { router, fetchMock };
}

// The app coming back from the background, as React Native reports it.
const appStateListeners = new Set<(state: string) => void>();
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
  appStateListeners.clear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    const handler = listener as (state: string) => void;
    appStateListeners.add(handler);
    return { remove: () => appStateListeners.delete(handler) } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => jest.restoreAllMocks());

async function resume() {
  await act(async () => appStateListeners.forEach((listener) => listener('background')));
  await act(async () => appStateListeners.forEach((listener) => listener('active')));
}

describe('A member opens their project', () => {
  it('opens the project from the list, its boards, and a board’s tasks', async () => {
    const { router } = await open('/', mine(project('WRITER'), other), mine(project('WRITER'), other), ...board());

    expect(await screen.findByText('Only projects you can access')).toBeOnTheScreen();
    expect(screen.getByText('Choose a project from your list.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`open-${PROJECT_ID}`));

    await waitFor(() => expect(router).toHavePathname(projectUrl));
    expect(await screen.findByRole('header', { name: 'Website redesign' })).toBeOnTheScreen();
    expect(screen.getByText('Member access · permitted content')).toBeOnTheScreen();
    const card = screen.getByTestId(`board-${BOARD_ID}`);
    expect(within(card).getByText('Sprint board')).toBeOnTheScreen();
    expect(within(card).getByText('3 columns · Your permitted tasks')).toBeOnTheScreen();
    // Only this project's boards.
    expect(screen.queryByText('Launch board')).not.toBeOnTheScreen();

    await fireEvent.press(within(card).getByRole('button', { name: 'Open board Sprint board' }));
    await waitFor(() => expect(router).toHavePathname(boardUrl));
    expect(await screen.findByText('Draft the sitemap')).toBeOnTheScreen();
  });

  it.each(['OWNER', 'WRITER', 'READER'])('lets a %s open the project and its board', async (role) => {
    await open(projectUrl, mine(project(role)), ...board(role));
    expect(await screen.findByTestId(`board-${BOARD_ID}`)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(`open-board-${BOARD_ID}`));
    expect(await screen.findByText('Draft the sitemap')).toBeOnTheScreen();
  });

  it('shows nothing of the project, not even its name, while access is checked', async () => {
    resetSecureStore(storedSession());
    let answer!: (value: unknown) => void;
    const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
    const queue = [async () => ok(meResponse().body), () => new Promise((resolve) => (answer = resolve))];
    globalThis.fetch = jest.fn(() => queue.shift()!()) as unknown as typeof fetch;
    await renderApp(projectUrl);

    expect(await screen.findByRole('header', { name: 'Checking access' })).toBeOnTheScreen();
    expect(screen.getByText('Please wait…')).toBeOnTheScreen();
    expect(screen.getByLabelText('Loading your permitted workspace…')).toBeOnTheScreen();
    expect(screen.getByText('Private boards and tasks remain hidden until access is confirmed.')).toBeOnTheScreen();
    expect(screen.queryByText(/Website redesign|Sprint board/)).not.toBeOnTheScreen();

    await act(async () => answer(ok(mine(project('READER')).body)));
    expect(await screen.findByText('Sprint board')).toBeOnTheScreen();
  });
});

describe('A non-member is refused', () => {
  it('a direct link to a project they aren’t in shows “Project unavailable”, and Back to projects', async () => {
    const { router } = await open(projectUrl, mine(other), mine(other));

    expect(await screen.findByRole('header', { name: 'Project unavailable' })).toBeOnTheScreen();
    expect(screen.getByText('You don’t have access, or this project is unavailable.')).toBeOnTheScreen();
    expect(screen.getByText('Return to your projects. If you need access, contact a project Owner.')).toBeOnTheScreen();
    expect(screen.queryByText(/Website redesign|Sprint board/)).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('back-to-projects'));
    await waitFor(() => expect(router).toHavePathname('/'));
    expect(await screen.findByText('Product launch')).toBeOnTheScreen();
  });

  it('a direct link to their board: the backend refuses, and no task is shown', async () => {
    const { fetchMock } = await open(boardUrl, boardGone());

    expect(await screen.findByRole('header', { name: 'Project unavailable' })).toBeOnTheScreen();
    expect(screen.queryByText('Draft the sitemap')).not.toBeOnTheScreen();
    expect(screen.queryByText('Test Board')).not.toBeOnTheScreen();
    // The membership check is the backend's: the board was asked for, with the user's token.
    expect(sent(fetchMock).at(-1)!.query).toBe(BOARD_WITH_TASKS_QUERY);
  });

  it('a direct link to one of their tasks: the same generic refusal', async () => {
    await open(taskUrl, boardGone());

    expect(await screen.findByRole('header', { name: 'Project unavailable' })).toBeOnTheScreen();
    expect(screen.queryByText('Draft the sitemap')).not.toBeOnTheScreen();
  });

  it('a direct link to their backlog or members: refused without the project’s name', async () => {
    // The name in the link is never shown; the backend's `projects` decides, and it isn't listed.
    const { fetchMock } = await open(`/projects/${PROJECT_ID}/backlog?projectName=Website%20redesign`, mine(other));
    expect(await screen.findByRole('header', { name: 'Project unavailable' })).toBeOnTheScreen();
    expect(screen.queryByText(/Website redesign/)).not.toBeOnTheScreen();
    // Refused before the backlog itself was ever asked for.
    expect(sent(fetchMock).map((b) => b.query)).not.toContain(BACKLOG_QUERY);
  });

  it('a direct link to the members of a project they aren’t in', async () => {
    await open(`/projects/${PROJECT_ID}/members`, mine(other));
    expect(await screen.findByRole('header', { name: 'Project unavailable' })).toBeOnTheScreen();
  });

  it('an old link to a project’s boards goes through the same check', async () => {
    const { router } = await open(`/boards?projectId=${PROJECT_ID}`, mine(other));
    await waitFor(() => expect(router).toHavePathname(projectUrl));
    expect(await screen.findByRole('header', { name: 'Project unavailable' })).toBeOnTheScreen();
  });
});

describe('Access lost while the app is in use', () => {
  it('coming back to the app reads the board again; a refusal clears it', async () => {
    await open(boardUrl, ...board(), boardGone());
    expect(await screen.findByText('Draft the sitemap')).toBeOnTheScreen();

    await resume();

    expect(await screen.findByRole('header', { name: 'Your project access has changed' })).toBeOnTheScreen();
    expect(screen.getByText('You no longer have access to this project.')).toBeOnTheScreen();
    expect(screen.queryByText('Draft the sitemap')).not.toBeOnTheScreen();
    expect(screen.queryByText(/Website redesign|Test Board/)).not.toBeOnTheScreen();
  });

  it('an open task is cleared the same way, and stays cleared', async () => {
    await open(taskUrl, ...board(), boardGone());
    expect(await screen.findByText('Draft the sitemap')).toBeOnTheScreen();

    await resume();

    expect(await screen.findByTestId('access-revoked')).toBeOnTheScreen();
    expect(screen.queryByText('Draft the sitemap')).not.toBeOnTheScreen();
  });

  it('an open project screen is cleared when the project is gone from the user’s projects', async () => {
    await open(projectUrl, mine(project('WRITER'), other), mine(other));
    expect(await screen.findByText('Sprint board')).toBeOnTheScreen();

    await resume();

    expect(await screen.findByTestId('access-revoked')).toBeOnTheScreen();
    expect(screen.queryByText('Sprint board')).not.toBeOnTheScreen();
  });

  it('the members list too', async () => {
    await open(`/projects/${PROJECT_ID}/members`, mine(project('WRITER')), mine(other));
    expect(await screen.findByText('admin@local.test (you)')).toBeOnTheScreen();

    await resume();

    expect(await screen.findByTestId('access-revoked')).toBeOnTheScreen();
    expect(screen.queryByText(/admin@local\.test/)).not.toBeOnTheScreen();
  });

  it('moving a task the backend no longer shows reads the board again, which is refused', async () => {
    await open(boardUrl, ...board(), notFound(`Task '${TASK.id}'`), boardGone());
    await fireEvent(await screen.findByTestId(`task-card-${TASK.id}`), 'longPress');
    await fireEvent.press(await screen.findByTestId(`move-task-sheet-option-${BOARD_NODE.columns[3].id}`));

    expect(await screen.findByTestId('access-revoked')).toBeOnTheScreen();
    expect(screen.queryByText('Draft the sitemap')).not.toBeOnTheScreen();
  });

  it('Back to projects shows the list read again: the lost project is gone, the others stay', async () => {
    const { router, fetchMock } = await open(boardUrl, ...board(), boardGone(), mine(other));
    await screen.findByText('Draft the sitemap');
    await resume();
    await screen.findByTestId('access-revoked');

    await fireEvent.press(screen.getByTestId('back-to-projects'));

    await waitFor(() => expect(router).toHavePathname('/'));
    expect(await screen.findByText('Product launch')).toBeOnTheScreen();
    expect(screen.queryByText('Website redesign')).not.toBeOnTheScreen();
    expect(sent(fetchMock).at(-1)!.query).toBe(PROJECTS_QUERY);
    // Losing one project doesn't end the session.
    expect(screen.getByRole('button', { name: 'Log out' })).toBeOnTheScreen();
  });

  it('the backlog too, when it was on screen', async () => {
    const backlogPage = {
      body: {
        data: {
          backlog: {
            items: [{ id: TASK.id, readableId: 'TES-1', title: 'Draft the sitemap', status: 'BACKLOG', priority: null, storyPoints: null, boardId: BOARD_ID, column: { name: 'Backlog' } }],
            totalCount: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1,
            hasNextPage: false,
          },
        },
      },
    };
    // Membership confirmed, the backlog read; on resume the project is gone from the user's projects.
    await open(`/projects/${PROJECT_ID}/backlog`, mine(project('WRITER')), backlogPage, mine(other));
    expect(await screen.findByText('Draft the sitemap')).toBeOnTheScreen();

    await resume();

    expect(await screen.findByTestId('access-revoked')).toBeOnTheScreen();
    expect(screen.queryByText('Draft the sitemap')).not.toBeOnTheScreen();
  });

  it('a refused link opened by bringing the app forward is “unavailable”, not “changed”', async () => {
    await open(`/projects/${PROJECT_ID}/backlog`, mine(other), mine(other));
    await screen.findByTestId('access-unavailable');

    await resume();

    await waitFor(() => expect(screen.getByTestId('access-unavailable')).toBeOnTheScreen());
    expect(screen.queryByTestId('access-revoked')).not.toBeOnTheScreen();
  });

  it('the project list itself drops a project the user was removed from when the app comes back', async () => {
    await open('/', mine(project('WRITER'), other), mine(other));
    expect(await screen.findByText('Website redesign')).toBeOnTheScreen();

    await resume();

    await waitFor(() => expect(screen.queryByText('Website redesign')).not.toBeOnTheScreen());
    expect(screen.getByText('Product launch')).toBeOnTheScreen();
  });

  it('a member who still has access keeps the board as it was', async () => {
    await open(boardUrl, ...board(), ...board());
    await screen.findByText('Draft the sitemap');

    await resume();

    await waitFor(() => expect(screen.getByText('Draft the sitemap')).toBeOnTheScreen());
    expect(screen.queryByTestId('access-revoked')).not.toBeOnTheScreen();
  });
});

describe('Access can’t be checked', () => {
  it('is never shown as a refusal: Couldn’t connect, Try again repeats the check', async () => {
    await open(projectUrl, 'network-error', mine(project('WRITER')));

    expect(await screen.findByRole('header', { name: 'Couldn’t connect' })).toBeOnTheScreen();
    expect(screen.getByText('We couldn’t check project access.')).toBeOnTheScreen();
    expect(screen.getByTestId('form-error')).toHaveTextContent('Check your connection and try again.');
    expect(screen.queryByTestId('access-unavailable')).not.toBeOnTheScreen();
    expect(screen.getByTestId('back-to-projects')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('access-retry'));
    expect(await screen.findByText('Sprint board')).toBeOnTheScreen();
  });

  it('a failed check on resume keeps what was confirmed before', async () => {
    await open(boardUrl, ...board(), 'network-error');
    await screen.findByText('Draft the sitemap');

    await resume();

    await waitFor(() => expect(screen.getByText('Draft the sitemap')).toBeOnTheScreen());
    expect(screen.queryByTestId('access-revoked')).not.toBeOnTheScreen();
  });
});

describe('An expired session', () => {
  it('hides the project, asks to log in, and after login goes back to the board, checked again', async () => {
    const { router } = await open(boardUrl, ...board(), expiredToken);
    await screen.findByText('Draft the sitemap');

    await resume();

    expect(await screen.findByRole('header', { name: 'Your session has expired' })).toBeOnTheScreen();
    expect(screen.queryByText('Draft the sitemap')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('session-expired-login'));
    // The projects come first (the guard opens them), then the board is read and checked again.
    const afterLogin = mockFetch(loginPayload(), mine(project('WRITER'), other), ...board());
    await fireEvent.changeText(screen.getByTestId('email-input'), EMAIL);
    await fireEvent.changeText(screen.getByTestId('password-input'), PASSWORD);
    await fireEvent.press(screen.getByTestId('submit-button'));

    await waitFor(() => expect(router).toHavePathname(boardUrl));
    expect(await screen.findByText('Draft the sitemap')).toBeOnTheScreen();
    expect(sent(afterLogin).map((b) => b.query)).toContain(BOARD_WITH_TASKS_QUERY);
  });

  it('shows “Project unavailable” after login if the membership is gone by then', async () => {
    const { router } = await open(boardUrl, ...board(), expiredToken);
    await screen.findByText('Draft the sitemap');
    await resume();
    await fireEvent.press(await screen.findByTestId('session-expired-login'));

    mockFetch(loginPayload(), mine(other), boardGone());
    await fireEvent.changeText(screen.getByTestId('email-input'), EMAIL);
    await fireEvent.changeText(screen.getByTestId('password-input'), PASSWORD);
    await fireEvent.press(screen.getByTestId('submit-button'));

    await waitFor(() => expect(router).toHavePathname(boardUrl));
    expect(await screen.findByTestId('access-unavailable')).toBeOnTheScreen();
    expect(screen.queryByText('Draft the sitemap')).not.toBeOnTheScreen();
  });
});

describe('A screen left open in the foreground', () => {
  /** The tests run on fake timers (renderRouter's): time passes only when advanced. */
  const wait = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
    await act(async () => {
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
  };
  const projectsCalls = (fetchMock: jest.Mock) => sent(fetchMock).filter((b) => b.query === PROJECTS_QUERY).length;

  it('finds the removal with the periodic check and clears the board, without any touch', async () => {
    await open(boardUrl, ...board(), mine(project('WRITER'), other), mine(other));
    expect(await screen.findByText('Draft the sitemap')).toBeOnTheScreen();

    await wait(ACCESS_CHECK_INTERVAL_MS - 1000);
    // Nothing before the interval.
    expect(screen.getByText('Draft the sitemap')).toBeOnTheScreen();
    await wait(1000); // First check: still a member.
    expect(screen.getByText('Draft the sitemap')).toBeOnTheScreen();
    await wait(ACCESS_CHECK_INTERVAL_MS); // Second check: removed.
    expect(await screen.findByTestId('access-revoked')).toBeOnTheScreen();
    expect(screen.queryByText('Draft the sitemap')).not.toBeOnTheScreen();
  });

  it('a member who keeps access keeps the board, and the checks go on', async () => {
    const { fetchMock } = await open(boardUrl, ...board(), ...Array(20).fill(mine(project('WRITER'), other)));
    await screen.findByText('Draft the sitemap');
    const before = projectsCalls(fetchMock);

    await wait(ACCESS_CHECK_INTERVAL_MS);
    await wait(ACCESS_CHECK_INTERVAL_MS);
    expect(projectsCalls(fetchMock)).toBe(before + 2);
    expect(screen.getByText('Draft the sitemap')).toBeOnTheScreen();
    expect(screen.queryByTestId('access-revoked')).not.toBeOnTheScreen();
  });

  it('stops while the app is in the background', async () => {
    const { fetchMock } = await open(boardUrl, ...board(), ...Array(20).fill(mine(project('WRITER'), other)));
    await screen.findByText('Draft the sitemap');

    await act(async () => appStateListeners.forEach((listener) => listener('background')));
    const before = fetchMock.mock.calls.length;
    await wait(ACCESS_CHECK_INTERVAL_MS * 3);
    expect(fetchMock.mock.calls.length).toBe(before);
  });

  it('stops when the screen is left, and a form doesn’t check (nobody’s typing is replaced)', async () => {
    const { fetchMock } = await open(taskUrl, ...board(), ...board(), ...Array(20).fill(mine(project('WRITER'), other)));
    await screen.findByText('Draft the sitemap');

    await fireEvent.press(screen.getByTestId('edit-task-button'));
    expect(await screen.findByDisplayValue('Draft the sitemap')).toBeOnTheScreen();
    const before = fetchMock.mock.calls.length;
    await wait(ACCESS_CHECK_INTERVAL_MS * 3);
    expect(fetchMock.mock.calls.length).toBe(before);
  });

  it('clears every open screen of the project, not only the one that found out', async () => {
    const { router } = await open(boardUrl, ...board(), ...board(), mine(other));
    await fireEvent.press(await screen.findByText('Draft the sitemap'));
    await waitFor(() => expect(router).toHavePathname(`/tasks/${TASK.id}`));
    await screen.findByTestId('task-details-screen');

    // The task's screen finds the removal; the board under it, still in the stack, clears at the
    // same moment, so Back can't show it again.
    await wait(ACCESS_CHECK_INTERVAL_MS);
    expect(await screen.findByTestId('access-revoked')).toBeOnTheScreen();
    const hidden = { includeHiddenElements: true };
    expect(screen.getAllByTestId('access-revoked', hidden)).toHaveLength(2);
    expect(screen.queryByText('Draft the sitemap', hidden)).not.toBeOnTheScreen();
  });
});

describe('Pull-to-refresh and opening a screen again', () => {
  const pull = async (testID: string) => {
    const scroll = screen.getByTestId(testID);
    await act(async () => (scroll.props.refreshControl.props.onRefresh as () => void)());
  };

  it('pulling the project screen asks the backend again: a refusal clears it', async () => {
    await open(projectUrl, mine(project('WRITER'), other), mine(other));
    await screen.findByText('Sprint board');

    await pull('project-screen-scroll');

    expect(await screen.findByTestId('access-revoked')).toBeOnTheScreen();
    expect(screen.queryByText('Sprint board')).not.toBeOnTheScreen();
  });

  it('pulling an open task asks the backend again: a refusal clears it', async () => {
    await open(taskUrl, ...board(), boardGone());
    await screen.findByText('Draft the sitemap');

    await pull('task-details-screen-scroll');

    expect(await screen.findByTestId('access-revoked')).toBeOnTheScreen();
    expect(screen.queryByText('Draft the sitemap')).not.toBeOnTheScreen();
  });

  it('coming back to the project screen reads it again from the backend', async () => {
    await open(projectUrl, mine(project('WRITER'), other), ...board(), mine(other));
    await fireEvent.press(await screen.findByTestId(`open-board-${BOARD_ID}`));
    await screen.findByText('Draft the sitemap');

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByTestId('access-revoked')).toBeOnTheScreen();
    expect(screen.queryByText('Sprint board')).not.toBeOnTheScreen();
  });
});

describe('Every protected screen checks access first', () => {
  it.each([
    ['edit', 'Edit task'],
    ['subtask', 'Create subtask'],
    ['dependencies', 'Task dependencies'],
  ])('a direct link to a task’s %s screen: Checking access, then the refusal, never the task', async (screenPath) => {
    resetSecureStore(storedSession());
    let answer!: (value: unknown) => void;
    const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
    const queue = [async () => ok(meResponse().body), () => new Promise((resolve) => (answer = resolve))];
    globalThis.fetch = jest.fn(() => queue.shift()!()) as unknown as typeof fetch;
    await renderApp(`/tasks/${TASK.id}/${screenPath}?boardId=${BOARD_ID}`);

    expect(await screen.findByTestId('access-checking')).toBeOnTheScreen();
    expect(screen.queryByTestId('save-button')).not.toBeOnTheScreen();

    await act(async () => answer(ok((boardGone() as { body: unknown }).body)));
    expect(await screen.findByTestId('access-unavailable')).toBeOnTheScreen();
    expect(screen.queryByText('Draft the sitemap')).not.toBeOnTheScreen();
  });

  it('a task missing from a board the user can see is unavailable, without clearing the project elsewhere', async () => {
    await open(taskUrl, boardResponse([]), mine(project('WRITER'), other));

    expect(await screen.findByTestId('access-unavailable')).toBeOnTheScreen();
    expect(hasLostAccess(PROJECT_ID)).toBe(false);
  });

  it('the list of all boards checks access first too, and lists only the user’s', async () => {
    await open('/boards', mine(project('READER')));
    expect(await screen.findByLabelText('Sprint board')).toBeOnTheScreen();
    expect(screen.queryByText('Launch board')).not.toBeOnTheScreen();
  });
});

describe('Refusal, connection and server problems are told apart', () => {
  it('a server error (HTTP 500) is the server’s problem, never “no access” or “check your connection”', async () => {
    await open(projectUrl, { status: 500, body: { errors: [{ message: 'Unexpected Execution Error' }] } }, mine(project('WRITER')));

    expect(await screen.findByRole('header', { name: 'Couldn’t check access' })).toBeOnTheScreen();
    expect(screen.getByText('Something went wrong on the server. Try again in a moment.')).toBeOnTheScreen();
    expect(screen.queryByTestId('access-unavailable')).not.toBeOnTheScreen();
    expect(screen.queryByText('Check your connection and try again.')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('access-retry'));
    expect(await screen.findByText('Sprint board')).toBeOnTheScreen();
  });

  it('an unexpected error code is a server problem too, not a refusal', async () => {
    await open(projectUrl, { body: gqlError('SOMETHING_ELSE', 'Boom') });
    expect(await screen.findByTestId('access-service-problem')).toBeOnTheScreen();
  });

  it('AUTH_NOT_AUTHORIZED is a refusal', async () => {
    await open(boardUrl, { body: gqlError('AUTH_NOT_AUTHORIZED', 'Not allowed.') });
    expect(await screen.findByTestId('access-unavailable')).toBeOnTheScreen();
  });

  it('a lost connection after the board was shown keeps it, and is not a refusal', async () => {
    await open(boardUrl, ...board(), 'network-error');
    await screen.findByText('Draft the sitemap');
    await resume();
    await waitFor(() => expect(screen.getByText('Draft the sitemap')).toBeOnTheScreen());
    expect(screen.queryByTestId('access-revoked')).not.toBeOnTheScreen();
  });
});

describe('The backlog’s title', () => {
  it('shows no project name, not even the link’s, until the backend confirms it; then the backend’s', async () => {
    resetSecureStore(storedSession());
    const answers: ((value: unknown) => void)[] = [];
    const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
    const queue = [async () => ok(meResponse().body), () => new Promise((resolve) => answers.push(resolve))];
    globalThis.fetch = jest.fn(() => (queue.length ? queue.shift()!() : new Promise((resolve) => answers.push(resolve)))) as unknown as typeof fetch;
    await renderApp(`/projects/${PROJECT_ID}/backlog?projectName=Someone%20else%27s%20name`);

    expect(await screen.findByTestId('access-checking')).toBeOnTheScreen();
    expect(screen.queryByText(/Someone else|Website redesign/i)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('task-breadcrumb')).not.toBeOnTheScreen();

    await act(async () => answers[0](ok(mine(project('READER')).body)));
    expect(await screen.findByTestId('task-breadcrumb')).toHaveTextContent('WEBSITE REDESIGN');
    expect(screen.queryByText(/Someone else/i)).not.toBeOnTheScreen();
  });
});

describe('safeReturnPath', () => {
  it.each([
    [boardUrl, boardUrl],
    [taskUrl, taskUrl],
    [projectUrl, projectUrl],
    [`${projectUrl}/backlog`, `${projectUrl}/backlog`],
    ['https://evil.example/boards', null],
    ['//evil.example', null],
    ['/login', null],
    [`${boardUrl}?next=https://evil.example`, null],
    [null, null],
  ])('keeps only the app’s own screens: %s', (path, expected) => {
    expect(safeReturnPath(path)).toBe(expected);
  });
});
