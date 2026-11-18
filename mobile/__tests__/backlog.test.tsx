import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { BACKLOG_QUERY, type BacklogItemNode } from '../src/api/backlog';
import { setSession } from '../src/auth/session';
import {
  LOAD_FAILED_TEXT,
  LOAD_MORE_FAILED,
  appendPage,
  backlogVariables,
  EMPTY_QUERY,
} from '../src/domain/backlog';
import type { ColumnCategory, TaskPriority } from '../src/domain/models';
import {
  API_URL,
  BOARD_ID,
  PROJECT_ID,
  type FakeResponse,
  gqlError,
  mockFetch,
  projectsResponse,
} from '../test-utils/fakeBackend';
import { meResponse, renderApp, storedSession } from '../test-utils/renderApp';
import { resetSecureStore } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

const OTHER_BOARD = '01a18766-48b5-7fb8-a04c-13e1bf648d99';
const COLUMN_NAMES: Record<ColumnCategory, string> = {
  BACKLOG: 'Backlog',
  TO_DO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const item = (
  n: number,
  title: string,
  status: ColumnCategory = 'BACKLOG',
  priority: TaskPriority | null = null,
  storyPoints: number | null = null,
  boardId = BOARD_ID,
): BacklogItemNode => ({
  id: `01a18766-8315-7c9c-90fd-5657de97${String(n).padStart(4, '0')}`,
  readableId: `TES-${n}`,
  title,
  status,
  priority,
  storyPoints,
  boardId,
  column: { name: COLUMN_NAMES[status] },
});

/** The four items of the design, from two boards of the project, in the backend's order. */
const DESIGN = [
  item(31, 'Prepare the launch checklist', 'TO_DO', 'HIGH', 3),
  item(32, 'Review project permissions', 'IN_PROGRESS', 'CRITICAL', 5, OTHER_BOARD),
  item(33, 'Update the project guide', 'BACKLOG', 'LOW'),
  item(34, 'Explore notification preferences', 'BACKLOG', null),
];

const page = (items: BacklogItemNode[], { totalCount = items.length, pageNumber = 1, hasNextPage = false } = {}) => ({
  body: {
    data: {
      backlog: {
        items,
        totalCount,
        page: pageNumber,
        pageSize: 20,
        totalPages: Math.max(1, Math.ceil(totalCount / 20)),
        hasNextPage,
      },
    },
  },
});

/** 20 items numbered from `start`. */
const many = (start: number, count = 20) =>
  Array.from({ length: count }, (_, i) => item(start + i, `Backlog task ${start + i}`, 'TO_DO', 'MEDIUM', 1));

type Sent = { query: string; variables: Record<string, unknown> };
const backlogCalls = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls
    .map(([, init]) => JSON.parse((init as RequestInit).body as string) as Sent)
    .filter((b) => b.query === BACKLOG_QUERY);
const lastVariables = (fetchMock: jest.Mock) => backlogCalls(fetchMock).at(-1)!.variables;

const backlogUrl = `/projects/${PROJECT_ID}/backlog?projectName=Test%20Project`;

async function openBacklog(...responses: FakeResponse[]) {
  resetSecureStore(storedSession());
  const fetchMock = mockFetch(meResponse(), ...responses);
  const router = await renderApp(backlogUrl);
  return { router, fetchMock };
}

const rowTitles = () =>
  screen.queryAllByTestId(/^backlog-item-/).map((row) => (row.props.accessibilityLabel as string).split(', ').slice(0, 3).join(', '));

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
});

describe('Project backlog', () => {
  it('opens from the project and lists the backend’s items from all its boards, in its order, as in the design', async () => {
    resetSecureStore(storedSession());
    const fetchMock = mockFetch(meResponse(), projectsResponse(), page(DESIGN));
    const router = await renderApp('/');

    await fireEvent.press(await screen.findByRole('button', { name: 'View the backlog of Test Project' }));

    await waitFor(() => expect(router).toHavePathname(`/projects/${PROJECT_ID}/backlog`));
    expect(await screen.findByTestId('backlog-count')).toHaveTextContent('4 items · Ordered by backlog position');
    expect(screen.getByTestId('task-breadcrumb')).toHaveTextContent('TEST PROJECT');
    expect(screen.getByRole('header', { name: 'Project backlog' })).toBeOnTheScreen();
    expect(screen.getByText('Upcoming work, in one ordered list.')).toBeOnTheScreen();

    // Exactly the server's order, numbered by position, across both boards.
    expect(rowTitles()).toEqual([
      '1, TES-31, Prepare the launch checklist',
      '2, TES-32, Review project permissions',
      '3, TES-33, Update the project guide',
      '4, TES-34, Explore notification preferences',
    ]);
    const first = screen.getByTestId(`backlog-item-${DESIGN[0].id}`);
    expect(within(first).getByText('1 · TES-31')).toBeOnTheScreen();
    expect(within(first).getByText('To do · High')).toBeOnTheScreen();
    expect(within(first).getByText('Estimate: 3 points')).toBeOnTheScreen();
    const third = screen.getByTestId(`backlog-item-${DESIGN[2].id}`);
    expect(within(third).getByText('Backlog · Low')).toBeOnTheScreen();
    expect(within(third).getByText('Estimate: Not estimated')).toBeOnTheScreen();
    expect(within(screen.getByTestId(`backlog-item-${DESIGN[3].id}`)).getByText('Backlog · No priority')).toBeOnTheScreen();

    // One project-scoped query: the backend decides which tasks belong to the project.
    const calls = backlogCalls(fetchMock);
    expect(calls).toHaveLength(1);
    expect(calls[0].query).toContain('backlog(projectId: $projectId, search: $search, where: $where, page: $page, pageSize: $pageSize)');
    expect(calls[0].variables).toEqual({ projectId: PROJECT_ID, page: 1, pageSize: 20 });
    expect(screen.getByTestId('backlog-end')).toBeOnTheScreen();
    expect(screen.queryByTestId('load-more')).not.toBeOnTheScreen();
  });

  it('shows only what the backend returns for the project, without sorting it', async () => {
    const reversed = [...DESIGN].reverse();
    await openBacklog(page(reversed));

    await screen.findByTestId('backlog-count');
    expect(rowTitles().map((t) => t.split(', ')[1])).toEqual(['TES-34', 'TES-33', 'TES-32', 'TES-31']);
  });

  it('shows grey placeholders and “Loading backlog…” first, never the empty state', async () => {
    resetSecureStore(storedSession());
    let answer!: (value: unknown) => void;
    const queue: (() => Promise<unknown>)[] = [
      async () => ({ ok: true, status: 200, text: async () => JSON.stringify(meResponse().body) }),
      () => new Promise((resolve) => (answer = resolve)),
    ];
    globalThis.fetch = jest.fn(() => queue.shift()!()) as unknown as typeof fetch;
    await renderApp(backlogUrl);

    expect(await screen.findByText('Loading backlog…')).toBeOnTheScreen();
    expect(screen.getByTestId('backlog-loading')).toBeOnTheScreen();
    expect(screen.queryByTestId('backlog-empty')).not.toBeOnTheScreen();

    answer({ ok: true, status: 200, text: async () => JSON.stringify(page(DESIGN).body) });
    expect(await screen.findByTestId('backlog-count')).toBeOnTheScreen();
  });

  it('says there is nothing yet for an empty backlog, with Back to project', async () => {
    await openBacklog(page([]));

    const empty = await screen.findByTestId('backlog-empty');
    expect(within(empty).getByText('No backlog items yet')).toBeOnTheScreen();
    expect(within(empty).getByText('Tasks added to this project’s backlog will appear here.')).toBeOnTheScreen();
    expect(within(empty).getByRole('button', { name: 'Back to project' })).toBeOnTheScreen();
  });

  it.each([
    ['no response', 'network-error' as const, LOAD_FAILED_TEXT],
    ['a server error', { status: 500, body: { errors: [{ message: 'Unexpected Execution Error' }] } }, LOAD_FAILED_TEXT],
    ['a refused query', { body: gqlError('BAD_USER_INPUT', 'Search cannot be longer than 200 characters.') }, 'Search cannot be longer than 200 characters.'],
  ])('shows the load error for %s, and Try again fetches the list again', async (_, failure, message) => {
    const { fetchMock } = await openBacklog(failure as FakeResponse, page(DESIGN));

    const error = await screen.findByTestId('backlog-error');
    expect(within(error).getByText('Couldn’t load the backlog')).toBeOnTheScreen();
    expect(within(error).getByText(message)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('backlog-count')).toHaveTextContent(/^4 items/);
    expect(backlogCalls(fetchMock)).toHaveLength(2);
  });

  it('opens a task from its row', async () => {
    const { router } = await openBacklog(page(DESIGN), { body: { data: null, errors: [{ message: 'x' }] } });

    await fireEvent.press(await screen.findByTestId(`backlog-item-${DESIGN[1].id}`));

    await waitFor(() => expect(router).toHavePathname(`/tasks/${DESIGN[1].id}`));
  });
});

describe('Search', () => {
  it('sends the title to the backend and shows what it matches', async () => {
    const { fetchMock } = await openBacklog(page(DESIGN), page([DESIGN[0]]));
    await screen.findByTestId('backlog-count');

    await fireEvent.changeText(screen.getByTestId('backlog-search'), 'checklist');

    await waitFor(() => expect(backlogCalls(fetchMock)).toHaveLength(2));
    expect(lastVariables(fetchMock)).toEqual({ projectId: PROJECT_ID, search: 'checklist', page: 1, pageSize: 20 });
    await waitFor(() => expect(rowTitles()).toEqual(['1, TES-31, Prepare the launch checklist']));
  });

  it('shows the no-match state with a way to clear the search', async () => {
    const { fetchMock } = await openBacklog(page(DESIGN), page([]), page(DESIGN));
    await screen.findByTestId('backlog-count');

    await fireEvent.changeText(screen.getByTestId('backlog-search'), 'nothing like this');

    const empty = await screen.findByTestId('backlog-empty');
    expect(within(empty).getByText('No matching backlog items')).toBeOnTheScreen();
    await fireEvent.press(within(empty).getByRole('button', { name: 'Clear search and filters' }));
    expect(await screen.findByTestId('backlog-count')).toHaveTextContent(/^4 items/);
    expect(lastVariables(fetchMock)).toEqual({ projectId: PROJECT_ID, page: 1, pageSize: 20 });
  });

  it('starts again from page 1 when the search changes', async () => {
    const { fetchMock } = await openBacklog(
      page(many(1), { totalCount: 25, hasNextPage: true }),
      page(many(21, 5), { totalCount: 25, pageNumber: 2 }),
      page([DESIGN[0]]),
    );
    await fireEvent.press(await screen.findByTestId('load-more'));
    await waitFor(() => expect(rowTitles()).toHaveLength(25));

    await fireEvent.changeText(screen.getByTestId('backlog-search'), 'launch');

    await waitFor(() => expect(rowTitles()).toEqual(['1, TES-31, Prepare the launch checklist']));
    expect(lastVariables(fetchMock)).toEqual({ projectId: PROJECT_ID, search: 'launch', page: 1, pageSize: 20 });
  });

  it('never lets an older search’s late answer replace the newer one', async () => {
    resetSecureStore(storedSession());
    const answers: ((value: unknown) => void)[] = [];
    const respond = (index: number, body: unknown) =>
      answers[index]({ ok: true, status: 200, text: async () => JSON.stringify(body) });
    const fetchMock = jest.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query !== BACKLOG_QUERY) return { ok: true, status: 200, text: async () => JSON.stringify(meResponse().body) };
      return new Promise((resolve) => answers.push(resolve));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await renderApp(backlogUrl);
    await waitFor(() => expect(answers).toHaveLength(1));
    respond(0, page(DESIGN).body);
    await screen.findByTestId('backlog-count');

    await fireEvent.changeText(screen.getByTestId('backlog-search'), 'project');
    await waitFor(() => expect(answers).toHaveLength(2));
    await fireEvent.changeText(screen.getByTestId('backlog-search'), 'launch');
    await waitFor(() => expect(answers).toHaveLength(3));

    // The newer search answers first, then the older one arrives late.
    respond(2, page([DESIGN[0]]).body);
    await waitFor(() => expect(rowTitles()).toEqual(['1, TES-31, Prepare the launch checklist']));
    respond(1, page([DESIGN[1], DESIGN[2]]).body);
    // Let the late answer settle (it resolves through promises only; timers are faked here).
    await act(async () => {
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
    expect(rowTitles()).toEqual(['1, TES-31, Prepare the launch checklist']);
  });
});

describe('Filters', () => {
  it('sends the chosen statuses and priorities, together and with the search, and starts from page 1', async () => {
    const { fetchMock } = await openBacklog(
      page(many(1), { totalCount: 25, hasNextPage: true }),
      page(many(21, 5), { totalCount: 25, pageNumber: 2 }),
      page([DESIGN[0], DESIGN[1]]),
      page([DESIGN[0], DESIGN[1]]),
      page([DESIGN[1]]),
      page([DESIGN[1]]),
    );
    await fireEvent.press(await screen.findByTestId('load-more'));
    await waitFor(() => expect(rowTitles()).toHaveLength(25));

    await fireEvent.press(screen.getByTestId('status-TO_DO'));
    await waitFor(() => expect(backlogCalls(fetchMock)).toHaveLength(3));
    expect(lastVariables(fetchMock)).toEqual({
      projectId: PROJECT_ID,
      where: { status: { in: ['TO_DO'] } },
      page: 1,
      pageSize: 20,
    });
    expect(screen.getByTestId('status-TO_DO').props.accessibilityState).toMatchObject({ checked: true });

    await fireEvent.press(await screen.findByTestId('status-IN_PROGRESS'));
    await waitFor(() => expect(backlogCalls(fetchMock)).toHaveLength(4));

    await fireEvent.press(screen.getByTestId('priority-CRITICAL'));
    await waitFor(() => expect(backlogCalls(fetchMock)).toHaveLength(5));
    expect(lastVariables(fetchMock)).toEqual({
      projectId: PROJECT_ID,
      where: { status: { in: ['TO_DO', 'IN_PROGRESS'] }, priority: { in: ['CRITICAL'] } },
      page: 1,
      pageSize: 20,
    });

    await fireEvent.changeText(screen.getByTestId('backlog-search'), 'permissions');
    await waitFor(() => expect(backlogCalls(fetchMock)).toHaveLength(6));
    expect(lastVariables(fetchMock)).toEqual({
      projectId: PROJECT_ID,
      search: 'permissions',
      where: { status: { in: ['TO_DO', 'IN_PROGRESS'] }, priority: { in: ['CRITICAL'] } },
      page: 1,
      pageSize: 20,
    });
    await waitFor(() => expect(rowTitles()).toEqual(['1, TES-32, Review project permissions']));
  });

  it('clears the filters and asks for the unfiltered list, keeping the search', async () => {
    const { fetchMock } = await openBacklog(page(DESIGN), page([DESIGN[0]]), page([DESIGN[0]]), page(DESIGN));
    await screen.findByTestId('backlog-count');
    await fireEvent.press(screen.getByTestId('priority-HIGH'));
    await waitFor(() => expect(backlogCalls(fetchMock)).toHaveLength(2));
    await fireEvent.press(await screen.findByTestId('status-TO_DO'));
    await waitFor(() => expect(backlogCalls(fetchMock)).toHaveLength(3));

    await fireEvent.press(await screen.findByTestId('clear-filters'));

    await waitFor(() => expect(backlogCalls(fetchMock)).toHaveLength(4));
    expect(lastVariables(fetchMock)).toEqual({ projectId: PROJECT_ID, page: 1, pageSize: 20 });
    expect(await screen.findByTestId('backlog-count')).toHaveTextContent(/^4 items/);
    expect(screen.queryByTestId('clear-filters')).not.toBeOnTheScreen();
  });

  it('builds variables with only what is set', () => {
    expect(backlogVariables('p', EMPTY_QUERY, 1)).toEqual({ projectId: 'p', page: 1, pageSize: 20 });
    expect(backlogVariables('p', { search: '  guide  ', statuses: [], priorities: ['LOW'] }, 3)).toEqual({
      projectId: 'p',
      search: 'guide',
      where: { priority: { in: ['LOW'] } },
      page: 3,
      pageSize: 20,
    });
  });
});

describe('Pagination', () => {
  it('loads the next page with the same search and filters, adds it in order, and stops at the last page', async () => {
    const pageOne = many(1);
    // Page 2 repeats the last item of page 1, as can happen when the backlog changes in between.
    const pageTwo = [pageOne[19], ...many(21, 5)];
    const { fetchMock } = await openBacklog(
      page(pageOne, { totalCount: 25, hasNextPage: true }),
      page(pageOne, { totalCount: 25, hasNextPage: true }),
      page(pageTwo, { totalCount: 25, pageNumber: 2 }),
    );
    await screen.findByTestId('load-more');
    await fireEvent.press(screen.getByTestId('priority-MEDIUM'));
    await waitFor(() => expect(backlogCalls(fetchMock)).toHaveLength(2));
    expect(await screen.findByTestId('backlog-count')).toHaveTextContent(/^25 items/);

    await fireEvent.press(await screen.findByTestId('load-more'));

    await waitFor(() => expect(rowTitles()).toHaveLength(25));
    expect(lastVariables(fetchMock)).toEqual({
      projectId: PROJECT_ID,
      where: { priority: { in: ['MEDIUM'] } },
      page: 2,
      pageSize: 20,
    });
    const keys = rowTitles().map((t) => t.split(', ')[1]);
    expect(keys).toEqual(Array.from({ length: 25 }, (_, i) => `TES-${i + 1}`));
    expect(rowTitles()[20]).toBe('21, TES-21, Backlog task 21');
    expect(new Set(keys).size).toBe(25);

    // The last page: no Load more, and no further request.
    expect(screen.queryByTestId('load-more')).not.toBeOnTheScreen();
    expect(screen.getByTestId('backlog-end')).toHaveTextContent('End of the backlog.');
    expect(backlogCalls(fetchMock)).toHaveLength(3);
  });

  it('keeps the list while the next page loads, and sends only one request however often it is tapped', async () => {
    await openBacklog(page(many(1), { totalCount: 25, hasNextPage: true }));
    await screen.findByTestId('load-more');
    let answer!: (value: unknown) => void;
    const pending = jest.fn(() => new Promise((resolve) => (answer = resolve)));
    globalThis.fetch = pending as unknown as typeof fetch;

    await fireEvent.press(screen.getByTestId('load-more'));
    await fireEvent.press(screen.getByTestId('load-more'));

    expect(screen.getByText('Loading more…')).toBeOnTheScreen();
    expect(rowTitles()).toHaveLength(20);
    expect(screen.queryByTestId('backlog-loading')).not.toBeOnTheScreen();
    expect(pending).toHaveBeenCalledTimes(1);

    answer({ ok: true, status: 200, text: async () => JSON.stringify(page(many(21, 5), { totalCount: 25, pageNumber: 2 }).body) });
    await waitFor(() => expect(rowTitles()).toHaveLength(25));
  });

  it('keeps the loaded items when the next page fails, and can ask for it again', async () => {
    const { fetchMock } = await openBacklog(
      page(many(1), { totalCount: 25, hasNextPage: true }),
      'network-error',
      page(many(21, 5), { totalCount: 25, pageNumber: 2 }),
    );
    await fireEvent.press(await screen.findByTestId('load-more'));

    expect(await screen.findByTestId('load-more-error')).toHaveTextContent(LOAD_MORE_FAILED);
    expect(rowTitles()).toHaveLength(20);

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(rowTitles()).toHaveLength(25));
    expect(screen.queryByTestId('load-more-error')).not.toBeOnTheScreen();
    expect(backlogCalls(fetchMock).map((c) => c.variables.page)).toEqual([1, 2, 2]);
  });

  it('adds a page without repeating items already shown', () => {
    const shown = DESIGN.slice(0, 2).map((n) => ({ ...n, columnName: n.column.name }));
    const next = DESIGN.slice(1).map((n) => ({ ...n, columnName: n.column.name }));
    expect(appendPage(shown, next).map((i) => i.readableId)).toEqual(['TES-31', 'TES-32', 'TES-33', 'TES-34']);
  });
});
