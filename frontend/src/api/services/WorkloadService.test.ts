import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../HttpClient';
import { ApiError } from '../errors';
import { ColumnCategory, ProjectRole, TaskPriority } from '../../domain/models';
import { WorkloadService } from './WorkloadService';

describe('WorkloadService', () => {
  it('calls GraphQL workload query with projectId and maps response sorted by openTaskCount desc', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      data: {
        workload: {
          averageOpenTasks: 2.5,
          members: [
            {
              userId: 'u-1',
              userName: 'Bob Writer',
              role: ProjectRole.Writer,
              openTaskCount: 1,
              openTasks: [
                {
                  id: 't-1',
                  readableId: 'TES-1',
                  number: 1,
                  boardId: 'b-1',
                  title: 'Task 1',
                  status: ColumnCategory.ToDo,
                  priority: TaskPriority.Low,
                },
              ],
            },
            {
              userId: 'u-2',
              userName: 'Alice Owner',
              role: ProjectRole.Owner,
              openTaskCount: 4,
              openTasks: [
                {
                  id: 't-2',
                  readableId: 'TES-2',
                  number: 2,
                  boardId: 'b-1',
                  title: 'Task 2',
                  status: ColumnCategory.InProgress,
                  priority: TaskPriority.High,
                },
              ],
            },
          ],
          unassigned: [
            {
              id: 't-3',
              readableId: 'TES-3',
              number: 3,
              boardId: 'b-1',
              title: 'Unassigned Task',
              status: ColumnCategory.Backlog,
              priority: null,
            },
          ],
        },
      },
    });

    const client: HttpClient = { get: vi.fn(), post: mockPost, put: vi.fn(), delete: vi.fn() };
    const service = new WorkloadService(client);

    const result = await service.getWorkload('proj-123');

    expect(mockPost).toHaveBeenCalledWith('/graphql', {
      query: expect.stringContaining('query Workload'),
      variables: { projectId: 'proj-123' },
    });

    expect(result.averageOpenTasks).toBe(2.5);
    expect(result.totalOpenTasks).toBe(6); // 1 + 4 + 1
    expect(result.unassigned).toHaveLength(1);

    // Verify sorted descending: Alice (4) first, Bob (1) second
    expect(result.members[0].userName).toBe('Alice Owner');
    expect(result.members[0].openTaskCount).toBe(4);
    expect(result.members[1].userName).toBe('Bob Writer');
    expect(result.members[1].openTaskCount).toBe(1);
  });

  it('handles AUTH_NOT_AUTHORIZED error with 403 ApiError', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      errors: [
        {
          message: 'Only the owner of the project can see the workload.',
          extensions: { code: 'AUTH_NOT_AUTHORIZED' },
        },
      ],
    });

    const client: HttpClient = { get: vi.fn(), post: mockPost, put: vi.fn(), delete: vi.fn() };
    const service = new WorkloadService(client);

    await expect(service.getWorkload('proj-123')).rejects.toThrow('Only the owner');
  });

  it('handles NOT_FOUND error with 404 ApiError', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      errors: [
        {
          message: "Project 'proj-missing' was not found.",
          extensions: { code: 'NOT_FOUND' },
        },
      ],
    });

    const client: HttpClient = { get: vi.fn(), post: mockPost, put: vi.fn(), delete: vi.fn() };
    const service = new WorkloadService(client);

    await expect(service.getWorkload('proj-missing')).rejects.toThrow(ApiError);
  });
});
