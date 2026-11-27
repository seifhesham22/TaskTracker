import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { BOARD_TASKS_QUERY, type BoardTasksVariables } from '../src/api/boardTasks';
import { BOARD_WITH_TASKS_QUERY, PROJECTS_QUERY, type TaskNode } from '../src/api/boards';
import BoardScreen from '../src/app/boards/[boardId]';
import { setSession } from '../src/auth/session';
import type { ColumnCategory, TaskPriority } from '../src/domain/models';
import {
  CLEARED,
  LOAD_FAILED,
  NO_FILTERS,
  NO_MATCHES,
  REFRESH_FAILED,
  boardStatuses,
  boardTasksVariables,
  criteriaSummary,
  filterChips,
  withoutFilter,
} from '../src/domain/taskFilters';
import {
  API_URL,
  BOARD_ID,
  BOARD_NODE,
  COLUMNS,
  PROJECTS,
  PROJECT_MEMBERS,
  USER_ID,
  gqlError,
  taskNode,
} from '../test-utils/fakeBackend';
import { meResponse, renderApp, storedSession } from '../test-utils/renderApp';
import { resetSecureStore } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

const ADMIN = PROJECT_MEMBERS[0]; // admin@local.test
const USER1 = PROJECT_MEMBERS[1]; // user1@local.test
const OTHER_BOARD = '01a18766-48b5-7fb8-a04c-13e1bf648d99';

const columnOf = (status: ColumnCategory) => COLUMNS.find((c) => c.category === status)!;
const node = (
  n: number,
  title: string,
  status: ColumnCategory,
  priority: TaskPriority | null,
  assignees: { userId: string; userName: string }[],
  boardId = BOARD_ID,
): TaskNode =>
  taskNode({
    id: `01a18766-8315-7c9c-90fd-5657de97${String(n).padStart(4, '0')}`,
    number: n,
    readableId: `TES-${n}`,
    title,
    status,
    priority,
    boardId,
    columnId: columnOf(status).id,
    column: { id: columnOf(status).id, name: columnOf(status).name, category: status },
    assignees: assignees.map((a) => ({ id: a.userId, userName: a.userName })),
    dueDate: null,
  });

/** The design's tasks, in creation order, plus a task of another board the backend never returns. */
const T31 = node(31, 'Prepare launch checklist', 'TO_DO', 'HIGH', [USER1]);
const T32 = node(32, 'Review permissions', 'IN_PROGRESS', 'MEDIUM', [ADMIN]);
const T33 = node(33, 'Update project guide', 'TO_DO', 'LOW', []);
const T34 = node(34, 'Launch party planning', 'IN_PROGRESS', 'HIGH', [ADMIN, USER1]);
const T35 = node(35, 'Write launch notes', 'TO_DO', null, []);
const ELSEWHERE = node(90, 'Launch on another board', 'TO_DO', 'HIGH', [USER1], OTHER_BOARD);
const ALL = [T31, T32, T33, T34, T35, ELSEWHERE];

/** What the backend does with `tasks(boardId, search, where)` (GetTasksHandler, docs/api/queries/tasks.md). */
function serve(variables: BoardTasksVariables, tasks = ALL): TaskNode[] {
  const term = variables.search?.trim().toLowerCase() ?? '';
  const w = variables.where ?? {};
  return tasks
    .filter((t) => t.boardId === variables.boardId)
    .filter((t) => !term || t.title.toLowerCase().includes(term))
    .filter((t) => !w.status || t.status === w.status.eq)
    .filter((t) => !w.priority || t.priority === w.priority.eq)
    .filter((t) => {
      if (!w.assignees) return true;
      if ('any' in w.assignees) return t.assignees.length === 0;
      const id = w.assignees.some.userId.eq;
      return t.assignees.some((a) => a.id === id);
    })
    .sort((a, b) => a.number - b.number);
}

type Override = 'network-error' | { body: unknown } | Promise<{ body: unknown }>;

/** Answers by query. Each `tasks` request is served from ALL unless an override is queued for it. */
function backend({ overrides = [] as Override[], tasks = ALL } = {}) {
  const queue = [...overrides];
  const fetchMock = jest.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { query: string; variables: Record<string, unknown> };
    const respond = (payload: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(payload) });
    if (body.query === PROJECTS_QUERY) return respond({ data: { projects: PROJECTS } });
    if (body.query === BOARD_WITH_TASKS_QUERY) {
      return respond({ data: { board: BOARD_NODE, tasks: tasks.filter((t) => t.boardId === BOARD_ID) } });
    }
    if (body.query === BOARD_TASKS_QUERY) {
      const next = queue.shift();
      if (next === 'network-error') throw new TypeError('Network request failed');
      if (next) return respond((await next).body);
      return respond({ data: { tasks: serve(body.variables as unknown as BoardTasksVariables, tasks) } });
    }
    if (body.query.includes('query Me')) return respond(meResponse().body);
    return respond({ data: null, errors: [{ message: 'Not part of this test' }] });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const tasksCalls = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls
    .map(([, init]) => JSON.parse((init as RequestInit).body as string) as { query: string; variables: unknown })
    .filter((b) => b.query === BOARD_TASKS_QUERY)
    .map((b) => b.variables);
const lastVariables = (fetchMock: jest.Mock) => tasksCalls(fetchMock).at(-1);

const searchUrl = `/boards/tasks/${BOARD_ID}`;

async function openSearch(options: Parameters<typeof backend>[0] = {}) {
  resetSecureStore(storedSession());
  const fetchMock = backend(options);
  const router = await renderApp(searchUrl);
  await screen.findByTestId('tasks-count');
  return { router, fetchMock };
}

const keys = () => screen.queryAllByTestId(/^task-row-/).map((row) => (row.props.accessibilityLabel as string).split(', ')[1].split(' · ')[0]);

async function chooseStatus(label: string, key: string) {
  await fireEvent.press(screen.getByTestId('filter-status'));
  await fireEvent.press(await screen.findByTestId(`status-sheet-option-${key}`));
  expect(screen.getByTestId('filter-status')).toHaveTextContent(label);
}

async function choosePriority(key: string) {
  await fireEvent.press(screen.getByTestId('filter-priority'));
  await fireEvent.press(await screen.findByTestId(`priority-sheet-option-${key}`));
}

async function chooseAssignee(key: string) {
  await fireEvent.press(screen.getByTestId('filter-assignee'));
  await fireEvent.press(await screen.findByTestId(`assignee-option-${key}`));
  await fireEvent.press(screen.getByTestId('apply-assignee'));
  await screen.findByTestId('filter-tasks');
}

async function openFilters() {
  await fireEvent.press(screen.getByTestId('open-filters'));
  await screen.findByTestId('filter-tasks');
}

async function applyFilters() {
  await fireEvent.press(screen.getByTestId('apply-filters'));
  await screen.findByTestId('board-tasks-screen');
}

async function typeSearch(text: string, fetchMock: jest.Mock, calls: number) {
  await fireEvent.changeText(screen.getByTestId('task-search'), text);
  await waitFor(() => expect(tasksCalls(fetchMock)).toHaveLength(calls));
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
});

describe('Board tasks', () => {
  it('opens from the board’s search button and lists the board’s tasks, in the backend’s order, as in the design', async () => {
    resetSecureStore(storedSession());
    const fetchMock = backend();
    const router = await renderApp(`/boards/${BOARD_ID}`, { 'boards/[boardId]': BoardScreen });

    await fireEvent.press(await screen.findByTestId('board-search-button'));

    await waitFor(() => expect(router).toHavePathname(searchUrl));
    expect(await screen.findByTestId('tasks-count')).toHaveTextContent('5 tasks · Permitted board tasks');
    expect(screen.getByText('Test Project / Test Board')).toBeOnTheScreen();
    expect(screen.getByText('Search task titles')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Search by title…')).toBeOnTheScreen();
    expect(screen.getByTestId('open-filters')).toHaveTextContent('Filters');
    expect(keys()).toEqual(['TES-31', 'TES-32', 'TES-33', 'TES-34', 'TES-35']);
    expect(within(screen.getByTestId(`task-row-${T31.id}`)).getByText('TES-31 · To do · High · user1@local.test')).toBeOnTheScreen();
    expect(within(screen.getByTestId(`task-row-${T33.id}`)).getByText('TES-33 · To do · Low · Unassigned')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId(`task-row-${T34.id}`)).getByText('TES-34 · In progress · High · admin@local.test, user1@local.test'),
    ).toBeOnTheScreen();
    // One request for the board only: no search, no filters. Never the other board's task.
    expect(tasksCalls(fetchMock)).toEqual([{ boardId: BOARD_ID }]);
    expect(keys()).not.toContain('TES-90');
  });

  it('shows “Loading matching tasks…” first, never an empty result', async () => {
    let release!: (value: { body: unknown }) => void;
    resetSecureStore(storedSession());
    backend({ overrides: [new Promise((resolve) => (release = resolve))] });
    await renderApp(searchUrl);

    expect(await screen.findByText('Loading matching tasks…')).toBeOnTheScreen();
    expect(screen.queryByTestId('tasks-no-match')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('tasks-empty')).not.toBeOnTheScreen();

    await act(async () => release({ body: { data: { tasks: [T31] } } }));
    expect(await screen.findByTestId('tasks-count')).toHaveTextContent('1 task · Permitted board tasks');
  });

  it('says the board has no tasks, which is not a “no match”', async () => {
    resetSecureStore(storedSession());
    backend({ tasks: [] });
    await renderApp(searchUrl);

    expect(await screen.findByTestId('tasks-empty')).toHaveTextContent('This board has no tasks yet.');
    expect(screen.queryByText(NO_MATCHES)).not.toBeOnTheScreen();
  });

  it('opens a task from its row with its id and board', async () => {
    const { router } = await openSearch();

    await fireEvent.press(screen.getByTestId(`task-row-${T32.id}`));

    await waitFor(() => expect(router).toHavePathname(`/tasks/${T32.id}`));
    expect(router).toHaveSearchParams({ taskId: T32.id, boardId: BOARD_ID });
  });

  it('shows the access screen when the board isn’t there for the user', async () => {
    resetSecureStore(storedSession());
    const fetchMock = jest.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { query: string };
      const payload = body.query.includes('query Me')
        ? meResponse().body
        : gqlError('NOT_FOUND', `Board '${BOARD_ID}' was not found.`);
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await renderApp(searchUrl);

    expect(await screen.findByTestId('access-unavailable')).toBeOnTheScreen();
    expect(screen.queryByTestId(/^task-row-/)).not.toBeOnTheScreen();
  });
});

describe('Title search', () => {
  it('sends part of a title to the backend and shows what it matches, in any case', async () => {
    const { fetchMock } = await openSearch();

    await typeSearch('  LAUNCH ', fetchMock, 2);

    expect(lastVariables(fetchMock)).toEqual({ boardId: BOARD_ID, search: 'LAUNCH' });
    await waitFor(() => expect(keys()).toEqual(['TES-31', 'TES-34', 'TES-35']));
    expect(screen.getByTestId('tasks-count')).toHaveTextContent('3 matching tasks');
  });

  it('shows the no-match state with Adjust filters, and an emptied search brings the full list back', async () => {
    const { fetchMock } = await openSearch();

    await typeSearch('nothing like this', fetchMock, 2);
    expect(await screen.findByTestId('tasks-no-match')).toHaveTextContent(NO_MATCHES);
    expect(screen.getByTestId('adjust-filters')).toBeOnTheScreen();

    await typeSearch('', fetchMock, 3);
    expect(lastVariables(fetchMock)).toEqual({ boardId: BOARD_ID });
    await waitFor(() => expect(keys()).toHaveLength(5));
  });

  it('never lets an older search’s late answer replace the newer one', async () => {
    let releaseOld!: (value: { body: unknown }) => void;
    let releaseNew!: (value: { body: unknown }) => void;
    const { fetchMock } = await openSearch({
      overrides: [
        { body: { data: { tasks: [T31, T32, T33, T34, T35] } } },
        new Promise((resolve) => (releaseOld = resolve)),
        new Promise((resolve) => (releaseNew = resolve)),
      ],
    });

    await typeSearch('review', fetchMock, 2);
    await typeSearch('launch', fetchMock, 3);
    await act(async () => releaseNew({ body: { data: { tasks: [T31] } } }));
    await waitFor(() => expect(keys()).toEqual(['TES-31']));
    await act(async () => releaseOld({ body: { data: { tasks: [T32] } } }));

    expect(keys()).toEqual(['TES-31']);
  });
});

describe('Filters', () => {
  it('filters by one status from the board’s own columns, with a chip and a count, and the chip removes it', async () => {
    const { fetchMock } = await openSearch();
    await openFilters();
    expect(screen.getByText('Test Board · Changes apply on confirmation')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('filter-status'));
    const sheet = await screen.findByTestId('status-sheet');
    expect(within(sheet).getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
      'Any status',
      'Backlog',
      'To do',
      'In progress',
      'Done',
    ]);
    await fireEvent.press(within(sheet).getByTestId('status-sheet-option-TO_DO'));
    await applyFilters();

    await waitFor(() => expect(keys()).toEqual(['TES-31', 'TES-33', 'TES-35']));
    expect(lastVariables(fetchMock)).toEqual({ boardId: BOARD_ID, where: { status: { eq: 'TO_DO' } } });
    expect(screen.getByTestId('open-filters')).toHaveTextContent('Filters · 1');
    expect(screen.getByTestId('chip-status')).toHaveTextContent('To do ×');
    expect(screen.getByTestId('criteria-summary')).toHaveTextContent('1 filter');

    await fireEvent.press(screen.getByTestId('chip-status'));
    await waitFor(() => expect(keys()).toHaveLength(5));
    expect(lastVariables(fetchMock)).toEqual({ boardId: BOARD_ID });
  });

  it('offers the project’s members by name, with Anyone and Unassigned, and filters by the member’s id', async () => {
    const { fetchMock } = await openSearch();
    await openFilters();
    await fireEvent.press(screen.getByTestId('filter-assignee'));

    const picker = await screen.findByTestId('assignee-picker');
    expect(within(picker).getAllByRole('radio').map((r) => (r.props.accessibilityLabel as string).split(', ')[0])).toEqual([
      'Anyone',
      'Unassigned',
      'admin@local.test',
      'user1@local.test',
    ]);
    expect(screen.getByTestId('assignee-option-anyone').props.accessibilityState).toMatchObject({ checked: true });
    // The member search narrows the list.
    await fireEvent.changeText(screen.getByTestId('assignee-search'), 'USER1');
    expect(screen.queryByTestId(`assignee-option-${ADMIN.userId}`)).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`assignee-option-${USER1.userId}`));
    await fireEvent.press(screen.getByTestId('apply-assignee'));
    expect(await screen.findByTestId('filter-assignee')).toHaveTextContent('user1@local.test');
    await applyFilters();

    // A task with two assignees matches each of them.
    await waitFor(() => expect(keys()).toEqual(['TES-31', 'TES-34']));
    expect(lastVariables(fetchMock)).toEqual({
      boardId: BOARD_ID,
      where: { assignees: { some: { userId: { eq: USER1.userId } } } },
    });
    expect(screen.getByTestId('chip-assignee')).toHaveTextContent('user1@local.test ×');

    await fireEvent.press(screen.getByTestId('chip-assignee'));
    await waitFor(() => expect(keys()).toHaveLength(5));
  });

  it('filters unassigned tasks with the backend’s “no assignee” filter', async () => {
    const { fetchMock } = await openSearch();
    await openFilters();
    await chooseAssignee('unassigned');
    await applyFilters();

    await waitFor(() => expect(keys()).toEqual(['TES-33', 'TES-35']));
    expect(lastVariables(fetchMock)).toEqual({ boardId: BOARD_ID, where: { assignees: { any: false } } });
    expect(screen.getByTestId('chip-assignee')).toHaveTextContent('Unassigned ×');
  });

  it('filters by one priority, and by no priority, from the backend’s values', async () => {
    const { fetchMock } = await openSearch();
    await openFilters();
    await fireEvent.press(screen.getByTestId('filter-priority'));
    const sheet = await screen.findByTestId('priority-sheet');
    expect(within(sheet).getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
      'Any priority',
      'No priority',
      'Low',
      'Medium',
      'High',
      'Critical',
    ]);
    await fireEvent.press(within(sheet).getByTestId('priority-sheet-option-HIGH'));
    await applyFilters();

    await waitFor(() => expect(keys()).toEqual(['TES-31', 'TES-34']));
    expect(lastVariables(fetchMock)).toEqual({ boardId: BOARD_ID, where: { priority: { eq: 'HIGH' } } });

    await openFilters();
    await choosePriority('NONE');
    await applyFilters();
    await waitFor(() => expect(keys()).toEqual(['TES-35']));
    expect(lastVariables(fetchMock)).toEqual({ boardId: BOARD_ID, where: { priority: { eq: null } } });

    await fireEvent.press(screen.getByTestId('chip-priority'));
    await waitFor(() => expect(keys()).toHaveLength(5));
  });

  it('keeps the filters in force on Cancel, and Reset only clears the draft until Apply', async () => {
    const { fetchMock } = await openSearch();
    await openFilters();
    await chooseStatus('To do', 'TO_DO');
    await applyFilters();
    await waitFor(() => expect(keys()).toHaveLength(3));
    const calls = tasksCalls(fetchMock).length;

    await openFilters();
    await choosePriority('HIGH');
    await fireEvent.press(screen.getByTestId('cancel-filters'));
    await screen.findByTestId('board-tasks-screen');
    expect(screen.getByTestId('open-filters')).toHaveTextContent('Filters · 1');
    expect(tasksCalls(fetchMock)).toHaveLength(calls);

    await openFilters();
    expect(screen.getByTestId('filter-status')).toHaveTextContent('To do');
    await fireEvent.press(screen.getByTestId('reset-filters'));
    expect(screen.getByTestId('filter-status')).toHaveTextContent('Any status');
    expect(tasksCalls(fetchMock)).toHaveLength(calls);
    await applyFilters();
    await waitFor(() => expect(keys()).toHaveLength(5));
    expect(lastVariables(fetchMock)).toEqual({ boardId: BOARD_ID });
  });
});

describe('Combined criteria', () => {
  it.each([
    ['status', async () => chooseStatus('In progress', 'IN_PROGRESS'), { status: { eq: 'IN_PROGRESS' } }, ['TES-34']],
    ['assignee', async () => chooseAssignee(USER1.userId), { assignees: { some: { userId: { eq: USER1.userId } } } }, ['TES-31', 'TES-34']],
    ['priority', async () => choosePriority('HIGH'), { priority: { eq: 'HIGH' } }, ['TES-31', 'TES-34']],
  ])('combines the search with the %s filter (AND)', async (_, choose, where, expected) => {
    const { fetchMock } = await openSearch();
    await typeSearch('launch', fetchMock, 2);
    await waitFor(() => expect(keys()).toHaveLength(3));

    await openFilters();
    await choose();
    await applyFilters();

    await waitFor(() => expect(keys()).toEqual(expected));
    expect(lastVariables(fetchMock)).toEqual({ boardId: BOARD_ID, search: 'launch', where });
    expect(screen.getByTestId('tasks-count')).toHaveTextContent(new RegExp(`^${expected.length} matching`));
  });

  it('applies all four together, each chip removing only its own filter', async () => {
    const { fetchMock } = await openSearch();
    await typeSearch('launch', fetchMock, 2);
    await openFilters();
    await chooseStatus('To do', 'TO_DO');
    await chooseAssignee(USER1.userId);
    await choosePriority('HIGH');
    await applyFilters();

    await waitFor(() => expect(keys()).toEqual(['TES-31']));
    expect(lastVariables(fetchMock)).toEqual({
      boardId: BOARD_ID,
      search: 'launch',
      where: {
        status: { eq: 'TO_DO' },
        priority: { eq: 'HIGH' },
        assignees: { some: { userId: { eq: USER1.userId } } },
      },
    });
    expect(screen.getByTestId('open-filters')).toHaveTextContent('Filters · 3');
    expect(screen.getByTestId('criteria-summary')).toHaveTextContent('Title contains “launch” · 3 filters');
    expect(screen.getByTestId('tasks-count')).toHaveTextContent('1 matching task');

    // Removing the status keeps the assignee, the priority and the search.
    await fireEvent.press(screen.getByTestId('chip-status'));
    await waitFor(() => expect(keys()).toEqual(['TES-31', 'TES-34']));
    expect(lastVariables(fetchMock)).toEqual({
      boardId: BOARD_ID,
      search: 'launch',
      where: { priority: { eq: 'HIGH' }, assignees: { some: { userId: { eq: USER1.userId } } } },
    });
  });

  it('shows no match after a successful empty answer, and Adjust filters opens the filters as they are', async () => {
    const { fetchMock } = await openSearch();
    await typeSearch('launch', fetchMock, 2);
    await openFilters();
    await chooseStatus('Done', 'DONE');
    await applyFilters();

    expect(await screen.findByTestId('tasks-no-match')).toHaveTextContent(NO_MATCHES);
    await fireEvent.press(screen.getByTestId('adjust-filters'));
    expect(await screen.findByTestId('filter-status')).toHaveTextContent('Done');
  });

  it('Clear all removes the search and every filter and reads the full board list again', async () => {
    const { fetchMock } = await openSearch();
    await typeSearch('launch', fetchMock, 2);
    await openFilters();
    await chooseStatus('To do', 'TO_DO');
    await chooseAssignee(ADMIN.userId);
    await applyFilters();
    await screen.findByTestId('tasks-no-match');

    await fireEvent.press(screen.getByTestId('clear-all'));

    await waitFor(() => expect(keys()).toEqual(['TES-31', 'TES-32', 'TES-33', 'TES-34', 'TES-35']));
    expect(lastVariables(fetchMock)).toEqual({ boardId: BOARD_ID });
    expect(screen.getByTestId('task-search').props.value).toBe('');
    expect(screen.getByTestId('open-filters')).toHaveTextContent('Filters');
    expect(screen.queryByTestId(/^chip-/)).not.toBeOnTheScreen();
    expect(screen.getByTestId('success-banner')).toHaveTextContent(CLEARED);
    expect(screen.getByTestId('tasks-count')).toHaveTextContent('5 tasks · Permitted board tasks');
  });
});

describe('Errors', () => {
  it('keeps the filters when the request fails, and Try again sends the same request', async () => {
    const { fetchMock } = await openSearch({ overrides: [{ body: { data: { tasks: serve({ boardId: BOARD_ID }) } } }, 'network-error'] });
    await openFilters();
    await choosePriority('HIGH');
    await applyFilters();

    expect(await screen.findByTestId('tasks-error')).toHaveTextContent(LOAD_FAILED);
    expect(screen.getByTestId('chip-priority')).toBeOnTheScreen();
    expect(screen.getByTestId('clear-all')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('tasks-retry'));
    await waitFor(() => expect(keys()).toEqual(['TES-31', 'TES-34']));
    const calls = tasksCalls(fetchMock);
    expect(calls.at(-1)).toEqual(calls.at(-2));
  });

  it('shows the backend’s reason for a refused search', async () => {
    const { fetchMock } = await openSearch({
      overrides: [
        { body: { data: { tasks: serve({ boardId: BOARD_ID }) } } },
        { body: gqlError('BAD_USER_INPUT', 'Search cannot be longer than 200 characters.') },
      ],
    });

    await typeSearch('x'.repeat(201), fetchMock, 2);

    expect(await screen.findByTestId('tasks-error')).toHaveTextContent(/Search cannot be longer than 200 characters\.$/);
  });

  it('keeps the last results, marked as not current, when a refresh fails', async () => {
    await openSearch({ overrides: [{ body: { data: { tasks: serve({ boardId: BOARD_ID }) } } }, 'network-error'] });

    const { refreshControl } = screen.getByTestId('board-tasks-screen-scroll').props as {
      refreshControl: { props: { onRefresh: () => void } };
    };
    await act(async () => refreshControl.props.onRefresh());

    expect(await screen.findByTestId('tasks-stale')).toHaveTextContent(REFRESH_FAILED);
    expect(keys()).toHaveLength(5);
  });
});

describe('Rules', () => {
  it('sends only what is set, trimmed', () => {
    expect(boardTasksVariables('b', '  ', NO_FILTERS)).toEqual({ boardId: 'b' });
    expect(boardTasksVariables('b', ' guide ', { status: null, assignee: { kind: 'unassigned' }, priority: null })).toEqual({
      boardId: 'b',
      search: 'guide',
      where: { priority: { eq: null }, assignees: { any: false } },
    });
  });

  it('lists the board’s statuses in column order, once each', () => {
    const columns = [COLUMNS[2], COLUMNS[0], { ...COLUMNS[1], id: 'x', position: 'z', category: 'TO_DO' as const }, COLUMNS[1]];
    expect(boardStatuses(columns)).toEqual(['BACKLOG', 'TO_DO', 'IN_PROGRESS']);
  });

  it('describes and removes filters one at a time', () => {
    const f = { status: 'TO_DO' as const, assignee: { kind: 'member' as const, userId: USER_ID }, priority: 'HIGH' as const };
    expect(filterChips(f, PROJECT_MEMBERS).map((c) => c.label)).toEqual(['To do', 'admin@local.test', 'High']);
    expect(withoutFilter(f, 'assignee')).toEqual({ ...f, assignee: { kind: 'anyone' } });
    expect(criteriaSummary('launch', f)).toBe('Title contains “launch” · 3 filters');
  });
});
