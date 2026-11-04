import { createBackendBoardRepository } from '../src/data/backendBoardRepository';
import { BoardLoadError } from '../src/data/BoardRepository';
import { CreateTaskError } from '../src/domain/createTaskErrors';

const MISSING_ID = '00000000-0000-0000-0000-000000000001';

const liveUrl = process.env.LIVE_API_URL;
const liveUserId = process.env.LIVE_USER_ID;

if (!liveUrl || !liveUserId) {
  throw new Error('Set LIVE_API_URL and LIVE_USER_ID to run the integration tests.');
}

const repository = createBackendBoardRepository();

async function firstBoardId(): Promise<string> {
  const [summary] = await repository.listBoards();
  if (!summary) throw new Error('The user in LIVE_USER_ID has no boards.');
  return summary.id;
}

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_URL = liveUrl;
  process.env.EXPO_PUBLIC_USER_ID = liveUserId;
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
