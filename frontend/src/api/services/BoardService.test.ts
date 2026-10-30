import { describe, expect, it, vi } from 'vitest';
import { BoardService } from './BoardService';
import { ColumnCategory, TaskPriority } from '../../domain/models';
import type { HttpClient } from '../HttpClient';

describe('BoardService', () => {
  it('returns board with tasks successfully', async () => {
    const mockHttpClient: HttpClient = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        data: {
          board: {
            id: 'b-1',
            projectId: 'p-1',
            projectName: 'Test Project',
            name: 'Test Board',
            columns: [
              { id: 'c-1', name: 'Backlog', category: ColumnCategory.Backlog, position: 'A' },
            ],
            members: [
              { userId: 'u-1', userName: 'Alice', email: 'alice@example.com' },
            ],
          },
          tasks: [
            {
              id: 't-1',
              readableId: 'TES-1',
              number: 1,
              boardId: 'b-1',
              title: 'First task',
              status: ColumnCategory.Backlog,
              columnId: 'c-1',
              columnName: 'Backlog',
              priority: TaskPriority.High,
              assigneeIds: ['u-1'],
              dueDate: '2026-11-01T00:00:00Z',
              createdAt: '2026-10-30T00:00:00Z',
            },
          ],
        },
      }),
      put: vi.fn(),
      delete: vi.fn(),
    };

    const service = new BoardService(mockHttpClient);
    const result = await service.getBoardWithTasks('b-1');

    expect(result.board.name).toBe('Test Board');
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('First task');
  });

  it('throws 404 error when board is not found', async () => {
    const mockHttpClient: HttpClient = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        errors: [{ message: "Board 'invalid-id' was not found.", extensions: { code: 'NOT_FOUND' } }],
      }),
      put: vi.fn(),
      delete: vi.fn(),
    };

    const service = new BoardService(mockHttpClient);

    await expect(service.getBoardWithTasks('invalid-id')).rejects.toThrow(/not found/i);
  });

  it('creates task via GraphQL mutation', async () => {
    const mockHttpClient: HttpClient = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        data: {
          createTask: {
            id: 't-2',
            readableId: 'TES-2',
            number: 2,
            boardId: 'b-1',
            title: 'New task',
            status: ColumnCategory.Backlog,
            columnId: 'c-1',
            columnName: 'Backlog',
            priority: null,
            assigneeIds: [],
            dueDate: null,
            createdAt: '2026-10-30T00:00:00Z',
          },
        },
      }),
      put: vi.fn(),
      delete: vi.fn(),
    };

    const service = new BoardService(mockHttpClient);
    const created = await service.createTask({
      boardId: 'b-1',
      title: 'New task',
    });

    expect(created.readableId).toBe('TES-2');
    expect(created.title).toBe('New task');
  });

  it('throws ApiError when createTask is refused with BAD_USER_INPUT', async () => {
    const mockHttpClient: HttpClient = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        errors: [{ message: 'Title cannot be empty or only spaces.', extensions: { code: 'BAD_USER_INPUT' } }],
      }),
      put: vi.fn(),
      delete: vi.fn(),
    };

    const service = new BoardService(mockHttpClient);

    await expect(
      service.createTask({ boardId: 'b-1', title: '   ' })
    ).rejects.toThrow('Title cannot be empty or only spaces.');
  });
});

