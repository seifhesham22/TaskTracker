import { describe, expect, it, vi } from 'vitest';
import { BoardService } from './BoardService';
import { ColumnCategory, type TaskItem, TaskPriority } from '../../domain/models';
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

  it('moves task via MoveTask mutation successfully', async () => {
    const mockHttpClient: HttpClient = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        data: {
          moveTask: {
            id: 't-1',
            readableId: 'TES-1',
            number: 1,
            boardId: 'b-1',
            title: 'Moved task',
            status: ColumnCategory.InProgress,
            columnId: 'c-progress',
            column: { id: 'c-progress', name: 'In progress', category: ColumnCategory.InProgress },
            priority: TaskPriority.High,
            assignees: [],
            dueDate: null,
            createdAt: '2026-10-30T00:00:00Z',
            parentTaskId: 'p-1',
          },
        },
      }),
      put: vi.fn(),
      delete: vi.fn(),
    };

    const service = new BoardService(mockHttpClient);
    const moved = await service.moveTask({
      taskId: 't-1',
      columnId: 'c-progress',
    });

    expect(moved.id).toBe('t-1');
    expect(moved.columnId).toBe('c-progress');
    expect(moved.columnName).toBe('In progress');
    expect(moved.status).toBe(ColumnCategory.InProgress);
    expect(moved.parentTaskId).toBe('p-1');
  });

  it('throws ApiError when MoveTask fails with GraphQL error', async () => {
    const mockHttpClient: HttpClient = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        errors: [{ message: "Column 'c-invalid' was not found on board 'b-1'.", extensions: { code: 'NOT_FOUND' } }],
      }),
      put: vi.fn(),
      delete: vi.fn(),
    };

    const service = new BoardService(mockHttpClient);

    await expect(service.moveTask({ taskId: 't-1', columnId: 'c-invalid' })).rejects.toThrow(
      "Column 'c-invalid' was not found on board 'b-1'."
    );
  });

  it('accepts UUIDv7 IDs like the seeded test board and requests valid GraphQL fields', async () => {
    const postMock = vi.fn().mockResolvedValue({
      data: {
        board: {
          id: '01a1aad8-c24a-73f9-a095-069769796312',
          projectId: '01a1aad8-c24a-73cd-b1e8-23e9150a4fa7',
          name: 'Test Board',
          columns: [
            { id: '01a1aad8-c24a-7981-bc0e-b8572aa9d513', name: 'Backlog', category: ColumnCategory.Backlog, position: 'A' },
          ],
        },
        tasks: [
          {
            id: '01a1aae6-ea53-72e0-a09a-e48651aea223',
            readableId: 'TES-1',
            number: 1,
            boardId: '01a1aad8-c24a-73f9-a095-069769796312',
            title: 'Design onboarding checklist',
            status: ColumnCategory.Backlog,
            columnId: '01a1aad8-c24a-7981-bc0e-b8572aa9d513',
            column: { id: '01a1aad8-c24a-7981-bc0e-b8572aa9d513', name: 'Backlog', category: ColumnCategory.Backlog },
            priority: TaskPriority.Medium,
            assignees: [{ id: '01a1aad8-c24a-73cd-b1e8-23e9150a4fa8', userName: 'Admin User' }],
          },
        ],
      },
    });

    const mockHttpClient: HttpClient = {
      get: vi.fn(),
      post: postMock,
      put: vi.fn(),
      delete: vi.fn(),
    };

    const service = new BoardService(mockHttpClient);
    const result = await service.getBoardWithTasks('01a1aad8-c24a-73f9-a095-069769796312');

    expect(result.board.id).toBe('01a1aad8-c24a-73f9-a095-069769796312');
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('Design onboarding checklist');
    expect(result.tasks[0].assigneeNames).toEqual(['Admin User']);

    // Verify GraphQL query does NOT request projectName or members on BoardNode
    const sentQuery = postMock.mock.calls[0][1].query as string;
    expect(sentQuery).not.toMatch(/board\s*\([^)]*\)\s*\{[^}]*projectName/);
    expect(sentQuery).not.toMatch(/board\s*\([^)]*\)\s*\{[^}]*members/);
  });

  it('throws IncompleteSubtasksApiError when moveTask is rejected due to incomplete subtasks', async () => {
    const postMock = vi.fn().mockResolvedValue({
      errors: [
        {
          message:
            "TES-24 can't be completed while these 2 subtasks are not done: TES-26 (Review checklist), TES-27 (Confirm date).",
          extensions: {
            code: 'BAD_USER_INPUT',
            incompleteSubtasks: [
              { id: 'sub-1', readableId: 'TES-26', title: 'Review checklist' },
              { id: 'sub-2', readableId: 'TES-27', title: 'Confirm date' },
            ],
          },
        },
      ],
    });

    const mockHttpClient: HttpClient = {
      get: vi.fn(),
      post: postMock,
      put: vi.fn(),
      delete: vi.fn(),
    };

    const service = new BoardService(mockHttpClient);

    await expect(
      service.moveTask({ taskId: 't-parent', columnId: 'col-done' })
    ).rejects.toThrowError(
      "TES-24 can't be completed while these 2 subtasks are not done: TES-26 (Review checklist), TES-27 (Confirm date)."
    );

    try {
      await service.moveTask({ taskId: 't-parent', columnId: 'col-done' });
    } catch (err: unknown) {
      const error = err as import('../errors').IncompleteSubtasksApiError;
      expect(error.name).toBe('IncompleteSubtasksApiError');
      expect(error.incompleteSubtasks).toHaveLength(2);
      expect(error.incompleteSubtasks[0]).toEqual({
        id: 'sub-1',
        readableId: 'TES-26',
        title: 'Review checklist',
      });
      expect(error.incompleteSubtasks[1]).toEqual({
        id: 'sub-2',
        readableId: 'TES-27',
        title: 'Confirm date',
      });
    }
  });

  it('preserves parentTaskId when moveTask succeeds', async () => {
    const postMock = vi.fn().mockResolvedValue({
      data: {
        moveTask: {
          id: 'sub-1',
          readableId: 'TES-26',
          number: 26,
          boardId: 'b-1',
          title: 'Review checklist',
          status: ColumnCategory.Done,
          columnId: 'col-done',
          column: { id: 'col-done', name: 'Done', category: ColumnCategory.Done },
          parentTaskId: 'parent-1',
          createdAt: '2026-10-30T00:00:00Z',
        },
      },
    });

    const mockHttpClient: HttpClient = {
      get: vi.fn(),
      post: postMock,
      put: vi.fn(),
      delete: vi.fn(),
    };

    const service = new BoardService(mockHttpClient);
    const moved = await service.moveTask({ taskId: 'sub-1', columnId: 'col-done' });

    expect(moved.parentTaskId).toBe('parent-1');
    expect(moved.status).toBe(ColumnCategory.Done);
  });

  it('creates subtask via createSubtask method', async () => {
    const postMock = vi.fn().mockResolvedValue({
      data: {
        createTask: {
          id: 't-sub-1',
          readableId: 'TES-28',
          number: 28,
          boardId: 'b-1',
          title: 'Prepare the release notes',
          status: ColumnCategory.ToDo,
          columnId: 'c-1',
          columnName: 'To do',
          priority: null,
          assigneeIds: [],
          dueDate: null,
          createdAt: '2026-11-01T00:00:00Z',
          parentTaskId: 't-parent-1',
        },
      },
    });

    const mockHttpClient: HttpClient = {
      get: vi.fn(),
      post: postMock,
      put: vi.fn(),
      delete: vi.fn(),
    };

    const service = new BoardService(mockHttpClient);
    const parentTask: TaskItem = {
      id: 't-parent-1',
      readableId: 'TES-24',
      number: 24,
      boardId: 'b-1',
      title: 'Prepare the project launch',
      status: ColumnCategory.InProgress,
      columnId: 'c-1',
      assigneeIds: [],
    };

    const subtask = await service.createSubtask(parentTask, 'Prepare the release notes');

    expect(subtask.id).toBe('t-sub-1');
    expect(subtask.parentTaskId).toBe('t-parent-1');
    expect(postMock).toHaveBeenCalledWith(
      '/graphql',
      expect.objectContaining({
        variables: {
          input: {
            boardId: 'b-1',
            columnId: 'c-1',
            title: 'Prepare the release notes',
            parentTaskId: 't-parent-1',
          },
        },
      })
    );
  });

  describe('updateTask', () => {
    it('updates task successfully and returns mapped TaskItem', async () => {
      const mockUpdated = {
        id: 't-1',
        readableId: 'TES-1',
        number: 1,
        boardId: 'b-1',
        title: 'Updated title',
        description: 'Updated desc',
        status: ColumnCategory.Backlog,
        columnId: 'c-1',
        column: { id: 'c-1', name: 'Backlog', category: ColumnCategory.Backlog },
        priority: TaskPriority.High,
        startDate: '2026-11-16T00:00:00Z',
        dueDate: '2026-11-20T00:00:00Z',
        assignees: [{ id: 'u-1', userName: 'Alice' }],
      };

      const postMock = vi.fn().mockResolvedValue({
        data: { updateTask: mockUpdated },
      });

      const mockHttpClient: HttpClient = {
        get: vi.fn(),
        post: postMock,
        put: vi.fn(),
        delete: vi.fn(),
      };

      const service = new BoardService(mockHttpClient);
      const result = await service.updateTask({
        taskId: 't-1',
        title: 'Updated title',
        description: 'Updated desc',
        priority: TaskPriority.High,
        startDate: '2026-11-16T00:00:00Z',
        dueDate: '2026-11-20T00:00:00Z',
      });

      expect(result.id).toBe('t-1');
      expect(result.title).toBe('Updated title');
      expect(result.priority).toBe(TaskPriority.High);
      expect(result.startDate).toBe('2026-11-16T00:00:00Z');
      expect(result.dueDate).toBe('2026-11-20T00:00:00Z');
      expect(postMock).toHaveBeenCalledWith(
        '/graphql',
        expect.objectContaining({
          variables: {
            input: {
              taskId: 't-1',
              title: 'Updated title',
              description: 'Updated desc',
              priority: TaskPriority.High,
              startDate: '2026-11-16T00:00:00Z',
              dueDate: '2026-11-20T00:00:00Z',
            },
          },
        })
      );
    });

    it('throws 404 ApiError when task is not found', async () => {
      const postMock = vi.fn().mockResolvedValue({
        errors: [{ message: "Task 't-unknown' was not found.", extensions: { code: 'NOT_FOUND' } }],
      });

      const mockHttpClient: HttpClient = {
        get: vi.fn(),
        post: postMock,
        put: vi.fn(),
        delete: vi.fn(),
      };

      const service = new BoardService(mockHttpClient);
      await expect(service.updateTask({ taskId: 't-unknown', title: 'New' })).rejects.toMatchObject({
        status: 404,
      });
    });

    it('throws 400 ApiError when input is invalid', async () => {
      const postMock = vi.fn().mockResolvedValue({
        errors: [{ message: 'Title cannot be empty.', extensions: { code: 'BAD_USER_INPUT' } }],
      });

      const mockHttpClient: HttpClient = {
        get: vi.fn(),
        post: postMock,
        put: vi.fn(),
        delete: vi.fn(),
      };

      const service = new BoardService(mockHttpClient);
      await expect(service.updateTask({ taskId: 't-1', title: '' })).rejects.toMatchObject({
        status: 400,
      });
    });
  });

  describe('addTaskDependency', () => {
    it('creates dependency successfully and returns both tasks', async () => {
      const postMock = vi.fn().mockResolvedValue({
        data: {
          addTaskDependency: {
            blockingTask: {
              id: 't-1',
              readableId: 'TES-1',
              number: 1,
              boardId: 'b-1',
              title: 'Build API',
              status: ColumnCategory.InProgress,
              columnId: 'c-1',
              blocks: [{ id: 't-2', readableId: 'TES-2', title: 'Write tests' }],
              blockedBy: [],
            },
            blockedTask: {
              id: 't-2',
              readableId: 'TES-2',
              number: 2,
              boardId: 'b-1',
              title: 'Write tests',
              status: ColumnCategory.ToDo,
              columnId: 'c-2',
              blocks: [],
              blockedBy: [{ id: 't-1', readableId: 'TES-1', title: 'Build API' }],
            },
          },
        },
      });

      const mockHttpClient: HttpClient = {
        get: vi.fn(),
        post: postMock,
        put: vi.fn(),
        delete: vi.fn(),
      };

      const service = new BoardService(mockHttpClient);
      const result = await service.addTaskDependency({
        blockingTaskId: 't-1',
        blockedTaskId: 't-2',
      });

      expect(result.blockingTask.readableId).toBe('TES-1');
      expect(result.blockingTask.blocks).toHaveLength(1);
      expect(result.blockedTask.readableId).toBe('TES-2');
      expect(result.blockedTask.blockedBy).toHaveLength(1);
    });

    it('throws 400 when cycle is detected', async () => {
      const postMock = vi.fn().mockResolvedValue({
        errors: [
          {
            message: "TES-3 can't block TES-1: TES-1 already blocks TES-3, so this would create a cycle.",
            extensions: { code: 'BAD_USER_INPUT' },
          },
        ],
      });

      const mockHttpClient: HttpClient = {
        get: vi.fn(),
        post: postMock,
        put: vi.fn(),
        delete: vi.fn(),
      };

      const service = new BoardService(mockHttpClient);
      await expect(
        service.addTaskDependency({ blockingTaskId: 't-3', blockedTaskId: 't-1' })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('would create a cycle'),
      });
    });

    it('throws 403 when user is not authorized as writer/owner', async () => {
      const postMock = vi.fn().mockResolvedValue({
        errors: [
          {
            message: 'Only writers and owners of the project can add dependencies.',
            extensions: { code: 'AUTH_NOT_AUTHORIZED' },
          },
        ],
      });

      const mockHttpClient: HttpClient = {
        get: vi.fn(),
        post: postMock,
        put: vi.fn(),
        delete: vi.fn(),
      };

      const service = new BoardService(mockHttpClient);
      await expect(
        service.addTaskDependency({ blockingTaskId: 't-1', blockedTaskId: 't-2' })
      ).rejects.toMatchObject({
        status: 403,
      });
    });

    it('throws 404 when a task is not found', async () => {
      const postMock = vi.fn().mockResolvedValue({
        errors: [
          {
            message: "Task 't-missing' was not found.",
            extensions: { code: 'NOT_FOUND' },
          },
        ],
      });

      const mockHttpClient: HttpClient = {
        get: vi.fn(),
        post: postMock,
        put: vi.fn(),
        delete: vi.fn(),
      };

      const service = new BoardService(mockHttpClient);
      await expect(
        service.addTaskDependency({ blockingTaskId: 't-missing', blockedTaskId: 't-2' })
      ).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('searchTasks', () => {
    it('searches backlog tasks by project and search query', async () => {
      const postMock = vi.fn().mockResolvedValue({
        data: {
          backlog: {
            items: [
              {
                id: 't-18',
                readableId: 'TES-18',
                number: 18,
                boardId: 'b-1',
                title: 'Approve project scope',
                status: ColumnCategory.InProgress,
                columnId: 'c-1',
              },
            ],
            totalCount: 1,
          },
        },
      });

      const mockHttpClient: HttpClient = {
        get: vi.fn(),
        post: postMock,
        put: vi.fn(),
        delete: vi.fn(),
      };

      const service = new BoardService(mockHttpClient);
      const results = await service.searchTasks('proj-1', 'Approve');
      expect(results).toHaveLength(1);
      expect(results[0].readableId).toBe('TES-18');
    });
  });
});

