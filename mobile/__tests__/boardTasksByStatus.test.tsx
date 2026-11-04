import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { ScrollView, Text } from 'react-native';

import BoardScreen from '../src/app/boards/[boardId]';
import { createBackendBoardRepository } from '../src/data/backendBoardRepository';
import { BoardRepositoryProvider } from '../src/data/BoardRepositoryContext';
import { groupTasksByColumn } from '../src/domain/board';
import type { Task } from '../src/domain/models';
import { REFRESH_FAILED_MESSAGE } from '../src/hooks/useBoard';
import {
  API_URL,
  BOARD_ID,
  COLUMNS,
  USER_ID,
  boardResponse,
  gqlError,
  gqlTask,
  mockFetch,
  projectsResponse,
  taskDto,
  taskNode,
  titleOnlyTaskNode,
  type FakeResponse,
} from '../test-utils/fakeBackend';

const [BACKLOG, TO_DO, IN_PROGRESS, DONE] = COLUMNS;

const page = (columnId: string) => screen.getByTestId(`column-page-${columnId}`);
const tab = (columnId: string) => screen.getByTestId(`column-tab-${columnId}`);

const scrollTo = (ScrollView.prototype as unknown as { scrollTo: jest.Mock }).scrollTo;
const pagerScrolls = () =>
  scrollTo.mock.calls
    .filter((_, i) => (scrollTo.mock.contexts[i] as { props?: { testID?: string } })?.props?.testID === 'board-column-pager')
    .map(([options]) => options);

async function renderBoard(boardId: string = BOARD_ID) {
  await renderRouter(
    {
      'boards/[boardId]': () => (
        <BoardRepositoryProvider repository={createBackendBoardRepository()}>
          <BoardScreen />
        </BoardRepositoryProvider>
      ),
      'boards/index': () => <Text>Boards list</Text>,
    },
    { initialUrl: `/boards/${boardId}` },
  );
}

function loaded(...tasks: Parameters<typeof boardResponse>[0][]): FakeResponse[] {
  return tasks.flatMap((list) => [boardResponse(list), projectsResponse()]);
}

async function pullToRefresh(columnId: string) {
  const { refreshControl } = page(columnId).props as { refreshControl: { props: { onRefresh: () => void } } };
  await act(async () => {
    refreshControl.props.onRefresh();
  });
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  process.env.EXPO_PUBLIC_USER_ID = USER_ID;
  scrollTo.mockClear();
});

afterAll(() => {
  delete process.env.EXPO_PUBLIC_USER_ID;
});

describe('Status columns', () => {
  it('shows every column of the board in the server’s order, each with its own page', async () => {
    mockFetch(...loaded([]));
    await renderBoard();

    expect(await screen.findByText('Test Project · 0 tasks')).toBeOnTheScreen();
    const tabs = screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel);
    expect(tabs).toEqual(['Backlog, 0 tasks', 'To do, 0 tasks', 'In progress, 0 tasks', 'Done, 0 tasks']);
    for (const column of COLUMNS) expect(page(column.id)).toBeOnTheScreen();
  });

  it('shows an empty state on every column of an empty board', async () => {
    mockFetch(...loaded([]));
    await renderBoard();

    await screen.findByText('Test Project · 0 tasks');
    for (const column of COLUMNS) expect(within(page(column.id)).getByText('No tasks yet')).toBeOnTheScreen();
    expect(screen.queryByTestId('create-task-button')).not.toBeOnTheScreen();
  });

  it('keeps empty columns, with their own message, on a board that has tasks', async () => {
    mockFetch(...loaded([titleOnlyTaskNode(2)]));
    await renderBoard();

    await screen.findByText('Test Project · 1 task');
    expect(screen.queryByText('No tasks yet')).not.toBeOnTheScreen();
    expect(within(page(TO_DO.id)).getByText('No tasks in this column')).toBeOnTheScreen();
    expect(within(page(DONE.id)).getByText('No tasks in this column')).toBeOnTheScreen();
    expect(screen.queryByTestId(`column-empty-${IN_PROGRESS.id}`)).not.toBeOnTheScreen();
    expect(screen.getByTestId('create-task-button')).toBeOnTheScreen();
  });

  it('puts each task only in the column it belongs to', async () => {
    mockFetch(
      ...loaded([
        titleOnlyTaskNode(0, { id: 'task-backlog', title: 'In backlog' }),
        titleOnlyTaskNode(3, { id: 'task-done', title: 'In done' }),
      ]),
    );
    await renderBoard();

    await screen.findByText('Test Project · 2 tasks');
    expect(within(page(BACKLOG.id)).getByText('In backlog')).toBeOnTheScreen();
    expect(within(page(DONE.id)).getByText('In done')).toBeOnTheScreen();
    expect(screen.getAllByText('In backlog')).toHaveLength(1);
    expect(screen.getAllByText('In done')).toHaveLength(1);
    expect(screen.getByLabelText('Backlog, 1 task')).toBeOnTheScreen();
    expect(screen.getByLabelText('To do, 0 tasks')).toBeOnTheScreen();
    expect(screen.getByLabelText('Done, 1 task')).toBeOnTheScreen();
  });

  it('orders cards by position, not by the order they were created', () => {
    const task = (id: string, position?: string) => ({ id, columnId: BACKLOG.id, position }) as Task;
    const { byColumn } = groupTasksByColumn(COLUMNS, [task('created-first', 'l'), task('created-last'), task('moved-up', 'V')]);
    expect(byColumn[BACKLOG.id].map((t) => t.id)).toEqual(['moved-up', 'created-first', 'created-last']);
    expect(byColumn[DONE.id]).toEqual([]);
  });
});

describe('Task cards', () => {
  it('shows only the title for a task with nothing else set', async () => {
    const node = titleOnlyTaskNode(0, { title: 'Just a title' });
    mockFetch(...loaded([node]));
    await renderBoard();

    const card = await screen.findByTestId(`task-card-${node.id}`);
    expect(card.props.accessibilityLabel).toBe('Just a title');
    expect(within(card).getByText('Just a title')).toBeOnTheScreen();
    expect(card.children).toHaveLength(1);
    expect(screen.queryByText(/null|undefined/)).not.toBeOnTheScreen();
  });

  it('shows the assignee, priority and due date when they are set', async () => {
    const node = taskNode({ dueDate: '2099-11-05T00:00:00.000Z' });
    mockFetch(...loaded([node]));
    await renderBoard();

    const card = await screen.findByTestId(`task-card-${node.id}`);
    expect(within(card).getByText('Existing task')).toBeOnTheScreen();
    expect(within(card).getByText('High')).toBeOnTheScreen();
    expect(within(card).getByText('Nov 5, 2099')).toBeOnTheScreen();
    expect(within(card).getByText('U1')).toBeOnTheScreen();
    expect(card.props.accessibilityLabel).toBe('Existing task, Priority High, Due Nov 5, 2099, Assigned to user1@local.test');
  });

  it('uses the design’s 16 pt card title, wrapped to three lines', async () => {
    const node = titleOnlyTaskNode(0, { title: 'A long title' });
    mockFetch(...loaded([node]));
    await renderBoard();

    const title = await screen.findByText('A long title');
    expect(title).toHaveStyle({ fontSize: 16, lineHeight: 24 });
    expect(title.props.numberOfLines).toBe(3);
  });
});

describe('Moving between columns', () => {
  it('selects the tapped tab and scrolls the pager to its column', async () => {
    mockFetch(...loaded([titleOnlyTaskNode(0)]));
    await renderBoard();
    await screen.findByText('Test Project · 1 task');
    expect(tab(BACKLOG.id)).toBeSelected();

    for (const [index, column] of COLUMNS.entries()) {
      await fireEvent.press(tab(column.id));
      expect(tab(column.id)).toBeSelected();
      if (index > 0) expect(pagerScrolls()).toContainEqual({ x: index * 750, animated: true });
    }
    expect(tab(BACKLOG.id)).not.toBeSelected();
  });

  it('moves the selected tab when the pager is swiped', async () => {
    mockFetch(...loaded([titleOnlyTaskNode(0)]));
    await renderBoard();
    await screen.findByText('Test Project · 1 task');

    await fireEvent(screen.getByTestId('board-column-pager'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 2 * 750, y: 0 } },
    });

    expect(tab(IN_PROGRESS.id)).toBeSelected();
    expect(tab(BACKLOG.id)).not.toBeSelected();
  });
});

describe('Loading and failed requests', () => {
  it('shows the skeleton and no empty message while the query is running', async () => {
    globalThis.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    await renderBoard();

    expect(await screen.findByLabelText('Loading board')).toBeOnTheScreen();
    expect(screen.queryByText('No tasks yet')).not.toBeOnTheScreen();
  });

  it('shows an error with a retry that loads the board', async () => {
    mockFetch('network-error', ...loaded([titleOnlyTaskNode(0, { title: 'Back again' })]));
    await renderBoard();

    expect(await screen.findByText('Couldn’t load this board')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Back again')).toBeOnTheScreen();
  });

  it('shows "Board not found" when the server says this board is missing', async () => {
    mockFetch({ body: gqlError('NOT_FOUND', `Board '${BOARD_ID}' was not found.`) });
    await renderBoard();
    expect(await screen.findByText('Board not found')).toBeOnTheScreen();
  });

  it('shows "Board not found" for an ID that is not a board ID, without a request', async () => {
    const fetchMock = mockFetch();
    await renderBoard('not-a-board');
    expect(await screen.findByText('Board not found')).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a task’s column', 'Couldn\'t find a column associated with this task'],
    ['another board', "Board '00000000-0000-0000-0000-000000000001' was not found."],
  ])('does not call a NOT_FOUND about %s a missing board', async (_, message) => {
    mockFetch({ body: gqlError('NOT_FOUND', message) });
    await renderBoard();
    expect(await screen.findByText('Couldn’t load this board')).toBeOnTheScreen();
    expect(screen.queryByText('Board not found')).not.toBeOnTheScreen();
  });
});

describe('Pull-to-refresh', () => {
  const inBacklog = titleOnlyTaskNode(0, { id: 'moving-task', title: 'Moving task' });
  const inDone = titleOnlyTaskNode(3, { id: 'moving-task', title: 'Moving task' });

  it('asks the server again and moves a task whose status changed', async () => {
    const fetchMock = mockFetch(...loaded([inBacklog], [inDone]));
    await renderBoard();
    expect(within(await screen.findByTestId(`column-page-${BACKLOG.id}`)).getByText('Moving task')).toBeOnTheScreen();

    await pullToRefresh(BACKLOG.id);

    await waitFor(() => expect(within(page(DONE.id)).getByText('Moving task')).toBeOnTheScreen());
    expect(within(page(BACKLOG.id)).queryByText('Moving task')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Done, 1 task')).toBeOnTheScreen();
    expect(screen.getByLabelText('Backlog, 0 tasks')).toBeOnTheScreen();
    expect(JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string).query).toContain('tasks(boardId: $boardId)');
  });

  it('shows the refresh indicator until the request finishes', async () => {
    let finish: (response: unknown) => void = () => {};
    const fetchMock = mockFetch(...loaded([inBacklog]));
    await renderBoard();
    await screen.findByTestId('task-card-moving-task');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    globalThis.fetch = jest.fn(() => new Promise((resolve) => (finish = resolve))) as unknown as typeof fetch;
    await pullToRefresh(BACKLOG.id);
    const indicator = () => (page(BACKLOG.id).props as { refreshControl: { props: { refreshing: boolean } } }).refreshControl.props.refreshing;
    expect(indicator()).toBe(true);

    mockFetch(projectsResponse());
    await act(async () => {
      finish({ ok: true, status: 200, text: async () => JSON.stringify(boardResponse([inDone]).body) });
    });
    await waitFor(() => expect(indicator()).toBe(false));
  });

  it('works on an empty board too', async () => {
    mockFetch(...loaded([], [inBacklog]));
    await renderBoard();
    await screen.findByText('Test Project · 0 tasks');

    await pullToRefresh(BACKLOG.id);

    expect(await screen.findByText('Moving task')).toBeOnTheScreen();
    expect(screen.queryByText('No tasks yet')).not.toBeOnTheScreen();
  });

  it('keeps the cards and says so when a refresh fails, and can be pulled again', async () => {
    mockFetch(...loaded([inBacklog]), 'network-error', ...loaded([inDone]));
    await renderBoard();
    await screen.findByText('Moving task');

    await pullToRefresh(BACKLOG.id);

    expect(await screen.findByText(REFRESH_FAILED_MESSAGE)).toBeOnTheScreen();
    expect(within(page(BACKLOG.id)).getByText('Moving task')).toBeOnTheScreen();
    expect(screen.queryByText('Couldn’t load this board')).not.toBeOnTheScreen();

    await pullToRefresh(BACKLOG.id);
    await waitFor(() => expect(within(page(DONE.id)).getByText('Moving task')).toBeOnTheScreen());
  });

  it('shows "Board not found" when a refresh finds the board was deleted', async () => {
    mockFetch(...loaded([inBacklog]), { body: gqlError('NOT_FOUND', `Board '${BOARD_ID}' was not found.`) });
    await renderBoard();
    await screen.findByText('Moving task');

    await pullToRefresh(BACKLOG.id);

    expect(await screen.findByText('Board not found')).toBeOnTheScreen();
  });
});

describe('Create task on the board', () => {
  const created = taskDto({ id: 'created-task', title: 'New in progress', columnId: IN_PROGRESS.id, columnName: 'In progress', status: 'IN_PROGRESS' });
  const createdNode = titleOnlyTaskNode(2, { id: 'created-task', title: 'New in progress', position: 'W' });

  async function createInProgress() {
    await fireEvent.press(await screen.findByLabelText('Add task to In progress'));
    await fireEvent.changeText(screen.getByTestId('title-input'), 'New in progress');
    await fireEvent.press(screen.getByTestId('submit-button'));
    await waitFor(() => expect(screen.queryByTestId('create-task-sheet')).not.toBeOnTheScreen());
  }

  it('sends the chosen column, shows the card there, and selects its tab', async () => {
    const fetchMock = mockFetch(
      ...loaded([titleOnlyTaskNode(0)]),
      { body: gqlTask(created) },
      ...loaded([titleOnlyTaskNode(0), createdNode]),
    );
    await renderBoard();

    await createInProgress();

    expect(JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string).variables.input.columnId).toBe(IN_PROGRESS.id);
    expect(within(page(IN_PROGRESS.id)).getByText('New in progress')).toBeOnTheScreen();
    expect(tab(IN_PROGRESS.id)).toBeSelected();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
  });

  it('keeps the created card and the success toast if the reload after it fails', async () => {
    const fetchMock = mockFetch(...loaded([titleOnlyTaskNode(0)]), { body: gqlTask(created) }, 'network-error');
    await renderBoard();

    await createInProgress();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(within(page(IN_PROGRESS.id)).getByText('New in progress')).toBeOnTheScreen();
    expect(screen.getByTestId('toast')).toHaveTextContent('Task created');
    expect(screen.queryByText(REFRESH_FAILED_MESSAGE)).not.toBeOnTheScreen();
  });
});
