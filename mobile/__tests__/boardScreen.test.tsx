import { Text } from 'react-native';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import BoardScreen from '../src/app/boards/[boardId]';
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
      index: () => <Text>Your projects</Text>,
    },
    { initialUrl: `/boards/${BOARD_ID}` },
  );
}

async function pressCreateTask() {
  const [button] = await screen.findAllByText('Create task');
  await fireEvent.press(button);
}

async function openFormAndSubmit(title: string) {
  await pressCreateTask();
  await fireEvent.changeText(screen.getByTestId('title-input'), title);
  await fireEvent.press(screen.getByTestId('submit-button'));
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
});

describe('Board screen: empty state', () => {
  it('shows "No tasks yet" for a board with zero tasks', async () => {
    await renderBoard(testRepository(async () => boardData()));

    expect(await screen.findAllByText('No tasks yet')).toHaveLength(COLUMNS.length);
    expect(screen.getAllByText('Tasks you add to this board show up here, grouped by status.')).toHaveLength(COLUMNS.length);
    expect(screen.getByText('Test Project · 0 tasks')).toBeOnTheScreen();
    expect(screen.queryByTestId('create-task-sheet')).not.toBeOnTheScreen();
  });

  it('opens the create-task form from the "Create task" button', async () => {
    await renderBoard(testRepository(async () => boardData()));

    await pressCreateTask();

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

    serverTasks = [created];
    await openFormAndSubmit('First task');

    await waitFor(() => expect(screen.queryByTestId('create-task-sheet')).not.toBeOnTheScreen());
    expect(screen.queryByText('No tasks yet')).not.toBeOnTheScreen();
    expect(screen.getByTestId(`task-card-${created.id}`)).toBeOnTheScreen();
    expect(screen.getByText('First task')).toBeOnTheScreen();
    expect(screen.getByTestId('toast')).toHaveTextContent('Task created');
    expect(screen.getByText('Test Project · 1 task')).toBeOnTheScreen();
    expect(screen.getByLabelText('Backlog, 1 task')).toBeOnTheScreen();
    expect(sentBody(fetchMock).variables.input).toMatchObject({ boardId: BOARD_ID, columnId: COLUMNS[0].id, title: 'First task' });
    expect(repository.getBoard).toHaveBeenCalledTimes(2);
  });
});

describe('Board screen: board not found', () => {
  it('shows “Project unavailable” for a board that is missing or not the user’s, with a way back to the projects', async () => {
    await renderBoard(
      testRepository(async () => {
        throw new BoardLoadError('notFound', `Board '${BOARD_ID}' was not found.`);
      }),
    );

    expect(await screen.findByRole('header', { name: 'Project unavailable' })).toBeOnTheScreen();
    expect(screen.getByText('You don’t have access, or this project is unavailable.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('back-to-projects'));
    expect(screen).toHavePathname('/');
  });

  it('clears the board when createTask reports that it is gone (deleted, or access lost)', async () => {
    mockFetch({ body: gqlError('NOT_FOUND', `Board '${BOARD_ID}' was not found.`) });
    await renderBoard(testRepository(async () => boardData()));

    await openFormAndSubmit('Too late');

    expect(await screen.findByRole('header', { name: 'Your project access has changed' })).toBeOnTheScreen();
    expect(screen.queryByTestId('create-task-sheet')).not.toBeOnTheScreen();
    expect(screen.queryByText('Test Project · 0 tasks')).not.toBeOnTheScreen();
  });

  it('does not treat a missing column as a lost board', async () => {
    mockFetch({ body: gqlError('NOT_FOUND', `Column '${COLUMNS[0].id}' was not found on board '${BOARD_ID}'.`) });
    await renderBoard(testRepository(async () => boardData()));

    await openFormAndSubmit('Lost column');

    expect(await screen.findByTestId('form-error-alert')).toBeOnTheScreen();
    expect(screen.getByTestId('create-task-sheet')).toBeOnTheScreen();
    expect(screen.queryByTestId('access-revoked')).not.toBeOnTheScreen();
  });
});

describe('Board screen: loading and errors', () => {
  it('shows Checking access, and nothing of the board, until the backend answers', async () => {
    await renderBoard(testRepository(() => new Promise(() => {})));
    expect(await screen.findByRole('header', { name: 'Checking access' })).toBeOnTheScreen();
    expect(screen.queryByText(/Test Board|Test Project/)).not.toBeOnTheScreen();
    expect(screen.queryByText('Create task')).not.toBeOnTheScreen();
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

    // Not a permission denial: access couldn't be checked.
    expect(await screen.findByRole('header', { name: 'Couldn’t connect' })).toBeOnTheScreen();
    expect(screen.getByText('Check your connection and try again.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('access-retry'));
    expect(await screen.findAllByText('No tasks yet')).toHaveLength(COLUMNS.length);
  });

  it('keeps the form open with a general error on a network failure', async () => {
    mockFetch('network-error');
    await renderBoard(testRepository(async () => boardData()));

    await openFormAndSubmit('Offline task');

    expect(await screen.findByText(NETWORK_ERROR_DESCRIPTION)).toBeOnTheScreen();
    expect(screen.getByTestId('title-input')).toHaveDisplayValue('Offline task');
    expect(screen.getAllByText('No tasks yet')).toHaveLength(COLUMNS.length);
  });
});
