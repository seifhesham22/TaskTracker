import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../HttpClient';
import { ApiError } from '../errors';
import { BacklogService } from './BacklogService';
import { ColumnCategory, TaskPriority } from '../../domain/models';

describe('BacklogService', () => {
  const mockHttpClient: HttpClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };

  it('builds GraphQL where filter correctly for status and priority combinations', () => {
    const service = new BacklogService(mockHttpClient);

    expect(service.buildFilter()).toBeUndefined();
    expect(service.buildFilter(null, null)).toBeUndefined();

    expect(service.buildFilter(ColumnCategory.ToDo, null)).toEqual({
      status: { eq: ColumnCategory.ToDo },
    });

    expect(service.buildFilter(null, TaskPriority.High)).toEqual({
      priority: { eq: TaskPriority.High },
    });

    expect(service.buildFilter(null, 'NONE')).toEqual({
      priority: { eq: null },
    });

    expect(service.buildFilter(ColumnCategory.InProgress, TaskPriority.Critical)).toEqual({
      status: { eq: ColumnCategory.InProgress },
      priority: { eq: TaskPriority.Critical },
    });

    expect(service.buildFilter(ColumnCategory.Backlog, 'NONE')).toEqual({
      status: { eq: ColumnCategory.Backlog },
      priority: { eq: null },
    });
  });

  it('calls GraphQL backlog query with correct variables and maps response', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      data: {
        backlog: {
          items: [
            {
              id: 'task-1',
              readableId: 'TES-31',
              number: 31,
              boardId: 'board-1',
              title: 'Prepare the launch checklist',
              description: 'Detailed steps',
              status: ColumnCategory.ToDo,
              column: { id: 'col-1', name: 'To Do', category: ColumnCategory.ToDo },
              priority: TaskPriority.High,
              assignees: [{ id: 'user-1', userName: 'Alice' }],
              blocks: [{ readableId: 'TES-32' }],
              blockedBy: [],
              position: '0|hzzzzz:',
              parentTaskId: null,
            },
          ],
          totalCount: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    });

    const client: HttpClient = { get: vi.fn(), post: mockPost, put: vi.fn(), delete: vi.fn() };
    const service = new BacklogService(client);

    const result = await service.getBacklog({
      projectId: 'proj-123',
      search: '  launch  ',
      where: { status: { eq: ColumnCategory.ToDo } },
      page: 1,
      pageSize: 20,
    });

    expect(mockPost).toHaveBeenCalledWith('/graphql', {
      query: expect.stringContaining('query Backlog'),
      variables: {
        projectId: 'proj-123',
        search: 'launch',
        where: { status: { eq: ColumnCategory.ToDo } },
        page: 1,
        pageSize: 20,
      },
    });

    expect(result.totalCount).toBe(1);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      id: 'task-1',
      readableId: 'TES-31',
      number: 31,
      boardId: 'board-1',
      title: 'Prepare the launch checklist',
      description: 'Detailed steps',
      status: ColumnCategory.ToDo,
      column: { id: 'col-1', name: 'To Do', category: ColumnCategory.ToDo },
      priority: TaskPriority.High,
      assignees: [{ id: 'user-1', userName: 'Alice' }],
      blocks: [{ readableId: 'TES-32' }],
      blockedBy: [],
      position: '0|hzzzzz:',
      parentTaskId: null,
    });
  });

  it('handles NOT_FOUND GraphQL error with 404 status', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      errors: [
        {
          message: "Project '01a1...' was not found.",
          extensions: { code: 'NOT_FOUND' },
        },
      ],
    });

    const client: HttpClient = { get: vi.fn(), post: mockPost, put: vi.fn(), delete: vi.fn() };
    const service = new BacklogService(client);

    await expect(
      service.getBacklog({ projectId: '01a1-missing' })
    ).rejects.toThrow(ApiError);
  });

  it('handles AUTH_NOT_AUTHENTICATED error with 401 status', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      errors: [
        {
          message: 'The current user is not authorized.',
          extensions: { code: 'AUTH_NOT_AUTHENTICATED' },
        },
      ],
    });

    const client: HttpClient = { get: vi.fn(), post: mockPost, put: vi.fn(), delete: vi.fn() };
    const service = new BacklogService(client);

    await expect(
      service.getBacklog({ projectId: 'proj-1' })
    ).rejects.toThrow(ApiError);
  });
});
