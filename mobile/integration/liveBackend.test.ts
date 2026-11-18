import { loginRequest, logoutRequest, meRequest, registerRequest } from '../src/api/auth';
import { hasErrorCode } from '../src/api/graphql';
import { setSession } from '../src/auth/session';
import { createBackendBoardRepository } from '../src/data/backendBoardRepository';
import { BoardLoadError } from '../src/data/BoardRepository';
import { EMAIL_TAKEN, INVALID_CREDENTIALS, toLoginErrors, toRegisterErrors } from '../src/domain/authErrors';
import { CreateTaskError } from '../src/domain/createTaskErrors';

const MISSING_ID = '00000000-0000-0000-0000-000000000001';

const liveUrl = process.env.LIVE_API_URL;
const liveEmail = process.env.LIVE_EMAIL;
const livePassword = process.env.LIVE_PASSWORD;

if (!liveUrl || !liveEmail || !livePassword) {
  throw new Error('Set LIVE_API_URL, LIVE_EMAIL and LIVE_PASSWORD to run the integration tests.');
}

const repository = createBackendBoardRepository();

async function firstBoardId(): Promise<string> {
  const [summary] = await repository.listBoards();
  if (!summary) throw new Error('The user in LIVE_EMAIL has no boards.');
  return summary.id;
}

beforeAll(async () => {
  process.env.EXPO_PUBLIC_API_URL = liveUrl;
  setSession(await loginRequest({ email: liveEmail, password: livePassword }));
});

afterAll(() => setSession(null));

const failureOf = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected the request to fail');
    },
    (error: unknown) => error,
  );

describe('live auth', () => {
  // A throwaway account: the backend has no delete operation, so each run leaves one behind.
  const email = `integration-${Date.now()}@test.local`;
  const password = `Integration@${Date.now()}`;

  it('registers an account, refuses the same email twice, and refuses a weak password', async () => {
    await expect(registerRequest({ email, password })).resolves.toMatchObject({ email });
    expect(toRegisterErrors(await failureOf(registerRequest({ email, password })))).toEqual({ email: EMAIL_TAKEN });
    const weak = toRegisterErrors(await failureOf(registerRequest({ email: `weak-${email}`, password: 'short' })));
    expect(weak.password).toMatch(/Passwords must/);
  });

  it('logs in, identifies the user with the token, and ends the session on logout', async () => {
    const session = await loginRequest({ email, password });
    expect(session.user.email).toBe(email);
    expect(Date.parse(session.expiresAt)).toBeGreaterThan(Date.now());
    await expect(meRequest(session.accessToken)).resolves.toMatchObject({ id: session.user.id, email });

    await logoutRequest(session.accessToken);
    expect(hasErrorCode(await failureOf(meRequest(session.accessToken)), 'AUTH_NOT_AUTHENTICATED')).toBe(true);
  });

  it('answers a wrong password with the generic invalid-credentials message', async () => {
    const error = await failureOf(loginRequest({ email, password: 'Wrong@Password123' }));
    expect(toLoginErrors(error)).toEqual({ form: INVALID_CREDENTIALS });
  });
});

describe('live GraphQL backend', () => {
  it('returns the board’s columns in position order, with the project’s members', async () => {
    const { board } = await repository.getBoard(await firstBoardId());

    expect(board.columns.length).toBeGreaterThan(0);
    const positions = board.columns.map((column) => column.position);
    expect(positions).toEqual([...positions].sort());
    expect(board.projectName).not.toBe('');
    expect(board.members.length).toBeGreaterThan(0);
    expect(board.membersUnavailable).toBeUndefined();
  });

  it('creates a title-only task that a fresh board request returns', async () => {
    const boardId = await firstBoardId();
    const title = `integration title-only ${Date.now()}`;

    const created = await repository.createTask({ boardId, title });

    expect(created).toMatchObject({ title, description: null, priority: null, dueDate: null, assigneeIds: [] });
    const { board, tasks } = await repository.getBoard(boardId);
    const returned = tasks.find((task) => task.id === created.id);
    expect(returned?.title).toBe(title);
    expect(returned?.columnId).toBe(board.columns[0].id);
  });

  it('creates a task with every optional field in the chosen column', async () => {
    const boardId = await firstBoardId();
    const { board } = await repository.getBoard(boardId);
    const column = board.columns[board.columns.length - 1];
    const assignee = board.members[0];
    const title = `integration full ${Date.now()}`;

    const created = await repository.createTask({
      boardId,
      columnId: column.id,
      title,
      description: 'integration description',
      assigneeId: assignee.userId,
      priority: 'CRITICAL',
      dueDate: '2099-11-05T00:00:00Z',
    });

    const { tasks } = await repository.getBoard(boardId);
    const returned = tasks.find((task) => task.id === created.id);
    expect(returned).toMatchObject({
      title,
      columnId: column.id,
      status: column.category,
      description: 'integration description',
      priority: 'CRITICAL',
      assigneeIds: [assignee.userId],
    });
    expect(returned?.dueDate?.slice(0, 10)).toBe('2099-11-05');
  });

  it('moves a task to another column and keeps it there, and refuses an unknown column', async () => {
    const boardId = await firstBoardId();
    const { board } = await repository.getBoard(boardId);
    const destination = board.columns[1];
    const created = await repository.createTask({ boardId, columnId: board.columns[0].id, title: `integration move ${Date.now()}` });

    const moved = await repository.moveTask(created.id, destination.id);

    expect(moved).toMatchObject({ id: created.id, columnId: destination.id, status: destination.category });
    const { tasks } = await repository.getBoard(boardId);
    expect(tasks.filter((task) => task.id === created.id).map((task) => task.columnId)).toEqual([destination.id]);

    await expect(repository.moveTask(created.id, MISSING_ID)).rejects.toThrow(`Column '${MISSING_ID}' was not found on board '${boardId}'.`);
    const after = await repository.getBoard(boardId);
    expect(after.tasks.find((task) => task.id === created.id)?.columnId).toBe(destination.id);
  });

  it('reports a board that does not exist as not found', async () => {
    await expect(repository.getBoard(MISSING_ID)).rejects.toMatchObject({ kind: 'notFound' });
    await expect(repository.getBoard(MISSING_ID)).rejects.toBeInstanceOf(BoardLoadError);
  });

  it('maps the server’s rejections to the right place in the form', async () => {
    const boardId = await firstBoardId();
    const failureOf = (input: Parameters<typeof repository.createTask>[0]) =>
      repository.createTask(input).then(
        () => {
          throw new Error('expected createTask to fail');
        },
        (error: unknown) => (error as CreateTaskError).failure,
      );

    const blank = await failureOf({ boardId, title: '   ' });
    expect(blank).toEqual({ kind: 'fields', fields: { title: 'Title is required.' } });

    const nonMember = await failureOf({ boardId, title: 'integration rejected', assigneeId: MISSING_ID });
    expect(nonMember.kind).toBe('fields');

    const missingColumn = await failureOf({ boardId, title: 'integration rejected', columnId: MISSING_ID });
    expect(missingColumn.kind).toBe('general');

    const missingBoard = await failureOf({ boardId: MISSING_ID, title: 'integration rejected' });
    expect(missingBoard.kind).toBe('boardNotFound');
  });
});
