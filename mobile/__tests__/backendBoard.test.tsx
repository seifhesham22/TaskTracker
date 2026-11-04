import { Text } from 'react-native';
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import BoardScreen from '../src/app/boards/[boardId]';
import {
  BOARD_LOAD_NETWORK,
  MEMBERS_LOAD_FAILED,
  MEMBERS_NEED_USER_ID,
  MEMBERS_NOT_IN_PROJECT,
  USER_ID_MISSING,
  USER_NOT_FOUND,
  createBackendBoardRepository,
} from '../src/data/backendBoardRepository';
import { BoardLoadError } from '../src/data/BoardRepository';
import { BoardRepositoryProvider } from '../src/data/BoardRepositoryContext';
import { NETWORK_ERROR_DESCRIPTION, TITLE_REQUIRED } from '../src/domain/createTaskErrors';
import { colors } from '../src/theme/tokens';
import {
  API_URL,
  BOARD_ID,
  COLUMNS,
  PROJECT_MEMBERS,
  PROJECTS,
  USER_ID,
  boardResponse,
  gqlError,
  gqlTask,
  mockFetch,
  projectsResponse,
  taskDto,
  taskNode,
} from '../test-utils/fakeBackend';

jest.mock('@react-native-community/datetimepicker', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text: RNText } = jest.requireActual('react-native');
  const Picker = ({ onChange, testID }: { onChange: (e: { type: string }, d: Date) => void; testID?: string }) =>
    React.createElement(
      Pressable,
      { testID, onPress: () => onChange({ type: 'set' }, new Date(2026, 10, 3)) },
      React.createElement(RNText, null, 'Pick Nov 3'),
    );
  return { __esModule: true, default: Picker, DateTimePickerAndroid: { open: jest.fn() } };
});

type SentRequest = { query: string; variables: Record<string, unknown> };
const sent = (fetchMock: jest.Mock, call: number): SentRequest =>
  JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string);

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  process.env.EXPO_PUBLIC_USER_ID = USER_ID;
});

afterAll(() => {
  delete process.env.EXPO_PUBLIC_USER_ID;
});

describe('backend getBoard', () => {
  it('loads the board, its tasks and the members of its project from the real queries', async () => {
    const fetchMock = mockFetch(boardResponse([taskNode()]), projectsResponse());

    const { board, tasks } = await createBackendBoardRepository().getBoard(BOARD_ID);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/graphql`);
    expect(sent(fetchMock, 0).query).toContain('board(id: $boardId)');
    expect(sent(fetchMock, 0).query).toContain('tasks(boardId: $boardId)');
    expect(sent(fetchMock, 0).variables).toEqual({ boardId: BOARD_ID });
    expect(sent(fetchMock, 1).query).toContain('projects(userId: $userId)');
    expect(sent(fetchMock, 1).variables).toEqual({ userId: USER_ID });

    expect(board.projectName).toBe('Test Project');
    expect(board.members).toEqual(PROJECT_MEMBERS);
    expect(board.membersUnavailable).toBeUndefined();
    expect(board.columns.map((c) => [c.id, c.category, c.color])).toEqual(
      COLUMNS.map((c) => [c.id, c.category, colors.status[c.category]]),
    );
    expect(tasks).toEqual([
      {
        id: '01a18766-8315-7c9c-90fd-5657de973400',
        readableId: 'TES-1',
        number: 1,
        boardId: BOARD_ID,
        title: 'Existing task',
        description: null,
        status: 'IN_PROGRESS',
        columnId: COLUMNS[2].id,
        columnName: 'In progress',
        priority: 'HIGH',
        assigneeIds: [PROJECT_MEMBERS[1].userId],
        assigneeNames: [PROJECT_MEMBERS[1].userName],
        dueDate: '2026-11-05T00:00:00.000Z',
        position: 'V',
      },
    ]);
  });

  it('still loads the board without EXPO_PUBLIC_USER_ID, but lists no members and says why', async () => {
    delete process.env.EXPO_PUBLIC_USER_ID;
    const fetchMock = mockFetch(boardResponse());

    const { board } = await createBackendBoardRepository().getBoard(BOARD_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(board.members).toEqual([]);
    expect(board.membersUnavailable).toBe(MEMBERS_NEED_USER_ID);
    expect(board.projectName).toBe('');
  });

  it('lists no members when the user is not in the board’s project', async () => {
    mockFetch(boardResponse(), projectsResponse([PROJECTS[0]]));
    const { board } = await createBackendBoardRepository().getBoard(BOARD_ID);
    expect(board.members).toEqual([]);
    expect(board.membersUnavailable).toBe(MEMBERS_NOT_IN_PROJECT);
  });

  it('lists no members when the members request fails, and keeps the board', async () => {
    mockFetch(boardResponse([taskNode()]), 'network-error');
    const { board, tasks } = await createBackendBoardRepository().getBoard(BOARD_ID);
    expect(tasks).toHaveLength(1);
    expect(board.members).toEqual([]);
    expect(board.membersUnavailable).toBe(MEMBERS_LOAD_FAILED);
  });

  it('reports a board the backend does not find as not found', async () => {
    const message = `Board '${BOARD_ID}' was not found.`;
    mockFetch({ body: gqlError('NOT_FOUND', message) });
    await expect(createBackendBoardRepository().getBoard(BOARD_ID)).rejects.toEqual(new BoardLoadError('notFound', message));
  });

  it('reports an ID that is not a UUID as not found without sending a request', async () => {
    const fetchMock = mockFetch();
    await expect(createBackendBoardRepository().getBoard('nope')).rejects.toMatchObject({ kind: 'notFound' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports no response as a network failure', async () => {
    mockFetch('network-error');
    await expect(createBackendBoardRepository().getBoard(BOARD_ID)).rejects.toEqual(
      new BoardLoadError('network', BOARD_LOAD_NETWORK),
    );
  });
});

describe('backend listBoards', () => {
  it('lists every board of the user’s projects', async () => {
    mockFetch(projectsResponse());
    await expect(createBackendBoardRepository().listBoards()).resolves.toEqual([
      { id: PROJECTS[0].boards[0].id, name: 'Other Board', projectName: 'Other Project' },
      { id: BOARD_ID, name: 'Test Board', projectName: 'Test Project' },
    ]);
  });

  it('asks for EXPO_PUBLIC_USER_ID instead of calling the backend without it', async () => {
    delete process.env.EXPO_PUBLIC_USER_ID;
    const fetchMock = mockFetch();
    await expect(createBackendBoardRepository().listBoards()).rejects.toEqual(new BoardLoadError('unsupported', USER_ID_MISSING));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('explains an unknown user', async () => {
    mockFetch({ body: gqlError('NOT_FOUND', `User '${USER_ID}' was not found.`) });
    await expect(createBackendBoardRepository().listBoards()).rejects.toEqual(new BoardLoadError('server', USER_NOT_FOUND));
  });
});

async function renderRealBoard() {
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

describe('Board screen and create-task form against the real backend contract', () => {
  it('creates a task with all five fields, using a real project member, and shows it at once', async () => {
    const created = taskDto({
      id: '01a18766-8315-7c9c-90fd-5657de973481',
      readableId: 'TES-2',
      title: 'Full task',
      description: 'Some details',
      priority: 'CRITICAL',
      assigneeIds: [PROJECT_MEMBERS[1].userId],
      dueDate: '2026-11-03T00:00:00.000Z',
    });
    const fetchMock = mockFetch(
      boardResponse(),
      projectsResponse(),
      { body: gqlTask(created) },
      'network-error',
    );
    await renderRealBoard();

    expect(await screen.findByText('Test Project · 0 tasks')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByText('Create task')[0]);

    await fireEvent.press(screen.getByTestId('assignee-select'));
    const sheet = screen.getByTestId('assignee-sheet');
    expect(within(sheet).getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
      'Unassigned',
      'admin@local.test',
      'user1@local.test',
    ]);
    expect(within(sheet).queryByText('outsider@local.test')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`assignee-sheet-option-${PROJECT_MEMBERS[1].userId}`));

    await fireEvent.changeText(screen.getByTestId('title-input'), '  Full task  ');
    await fireEvent.changeText(screen.getByTestId('description-input'), 'Some details');
    await fireEvent.press(screen.getByTestId('priority-select'));
    await fireEvent.press(screen.getByTestId('priority-sheet-option-CRITICAL'));
    await fireEvent.press(screen.getByTestId('due-date-select'));
    await fireEvent.press(screen.getByTestId('due-date-picker'));
    await fireEvent.press(screen.getByTestId('due-date-done'));
    await fireEvent.press(screen.getByTestId('submit-button'));

    await waitFor(() => expect(screen.queryByTestId('create-task-sheet')).not.toBeOnTheScreen());
    const mutation = sent(fetchMock, 2);
    expect(mutation.query).toContain('createTask(input: $input)');
    expect(mutation.variables.input).toEqual({
      boardId: BOARD_ID,
      columnId: COLUMNS[0].id,
      title: 'Full task',
      description: 'Some details',
      assigneeId: PROJECT_MEMBERS[1].userId,
      priority: 'CRITICAL',
      dueDate: '2026-11-03T00:00:00Z',
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    const card = screen.getByTestId(`task-card-${created.id}`);
    expect(within(card).getByText('Full task')).toBeOnTheScreen();
    expect(within(card).getByText('Critical')).toBeOnTheScreen();
    expect(screen.getByText('Test Project · 1 task')).toBeOnTheScreen();
    expect(screen.getByLabelText('Backlog, 1 task')).toBeOnTheScreen();
  });

  it('keeps every value after a network failure and succeeds on retry', async () => {
    const created = taskDto({ title: 'Retry me' });
    const fetchMock = mockFetch(
      boardResponse(),
      projectsResponse(),
      'network-error',
      { body: gqlTask(created) },
      boardResponse([
        taskNode({
          id: created.id,
          title: 'Retry me',
          priority: null,
          dueDate: null,
          columnId: COLUMNS[0].id,
          column: { id: COLUMNS[0].id, name: 'Backlog', category: 'BACKLOG' },
          assignees: [],
        }),
      ]),
      projectsResponse(),
    );
    await renderRealBoard();

    await fireEvent.press((await screen.findAllByText('Create task'))[0]);
    await fireEvent.press(screen.getByTestId('submit-button'));
    expect(within(screen.getByTestId('field-title')).getByText(TITLE_REQUIRED)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('title-input'), 'Retry me');
    expect(screen.queryByTestId('title-error')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('submit-button'));
    expect(await screen.findByText(NETWORK_ERROR_DESCRIPTION)).toBeOnTheScreen();
    expect(screen.getByTestId('title-input')).toHaveDisplayValue('Retry me');

    await fireEvent.press(screen.getByTestId('submit-button'));
    await waitFor(() => expect(screen.queryByTestId('create-task-sheet')).not.toBeOnTheScreen());
    expect(screen.getByTestId(`task-card-${created.id}`)).toBeOnTheScreen();
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('shows the assignee’s initials from the tasks query when the members can’t be loaded', async () => {
    delete process.env.EXPO_PUBLIC_USER_ID;
    mockFetch(boardResponse([taskNode({ columnId: COLUMNS[0].id, column: { id: COLUMNS[0].id, name: 'Backlog', category: 'BACKLOG' } })]));
    await renderRealBoard();

    const card = await screen.findByTestId('task-card-01a18766-8315-7c9c-90fd-5657de973400');
    expect(within(card).getByText('US')).toBeOnTheScreen();
  });

  it('says why no assignee can be picked when the members can’t be loaded', async () => {
    delete process.env.EXPO_PUBLIC_USER_ID;
    mockFetch(boardResponse());
    await renderRealBoard();

    expect(await screen.findByText('0 tasks')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByText('Create task')[0]);

    expect(screen.getByTestId('assignee-unavailable')).toHaveTextContent(MEMBERS_NEED_USER_ID);
    await fireEvent.press(screen.getByTestId('assignee-select'));
    expect(within(screen.getByTestId('assignee-sheet')).getAllByRole('button')).toHaveLength(1);
  });
});
