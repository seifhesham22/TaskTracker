import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { Text } from 'react-native';

import type { TaskNode } from '../src/api/boards';
import BoardScreen from '../src/app/boards/[boardId]';
import { createBackendBoardRepository } from '../src/data/backendBoardRepository';
import { BoardRepositoryProvider } from '../src/data/BoardRepositoryContext';
import { MOVE_NETWORK_ERROR, MOVE_SERVER_ERROR } from '../src/domain/moveTaskErrors';
import {
  API_URL,
  BOARD_ID,
  COLUMNS,
  USER_ID,
  boardResponse,
  gqlError,
  mockFetch,
  movedTaskResponse,
  projectsResponse,
  titleOnlyTaskNode,
} from '../test-utils/fakeBackend';

const [BACKLOG, TO_DO, IN_PROGRESS] = COLUMNS;
const TASK_ID = 'moving-task';
const TITLE = 'Moving task';
const REJECTION = `Column '${IN_PROGRESS.id}' was not found on board '${BOARD_ID}'.`;

const inBacklog = titleOnlyTaskNode(0, { id: TASK_ID, title: TITLE, position: 'V' });
const inProgress = titleOnlyTaskNode(2, { id: TASK_ID, title: TITLE, position: 'W' });
const other = titleOnlyTaskNode(0, { id: 'other-task', title: 'Other task', position: 'W' });

const page = (columnId: string) => screen.getByTestId(`column-page-${columnId}`);
const card = () => screen.getByTestId(`task-card-${TASK_ID}`);
const tab = (columnId: string) => screen.getByTestId(`column-tab-${columnId}`);
const sheet = () => screen.getByTestId('move-task-sheet');
const option = (columnId: string) => screen.getByTestId(`move-task-sheet-option-${columnId}`);

type SentRequest = { query: string; variables: { input?: Record<string, unknown> } };
const sent = (fetchMock: jest.Mock, call: number): SentRequest =>
  JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string);

function loaded(tasks: TaskNode[]) {
  return [boardResponse(tasks), projectsResponse()];
}

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
  await screen.findByTestId(`task-card-${TASK_ID}`);
}

async function moveToInProgress() {
  await fireEvent(card(), 'longPress');
  await fireEvent.press(option(IN_PROGRESS.id));
}

function holdNextResponse() {
  let release: (node: TaskNode) => void = () => {};
  let fail: (error: Error) => void = () => {};
  const pending = new Promise<{ ok: boolean; status: number; text: () => Promise<string> }>((resolve, reject) => {
    release = (node) =>
      resolve({ ok: true, status: 200, text: async () => JSON.stringify(movedTaskResponse(node).body) });
    fail = reject;
  });
  const fetchMock = jest.fn(() => pending);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock, release: (node: TaskNode) => release(node), fail: (error: Error) => fail(error) };
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  process.env.EXPO_PUBLIC_USER_ID = USER_ID;
});

afterAll(() => {
  delete process.env.EXPO_PUBLIC_USER_ID;
});

describe('Holding a task', () => {
  it('opens the move sheet with the board’s columns in order and marks the current one', async () => {
    mockFetch(...loaded([inBacklog]));
    await renderBoard();
    expect(screen.queryByTestId('move-task-sheet')).not.toBeOnTheScreen();

    await fireEvent(card(), 'longPress');

    expect(within(sheet()).getByText('Move to column')).toBeOnTheScreen();
    expect(within(sheet()).getByText(TITLE)).toBeOnTheScreen();
    expect(within(sheet()).getAllByRole('button').map((row) => row.props.accessibilityLabel)).toEqual(
      COLUMNS.map((column) => (column.id === BACKLOG.id ? `${column.name}, Current` : column.name)),
    );
    expect(option(BACKLOG.id)).toBeSelected();
    expect(option(IN_PROGRESS.id)).not.toBeSelected();
  });

  it('does nothing when the sheet is closed or the current column is chosen', async () => {
    const fetchMock = mockFetch(...loaded([inBacklog]));
    await renderBoard();

    await fireEvent(card(), 'longPress');
    await fireEvent.press(within(sheet()).getByText('Backlog'));

    expect(screen.queryByTestId('move-task-sheet')).not.toBeOnTheScreen();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(within(page(BACKLOG.id)).getByText(TITLE)).toBeOnTheScreen();
  });

  it('keeps a plain press from opening the sheet', async () => {
    mockFetch(...loaded([inBacklog]));
    await renderBoard();

    await fireEvent.press(card());

    expect(screen.queryByTestId('move-task-sheet')).not.toBeOnTheScreen();
  });
});

describe('Saving a move', () => {
  it('sends moveTask with the task and column IDs and moves the card before the answer', async () => {
    const initial = mockFetch(...loaded([inBacklog]));
    await renderBoard();
    expect(initial).toHaveBeenCalledTimes(2);
    const { fetchMock, release } = holdNextResponse();

    await moveToInProgress();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent(fetchMock, 0).query).toContain('moveTask(input: $input)');
    expect(sent(fetchMock, 0).variables.input).toEqual({ taskId: TASK_ID, columnId: IN_PROGRESS.id });
    expect(within(page(IN_PROGRESS.id)).getByText(TITLE)).toBeOnTheScreen();
    expect(within(page(BACKLOG.id)).queryByText(TITLE)).not.toBeOnTheScreen();
    expect(screen.getAllByText(TITLE)).toHaveLength(1);
    expect(tab(IN_PROGRESS.id)).toBeSelected();
    expect(screen.getByTestId(`task-saving-${TASK_ID}`)).toBeOnTheScreen();
    expect(within(card()).getByText('Saving…')).toBeOnTheScreen();

    await act(async () => release(inProgress));
  });

  it('keeps the card in the new column without reloading the board once the server accepts', async () => {
    const fetchMock = mockFetch(...loaded([inBacklog]), movedTaskResponse(inProgress));
    await renderBoard();

    await moveToInProgress();

    await waitFor(() => expect(screen.queryByTestId(`task-saving-${TASK_ID}`)).not.toBeOnTheScreen());
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(within(page(IN_PROGRESS.id)).getByText(TITLE)).toBeOnTheScreen();
    expect(screen.getAllByText(TITLE)).toHaveLength(1);
    expect(screen.getByLabelText('In progress, 1 task')).toBeOnTheScreen();
    expect(screen.getByLabelText('Backlog, 0 tasks')).toBeOnTheScreen();
    expect(screen.getByText('Test Project · 1 task')).toBeOnTheScreen();
    expect(screen.getByTestId('toast')).toHaveTextContent('Moved to In progress');
    expect(screen.queryByTestId('move-task-error')).not.toBeOnTheScreen();
  });

  it('blocks a second move of the same task but not moves of other tasks', async () => {
    mockFetch(...loaded([inBacklog, other]));
    await renderBoard();
    const { fetchMock, release } = holdNextResponse();

    await moveToInProgress();
    await fireEvent(card(), 'longPress');

    expect(screen.queryByTestId('move-task-sheet')).not.toBeOnTheScreen();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await fireEvent(screen.getByTestId('task-card-other-task'), 'longPress');
    expect(sheet()).toBeOnTheScreen();

    await fireEvent.press(option(TO_DO.id));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sent(fetchMock, 1).variables.input).toEqual({ taskId: 'other-task', columnId: TO_DO.id });

    await act(async () => release(inProgress));
  });

  it('shows the saved column after pull-to-refresh', async () => {
    const fetchMock = mockFetch(...loaded([inBacklog]), movedTaskResponse(inProgress), ...loaded([inProgress]));
    await renderBoard();
    await moveToInProgress();
    await waitFor(() => expect(screen.queryByTestId(`task-saving-${TASK_ID}`)).not.toBeOnTheScreen());

    const { refreshControl } = page(IN_PROGRESS.id).props as { refreshControl: { props: { onRefresh: () => void } } };
    await act(async () => {
      refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(sent(fetchMock, 3).query).toContain('tasks(boardId: $boardId)');
    expect(within(page(IN_PROGRESS.id)).getByText(TITLE)).toBeOnTheScreen();
    expect(screen.getAllByText(TITLE)).toHaveLength(1);
  });

  it('keeps the pending move when a refresh returns the old column', async () => {
    const fetchMock = mockFetch(...loaded([inBacklog]));
    await renderBoard();
    const move = holdNextResponse();
    await moveToInProgress();

    mockFetch(...loaded([inBacklog]));
    const { refreshControl } = page(IN_PROGRESS.id).props as { refreshControl: { props: { onRefresh: () => void } } };
    await act(async () => {
      refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(within(page(IN_PROGRESS.id)).getByText(TITLE)).toBeOnTheScreen());
    expect(screen.getAllByText(TITLE)).toHaveLength(1);
    expect(screen.getByTestId(`task-saving-${TASK_ID}`)).toBeOnTheScreen();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => move.release(inProgress));
    expect(within(page(IN_PROGRESS.id)).getByText(TITLE)).toBeOnTheScreen();
  });
});

describe('A refresh still running when the move is saved', () => {
  it('is replaced by a new load, so its old column never comes back', async () => {
    mockFetch(...loaded([inBacklog]));
    await renderBoard();
    const move = holdNextResponse();
    await moveToInProgress();

    let finishStaleBoard: (value: unknown) => void = () => {};
    globalThis.fetch = jest.fn(() => new Promise((resolve) => (finishStaleBoard = resolve))) as unknown as typeof fetch;
    const { refreshControl } = page(IN_PROGRESS.id).props as { refreshControl: { props: { onRefresh: () => void } } };
    await act(async () => {
      refreshControl.props.onRefresh();
    });

    const fetchMock = mockFetch(...loaded([inProgress]));
    await act(async () => move.release(inProgress));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    mockFetch(projectsResponse());
    await act(async () => {
      finishStaleBoard({ ok: true, status: 200, text: async () => JSON.stringify(boardResponse([inBacklog]).body) });
    });

    expect(within(page(IN_PROGRESS.id)).getByText(TITLE)).toBeOnTheScreen();
    expect(within(page(BACKLOG.id)).queryByText(TITLE)).not.toBeOnTheScreen();
    expect(screen.getAllByText(TITLE)).toHaveLength(1);
  });
});

describe('A failed move', () => {
  async function expectRolledBack() {
    expect(await screen.findByTestId('move-task-error')).toBeOnTheScreen();
    expect(within(page(BACKLOG.id)).getByText(TITLE)).toBeOnTheScreen();
    expect(within(page(IN_PROGRESS.id)).queryByText(TITLE)).not.toBeOnTheScreen();
    expect(screen.getAllByText(TITLE)).toHaveLength(1);
    expect(screen.queryByTestId(`task-saving-${TASK_ID}`)).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Backlog, 1 task')).toBeOnTheScreen();
    expect(screen.getByLabelText('In progress, 0 tasks')).toBeOnTheScreen();
    expect(tab(BACKLOG.id)).toBeSelected();
  }

  it('restores the card and shows the server’s own reason when the server refuses', async () => {
    const unrelated = titleOnlyTaskNode(1, { id: 'unrelated-task', title: 'Unrelated task' });
    mockFetch(...loaded([inBacklog, unrelated]), { body: gqlError('NOT_FOUND', REJECTION) });
    await renderBoard();

    await moveToInProgress();

    await expectRolledBack();
    const notice = screen.getByTestId('move-task-error');
    expect(within(notice).getByText(`Couldn’t move “${TITLE}”`)).toBeOnTheScreen();
    expect(within(notice).getByText(REJECTION)).toBeOnTheScreen();
    expect(within(page(TO_DO.id)).getByText('Unrelated task')).toBeOnTheScreen();
  });

  it('restores the card and explains a network failure', async () => {
    mockFetch(...loaded([inBacklog]), 'network-error');
    await renderBoard();

    await moveToInProgress();

    await expectRolledBack();
    expect(screen.getByText(MOVE_NETWORK_ERROR)).toBeOnTheScreen();
  });

  it('restores the card and gives a general message for an unexpected server error', async () => {
    mockFetch(...loaded([inBacklog]), { status: 500, body: 'Internal Server Error' });
    await renderBoard();

    await moveToInProgress();

    await expectRolledBack();
    expect(screen.getByText(MOVE_SERVER_ERROR)).toBeOnTheScreen();
    expect(screen.queryByText('Internal Server Error')).not.toBeOnTheScreen();
  });

  it('can be retried, which moves the task and clears the error', async () => {
    const fetchMock = mockFetch(...loaded([inBacklog]), 'network-error', movedTaskResponse(inProgress));
    await renderBoard();
    await moveToInProgress();
    await screen.findByTestId('move-task-error');

    await fireEvent.press(screen.getByText('Try again'));

    await waitFor(() => expect(screen.queryByTestId(`task-saving-${TASK_ID}`)).not.toBeOnTheScreen());
    expect(sent(fetchMock, 3).variables.input).toEqual({ taskId: TASK_ID, columnId: IN_PROGRESS.id });
    expect(within(page(IN_PROGRESS.id)).getByText(TITLE)).toBeOnTheScreen();
    expect(screen.queryByTestId('move-task-error')).not.toBeOnTheScreen();
  });

  it('can be dismissed, and the task can be held again', async () => {
    mockFetch(...loaded([inBacklog]), 'network-error');
    await renderBoard();
    await moveToInProgress();
    await screen.findByTestId('move-task-error');

    await fireEvent.press(screen.getByText('Dismiss'));
    expect(screen.queryByTestId('move-task-error')).not.toBeOnTheScreen();

    await fireEvent(card(), 'longPress');
    expect(sheet()).toBeOnTheScreen();
  });
});
