import { router as appRouter } from 'expo-router';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { PROJECTS_QUERY } from '../src/api/boards';
import { WORKLOAD_QUERY, type MemberWorkloadNode, type ProjectWorkloadNode, type WorkloadTaskNode } from '../src/api/workload';
import { setSession } from '../src/auth/session';
import {
  CLOSED_STATUSES,
  LOADING_WORKLOAD,
  NO_OPEN_WORK,
  OPEN_STATUSES,
  WORKLOAD_REFRESH_FAILED,
  WORKLOAD_UNAVAILABLE_TITLE,
  barFraction,
  toProjectWorkload,
} from '../src/domain/workload';
import type { ColumnCategory, TaskPriority } from '../src/domain/models';
import type { ProjectNode } from '../src/api/boards';
import { API_URL, BOARD_ID, PROJECTS, PROJECT_ID, gqlError } from '../test-utils/fakeBackend';
import { meResponse, renderApp, storedSession } from '../test-utils/renderApp';
import { resetSecureStore } from '../test-utils/secureStoreMock';

jest.mock('expo-secure-store', () => require('../test-utils/secureStoreMock'));

const MINA = '01a18766-479c-7ec2-be3f-3c3a00989a01';
const DOMBELE = '01a18766-479c-7ec2-be3f-3c3a00989a02';
const SEIF = '01a18766-479c-7ec2-be3f-3c3a00989a03';
const OTHER_BOARD = '01a18766-48b5-7fb8-a04c-13e1bf648d99';

const COLUMN: Record<ColumnCategory, string> = {
  BACKLOG: 'Backlog',
  TO_DO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const idOf = (n: number) => `01a18766-8315-7c9c-90fd-5657de97${String(n).padStart(4, '0')}`;
const task = (
  n: number,
  title: string,
  status: ColumnCategory = 'TO_DO',
  priority: TaskPriority | null = 'MEDIUM',
  boardId = BOARD_ID,
): WorkloadTaskNode => ({
  id: idOf(n),
  readableId: `TES-${n}`,
  title,
  status,
  priority,
  boardId,
  column: { name: COLUMN[status] },
});

const member = (userId: string, userName: string, openTasks: WorkloadTaskNode[], role = 'WRITER'): MemberWorkloadNode => ({
  userId,
  userName,
  role,
  openTaskCount: openTasks.length,
  openTasks,
});

const T31 = task(31, 'Prepare launch checklist', 'TO_DO', 'HIGH');
const T32 = task(32, 'Review permissions', 'IN_PROGRESS', 'MEDIUM');
const T33 = task(33, 'Update project guide', 'TO_DO', 'LOW');
const T34 = task(34, 'Review handoff', 'TO_DO', 'HIGH');
const minaTasks = [T31, T32, ...Array.from({ length: 6 }, (_, i) => task(40 + i, `Mina task ${i + 1}`, 'BACKLOG'))];
const dombeleTasks = [task(50, 'Dombele task 1'), task(51, 'Dombele task 2'), task(52, 'Dombele task 3')];

/** The design's workload: 8, 3 and 0 open tasks, and 3 unassigned — in the backend's order. */
const DESIGN: ProjectWorkloadNode = {
  averageOpenTasks: 3.67,
  members: [
    member(MINA, 'Mina Joao', minaTasks, 'OWNER'),
    member(DOMBELE, 'Dombele Joao', dombeleTasks),
    member(SEIF, 'Seif Hesham', [], 'READER'),
  ],
  unassigned: [T33, T34, task(35, 'Third unassigned')],
};

const projects = (role: string | null, boards = [{ id: BOARD_ID, name: 'Test Board' }]): ProjectNode[] =>
  PROJECTS.map((p) => (p.id === PROJECT_ID ? { ...p, role, boards } : p));

type Answer = { body: unknown } | 'network-error' | Promise<{ body: unknown }>;

/**
 * Answers by query, since the screens read the project and the workload at the same time:
 * `projects` always gets `projectList`; each `workload` request takes the next answer in line.
 */
function backend({ projectList = projects('OWNER'), workloads = [] as Answer[] } = {}) {
  const queue = [...workloads];
  const fetchMock = jest.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { query: string };
    const respond = (payload: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(payload) });
    if (body.query === PROJECTS_QUERY) return respond({ data: { projects: projectList } });
    if (body.query === WORKLOAD_QUERY) {
      const next = queue.shift();
      if (next === undefined) throw new Error('unexpected workload request');
      if (next === 'network-error') throw new TypeError('Network request failed');
      return respond((await next).body);
    }
    if (body.query.includes('me {') || body.query.includes('query Me')) return respond(meResponse().body);
    return respond({ data: null, errors: [{ message: 'Not part of this test' }] });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const answer = (workload: ProjectWorkloadNode) => ({ body: { data: { workload } } });
const workloadCalls = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls
    .map(([, init]) => JSON.parse((init as RequestInit).body as string) as { query: string; variables: unknown })
    .filter((b) => b.query === WORKLOAD_QUERY);

const workloadUrl = `/projects/${PROJECT_ID}/workload`;

async function openWorkload(options: Parameters<typeof backend>[0]) {
  resetSecureStore(storedSession());
  const fetchMock = backend(options);
  const router = await renderApp(workloadUrl);
  return { router, fetchMock };
}

/** Member names in the order shown. */
const memberOrder = () =>
  screen.queryAllByTestId(/^member-[0-9a-f-]{36}$/).map((card) => (card.props.accessibilityLabel as string).split(', ')[0]);
const countOf = (userId: string) => screen.getByTestId(`member-count-${userId}`);
const barWidth = (userId: string) =>
  (screen.getByTestId(`member-bar-${userId}`, { includeHiddenElements: true }).children[0] as unknown as { props: { style: { width: string }[] } }).props.style[1]
    .width;
const taskTitles = () => screen.queryAllByTestId(/^workload-task-/).map((row) => (row.props.accessibilityLabel as string).split(', ')[0]);

async function pullToRefresh() {
  const { refreshControl } = screen.getByTestId('workload-screen-scroll').props as {
    refreshControl: { props: { onRefresh: () => void } };
  };
  await act(async () => {
    refreshControl.props.onRefresh();
  });
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setSession(null);
});

describe('Team workload', () => {
  it('opens from the project list for the owner and shows every member’s open-task count and bar, as in the design', async () => {
    resetSecureStore(storedSession());
    const fetchMock = backend({ workloads: [answer(DESIGN)] });
    const router = await renderApp('/');

    await fireEvent.press(await screen.findByRole('button', { name: 'Team workload of Test Project' }));

    await waitFor(() => expect(router).toHavePathname(`/projects/${PROJECT_ID}/workload`));
    await screen.findByTestId(`member-${MINA}`);
    expect(screen.getByText('Test Project · Open tasks')).toBeOnTheScreen();
    expect(screen.getByText('Counts exclude completed tasks.')).toBeOnTheScreen();
    // The backend's order: most open tasks first. Every member is listed, also with 0.
    expect(memberOrder()).toEqual(['Mina Joao', 'Dombele Joao', 'Seif Hesham']);
    expect(countOf(MINA)).toHaveTextContent('8 open');
    expect(countOf(DOMBELE)).toHaveTextContent('3 open');
    expect(countOf(SEIF)).toHaveTextContent('0 open');
    // The bars repeat the counts: the busiest fills it.
    expect(barWidth(MINA)).toBe('100%');
    expect(barWidth(DOMBELE)).toBe('38%');
    expect(barWidth(SEIF)).toBe('0%');
    expect(screen.getByTestId(`member-${SEIF}`).props.accessibilityLabel).toBe('Seif Hesham, 0 open tasks');
    // No overload label of its own: only the counts and bars.
    expect(screen.queryByText(/overload/i)).not.toBeOnTheScreen();
    expect(within(screen.getByTestId('unassigned-summary')).getByText('3 open tasks · Separate from member totals')).toBeOnTheScreen();

    const calls = workloadCalls(fetchMock);
    expect(calls).toHaveLength(1);
    expect(calls[0].query).toContain('workload(projectId: $projectId)');
    expect(calls[0].variables).toEqual({ projectId: PROJECT_ID });
  });

  it.each(['WRITER', 'READER'])('doesn’t offer the view to a %s, and a direct link says it is unavailable without asking for it', async (role) => {
    resetSecureStore(storedSession());
    const fetchMock = backend({ projectList: projects(role) });
    await renderApp('/');
    await screen.findByRole('button', { name: 'View the backlog of Test Project' });
    expect(screen.queryByRole('button', { name: 'Team workload of Test Project' })).not.toBeOnTheScreen();

    await act(async () => appRouter.push(workloadUrl));

    expect(await screen.findByTestId('workload-unavailable')).toBeOnTheScreen();
    expect(screen.getByText(WORKLOAD_UNAVAILABLE_TITLE)).toBeOnTheScreen();
    expect(screen.getByText('Only authorized project roles can open this view.')).toBeOnTheScreen();
    expect(workloadCalls(fetchMock)).toHaveLength(0);
  });

  it('shows the unavailable screen when the backend refuses the owner view by role', async () => {
    await openWorkload({
      workloads: [{ body: gqlError('AUTH_NOT_AUTHORIZED', 'Only the owner of the project can see the workload.') }],
    });

    expect(await screen.findByTestId('workload-unavailable')).toBeOnTheScreen();
    expect(screen.queryByTestId(`member-${MINA}`)).not.toBeOnTheScreen();
  });

  it('shows the access screen when the project isn’t there for the user', async () => {
    await openWorkload({ workloads: [{ body: gqlError('NOT_FOUND', `Project '${PROJECT_ID}' was not found.`) }] });

    expect(await screen.findByTestId('access-unavailable')).toBeOnTheScreen();
  });

  it('shows “Loading current assignments…” and no count until the backend answers', async () => {
    let release!: (value: { body: unknown }) => void;
    await openWorkload({ workloads: [new Promise((resolve) => (release = resolve))] });

    expect(await screen.findByText(LOADING_WORKLOAD)).toBeOnTheScreen();
    expect(screen.queryByText(/\d+ open/)).not.toBeOnTheScreen();

    await act(async () => release(answer(DESIGN)));
    expect(await screen.findByTestId(`member-${MINA}`)).toBeOnTheScreen();
  });

  it('shows the error with Try again, never zero counts, when the workload can’t be read', async () => {
    const { fetchMock } = await openWorkload({ workloads: ['network-error', answer(DESIGN)] });

    expect(await screen.findByTestId('workload-error')).toHaveTextContent(/couldn’t reach the server/);
    expect(screen.queryByText(/\d+ open/)).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('workload-retry'));
    expect(await screen.findByTestId(`member-${MINA}`)).toBeOnTheScreen();
    expect(workloadCalls(fetchMock)).toHaveLength(2);
  });

  it('says there is no open work, still listing every member with 0', async () => {
    await openWorkload({
      workloads: [
        answer({
          averageOpenTasks: 0,
          members: [member(DOMBELE, 'Dombele Joao', []), member(MINA, 'Mina Joao', [], 'OWNER')],
          unassigned: [],
        }),
      ],
    });

    expect(await screen.findByTestId('workload-empty')).toHaveTextContent(NO_OPEN_WORK);
    expect(memberOrder()).toEqual(['Dombele Joao', 'Mina Joao']);
    expect(within(screen.getByTestId(`member-${MINA}`)).getByText('0 open tasks')).toBeOnTheScreen();
    expect(screen.getByTestId('back-to-project')).toBeOnTheScreen();
  });

  it('reads the counts again on pull-to-refresh: a reassigned task and a completed task change them', async () => {
    // Since the first read, T31 was reassigned from Mina to Seif, and T32 was completed (so it's gone).
    const after: ProjectWorkloadNode = {
      averageOpenTasks: 3,
      members: [
        member(MINA, 'Mina Joao', minaTasks.slice(2), 'OWNER'),
        member(DOMBELE, 'Dombele Joao', dombeleTasks),
        member(SEIF, 'Seif Hesham', [T31], 'READER'),
      ],
      unassigned: DESIGN.unassigned,
    };
    const { fetchMock } = await openWorkload({ workloads: [answer(DESIGN), answer(after)] });
    await screen.findByTestId(`member-${MINA}`);

    await pullToRefresh();

    await waitFor(() => expect(countOf(MINA)).toHaveTextContent('6 open'));
    expect(countOf(SEIF)).toHaveTextContent('1 open');
    expect(barWidth(DOMBELE)).toBe('50%');
    expect(workloadCalls(fetchMock)).toHaveLength(2);
  });

  it('keeps the last counts, marked as not current, when a refresh fails', async () => {
    await openWorkload({ workloads: [answer(DESIGN), 'network-error'] });
    await screen.findByTestId(`member-${MINA}`);

    await pullToRefresh();

    expect(await screen.findByTestId('workload-stale')).toHaveTextContent(WORKLOAD_REFRESH_FAILED);
    expect(countOf(MINA)).toHaveTextContent('8 open');
  });
});

describe('Member’s open tasks', () => {
  it('opens a member’s open tasks with status and priority, and opens a task with its id and board', async () => {
    const { router, fetchMock } = await openWorkload({ workloads: [answer(DESIGN), answer(DESIGN)] });

    await fireEvent.press(await screen.findByTestId(`member-${MINA}`));

    await waitFor(() => expect(router).toHavePathname(`/projects/${PROJECT_ID}/workload/member/${MINA}`));
    expect(await screen.findByText('Mina Joao’s open tasks')).toBeOnTheScreen();
    expect(screen.getByTestId('workload-list-subtitle')).toHaveTextContent('Test Project · 8 open tasks');
    expect(taskTitles().slice(0, 2)).toEqual(['Prepare launch checklist', 'Review permissions']);
    expect(within(screen.getByTestId(`workload-task-${T31.id}`)).getByText('TES-31 · To do · High')).toBeOnTheScreen();
    expect(within(screen.getByTestId(`workload-task-${T32.id}`)).getByText('TES-32 · In progress · Medium')).toBeOnTheScreen();
    expect(screen.getByTestId('workload-showing')).toHaveTextContent('Showing 8 of 8 open tasks');
    // Only Mina's tasks: none of Dombele's, none unassigned.
    expect(taskTitles()).not.toContain('Dombele task 1');
    expect(taskTitles()).not.toContain('Update project guide');
    // The list is read from the backend again, not carried over.
    expect(workloadCalls(fetchMock)).toHaveLength(2);

    await fireEvent.press(screen.getByTestId(`workload-task-${T32.id}`));
    await waitFor(() => expect(router).toHavePathname(`/tasks/${T32.id}`));
    expect(router).toHaveSearchParams({ taskId: T32.id, boardId: BOARD_ID });
  });

  it('says so when the member has no open tasks', async () => {
    await openWorkload({ workloads: [answer(DESIGN), answer(DESIGN)] });

    await fireEvent.press(await screen.findByTestId(`member-${SEIF}`));

    expect(await screen.findByTestId('workload-list-empty')).toHaveTextContent('No open tasks are assigned to Seif Hesham.');
    expect(screen.getByTestId('workload-list-subtitle')).toHaveTextContent('Test Project · 0 open tasks');
    expect(taskTitles()).toEqual([]);
  });

  it('shows a long list 20 at a time, counting the whole list', async () => {
    const many = Array.from({ length: 25 }, (_, i) => task(100 + i, `Busy task ${i + 1}`));
    const busy: ProjectWorkloadNode = { averageOpenTasks: 25, members: [member(MINA, 'Mina Joao', many, 'OWNER')], unassigned: [] };
    await openWorkload({ workloads: [answer(busy), answer(busy)] });
    await fireEvent.press(await screen.findByTestId(`member-${MINA}`));

    await screen.findByTestId('workload-showing');
    expect(taskTitles()).toHaveLength(20);
    expect(screen.getByTestId('workload-showing')).toHaveTextContent('Showing 20 of 25 open tasks');

    await fireEvent.press(screen.getByTestId('workload-load-more'));
    expect(taskTitles()).toHaveLength(25);
    expect(screen.getByTestId('workload-showing')).toHaveTextContent('Showing 25 of 25 open tasks');
    expect(screen.queryByTestId('workload-load-more')).not.toBeOnTheScreen();
  });

  it('reads the workload again on return, so a task reassigned from its details is no longer counted', async () => {
    const after: ProjectWorkloadNode = {
      ...DESIGN,
      members: [member(MINA, 'Mina Joao', minaTasks.slice(1), 'OWNER'), DESIGN.members[1], member(SEIF, 'Seif Hesham', [T31], 'READER')],
    };
    const { router } = await openWorkload({ workloads: [answer(DESIGN), answer(DESIGN), answer(after)] });
    await fireEvent.press(await screen.findByTestId(`member-${MINA}`));
    await screen.findByText('Mina Joao’s open tasks');

    await fireEvent.press(screen.getByTestId('back-to-workload'));

    await waitFor(() => expect(router).toHavePathname(`/projects/${PROJECT_ID}/workload`));
    await waitFor(() => expect(countOf(MINA)).toHaveTextContent('7 open'));
    expect(countOf(SEIF)).toHaveTextContent('1 open');
  });

  it('says the person left when they’re no longer a member', async () => {
    const left: ProjectWorkloadNode = { ...DESIGN, members: DESIGN.members.filter((m) => m.userId !== DOMBELE) };
    resetSecureStore(storedSession());
    backend({ workloads: [answer(left)] });
    await renderApp(`/projects/${PROJECT_ID}/workload/member/${DOMBELE}`);

    expect(await screen.findByTestId('member-gone')).toBeOnTheScreen();
    expect(taskTitles()).toEqual([]);
  });

  it('names the board when the project has several', async () => {
    const onOther = task(36, 'On the second board', 'IN_PROGRESS', 'LOW', OTHER_BOARD);
    const twoBoards: ProjectWorkloadNode = { averageOpenTasks: 2, members: [member(MINA, 'Mina Joao', [T31, onOther], 'OWNER')], unassigned: [] };
    resetSecureStore(storedSession());
    backend({
      projectList: projects('OWNER', [
        { id: BOARD_ID, name: 'Test Board' },
        { id: OTHER_BOARD, name: 'Launch board' },
      ]),
      workloads: [answer(twoBoards)],
    });
    await renderApp(`/projects/${PROJECT_ID}/workload/member/${MINA}`);

    expect(await screen.findByText('TES-36 · In progress · Low · Launch board')).toBeOnTheScreen();
    expect(screen.getByText('TES-31 · To do · High · Test Board')).toBeOnTheScreen();
  });
});

describe('Unassigned work', () => {
  it('lists the open tasks nobody in the project is assigned to, apart from member totals', async () => {
    const { router } = await openWorkload({ workloads: [answer(DESIGN), answer(DESIGN)] });

    await fireEvent.press(await screen.findByTestId('view-unassigned'));

    await waitFor(() => expect(router).toHavePathname(`/projects/${PROJECT_ID}/workload/unassigned`));
    expect(await screen.findByText('Review handoff')).toBeOnTheScreen();
    expect(screen.getByTestId('workload-list-subtitle')).toHaveTextContent('Test Project · 3 open tasks');
    expect(taskTitles()).toEqual(['Update project guide', 'Review handoff', 'Third unassigned']);
    expect(within(screen.getByTestId(`workload-task-${T34.id}`)).getByText('TES-34 · To do · High')).toBeOnTheScreen();
  });
});

describe('Counting rules', () => {
  it('uses the backend’s rule for open work: BACKLOG, TO_DO and IN_PROGRESS; never DONE or CANCELLED', () => {
    expect(OPEN_STATUSES).toEqual(['BACKLOG', 'TO_DO', 'IN_PROGRESS']);
    expect(CLOSED_STATUSES).toEqual(['DONE', 'CANCELLED']);
  });

  it('counts a task with two assignees once for each of them, and never twice for the same member', () => {
    const shared = task(60, 'Shared task');
    const workload = toProjectWorkload({
      averageOpenTasks: 1.5,
      members: [
        { ...member(MINA, 'Mina Joao', [shared, task(61, 'Own task')], 'OWNER') },
        member(DOMBELE, 'Dombele Joao', [shared]),
      ],
      unassigned: [task(62, 'Nobody'), task(62, 'Nobody')],
    });
    expect(workload.members.map((m) => [m.userName, m.openTaskCount, m.openTasks.map((t) => t.readableId)])).toEqual([
      ['Mina Joao', 2, ['TES-60', 'TES-61']],
      ['Dombele Joao', 1, ['TES-60']],
    ]);
    // A task listed twice in one group is shown once.
    expect(workload.unassigned.map((t) => t.readableId)).toEqual(['TES-62']);
  });

  it('shows the backend’s counts, member by member, in the backend’s order', async () => {
    const shared = task(60, 'Shared task');
    await openWorkload({
      workloads: [
        answer({
          averageOpenTasks: 1.5,
          members: [member(MINA, 'Mina Joao', [shared, task(61, 'Own task')], 'OWNER'), member(DOMBELE, 'Dombele Joao', [shared])],
          unassigned: [],
        }),
      ],
    });

    await screen.findByTestId(`member-${MINA}`);
    expect(countOf(MINA)).toHaveTextContent('2 open');
    expect(countOf(DOMBELE)).toHaveTextContent('1 open');
    expect(barWidth(DOMBELE)).toBe('50%');
  });

  it('makes the bar the share of the highest count', () => {
    expect(barFraction(8, 8)).toBe(1);
    expect(barFraction(3, 8)).toBe(0.375);
    expect(barFraction(0, 8)).toBe(0);
    expect(barFraction(0, 0)).toBe(0);
  });
});

describe('Entry from the project', () => {
  it.each([
    ['OWNER', true],
    ['WRITER', false],
    ['READER', false],
  ])('shows Team workload on the project screen only to the owner (%s)', async (role, shown) => {
    resetSecureStore(storedSession());
    backend({ projectList: projects(role), workloads: [answer(DESIGN)] });
    const router = await renderApp(`/projects/${PROJECT_ID}`);

    await screen.findByTestId('project-subtitle');
    if (!shown) {
      expect(screen.queryByTestId('team-workload-button')).not.toBeOnTheScreen();
      return;
    }
    await fireEvent.press(screen.getByTestId('team-workload-button'));
    await waitFor(() => expect(router).toHavePathname(`/projects/${PROJECT_ID}/workload`));
    expect(await screen.findByTestId(`member-${MINA}`)).toBeOnTheScreen();
  });
});
