/**
 * Board screen with an injected repository: the board comes from the test, createTask goes
 * through the real GraphQL request over a mocked fetch (backend-shaped responses).
 */
import { Text } from 'react-native';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import BoardScreen from '../src/app/boards/[boardId]';
import { createBackendBoardRepository, READ_API_MISSING } from '../src/data/backendBoardRepository';
import { BoardLoadError, type BoardRepository } from '../src/data/BoardRepository';
import { BoardRepositoryProvider } from '../src/data/BoardRepositoryContext';
import { NETWORK_ERROR_DESCRIPTION } from '../src/domain/createTaskErrors';
import type { Task } from '../src/domain/models';
import { API_URL, BOARD_ID, COLUMNS, boardData, gqlError, gqlTask, mockFetch, sentBody, taskDto, testRepository } from '../test-utils/fakeBackend';

async function renderBoard(repository: BoardRepository) {
  await renderRouter(
    {
      'boards/[boardId]': () => (
        <BoardRepositoryProvider repository={repository}>
          <BoardScreen />
        </BoardRepositoryProvider>
      ),
      'boards/index': () => <Text>Boards list</Text>,
    },
    { initialUrl: `/boards/${BOARD_ID}` },
  );
}

async function openFormAndSubmit(title: string) {
  await fireEvent.press(await screen.findByText('Create task'));
  await fireEvent.changeText(screen.getByTestId('title-input'), title);
  await fireEvent.press(screen.getByTestId('submit-button'));
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
});

describe('Board screen: empty state', () => {
  it('shows "No tasks yet" for a board with zero tasks', async () => {
    await renderBoard(testRepository(async () => boardData()));

    expect(await screen.findByText('No tasks yet')).toBeOnTheScreen();
    expect(screen.getByText('Tasks you add to this board show up here, grouped by status.')).toBeOnTheScreen();
    expect(screen.getByText('Test Project · 0 tasks')).toBeOnTheScreen();
    expect(screen.queryByTestId('create-task-sheet')).not.toBeOnTheScreen();
  });

  it('opens the create-task form from the "Create task" button', async () => {
    await renderBoard(testRepository(async () => boardData()));

    await fireEvent.press(await screen.findByText('Create task'));

    expect(screen.getByTestId('create-task-sheet')).toBeOnTheScreen();
    expect(screen.getByText('New task')).toBeOnTheScreen();
    expect(screen.getByTestId('title-input')).toBeOnTheScreen();
  });

  it('removes the empty state and shows the first task after it is created', async () => {
    let serverTasks: Task[] = [];
    const repository = testRepository(async () => boardData(serverTasks));
    const created = taskDto({ title: 'First task' });
    const fetchMock = mockFetch({ body: gqlTask(created) });
    await renderBoard(repository);

    serverTasks = [created]; // what the backend holds once createTask succeeds
    await openFormAndSubmit('First task');

    await waitFor(() => expect(screen.queryByTestId('create-task-sheet')).not.toBeOnTheScreen());
    expect(screen.queryByText('No tasks yet')).not.toBeOnTheScreen();
    expect(screen.getByTestId(`task-card-${created.id}`)).toBeOnTheScreen();
    expect(screen.getByText('First task')).toBeOnTheScreen();
    expect(screen.getByTestId('toast')).toHaveTextContent('Task created');
    expect(screen.getByText('Test Project · 1 task')).toBeOnTheScreen();
    expect(screen.getByLabelText('Backlog, 1 task')).toBeOnTheScreen();
    // Created in the column that was active (the first one), and the board was reloaded.
    expect(sentBody(fetchMock).variables.input).toMatchObject({ boardId: BOARD_ID, columnId: COLUMNS[0].id, title: 'First task' });
    expect(repository.getBoard).toHaveBeenCalledTimes(2);
  });
});

describe('Board screen: board not found', () => {
  it('shows "Board not found" when the board does not exist, with a way back to the boards', async () => {
    await renderBoard(
      testRepository(async () => {
        throw new BoardLoadError('notFound', `Board '${BOARD_ID}' was not found.`);
      }),
    );

    expect(await screen.findByText('Board not found')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Go to boards'));
    expect(screen).toHavePathname('/boards');
  });

  it('shows "Board not found" when createTask reports that the board was deleted', async () => {
    mockFetch({ body: gqlError('NOT_FOUND', `Board '${BOARD_ID}' was not found.`) });
    await renderBoard(testRepository(async () => boardData()));

    await openFormAndSubmit('Too late');

    expect(await screen.findByText('Board not found')).toBeOnTheScreen();
    expect(screen.queryByTestId('create-task-sheet')).not.toBeOnTheScreen();
  });

  it('does not show "Board not found" when only the column is missing', async () => {
    mockFetch({ body: gqlError('NOT_FOUND', `Column '${COLUMNS[0].id}' was not found on board '${BOARD_ID}'.`) });
    await renderBoard(testRepository(async () => boardData()));

    await openFormAndSubmit('Lost column');

    expect(await screen.findByTestId('form-error-alert')).toBeOnTheScreen();
    expect(screen.getByTestId('create-task-sheet')).toBeOnTheScreen();
    expect(screen.queryByText('Board not found')).not.toBeOnTheScreen();
  });
});

describe('Board screen: loading and errors', () => {
  it('shows the skeleton while the board takes longer than 300 ms to load', async () => {
    await renderBoard(testRepository(() => new Promise(() => {})));
    expect(await screen.findByLabelText('Loading board')).toBeOnTheScreen();
  });

  it('shows the error state and loads again on "Try again"', async () => {
    let calls = 0;
    await renderBoard(
      testRepository(async () => {
        calls += 1;
        if (calls === 1) throw new BoardLoadError('network', 'Network request failed');
        return boardData();
      }),
    );

    expect(await screen.findByText('Couldn’t load this board')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('No tasks yet')).toBeOnTheScreen();
  });

  it('keeps the form open with a general error on a network failure', async () => {
    mockFetch('network-error');
    await renderBoard(testRepository(async () => boardData()));

    await openFormAndSubmit('Offline task');

    expect(await screen.findByText(NETWORK_ERROR_DESCRIPTION)).toBeOnTheScreen();
    expect(screen.getByTestId('title-input')).toHaveDisplayValue('Offline task');
    expect(screen.getByText('No tasks yet')).toBeOnTheScreen();
  });

  it('with the real backend, says the board cannot be loaded instead of showing made-up data', async () => {
    const fetchMock = mockFetch();
    await renderBoard(createBackendBoardRepository());

    expect(await screen.findByText('Couldn’t load this board')).toBeOnTheScreen();
    expect(screen.getByText(READ_API_MISSING)).toBeOnTheScreen();
    expect(screen.queryByText('No tasks yet')).not.toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
