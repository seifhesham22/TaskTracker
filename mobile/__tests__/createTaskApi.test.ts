/**
 * The real backend repository: the createTask GraphQL request and how each backend answer is
 * mapped. Responses copy the backend's codes and messages (CreateTaskHandler, TaskItem).
 */
import { createBackendBoardRepository, READ_API_MISSING } from '../src/data/backendBoardRepository';
import { BoardLoadError } from '../src/data/BoardRepository';
import {
  COLUMN_MISSING_DESCRIPTION,
  CreateTaskError,
  NETWORK_ERROR_DESCRIPTION,
  SERVER_ERROR_DESCRIPTION,
  TITLE_REQUIRED,
  type CreateTaskFailure,
} from '../src/domain/createTaskErrors';
import type { CreateTaskInput } from '../src/domain/models';
import { API_URL, BOARD_ID, COLUMNS, MEMBERS, gqlError, gqlTask, mockFetch, sentBody, taskDto, type FakeResponse } from '../test-utils/fakeBackend';

const input: CreateTaskInput = { boardId: BOARD_ID, title: 'Write docs' };

async function failureFor(response: FakeResponse, request: CreateTaskInput = input): Promise<CreateTaskFailure> {
  mockFetch(response);
  try {
    await createBackendBoardRepository().createTask(request);
  } catch (error) {
    expect(error).toBeInstanceOf(CreateTaskError);
    return (error as CreateTaskError).failure;
  }
  throw new Error('createTask did not fail');
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = API_URL;
});

describe('createTask request', () => {
  it('posts the createTask mutation to /graphql with only the fields that are set', async () => {
    const fetchMock = mockFetch({ body: gqlTask(taskDto()) });

    await createBackendBoardRepository().createTask({
      boardId: BOARD_ID,
      columnId: COLUMNS[1].id,
      title: 'Write docs',
      assigneeId: MEMBERS[0].userId,
      priority: 'HIGH',
      dueDate: '2026-11-05T00:00:00Z',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/graphql`);
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST');
    const body = sentBody(fetchMock);
    expect(body.query).toContain('mutation CreateTask($input: CreateTaskInput!)');
    expect(body.query).toContain('createTask(input: $input)');
    expect(body.variables.input).toEqual({
      boardId: BOARD_ID,
      columnId: COLUMNS[1].id,
      title: 'Write docs',
      assigneeId: MEMBERS[0].userId,
      priority: 'HIGH',
      dueDate: '2026-11-05T00:00:00Z',
    });
  });

  it('leaves out optional fields that are not set', async () => {
    const fetchMock = mockFetch({ body: gqlTask(taskDto()) });
    await createBackendBoardRepository().createTask(input);
    expect(sentBody(fetchMock).variables.input).toEqual({ boardId: BOARD_ID, title: 'Write docs' });
  });

  it('returns the task from the response', async () => {
    const task = taskDto({ title: 'Write docs', readableId: 'TES-7' });
    mockFetch({ body: gqlTask(task) });
    await expect(createBackendBoardRepository().createTask(input)).resolves.toEqual(task);
  });
});

describe('createTask error mapping', () => {
  it('maps "Board … was not found." for the requested board to boardNotFound', async () => {
    const failure = await failureFor({ body: gqlError('NOT_FOUND', `Board '${BOARD_ID}' was not found.`) });
    expect(failure).toEqual({ kind: 'boardNotFound', message: `Board '${BOARD_ID}' was not found.` });
  });

  it('does not treat a missing column (also NOT_FOUND) as a missing board', async () => {
    const failure = await failureFor(
      { body: gqlError('NOT_FOUND', `Column '${COLUMNS[2].id}' was not found on board '${BOARD_ID}'.`) },
      { ...input, columnId: COLUMNS[2].id },
    );
    expect(failure.kind).toBe('general');
    expect(failure.kind === 'general' && failure.error.description).toBe(COLUMN_MISSING_DESCRIPTION);
  });

  it('does not treat a NOT_FOUND about another board as this board missing', async () => {
    const failure = await failureFor({ body: gqlError('NOT_FOUND', "Board '00000000-0000-0000-0000-000000000001' was not found.") });
    expect(failure.kind).toBe('general');
  });

  it('puts the server reason for a non-member assignee under Assignee', async () => {
    const message = `User '${MEMBERS[0].userId}' is not a member of project TES, so they can't be assigned to this task.`;
    const failure = await failureFor({ body: gqlError('BAD_USER_INPUT', message) }, { ...input, assigneeId: MEMBERS[0].userId });
    expect(failure).toEqual({ kind: 'fields', fields: { assigneeId: message } });
  });

  it('shows "board has no columns" as a general error with the server message', async () => {
    const message = "This board has no columns, so the task can't get a status.";
    const failure = await failureFor({ body: gqlError('BAD_USER_INPUT', message) });
    expect(failure).toMatchObject({ kind: 'general', reason: 'rejected', error: { description: message } });
  });

  it('maps the server title error to the Title field', async () => {
    const failure = await failureFor({ body: gqlError('BAD_USER_INPUT', 'Title cannot be empty or only spaces.') });
    expect(failure).toEqual({ kind: 'fields', fields: { title: TITLE_REQUIRED } });
  });

  it('treats an error without a known code as a server failure, not a network failure', async () => {
    const failure = await failureFor({ body: gqlError(undefined, 'Unexpected Execution Error') });
    expect(failure).toMatchObject({ kind: 'general', reason: 'server', error: { description: SERVER_ERROR_DESCRIPTION } });
  });

  it('reads GraphQL errors from a non-2xx response too', async () => {
    const failure = await failureFor({ status: 400, body: gqlError('BAD_USER_INPUT', 'Title cannot be empty or only spaces.') });
    expect(failure).toEqual({ kind: 'fields', fields: { title: TITLE_REQUIRED } });
  });

  it('maps an HTTP 500 without a GraphQL body to a server failure', async () => {
    const failure = await failureFor({ status: 500, body: 'Internal Server Error' });
    expect(failure).toMatchObject({ kind: 'general', reason: 'server', error: { description: SERVER_ERROR_DESCRIPTION } });
  });

  it('maps a request that gets no response to a network failure', async () => {
    const failure = await failureFor('network-error');
    expect(failure).toMatchObject({ kind: 'general', reason: 'network', error: { description: NETWORK_ERROR_DESCRIPTION } });
  });

  it('reports a missing EXPO_PUBLIC_API_URL without sending a request', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const fetchMock = mockFetch({ body: gqlTask(taskDto()) });

    const error = await createBackendBoardRepository().createTask(input).catch((e: unknown) => e);

    expect(fetchMock).not.toHaveBeenCalled();
    expect((error as CreateTaskError).failure).toMatchObject({ kind: 'general', reason: 'configuration' });
  });
});

describe('board reads on the real backend', () => {
  it('reports board and board-list loading as unsupported without calling the backend', async () => {
    const fetchMock = mockFetch();
    const repository = createBackendBoardRepository();

    await expect(repository.getBoard(BOARD_ID)).rejects.toEqual(new BoardLoadError('unsupported', READ_API_MISSING));
    await expect(repository.listBoards()).rejects.toMatchObject({ kind: 'unsupported' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
