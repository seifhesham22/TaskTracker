import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { Text } from 'react-native';

import type { BoardNode, ColumnNode, TaskNode } from '../src/api/boards';
import BoardScreen from '../src/app/boards/[boardId]';
import BoardsScreen from '../src/app/boards/index';
import { BOARD_LOAD_NETWORK, BOARD_LOAD_SERVER, createBackendBoardRepository } from '../src/data/backendBoardRepository';
import { BoardRepositoryProvider } from '../src/data/BoardRepositoryContext';
import { initials } from '../src/domain/format';
import { API_URL, BOARD_ID, BOARD_NODE, USER_ID, gqlError, mockFetch, projectsResponse, taskNode } from '../test-utils/fakeBackend';

const INTAKE: ColumnNode = { id: '01a18766-0000-7000-8000-00000000d001', name: 'Intake', position: 'z', category: 'DONE' };
const REVIEW: ColumnNode = { id: '01a18766-0000-7000-8000-00000000d002', name: 'Peer review', position: 'a', category: 'BACKLOG' };
const SHIPPED: ColumnNode = { id: '01a18766-0000-7000-8000-00000000d003', name: 'Shipped', position: 'm', category: 'IN_PROGRESS' };
const CUSTOM_COLUMNS = [INTAKE, REVIEW, SHIPPED];

const board = (columns: ColumnNode[] = CUSTOM_COLUMNS): BoardNode => ({ ...BOARD_NODE, columns });

const inColumn = (column: ColumnNode, overrides: Partial<TaskNode> = {}): TaskNode =>
  taskNode({
    priority: null,
    dueDate: null,
    assignees: [],
    columnId: column.id,
    status: column.category,
    column: { id: column.id, name: column.name, category: column.category },
    ...overrides,
  });

const loaded = (columns: ColumnNode[], tasks: TaskNode[] = []) => [
  { body: { data: { board: board(columns), tasks } } },
  projectsResponse(),
];

const page = (column: ColumnNode) => screen.getByTestId(`column-page-${column.id}`);
const tabLabels = () => screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel);

async function renderBoard() {
  await renderRouter(
    {
      'boards/[boardId]': () => (
        <BoardRepositoryProvider repository={createBackendBoardRepository()}>
          <BoardScreen />
        </BoardRepositoryProvider>
      ),
      'boards/index': () => <Text>Boards list</Text>,
    },
    { initialUrl: `/boards/${BOARD_ID}` },
  );
}

async function pullToRefresh(column: ColumnNode) {
  const { refreshControl } = page(column).props as { refreshControl: { props: { onRefresh: () => void } } };
  await act(async () => {
    refreshControl.props.onRefresh();
  });
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  process.env.EXPO_PUBLIC_USER_ID = USER_ID;
});

afterAll(() => {
  delete process.env.EXPO_PUBLIC_USER_ID;
});

describe('Columns come from the board query', () => {
  it('shows the returned names in the returned order, without sorting them', async () => {
    mockFetch(...loaded(CUSTOM_COLUMNS));
    await renderBoard();

    await screen.findByText('Test Project · 0 tasks');
    expect(tabLabels()).toEqual(['Intake, 0 tasks', 'Peer review, 0 tasks', 'Shipped, 0 tasks']);
    for (const name of ['Backlog', 'To do', 'In progress', 'Done']) {
      expect(screen.queryByText(name)).not.toBeOnTheScreen();
    }
  });

  it('keeps empty columns visible next to a column with tasks', async () => {
    mockFetch(...loaded(CUSTOM_COLUMNS, [inColumn(REVIEW, { title: 'Only task' })]));
    await renderBoard();

    await screen.findByText('Test Project · 1 task');
    expect(tabLabels()).toEqual(['Intake, 0 tasks', 'Peer review, 1 task', 'Shipped, 0 tasks']);
    expect(within(page(INTAKE)).getByText('No tasks in this column')).toBeOnTheScreen();
    expect(within(page(SHIPPED)).getByText('No tasks in this column')).toBeOnTheScreen();
  });

  it('never shows default columns when the board query fails', async () => {
    mockFetch('network-error');
    await renderBoard();

    expect(await screen.findByText('Couldn’t load this board')).toBeOnTheScreen();
    expect(screen.getByText(BOARD_LOAD_NETWORK)).toBeOnTheScreen();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('says the failure came from the server when the server answers with an error', async () => {
    mockFetch({ status: 500, body: 'Internal Server Error' });
    await renderBoard();

    expect(await screen.findByText(BOARD_LOAD_SERVER)).toBeOnTheScreen();
  });

  it('does not treat a board without columns as an empty board', async () => {
    mockFetch(...loaded([]), ...loaded(CUSTOM_COLUMNS));
    await renderBoard();

    expect(await screen.findByText('This board has no columns')).toBeOnTheScreen();
    expect(screen.queryByText('No tasks yet')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Try again'));

    await waitFor(() => expect(tabLabels()).toHaveLength(CUSTOM_COLUMNS.length));
  });
});

describe('Tasks are grouped by columnId', () => {
  it('uses columnId, not the status or the column name', async () => {
    const task = inColumn(SHIPPED, { title: 'Grouped by id', status: 'DONE', column: { id: INTAKE.id, name: 'Intake', category: 'DONE' } });
    mockFetch(...loaded(CUSTOM_COLUMNS, [task]));
    await renderBoard();

    await screen.findByText('Test Project · 1 task');
    expect(within(page(SHIPPED)).getByText('Grouped by id')).toBeOnTheScreen();
    expect(within(page(INTAKE)).queryByText('Grouped by id')).not.toBeOnTheScreen();
    expect(screen.getAllByText('Grouped by id')).toHaveLength(1);
  });

  it('reports a task whose column is not on the board instead of dropping it', async () => {
    const stray = inColumn(REVIEW, { id: 'stray', readableId: 'TES-9', title: 'Stray task', columnId: '01a18766-0000-7000-8000-00000000dfff' });
    mockFetch(...loaded(CUSTOM_COLUMNS, [stray, inColumn(REVIEW, { id: 'placed', title: 'Placed task' })]));
    await renderBoard();

    const notice = await screen.findByTestId('unplaced-tasks-notice');
    expect(within(notice).getByText('1 task isn’t in any column')).toBeOnTheScreen();
    expect(within(notice).getByText(/TES-9 Stray task/)).toBeOnTheScreen();
    expect(screen.getByText('Test Project · 2 tasks')).toBeOnTheScreen();
    expect(screen.getByLabelText('Peer review, 1 task')).toBeOnTheScreen();
  });

  it('shows no notice when every task has a column', async () => {
    mockFetch(...loaded(CUSTOM_COLUMNS, [inColumn(REVIEW)]));
    await renderBoard();

    await screen.findByText('Test Project · 1 task');
    expect(screen.queryByTestId('unplaced-tasks-notice')).not.toBeOnTheScreen();
  });
});

describe('Pull-to-refresh', () => {
  it('asks for the board and the tasks again and shows a renamed column', async () => {
    const task = inColumn(REVIEW, { id: 'same-task', title: 'Same task' });
    const renamed = { ...REVIEW, name: 'Code review' };
    const fetchMock = mockFetch(...loaded(CUSTOM_COLUMNS, [task]), ...loaded([INTAKE, renamed, SHIPPED], [task]));
    await renderBoard();
    await screen.findByLabelText('Peer review, 1 task');

    await pullToRefresh(REVIEW);

    expect(await screen.findByLabelText('Code review, 1 task')).toBeOnTheScreen();
    expect(screen.queryByText('Peer review')).not.toBeOnTheScreen();
    expect(within(page(renamed)).getByText('Same task')).toBeOnTheScreen();
    const refreshQuery = JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string).query as string;
    expect(refreshQuery).toContain('board(id: $boardId)');
    expect(refreshQuery).toContain('tasks(boardId: $boardId)');
  });

  it('shows the new column order and keeps the selected column selected', async () => {
    mockFetch(...loaded(CUSTOM_COLUMNS), ...loaded([SHIPPED, INTAKE, REVIEW]));
    await renderBoard();
    await screen.findByText('Test Project · 0 tasks');
    await fireEvent.press(screen.getByTestId(`column-tab-${REVIEW.id}`));

    await pullToRefresh(REVIEW);

    await waitFor(() => expect(tabLabels()).toEqual(['Shipped, 0 tasks', 'Intake, 0 tasks', 'Peer review, 0 tasks']));
    expect(screen.getByTestId(`column-tab-${REVIEW.id}`)).toBeSelected();
  });

  it('adds and removes columns', async () => {
    const added: ColumnNode = { id: '01a18766-0000-7000-8000-00000000d004', name: 'Added later', position: 'y', category: 'TO_DO' };
    mockFetch(...loaded([INTAKE, REVIEW]), ...loaded([INTAKE, added]));
    await renderBoard();
    await screen.findByText('Test Project · 0 tasks');

    await pullToRefresh(INTAKE);

    await waitFor(() => expect(tabLabels()).toEqual(['Intake, 0 tasks', 'Added later, 0 tasks']));
  });
});

describe('Task card details', () => {
  it('shows a description only when the task has one', async () => {
    mockFetch(
      ...loaded(CUSTOM_COLUMNS, [
        inColumn(REVIEW, { id: 'with-description', title: 'Described', description: 'Some details' }),
        inColumn(REVIEW, { id: 'without-description', title: 'Bare' }),
      ]),
    );
    await renderBoard();

    const described = await screen.findByTestId('task-card-with-description');
    expect(within(described).getByText('Some details')).toBeOnTheScreen();
    const bare = screen.getByTestId('task-card-without-description');
    expect(bare.children).toHaveLength(1);
    expect(screen.queryByText(/null|undefined/)).not.toBeOnTheScreen();
  });

  it.each([
    ['admin@local.test', 'AD'],
    ['user1@local.test', 'U1'],
    ['user2@local.test', 'U2'],
    ['Mona Adel', 'MA'],
  ])('gives %s the initials %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('Without a real backend', () => {
  it('shows a configuration error and no data on the board when no API URL is set', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const fetchMock = mockFetch();
    await renderBoard();

    expect(await screen.findByText(/EXPO_PUBLIC_API_URL is not set/)).toBeOnTheScreen();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a configuration error on the board list when no API URL is set', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    await renderRouter(
      {
        boards: () => (
          <BoardRepositoryProvider repository={createBackendBoardRepository()}>
            <BoardsScreen />
          </BoardRepositoryProvider>
        ),
      },
      { initialUrl: '/boards' },
    );

    expect(await screen.findByText('Couldn’t load your boards')).toBeOnTheScreen();
    expect(screen.getByText(/EXPO_PUBLIC_API_URL is not set/)).toBeOnTheScreen();
  });

  it('lists only the boards the server returns', async () => {
    mockFetch(projectsResponse());
    await renderRouter(
      {
        boards: () => (
          <BoardRepositoryProvider repository={createBackendBoardRepository()}>
            <BoardsScreen />
          </BoardRepositoryProvider>
        ),
      },
      { initialUrl: '/boards' },
    );

    expect(await screen.findByLabelText('Test Board')).toBeOnTheScreen();
    expect(screen.getAllByRole('button').map((row) => row.props.accessibilityLabel)).toEqual(['Other Board', 'Test Board']);
  });

  it('explains a server error on a query about something other than the board', async () => {
    mockFetch({ body: gqlError('NOT_FOUND', 'Couldn\'t find a column associated with this task') });
    await renderBoard();

    expect(await screen.findByText('Couldn’t load this board')).toBeOnTheScreen();
    expect(screen.queryByText('Board not found')).not.toBeOnTheScreen();
  });
});
