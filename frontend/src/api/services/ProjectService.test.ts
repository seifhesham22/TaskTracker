import { describe, expect, it, vi } from 'vitest';
import { ProjectService, CREATE_PROJECT_MUTATION, GET_PROJECTS_QUERY } from './ProjectService';
import type { HttpClient } from '../HttpClient';
import type { ProjectSummary } from './AuthService';

describe('ProjectService', () => {
  const mockHttpClient: HttpClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };

  it('aligns createProject mutation with the backend GraphQL API contract', async () => {
    expect(CREATE_PROJECT_MUTATION).toContain('mutation CreateProject($input: CreateProjectInput!)');
    expect(CREATE_PROJECT_MUTATION).toContain('createProject(input: $input)');
    expect(CREATE_PROJECT_MUTATION).toContain('id');
    expect(CREATE_PROJECT_MUTATION).toContain('key');
    expect(CREATE_PROJECT_MUTATION).toContain('name');
    expect(CREATE_PROJECT_MUTATION).toContain('description');
    expect(CREATE_PROJECT_MUTATION).toContain('role');
    expect(CREATE_PROJECT_MUTATION).toContain('boards {');
  });

  it('creates project successfully and returns ProjectSummary with role OWNER', async () => {
    const mockCreated: ProjectSummary = {
      id: 'p-new-1',
      key: 'WEBS',
      name: 'Website redesign',
      description: null,
      role: 'OWNER',
      boards: [{ id: 'b-new-1', name: 'Board' }],
      projectMembers: [{ userName: 'admin@local.test', role: 'OWNER' }],
    };

    const postMock = vi.fn().mockResolvedValue({
      data: { createProject: mockCreated },
    });

    const client: HttpClient = {
      ...mockHttpClient,
      post: postMock,
    };

    const service = new ProjectService(client);
    const result = await service.createProject({ name: '  Website redesign  ' });

    expect(result).toEqual(mockCreated);
    expect(result.role).toBe('OWNER');
    expect(postMock).toHaveBeenCalledWith(
      '/graphql',
      expect.objectContaining({
        query: CREATE_PROJECT_MUTATION,
        variables: {
          input: {
            name: 'Website redesign',
          },
        },
      })
    );
  });

  it('passes optional key and description if provided', async () => {
    const mockCreated: ProjectSummary = {
      id: 'p-new-2',
      key: 'CUSTOM',
      name: 'Custom Project',
      description: 'Project details',
      role: 'OWNER',
      boards: [{ id: 'b-new-2', name: 'Board' }],
    };

    const postMock = vi.fn().mockResolvedValue({
      data: { createProject: mockCreated },
    });

    const client: HttpClient = {
      ...mockHttpClient,
      post: postMock,
    };

    const service = new ProjectService(client);
    const result = await service.createProject({
      name: 'Custom Project',
      key: 'CUSTOM',
      description: 'Project details',
    });

    expect(result).toEqual(mockCreated);
    expect(postMock).toHaveBeenCalledWith(
      '/graphql',
      expect.objectContaining({
        variables: {
          input: {
            name: 'Custom Project',
            key: 'CUSTOM',
            description: 'Project details',
          },
        },
      })
    );
  });

  it('throws ApiError with 400 when backend returns BAD_USER_INPUT', async () => {
    const postMock = vi.fn().mockResolvedValue({
      errors: [
        {
          message: 'Project name cannot be empty or only spaces.',
          extensions: { code: 'BAD_USER_INPUT' },
        },
      ],
    });

    const client: HttpClient = {
      ...mockHttpClient,
      post: postMock,
    };

    const service = new ProjectService(client);
    await expect(service.createProject({ name: '' })).rejects.toMatchObject({
      message: 'Project name cannot be empty or only spaces.',
      status: 400,
    });
  });

  it('throws ApiError with 401 when backend returns AUTH_NOT_AUTHENTICATED', async () => {
    const postMock = vi.fn().mockResolvedValue({
      errors: [
        {
          message: 'The current user is not authorized to access this resource.',
          extensions: { code: 'AUTH_NOT_AUTHENTICATED' },
        },
      ],
    });

    const client: HttpClient = {
      ...mockHttpClient,
      post: postMock,
    };

    const service = new ProjectService(client);
    await expect(service.createProject({ name: 'My Project' })).rejects.toMatchObject({
      status: 401,
    });
  });

  it('retrieves projects for a user via getProjects', async () => {
    const mockProjects: ProjectSummary[] = [
      {
        id: 'p-1',
        key: 'PRJ',
        name: 'Project 1',
        role: 'OWNER',
        boards: [{ id: 'b-1', name: 'Board' }],
      },
    ];

    const postMock = vi.fn().mockResolvedValue({
      data: { projects: mockProjects },
    });

    const client: HttpClient = {
      ...mockHttpClient,
      post: postMock,
    };

    const service = new ProjectService(client);
    const result = await service.getProjects('u-1');

    expect(result).toEqual(mockProjects);
    expect(postMock).toHaveBeenCalledWith(
      '/graphql',
      expect.objectContaining({
        query: GET_PROJECTS_QUERY,
        variables: { userId: 'u-1' },
      })
    );
  });
});
