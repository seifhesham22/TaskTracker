import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../HttpClient';
import { ProjectRole } from '../../domain/models';
import {
  ADD_PROJECT_MEMBER_MUTATION,
  GET_PROJECT_DETAILS_QUERY,
  ProjectMemberService,
  REMOVE_PROJECT_MEMBER_MUTATION,
} from './ProjectMemberService';

describe('ProjectMemberService', () => {
  const createMockClient = (postResult: unknown) => {
    return {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue(postResult),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as HttpClient;
  };

  it('fetches project details and its members', async () => {
    const mockProject = {
      id: 'proj-1',
      key: 'PRJ',
      name: 'Website redesign',
      description: 'Main project',
      role: 'OWNER',
      boards: [{ id: 'b-1', name: 'Board 1' }],
      projectMembers: [
        {
          projectId: 'proj-1',
          userId: 'u-1',
          userName: 'Dombele',
          role: ProjectRole.Owner,
          joinedAt: '2026-11-20T10:00:00Z',
        },
      ],
    };

    const mockClient = createMockClient({
      data: { projects: [mockProject] },
    });

    const service = new ProjectMemberService(mockClient);
    const result = await service.getProjectDetails('proj-1', 'u-1');

    expect(mockClient.post).toHaveBeenCalledWith('/graphql', {
      query: GET_PROJECT_DETAILS_QUERY,
      variables: { userId: 'u-1' },
    });
    expect(result).toEqual(mockProject);
  });

  it('throws 404 when project not found in getProjectDetails', async () => {
    const mockClient = createMockClient({
      data: { projects: [] },
    });

    const service = new ProjectMemberService(mockClient);
    await expect(service.getProjectDetails('proj-99')).rejects.toThrow(
      "Project 'proj-99' was not found."
    );
  });

  it('adds a project member successfully', async () => {
    const createdMember = {
      projectId: 'proj-1',
      userId: 'u-2',
      userName: 'Mina',
      role: ProjectRole.Writer,
      joinedAt: '2026-11-24T12:00:00Z',
    };

    const mockClient = createMockClient({
      data: { addProjectMember: createdMember },
    });

    const service = new ProjectMemberService(mockClient);
    const result = await service.addProjectMember({
      projectId: 'proj-1',
      email: 'mina@example.com',
      role: ProjectRole.Writer,
    });

    expect(mockClient.post).toHaveBeenCalledWith('/graphql', {
      query: ADD_PROJECT_MEMBER_MUTATION,
      variables: {
        input: {
          projectId: 'proj-1',
          email: 'mina@example.com',
          role: ProjectRole.Writer,
        },
      },
    });
    expect(result).toEqual(createdMember);
  });

  it('handles backend error when adding member (e.g. duplicate or not found)', async () => {
    const mockClient = createMockClient({
      errors: [
        {
          message: 'Mina is already a project member. Choose another account.',
          extensions: { code: 'BAD_USER_INPUT' },
        },
      ],
    });

    const service = new ProjectMemberService(mockClient);
    await expect(
      service.addProjectMember({
        projectId: 'proj-1',
        email: 'mina@example.com',
        role: ProjectRole.Writer,
      })
    ).rejects.toThrow('Mina is already a project member. Choose another account.');
  });

  it('removes a project member successfully', async () => {
    const removedMember = {
      projectId: 'proj-1',
      userId: 'u-2',
      userName: 'Mina',
      role: ProjectRole.Writer,
      joinedAt: '2026-11-24T12:00:00Z',
    };

    const mockClient = createMockClient({
      data: { removeProjectMember: removedMember },
    });

    const service = new ProjectMemberService(mockClient);
    const result = await service.removeProjectMember('proj-1', 'u-2');

    expect(mockClient.post).toHaveBeenCalledWith('/graphql', {
      query: REMOVE_PROJECT_MEMBER_MUTATION,
      variables: {
        input: { projectId: 'proj-1', userId: 'u-2' },
      },
    });
    expect(result).toEqual(removedMember);
  });

  it('handles last owner removal error from backend', async () => {
    const mockClient = createMockClient({
      errors: [
        {
          message: "You can't remove the last Owner.",
          extensions: { code: 'BAD_USER_INPUT' },
        },
      ],
    });

    const service = new ProjectMemberService(mockClient);
    await expect(service.removeProjectMember('proj-1', 'u-1')).rejects.toThrow(
      "You can't remove the last Owner."
    );
  });
});
