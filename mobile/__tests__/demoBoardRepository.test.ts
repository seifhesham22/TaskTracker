import { CreateTaskError } from '../src/domain/createTaskErrors';
import {
  createDemoBoardRepository,
  DEMO_MEMBERS,
  DEMO_MISSING_BOARD_ID,
  DEMO_REMOVED_MEMBER_ID,
} from '../src/data/demoBoardRepository';
import type { BoardRepository } from '../src/data/BoardRepository';

async function boardNamed(repository: BoardRepository, name: string) {
  const summary = (await repository.listBoards()).find((b) => b.name === name);
  if (!summary) throw new Error(`no demo board "${name}"`);
  return repository.getBoard(summary.id);
}

const failureOf = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected createTask to fail');
    },
    (error: unknown) => (error as CreateTaskError).failure,
  );

describe('demo board repository', () => {
  it('starts with an empty board and adds created tasks to it', async () => {
    const repository = createDemoBoardRepository({ latencyMs: 0 });
    const { board, tasks } = await boardNamed(repository, 'Demo board');
    expect(tasks).toEqual([]);
    expect(board.columns.map((c) => c.name)).toEqual(['Backlog', 'To do', 'In progress', 'Done']);

    const created = await repository.createTask({ boardId: board.id, columnId: board.columns[1].id, title: '  First task  ' });

    expect(created).toMatchObject({ title: 'First task', status: 'TO_DO', columnName: 'To do', readableId: 'DEMO-1' });
    expect((await repository.getBoard(board.id)).tasks).toEqual([created]);
  });

  it('rejects the "removed" demo member like the backend rejects a non-member', async () => {
    const repository = createDemoBoardRepository({ latencyMs: 0 });
    const { board } = await boardNamed(repository, 'Demo board');

    const failure = await failureOf(repository.createTask({ boardId: board.id, title: 'T', assigneeId: DEMO_REMOVED_MEMBER_ID }));

    expect(failure).toEqual({
      kind: 'fields',
      fields: { assigneeId: `User '${DEMO_REMOVED_MEMBER_ID}' is not a member of project DEMO, so they can't be assigned to this task.` },
    });
    await expect(repository.createTask({ boardId: board.id, title: 'T', assigneeId: DEMO_MEMBERS[0].userId })).resolves.toBeDefined();
  });

  it('simulates a board deleted while the form is open', async () => {
    const repository = createDemoBoardRepository({ latencyMs: 0 });
    const { board } = await boardNamed(repository, 'Demo · board deleted while the form is open');

    const failure = await failureOf(repository.createTask({ boardId: board.id, title: 'T' }));

    expect(failure).toEqual({ kind: 'boardNotFound', message: `Board '${board.id}' was not found.` });
    await expect(repository.getBoard(board.id)).rejects.toMatchObject({ kind: 'notFound' });
  });

  it('simulates a missing column without reporting the board as missing, then succeeds on retry', async () => {
    const repository = createDemoBoardRepository({ latencyMs: 0 });
    const { board } = await boardNamed(repository, 'Demo · column missing on first submit');

    const failure = await failureOf(repository.createTask({ boardId: board.id, title: 'T' }));
    expect(failure.kind).toBe('general');

    await expect(repository.createTask({ boardId: board.id, title: 'T' })).resolves.toMatchObject({ title: 'T' });
  });

  it.each([
    ['Demo · network failure on first submit', 'network'],
    ['Demo · server failure on first submit', 'server'],
  ])('%s fails once with a %s error, then succeeds', async (name, reason) => {
    const repository = createDemoBoardRepository({ latencyMs: 0 });
    const { board } = await boardNamed(repository, name);

    expect(await failureOf(repository.createTask({ boardId: board.id, title: 'T' }))).toMatchObject({ kind: 'general', reason });
    await expect(repository.createTask({ boardId: board.id, title: 'T' })).resolves.toBeDefined();
  });

  it('reports an unknown board as not found and can fail a board load once', async () => {
    const repository = createDemoBoardRepository({ latencyMs: 0 });
    await expect(repository.getBoard(DEMO_MISSING_BOARD_ID)).rejects.toMatchObject({ kind: 'notFound' });

    const summary = (await repository.listBoards()).find((b) => b.name === 'Demo · board fails to load once')!;
    await expect(repository.getBoard(summary.id)).rejects.toMatchObject({ kind: 'network' });
    await expect(repository.getBoard(summary.id)).resolves.toMatchObject({ tasks: [] });
  });
});

describe('isDemoMode', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('uses demo data when the flag is "true", or when no backend URL is configured', () => {
    const { isDemoMode } = jest.requireActual<typeof import('../src/data/BoardRepositoryContext')>(
      '../src/data/BoardRepositoryContext',
    );
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    process.env.EXPO_PUBLIC_MOBILE_DEMO_MODE = 'false';
    expect(isDemoMode()).toBe(false);
    process.env.EXPO_PUBLIC_MOBILE_DEMO_MODE = 'true';
    expect(isDemoMode()).toBe(true);
    process.env.EXPO_PUBLIC_MOBILE_DEMO_MODE = 'false';
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(isDemoMode()).toBe(true);
  });
});
